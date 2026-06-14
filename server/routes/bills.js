const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT b.id, b.bill_date, b.total_amount, b.paid_amount, b.balance, b.notes, b.created_at,
             c.name AS customer_name, c.id AS customer_id,
             p.name AS place_name
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN places p ON c.place_id = p.id
      ORDER BY b.bill_date DESC, b.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-customer/:customerId', async (req, res) => {
  try {
    const [bills] = await db.execute(
      `SELECT b.id, b.bill_date, b.total_amount, b.paid_amount, b.balance, b.notes,
              (SELECT COUNT(*) FROM bills b2 WHERE b2.bill_date = b.bill_date AND b2.id <= b.id) AS daily_no
       FROM bills b WHERE b.customer_id = ?
       ORDER BY b.bill_date DESC, b.id DESC`,
      [req.params.customerId]
    );
    if (bills.length === 0) return res.json([]);

    const placeholders = bills.map(() => '?').join(',');
    const [items] = await db.execute(
      `SELECT bi.bill_id, bi.product_name, bi.quantity, bi.rate, bi.amount
       FROM bill_items bi WHERE bi.bill_id IN (${placeholders})
       ORDER BY bi.id ASC`,
      bills.map(b => b.id)
    );

    const result = bills.map(bill => ({
      ...bill,
      items: items.filter(i => i.bill_id === bill.id),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[bill]] = await db.execute(`
      SELECT b.*, c.name AS customer_name, p.name AS place_name
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN places p ON c.place_id = p.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const [items] = await db.execute(`
      SELECT bi.*, pr.base_product, pr.sub_product
      FROM bill_items bi
      LEFT JOIN products pr ON bi.product_id = pr.id
      WHERE bi.bill_id = ?
    `, [req.params.id]);

    res.json({ ...bill, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { bill_date, customer_id, total_amount, paid_amount, notes, items } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });

  const totalAmt = parseFloat(total_amount) || 0;
  const paidAmt = parseFloat(paid_amount) || 0;
  const balance = totalAmt - paidAmt;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      'INSERT INTO bills (bill_date, customer_id, total_amount, paid_amount, balance, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [bill_date, customer_id, totalAmt, paidAmt, balance, notes || null]
    );
    const billId = result.insertId;

    for (const item of (items || [])) {
      if (!item.product_name && !item.amount) continue;
      await conn.execute(
        'INSERT INTO bill_items (bill_id, product_id, product_name, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?)',
        [billId, item.product_id || null, item.product_name || '', parseFloat(item.quantity) || 1, parseFloat(item.rate) || 0, parseFloat(item.amount) || 0]
      );
    }

    await conn.commit();
    res.json({ id: billId, success: true });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/:id', async (req, res) => {
  const { bill_date, customer_id, total_amount, paid_amount, notes, items } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'Customer is required' });

  const totalAmt = parseFloat(total_amount) || 0;
  const paidAmt = parseFloat(paid_amount) || 0;
  const balance = totalAmt - paidAmt;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE bills SET bill_date=?, customer_id=?, total_amount=?, paid_amount=?, balance=?, notes=? WHERE id=?',
      [bill_date, customer_id, totalAmt, paidAmt, balance, notes || null, req.params.id]
    );

    await conn.execute('DELETE FROM bill_items WHERE bill_id = ?', [req.params.id]);

    for (const item of (items || [])) {
      if (!item.product_name && !item.amount) continue;
      await conn.execute(
        'INSERT INTO bill_items (bill_id, product_id, product_name, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.id, item.product_id || null, item.product_name || '', parseFloat(item.quantity) || 1, parseFloat(item.rate) || 0, parseFloat(item.amount) || 0]
      );
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
    await db.execute('DELETE FROM bills WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
