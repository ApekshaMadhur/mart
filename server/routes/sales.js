const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// 1. Checkout POS Transaction
router.post('/checkout', verifyToken, requireRole(['Admin', 'Cashier']), async (req, res) => {
  const { items, discount, paymentMethod } = req.body; // items: [{ productId, quantity, weighTxnId? }]

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Scan products to buy.' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ error: 'Payment method is required.' });
  }

  try {
    // 1. Verify all products and check stock
    const cartDetails = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await query.get('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }

      let qty, itemPrice, weighTxnId = null;

      if (item.weighTxnId) {
        // Weighed item — validate against weighed_items table
        const weighRecord = await query.get(
          'SELECT * FROM weighed_items WHERE txn_id = ? AND product_id = ?',
          [item.weighTxnId, item.productId]
        );

        if (!weighRecord) {
          return res.status(400).json({ error: `Invalid weigh record for ${product.name}.` });
        }

        if (weighRecord.used === 1) {
          return res.status(400).json({ error: `Weighed item "${product.name}" (${item.weighTxnId}) has already been checked out.` });
        }

        qty = weighRecord.weight;
        itemPrice = weighRecord.price_per_unit;
        weighTxnId = item.weighTxnId;
      } else {
        // Pre-packed item
        qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: `Invalid quantity for product ${product.name}.` });
        }
        itemPrice = product.price;
      }

      // Check stock
      if (product.stock < qty) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Remaining warehouse stock: ${product.stock} ${product.unit}. Requested: ${qty}`
        });
      }

      const totalPrice = parseFloat((itemPrice * qty).toFixed(2));
      subtotal += totalPrice;

      cartDetails.push({
        product,
        quantity: qty,
        price: itemPrice,
        totalPrice,
        weighTxnId
      });
    }

    // Calculations
    const discVal = discount ? parseFloat(discount) : 0;
    const taxRate = 0.05; // 5% VAT / GST
    const taxableAmount = Math.max(0, subtotal - discVal);
    const taxVal = parseFloat((taxableAmount * taxRate).toFixed(2));
    const finalTotal = parseFloat((taxableAmount + taxVal).toFixed(2));

    // Generate Invoice Number (Format: INV-YYYYMMDD-HHMMSS-RAND4)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    // 2. Perform DB operations
    // Start SQLite transaction manually
    await query.run('BEGIN TRANSACTION');

    try {
      // Insert Sale
      const saleResult = await query.run(
        `INSERT INTO sales (cashier_id, invoice_number, subtotal, tax, discount, total_amount, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, invoiceNumber, subtotal, taxVal, discVal, finalTotal, paymentMethod]
      );

      const saleId = saleResult.id;

      // Insert Items, Update stocks, log transactions
      for (const item of cartDetails) {
        // Insert sale_items
        await query.run(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price, total_price, weigh_txn_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, item.product.id, item.quantity, item.price, item.totalPrice, item.weighTxnId]
        );

        // Update product stock
        const newStock = parseFloat((item.product.stock - item.quantity).toFixed(4));
        await query.run(
          'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStock, item.product.id]
        );

        // Log to inventory_transactions
        await query.run(
          `INSERT INTO inventory_transactions (product_id, employee_id, transaction_type, quantity, previous_stock, new_stock, notes)
           VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
          [item.product.id, req.user.id, -item.quantity, item.product.stock, newStock, `Sale Invoice ${invoiceNumber}`]
        );

        // Mark weighed item as used
        if (item.weighTxnId) {
          await query.run('UPDATE weighed_items SET used = 1 WHERE txn_id = ?', [item.weighTxnId]);
        }
      }

      await query.run('COMMIT');

      // Return checkout details for printable receipt
      res.status(201).json({
        message: 'Checkout successful.',
        saleId,
        invoiceNumber,
        subtotal,
        tax: taxVal,
        discount: discVal,
        total: finalTotal,
        paymentMethod,
        date: new Date().toISOString()
      });

    } catch (dbErr) {
      await query.run('ROLLBACK');
      throw dbErr;
    }

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Checkout failed due to a database transaction error.' });
  }
});

// 2. Sales History Log
router.get('/history', verifyToken, async (req, res) => {
  try {
    const history = await query.all(`
      SELECT s.*, e.username as cashier_name
      FROM sales s
      JOIN employees e ON s.cashier_id = e.id
      ORDER BY s.created_at DESC
    `);
    res.json(history);
  } catch (error) {
    console.error('Fetch sales history error:', error);
    res.status(500).json({ error: 'Failed to fetch sales history.' });
  }
});

// 3. Get Detailed Invoice
router.get('/invoice/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const sale = await query.get(`
      SELECT s.*, e.username as cashier_name, e.email as cashier_email
      FROM sales s
      JOIN employees e ON s.cashier_id = e.id
      WHERE s.id = ?
    `, [id]);

    if (!sale) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const items = await query.all(`
      SELECT si.*, p.name, p.barcode, p.sku, p.unit, p.weight_or_count_type
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [id]);

    res.json({
      sale,
      items
    });
  } catch (error) {
    console.error('Fetch detailed invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice details.' });
  }
});

module.exports = router;
