const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// 1. Dashboard Aggregate Metrics
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    // Current timestamp strings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString().replace('T', ' ').slice(0, 19);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartISO = monthStart.toISOString().replace('T', ' ').slice(0, 19);

    // Run aggregate queries
    const salesToday = await query.get(
      'SELECT SUM(total_amount) as total FROM sales WHERE created_at >= ?',
      [todayStartISO]
    );

    const salesMonth = await query.get(
      'SELECT SUM(total_amount) as total FROM sales WHERE created_at >= ?',
      [monthStartISO]
    );

    const productsCount = await query.get('SELECT COUNT(*) as count FROM products');

    const lowStockCount = await query.get('SELECT COUNT(*) as count FROM products WHERE stock <= low_stock_threshold');

    // Get Top 5 low stock products
    const lowStockList = await query.all(
      'SELECT id, name, sku, stock, unit, low_stock_threshold FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC LIMIT 5'
    );

    // Get Top 5 recent sales
    const recentSales = await query.all(`
      SELECT s.id, s.invoice_number, s.total_amount, s.created_at, e.username as cashier_name
      FROM sales s
      JOIN employees e ON s.cashier_id = e.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);

    // Get Daily sales for past 7 days (to render a dashboard chart)
    const dailySalesChart = await query.all(`
      SELECT date(created_at) as sale_date, SUM(total_amount) as total_sales, COUNT(id) as invoices_count
      FROM sales
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY sale_date
      ORDER BY sale_date ASC
    `);

    res.json({
      metrics: {
        salesToday: salesToday.total || 0,
        salesMonth: salesMonth.total || 0,
        totalProducts: productsCount.count || 0,
        lowStockCount: lowStockCount.count || 0
      },
      lowStockList,
      recentSales,
      dailySalesChart
    });
  } catch (error) {
    console.error('Fetch dashboard reports error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summaries.' });
  }
});

// 2. Daily Sales Report Detail
router.get('/daily-sales', verifyToken, requireRole(['Admin', 'Warehouse Manager']), async (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = `
    SELECT s.*, e.username as cashier_name
    FROM sales s
    JOIN employees e ON s.cashier_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ' AND s.created_at >= ?';
    params.push(startDate + ' 00:00:00');
  } else {
    sql += ' AND s.created_at >= date("now", "-30 days")';
  }

  if (endDate) {
    sql += ' AND s.created_at <= ?';
    params.push(endDate + ' 23:59:59');
  }

  sql += ' ORDER BY s.created_at DESC';

  try {
    const sales = await query.all(sql, params);
    res.json(sales);
  } catch (error) {
    console.error('Fetch daily sales details error:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales report.' });
  }
});

// 3. Inventory Movement Transactions Audit Trail
router.get('/inventory-movement', verifyToken, requireRole(['Admin', 'Warehouse Manager']), async (req, res) => {
  const { productId } = req.query;
  let sql = `
    SELECT t.*, p.name as product_name, p.sku as product_sku, p.unit, e.username as employee_name
    FROM inventory_transactions t
    JOIN products p ON t.product_id = p.id
    JOIN employees e ON t.employee_id = e.id
  `;
  const params = [];

  if (productId) {
    sql += ' WHERE t.product_id = ?';
    params.push(productId);
  }

  sql += ' ORDER BY t.created_at DESC';

  try {
    const transactions = await query.all(sql, params);
    res.json(transactions);
  } catch (error) {
    console.error('Fetch inventory movement error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory movement details.' });
  }
});

module.exports = router;
