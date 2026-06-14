const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.id, p.base_product_id, bp.name AS base_product,
             p.sub_product, p.price, p.created_at
      FROM products p
      JOIN base_products bp ON p.base_product_id = bp.id
      ORDER BY bp.name, p.sub_product
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { base_product_id, sub_product, price } = req.body;
  if (!base_product_id) return res.status(400).json({ error: 'Base product is required' });
  const sub = sub_product && sub_product.trim() ? sub_product.trim() : null;
  try {
    const [dup] = await db.execute(
      `SELECT id FROM products
       WHERE base_product_id = ?
         AND COALESCE(LOWER(sub_product), '') = COALESCE(LOWER(?), '')`,
      [base_product_id, sub]
    );
    if (dup.length) {
      return res.status(409).json({ error: 'This product variant already exists under the selected base product' });
    }
    const [result] = await db.execute(
      'INSERT INTO products (base_product_id, sub_product, price) VALUES (?, ?, ?)',
      [base_product_id, sub, parseFloat(price) || 0]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { base_product_id, sub_product, price } = req.body;
  if (!base_product_id) return res.status(400).json({ error: 'Base product is required' });
  const sub = sub_product && sub_product.trim() ? sub_product.trim() : null;
  try {
    const [dup] = await db.execute(
      `SELECT id FROM products
       WHERE base_product_id = ?
         AND COALESCE(LOWER(sub_product), '') = COALESCE(LOWER(?), '')
         AND id != ?`,
      [base_product_id, sub, req.params.id]
    );
    if (dup.length) {
      return res.status(409).json({ error: 'This product variant already exists under the selected base product' });
    }
    await db.execute(
      'UPDATE products SET base_product_id = ?, sub_product = ?, price = ? WHERE id = ?',
      [base_product_id, sub, parseFloat(price) || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
