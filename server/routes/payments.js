const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT py.*, c.name AS customer_name
      FROM payments py
      JOIN customers c ON py.customer_id = c.id
      ORDER BY py.payment_date DESC, py.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customer/:customerId', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { customer_id, amount, payment_date, notes } = req.body;
  if (!customer_id || !amount) return res.status(400).json({ error: 'Customer and amount required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      'INSERT INTO payments (customer_id, amount, payment_date, notes) VALUES (?, ?, ?, ?)',
      [customer_id, parseFloat(amount), payment_date, notes || null]
    );

    // Update paid_amount and balance on all unpaid bills for this customer (FIFO)
    const [unpaidBills] = await conn.execute(
      'SELECT id, balance FROM bills WHERE customer_id = ? AND balance > 0 ORDER BY bill_date ASC, id ASC',
      [customer_id]
    );

    let remaining = parseFloat(amount);
    for (const bill of unpaidBills) {
      if (remaining <= 0) break;
      const billBalance = parseFloat(bill.balance);
      const apply = Math.min(remaining, billBalance);
      await conn.execute(
        'UPDATE bills SET paid_amount = paid_amount + ?, balance = balance - ? WHERE id = ?',
        [apply, apply, bill.id]
      );
      remaining -= apply;
    }

    await conn.commit();
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const { amount, payment_date } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[payment]] = await conn.execute('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) { await conn.rollback(); return res.status(404).json({ error: 'Not found' }); }

    await conn.execute(
      'UPDATE payments SET amount = ?, payment_date = ? WHERE id = ?',
      [parseFloat(amount), payment_date || payment.payment_date, req.params.id]
    );

    const custId = payment.customer_id;

    // Reset all bill balances for this customer, then re-apply all payments FIFO
    await conn.execute('UPDATE bills SET paid_amount = 0, balance = total_amount WHERE customer_id = ?', [custId]);

    const [allPmts] = await conn.execute(
      'SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date ASC, id ASC', [custId]
    );
    for (const pmt of allPmts) {
      let remaining = parseFloat(pmt.amount);
      const [unpaid] = await conn.execute(
        'SELECT id, balance FROM bills WHERE customer_id = ? AND balance > 0 ORDER BY bill_date ASC, id ASC', [custId]
      );
      for (const bill of unpaid) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, parseFloat(bill.balance));
        await conn.execute(
          'UPDATE bills SET paid_amount = paid_amount + ?, balance = balance - ? WHERE id = ?',
          [apply, apply, bill.id]
        );
        remaining -= apply;
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM payments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
