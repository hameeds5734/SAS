const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM places ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const trimmed = name.trim();
  try {
    const [dup] = await db.execute('SELECT id FROM places WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (dup.length) return res.status(409).json({ error: `Place "${trimmed}" already exists` });
    const [result] = await db.execute('INSERT INTO places (name) VALUES (?)', [trimmed]);
    res.json({ id: result.insertId, name: trimmed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const trimmed = name.trim();
  try {
    const [dup] = await db.execute(
      'SELECT id FROM places WHERE LOWER(name) = LOWER(?) AND id != ?',
      [trimmed, req.params.id]
    );
    if (dup.length) return res.status(409).json({ error: `Place "${trimmed}" already exists` });
    await db.execute('UPDATE places SET name = ? WHERE id = ?', [trimmed, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM places WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
