const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c.id, c.name, c.place_id, c.phone, c.created_at,
             p.name AS place_name
      FROM customers c
      LEFT JOIN places p ON c.place_id = p.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, place_id, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [dup] = await db.execute('SELECT id FROM customers WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    if (dup.length > 0) return res.status(409).json({ error: `Customer "${name.trim()}" already exists` });
    const [result] = await db.execute(
      'INSERT INTO customers (name, place_id, phone) VALUES (?, ?, ?)',
      [name.trim(), place_id || null, phone || null]
    );
    res.json({ id: result.insertId, name: name.trim(), place_id, phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, place_id, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [dup] = await db.execute('SELECT id FROM customers WHERE LOWER(name) = LOWER(?) AND id != ?', [name.trim(), req.params.id]);
    if (dup.length > 0) return res.status(409).json({ error: `Customer "${name.trim()}" already exists` });
    await db.execute(
      'UPDATE customers SET name = ?, place_id = ?, phone = ? WHERE id = ?',
      [name.trim(), place_id || null, phone || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
