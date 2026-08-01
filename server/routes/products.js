const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// 1. Get Products (with Search and Filters)
router.get('/', verifyToken, async (req, res) => {
  const { search, category, lowStock } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR barcode LIKE ? OR sku LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (lowStock === 'true') {
    sql += ' AND stock <= low_stock_threshold';
  }

  sql += ' ORDER BY name ASC';

  try {
    const products = await query.all(sql, params);
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// Helper for unique categories list
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const rows = await query.all('SELECT DISTINCT category FROM products ORDER BY category ASC');
    const categories = rows.map(r => r.category);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// 2. Scan Barcode / SKU (Instant Lookup)
router.get('/scan/:code', verifyToken, async (req, res) => {
  const { code } = req.params;
  try {
    const product = await query.get(
      'SELECT * FROM products WHERE barcode = ? OR sku = ?',
      [code, code]
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found with barcode or SKU.' });
    }

    res.json(product);
  } catch (error) {
    console.error('Scan lookup error:', error);
    res.status(500).json({ error: 'Failed to scan product.' });
  }
});

// 3. Create Product (Admin & Manager)
router.post('/', verifyToken, requireRole(['Admin', 'Warehouse Manager']), async (req, res) => {
  const { name, barcode, sku, category, price, unit, weight_or_count_type, stock, low_stock_threshold } = req.body;

  if (!name || !barcode || !sku || !category || price === undefined || !unit || !weight_or_count_type) {
    return res.status(400).json({ error: 'Please provide all required product details.' });
  }

  try {
    // Check barcode/sku uniqueness
    const existing = await query.get('SELECT id FROM products WHERE barcode = ? OR sku = ?', [barcode, sku]);
    if (existing) {
      return res.status(400).json({ error: 'Product with this barcode or SKU already exists.' });
    }

    const currentStock = stock !== undefined ? parseFloat(stock) : 0;
    const threshold = low_stock_threshold !== undefined ? parseFloat(low_stock_threshold) : 10;

    const result = await query.run(
      `INSERT INTO products (name, barcode, sku, category, price, unit, weight_or_count_type, stock, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, barcode, sku, category, parseFloat(price), unit, weight_or_count_type, currentStock, threshold]
    );

    // Log inventory transaction for initial stock if > 0
    if (currentStock > 0) {
      await query.run(
        `INSERT INTO inventory_transactions (product_id, employee_id, transaction_type, quantity, previous_stock, new_stock, notes)
         VALUES (?, ?, 'restock', ?, 0, ?, 'Initial inventory addition')`,
        [result.id, req.user.id, currentStock, currentStock]
      );
    }

    const createdProduct = await query.get('SELECT * FROM products WHERE id = ?', [result.id]);
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// 4. Update Product Info (Admin & Manager)
router.put('/:id', verifyToken, requireRole(['Admin', 'Warehouse Manager']), async (req, res) => {
  const { id } = req.params;
  const { name, barcode, sku, category, price, unit, weight_or_count_type, low_stock_threshold } = req.body;

  if (!name || !barcode || !sku || !category || price === undefined || !unit || !weight_or_count_type) {
    return res.status(400).json({ error: 'Please provide all required product details.' });
  }

  try {
    const product = await query.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Check barcode/sku uniqueness if changed
    const uniqueCheck = await query.get(
      'SELECT id FROM products WHERE (barcode = ? OR sku = ?) AND id != ?',
      [barcode, sku, id]
    );
    if (uniqueCheck) {
      return res.status(400).json({ error: 'Barcode or SKU matches another existing product.' });
    }

    const threshold = low_stock_threshold !== undefined ? parseFloat(low_stock_threshold) : 10;

    await query.run(
      `UPDATE products 
       SET name = ?, barcode = ?, sku = ?, category = ?, price = ?, unit = ?, weight_or_count_type = ?, low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, barcode, sku, category, parseFloat(price), unit, weight_or_count_type, threshold, id]
    );

    const updated = await query.get('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// 5. Restock Product (Admin & Manager)
router.post('/restock', verifyToken, requireRole(['Admin', 'Warehouse Manager']), async (req, res) => {
  const { productId, quantity, notes } = req.body;

  if (!productId || quantity === undefined || parseFloat(quantity) <= 0) {
    return res.status(400).json({ error: 'Product ID and a positive quantity are required for restocking.' });
  }

  try {
    const product = await query.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const restockQty = parseFloat(quantity);
    const previousStock = product.stock;
    const newStock = previousStock + restockQty;

    // Update product stock
    await query.run('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, productId]);

    // Log transaction
    await query.run(
      `INSERT INTO inventory_transactions (product_id, employee_id, transaction_type, quantity, previous_stock, new_stock, notes)
       VALUES (?, ?, 'restock', ?, ?, ?, ?)`,
      [productId, req.user.id, restockQty, previousStock, newStock, notes || 'Warehouse restock']
    );

    res.json({
      message: 'Product restocked successfully.',
      productId,
      newStock
    });
  } catch (error) {
    console.error('Restock error:', error);
    res.status(500).json({ error: 'Failed to restock product.' });
  }
});

// 6. Delete Product (Admin Only)
router.delete('/:id', verifyToken, requireRole(['Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const product = await query.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // SQLite will block this if there are active sale items depending on foreign keys (restrict/no action)
    // We can clean up, or let SQLite throw. Let's delete cascade if needed, but sqlite3 setup doesn't cascade-delete sales on purpose to keep billing integrity.
    // So we can let the user know, or mark the product stock to 0 / inactive, or just try to delete and return error if referencing.
    await query.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({
      error: 'Cannot delete product. It has historical sales transactions recorded. Reduce stock to 0 instead.'
    });
  }
});

module.exports = router;
