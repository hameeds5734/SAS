const express = require('express');
const router = express.Router();
const db = require('../db');

// Bill report: returns bills with their line items + customer's overall current balance.
// Filters: from_date, to_date, place_ids (csv), customer_id
router.get('/', async (req, res) => {
  const { from_date, to_date, customer_id, customer_ids, place_ids, place_id } = req.query;

  let sql = `
    SELECT
      b.id,
      DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date,
      (SELECT COUNT(*) FROM bills b2 WHERE b2.bill_date = b.bill_date AND b2.id <= b.id) AS daily_no,
      b.customer_id,
      c.name AS customer_name,
      c.place_id,
      p.name AS place_name,
      b.total_amount,
      b.paid_amount,
      b.balance,
      b.notes
    FROM bills b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN places p ON c.place_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (from_date) { sql += ' AND b.bill_date >= ?'; params.push(from_date); }
  if (to_date) { sql += ' AND b.bill_date <= ?'; params.push(to_date); }

  // Multi-customer filter (csv) takes precedence; fall back to single customer_id for compat.
  const customerIdList = (customer_ids ? String(customer_ids).split(',') : customer_id ? [customer_id] : [])
    .map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
  if (customerIdList.length > 0) {
    sql += ` AND b.customer_id IN (${customerIdList.map(() => '?').join(',')})`;
    params.push(...customerIdList);
  }

  // Multi-place filter (csv) takes precedence; fall back to single place_id for compat.
  const placeIdList = (place_ids ? String(place_ids).split(',') : place_id ? [place_id] : [])
    .map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
  if (placeIdList.length > 0) {
    sql += ` AND c.place_id IN (${placeIdList.map(() => '?').join(',')})`;
    params.push(...placeIdList);
  }

  sql += ' ORDER BY b.bill_date DESC, b.id DESC';

  try {
    const [bills] = await db.execute(sql, params);
    if (bills.length === 0) return res.json([]);

    const billIds = bills.map(b => b.id);
    const billPh = billIds.map(() => '?').join(',');
    const [items] = await db.execute(
      `SELECT bi.bill_id, bi.product_name, bi.quantity, bi.rate, bi.amount
       FROM bill_items bi WHERE bi.bill_id IN (${billPh})
       ORDER BY bi.id ASC`,
      billIds
    );

    const customerIds = [...new Set(bills.map(b => b.customer_id))];
    const custPh = customerIds.map(() => '?').join(',');
    const [custBalances] = await db.execute(
      `SELECT customer_id, COALESCE(SUM(balance), 0) AS current_balance
       FROM bills WHERE customer_id IN (${custPh})
       GROUP BY customer_id`,
      customerIds
    );
    const balanceMap = Object.fromEntries(custBalances.map(r => [r.customer_id, parseFloat(r.current_balance || 0)]));

    const result = bills.map(bill => {
      const billItems = items.filter(i => i.bill_id === bill.id);
      const total_qty = billItems.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
      return {
        ...bill,
        items: billItems,
        total_qty,
        customer_current_balance: balanceMap[bill.customer_id] || 0,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Day-wise customer balance: bills aggregated per (date, customer), ordered date desc / place / customer.
router.get('/daywise-balance', async (req, res) => {
  const { from_date, to_date, place_ids, customer_ids } = req.query;

  let sql = `
    SELECT
      DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date,
      c.id   AS customer_id,
      c.name AS customer_name,
      c.phone,
      p.id   AS place_id,
      p.name AS place_name,
      SUM(b.total_amount) AS billed,
      SUM(b.paid_amount)  AS paid,
      SUM(b.balance)      AS balance
    FROM bills b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN places p ON c.place_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (from_date) { sql += ' AND b.bill_date >= ?'; params.push(from_date); }
  if (to_date)   { sql += ' AND b.bill_date <= ?'; params.push(to_date); }

  const parseIds = (s) => String(s || '').split(',').map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));

  const placeList = parseIds(place_ids);
  if (placeList.length > 0) {
    sql += ` AND c.place_id IN (${placeList.map(() => '?').join(',')})`;
    params.push(...placeList);
  }

  const custList = parseIds(customer_ids);
  if (custList.length > 0) {
    sql += ` AND c.id IN (${custList.map(() => '?').join(',')})`;
    params.push(...custList);
  }

  sql += ' GROUP BY b.bill_date, c.id ORDER BY b.bill_date DESC, p.name, c.name';

  try {
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer statement (Tamil-style ledger): opening balance + per-date sale/paid + closing balance.
// When detail=1, each entry also includes its bill items so the UI can expand sales.
router.get('/customer-statement', async (req, res) => {
  const { customer_id, from_date, to_date, detail } = req.query;
  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  const wantsDetail = detail === '1' || detail === 'true';

  try {
    const [[customer]] = await db.execute(
      `SELECT c.id, c.name, c.phone, p.name AS place_name
       FROM customers c LEFT JOIN places p ON c.place_id = p.id
       WHERE c.id = ?`,
      [customer_id]
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Opening balance (everything dated strictly before from_date)
    let opening_balance = 0;
    if (from_date) {
      const [[ob]] = await db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) AS s FROM bills WHERE customer_id = ? AND bill_date < ?`,
        [customer_id, from_date]
      );
      const [[op]] = await db.execute(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE customer_id = ? AND payment_date < ?`,
        [customer_id, from_date]
      );
      opening_balance = parseFloat(ob.s) - parseFloat(op.s);
    }

    // Bills in range — individual rows so we can attach items when detail is on
    const billsSqlParts = [`SELECT id, DATE_FORMAT(bill_date,'%Y-%m-%d') AS date, total_amount
                            FROM bills WHERE customer_id = ?`];
    const billsParams = [customer_id];
    if (from_date) { billsSqlParts.push('AND bill_date >= ?'); billsParams.push(from_date); }
    if (to_date)   { billsSqlParts.push('AND bill_date <= ?'); billsParams.push(to_date); }
    billsSqlParts.push('ORDER BY bill_date ASC, id ASC');
    const [billsRaw] = await db.execute(billsSqlParts.join(' '), billsParams);

    let itemsByBillId = {};
    if (wantsDetail && billsRaw.length > 0) {
      const ids = billsRaw.map(b => b.id);
      const ph = ids.map(() => '?').join(',');
      const [its] = await db.execute(
        `SELECT bi.bill_id, bi.product_name, bi.quantity, bi.rate, bi.amount
         FROM bill_items bi WHERE bi.bill_id IN (${ph}) ORDER BY bi.id ASC`,
        ids
      );
      its.forEach(it => {
        if (!itemsByBillId[it.bill_id]) itemsByBillId[it.bill_id] = [];
        itemsByBillId[it.bill_id].push(it);
      });
    }

    const paySqlParts = [`SELECT DATE_FORMAT(payment_date,'%Y-%m-%d') AS date, COALESCE(SUM(amount),0) AS paid
                          FROM payments WHERE customer_id = ?`];
    const payParams = [customer_id];
    if (from_date) { paySqlParts.push('AND payment_date >= ?'); payParams.push(from_date); }
    if (to_date)   { paySqlParts.push('AND payment_date <= ?'); payParams.push(to_date); }
    paySqlParts.push('GROUP BY payment_date');
    const [pays] = await db.execute(paySqlParts.join(' '), payParams);

    const map = new Map();
    billsRaw.forEach(b => {
      if (!map.has(b.date)) map.set(b.date, { date: b.date, sale: 0, paid: 0, items: [] });
      const entry = map.get(b.date);
      entry.sale += parseFloat(b.total_amount || 0);
      if (wantsDetail) {
        const its = itemsByBillId[b.id] || [];
        entry.items.push(...its);
      }
    });
    pays.forEach(p => {
      if (!map.has(p.date)) map.set(p.date, { date: p.date, sale: 0, paid: 0, items: [] });
      map.get(p.date).paid = parseFloat(p.paid) || 0;
    });
    const entries = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

    const total_sale = entries.reduce((s, e) => s + e.sale, 0);
    const total_paid = entries.reduce((s, e) => s + e.paid, 0);
    const closing_balance = opening_balance + total_sale - total_paid;

    res.json({ customer, opening_balance, entries, total_sale, total_paid, closing_balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily sale: per (date, customer) — items, payments, opening / closing balance.
router.get('/daily-sale', async (req, res) => {
  const { from_date, to_date, place_ids, customer_ids } = req.query;
  const parseIds = (s) => String(s || '').split(',').map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
  const placeIds = parseIds(place_ids);
  const custIds = parseIds(customer_ids);

  try {
    // 1. Bills in range — include daily_no (per-day sequence; computed against ALL bills, not filtered)
    let billsSql = `
      SELECT b.id, DATE_FORMAT(b.bill_date,'%Y-%m-%d') AS date, b.customer_id,
             c.name AS customer_name, p.name AS place_name, b.total_amount,
             (SELECT COUNT(*) FROM bills b2 WHERE b2.bill_date = b.bill_date AND b2.id <= b.id) AS daily_no
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      LEFT JOIN places p ON c.place_id = p.id
      WHERE 1=1
    `;
    const bp = [];
    if (from_date) { billsSql += ' AND b.bill_date >= ?'; bp.push(from_date); }
    if (to_date)   { billsSql += ' AND b.bill_date <= ?'; bp.push(to_date); }
    if (custIds.length)  { billsSql += ` AND b.customer_id IN (${custIds.map(() => '?').join(',')})`; bp.push(...custIds); }
    if (placeIds.length) { billsSql += ` AND c.place_id IN (${placeIds.map(() => '?').join(',')})`; bp.push(...placeIds); }
    billsSql += ' ORDER BY b.bill_date ASC, b.id ASC';
    const [bills] = await db.execute(billsSql, bp);

    // 2. Items for those bills
    let items = [];
    if (bills.length > 0) {
      const billIds = bills.map(b => b.id);
      const ph = billIds.map(() => '?').join(',');
      const [r] = await db.execute(
        `SELECT bi.bill_id, bi.product_name, bi.quantity, bi.rate, bi.amount
         FROM bill_items bi WHERE bi.bill_id IN (${ph}) ORDER BY bi.id ASC`,
        billIds
      );
      items = r;
    }

    // 3. Payments in range, grouped per (date, customer)
    let paySql = `
      SELECT DATE_FORMAT(py.payment_date,'%Y-%m-%d') AS date, py.customer_id,
             COALESCE(SUM(py.amount),0) AS amount
      FROM payments py
      JOIN customers c ON py.customer_id = c.id
      WHERE 1=1
    `;
    const pp = [];
    if (from_date) { paySql += ' AND py.payment_date >= ?'; pp.push(from_date); }
    if (to_date)   { paySql += ' AND py.payment_date <= ?'; pp.push(to_date); }
    if (custIds.length)  { paySql += ` AND py.customer_id IN (${custIds.map(() => '?').join(',')})`; pp.push(...custIds); }
    if (placeIds.length) { paySql += ` AND c.place_id IN (${placeIds.map(() => '?').join(',')})`; pp.push(...placeIds); }
    paySql += ' GROUP BY py.payment_date, py.customer_id';
    const [pays] = await db.execute(paySql, pp);

    // 4. Customer info for entries that may only have payments (no bills that day)
    const allCustIdsSet = new Set();
    bills.forEach(b => allCustIdsSet.add(b.customer_id));
    pays.forEach(p => allCustIdsSet.add(p.customer_id));
    const allCustIds = [...allCustIdsSet];
    let customerInfo = {};
    if (allCustIds.length > 0) {
      const ph = allCustIds.map(() => '?').join(',');
      const [custs] = await db.execute(
        `SELECT c.id, c.name, p.name AS place_name FROM customers c
         LEFT JOIN places p ON c.place_id = p.id
         WHERE c.id IN (${ph})`,
        allCustIds
      );
      customerInfo = Object.fromEntries(custs.map(c => [c.id, c]));
    }

    // 5. Build (date, customer) → entry map
    const map = new Map();
    for (const bill of bills) {
      const key = `${bill.date}|${bill.customer_id}`;
      if (!map.has(key)) {
        map.set(key, {
          date: bill.date, customer_id: bill.customer_id,
          customer_name: bill.customer_name, place_name: bill.place_name,
          items: [], paid: 0, total_sale: 0, total_qty: 0, bill_numbers: [],
        });
      }
      const entry = map.get(key);
      const billItems = items.filter(i => i.bill_id === bill.id);
      entry.items.push(...billItems);
      entry.total_sale += parseFloat(bill.total_amount || 0);
      entry.total_qty += billItems.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
      entry.bill_numbers.push(parseInt(bill.daily_no, 10));
    }
    for (const pay of pays) {
      const key = `${pay.date}|${pay.customer_id}`;
      if (!map.has(key)) {
        const c = customerInfo[pay.customer_id];
        if (!c) continue;
        map.set(key, {
          date: pay.date, customer_id: pay.customer_id,
          customer_name: c.name, place_name: c.place_name,
          items: [], paid: 0, total_sale: 0, total_qty: 0, bill_numbers: [],
        });
      }
      map.get(key).paid = parseFloat(pay.amount || 0);
    }

    // 6. Opening balances (per entry; one query each — fine for small ranges)
    for (const entry of map.values()) {
      const [[ob]] = await db.execute(
        `SELECT COALESCE(SUM(total_amount),0) AS s FROM bills WHERE customer_id=? AND bill_date < ?`,
        [entry.customer_id, entry.date]
      );
      const [[op]] = await db.execute(
        `SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE customer_id=? AND payment_date < ?`,
        [entry.customer_id, entry.date]
      );
      entry.opening_balance = parseFloat(ob.s) - parseFloat(op.s);
      entry.total_billed = entry.opening_balance + entry.total_sale;
      entry.closing_balance = entry.total_billed - entry.paid;
    }

    // Only keep entries that actually have a sale that day; payment-only days are excluded.
    const result = [...map.values()]
      .filter(e => e.total_sale > 0)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.customer_name.localeCompare(b.customer_name));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments report: per (date, customer) payment amounts, ordered by date desc → place → customer.
router.get('/payments-report', async (req, res) => {
  const { from_date, to_date, place_ids, customer_ids } = req.query;
  const parseIds = (s) => String(s || '').split(',').map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
  const placeIds = parseIds(place_ids);
  const custIds = parseIds(customer_ids);

  let sql = `
    SELECT
      DATE_FORMAT(py.payment_date,'%Y-%m-%d') AS bill_date,
      c.id   AS customer_id,
      c.name AS customer_name,
      c.phone,
      p.id   AS place_id,
      p.name AS place_name,
      COALESCE(SUM(py.amount), 0) AS paid
    FROM payments py
    JOIN customers c ON py.customer_id = c.id
    LEFT JOIN places p ON c.place_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (from_date) { sql += ' AND py.payment_date >= ?'; params.push(from_date); }
  if (to_date)   { sql += ' AND py.payment_date <= ?'; params.push(to_date); }
  if (placeIds.length) {
    sql += ` AND c.place_id IN (${placeIds.map(() => '?').join(',')})`;
    params.push(...placeIds);
  }
  if (custIds.length) {
    sql += ` AND c.id IN (${custIds.map(() => '?').join(',')})`;
    params.push(...custIds);
  }
  sql += ' GROUP BY py.payment_date, c.id ORDER BY py.payment_date DESC, p.name, c.name';

  try {
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product sale: bill_items grouped by base product, optionally filtered by date and base_product_ids.
// Returns one row per bill_item (frontend groups + aggregates) so both summary and detail are served from one call.
router.get('/product-sale', async (req, res) => {
  const { from_date, to_date, base_product_ids } = req.query;
  const parseIds = (s) => String(s || '').split(',').map(x => parseInt(x, 10)).filter(n => !Number.isNaN(n));
  const ids = parseIds(base_product_ids);

  let sql = `
    SELECT
      COALESCE(bp.id, 0) AS base_product_id,
      COALESCE(bp.name, SUBSTRING_INDEX(bi.product_name, ' - ', 1)) AS base_product,
      bi.product_name AS product_name,
      bi.quantity, bi.rate, bi.amount,
      b.id AS bill_id,
      DATE_FORMAT(b.bill_date, '%Y-%m-%d') AS bill_date,
      c.id AS customer_id, c.name AS customer_name,
      p.name AS place_name
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN places p ON c.place_id = p.id
    LEFT JOIN products pr ON bi.product_id = pr.id
    LEFT JOIN base_products bp ON pr.base_product_id = bp.id
    WHERE 1=1
  `;
  const params = [];
  if (from_date) { sql += ' AND b.bill_date >= ?'; params.push(from_date); }
  if (to_date)   { sql += ' AND b.bill_date <= ?'; params.push(to_date); }
  if (ids.length > 0) {
    sql += ` AND bp.id IN (${ids.map(() => '?').join(',')})`;
    params.push(...ids);
  }
  sql += ' ORDER BY base_product, b.bill_date, c.name, bi.id';

  try {
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer outstanding balance summary
router.get('/customer-balance', async (req, res) => {
  const { place_id } = req.query;
  let sql = `
    SELECT
      c.id,
      c.name AS customer_name,
      c.phone,
      p.name AS place_name,
      COALESCE(SUM(b.total_amount), 0) AS total_billed,
      COALESCE(SUM(b.paid_amount), 0) AS total_paid,
      COALESCE(SUM(b.balance), 0) AS outstanding_balance
    FROM customers c
    LEFT JOIN places p ON c.place_id = p.id
    LEFT JOIN bills b ON c.id = b.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (place_id) { sql += ' AND c.place_id = ?'; params.push(place_id); }
  sql += ' GROUP BY c.id ORDER BY c.name';

  try {
    const [rows] = await db.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
