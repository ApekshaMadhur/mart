const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken } = require('../middleware/auth');

// Generate a unique weighing transaction ID
function generateWeighTxnId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WGH-${dateStr}-${timeStr}-${rand}`;
}

// 1. Generate a weighed-item QR code payload
router.post('/generate', verifyToken, async (req, res) => {
  const { productId, weight } = req.body;

  if (!productId || weight === undefined) {
    return res.status(400).json({ error: 'Product ID and weight are required.' });
  }

  const w = parseFloat(weight);
  if (isNaN(w) || w <= 0) {
    return res.status(400).json({ error: 'Weight must be a positive number.' });
  }

  try {
    const product = await query.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.weight_or_count_type !== 'loose') {
      return res.status(400).json({ error: 'Only loose products can be weighed. This is a pre-packed product.' });
    }

    // Check stock availability
    if (product.stock < w) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${product.stock} ${product.unit}. Requested: ${w} ${product.unit}`
      });
    }

    const txnId = generateWeighTxnId();
    const totalPrice = parseFloat((product.price * w).toFixed(2));

    // Store in weighed_items table
    await query.run(
      `INSERT INTO weighed_items (product_id, txn_id, weight, unit, price_per_unit, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product.id, txnId, w, product.unit, product.price, totalPrice]
    );

    // Build QR payload
    const qrPayload = {
      type: 'weighed',
      productId: product.id,
      name: product.name,
      weight: w,
      unit: product.unit,
      pricePerUnit: product.price,
      totalPrice: totalPrice,
      txnId: txnId,
      timestamp: new Date().toISOString()
    };

    res.status(201).json({
      message: 'Weigh record created successfully.',
      qrPayload,
      txnId
    });
  } catch (error) {
    console.error('Generate weigh record error:', error);
    res.status(500).json({ error: 'Failed to generate weigh record.' });
  }
});

// 2. Lookup a weighed item by transaction ID (used by checkout scanner)
router.get('/lookup/:txnId', verifyToken, async (req, res) => {
  const { txnId } = req.params;

  try {
    const record = await query.get(
      `SELECT w.*, p.name as product_name, p.barcode, p.sku, p.category, p.stock as current_stock
       FROM weighed_items w
       JOIN products p ON w.product_id = p.id
       WHERE w.txn_id = ?`,
      [txnId]
    );

    if (!record) {
      return res.status(404).json({ error: 'Weigh record not found. Invalid QR code.' });
    }

    if (record.used === 1) {
      return res.status(400).json({ error: 'This weighed item has already been checked out.' });
    }

    res.json(record);
  } catch (error) {
    console.error('Weigh lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup weigh record.' });
  }
});

// 3. List recent weighed items (for the weighing station session log)
router.get('/recent', verifyToken, async (req, res) => {
  try {
    const records = await query.all(
      `SELECT w.*, p.name as product_name
       FROM weighed_items w
       JOIN products p ON w.product_id = p.id
       WHERE w.created_at >= datetime('now', '-24 hours')
       ORDER BY w.created_at DESC
       LIMIT 50`
    );
    res.json(records);
  } catch (error) {
    console.error('Fetch recent weighed items error:', error);
    res.status(500).json({ error: 'Failed to fetch recent weighed items.' });
  }
});

module.exports = router;
