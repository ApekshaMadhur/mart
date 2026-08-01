const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Promisify DB operations
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Database Initial Setup and Seeding
async function initializeDatabase() {
  try {
    // Create tables
    await query.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Admin', 'Warehouse Manager', 'Cashier')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        unit TEXT NOT NULL, -- e.g. 'packet', 'pcs', 'kg', 'L', 'g'
        weight_or_count_type TEXT NOT NULL CHECK(weight_or_count_type IN ('fixed', 'loose')),
        stock REAL NOT NULL DEFAULT 0, -- REAL to support decimal weight/liter values
        low_stock_threshold REAL NOT NULL DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_id INTEGER NOT NULL,
        invoice_number TEXT UNIQUE NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        discount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Card', 'UPI')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashier_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL, -- REAL to support loose product weights
        price REAL NOT NULL,
        total_price REAL NOT NULL,
        weigh_txn_id TEXT, -- NULL for pre-packed, set for weighed loose items
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('restock', 'sale', 'adjustment', 'damage')),
        quantity REAL NOT NULL, -- negative for sales/damages, positive for restocks
        previous_stock REAL NOT NULL,
        new_stock REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS weighed_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        txn_id TEXT UNIQUE NOT NULL,
        weight REAL NOT NULL,
        unit TEXT NOT NULL,
        price_per_unit REAL NOT NULL,
        total_price REAL NOT NULL,
        used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    console.log('Tables verified/created successfully.');

    // Seed Employees
    const employeeCount = await query.get('SELECT COUNT(*) as count FROM employees');
    if (employeeCount.count === 0) {
      console.log('Seeding default employees...');
      const adminPass = bcrypt.hashSync('admin123', 10);
      const managerPass = bcrypt.hashSync('manager123', 10);
      const cashierPass = bcrypt.hashSync('cashier123', 10);

      await query.run(
        'INSERT INTO employees (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@supermarket.com', adminPass, 'Admin']
      );
      await query.run(
        'INSERT INTO employees (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['manager', 'manager@supermarket.com', managerPass, 'Warehouse Manager']
      );
      await query.run(
        'INSERT INTO employees (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['cashier', 'cashier@supermarket.com', cashierPass, 'Cashier']
      );
      console.log('Employees seeded successfully. (admin/admin123, manager/manager123, cashier/cashier123)');
    }

    // Seed Products
    const productCount = await query.get('SELECT COUNT(*) as count FROM products');
    if (productCount.count === 0) {
      console.log('Seeding initial products...');
      const defaultProducts = [
        // Fixed package products
        { name: 'Organic Milk 1L', barcode: '8801019202021', sku: 'MILK-ORG-1L', category: 'Dairy', price: 2.99, unit: 'packet', type: 'fixed', stock: 120, lowStock: 20 },
        { name: 'Choco Delight Biscuits 200g', barcode: '8801019202038', sku: 'BIS-CHO-200', category: 'Snacks', price: 1.49, unit: 'packet', type: 'fixed', stock: 250, lowStock: 30 },
        { name: 'Scented Bath Soap 150g', barcode: '8801019202045', sku: 'SOAP-SNT-150', category: 'Personal Care', price: 1.19, unit: 'pcs', type: 'fixed', stock: 80, lowStock: 15 },
        { name: 'Salted Potato Chips 150g', barcode: '8801019202052', sku: 'CHIP-SLT-150', category: 'Snacks', price: 1.99, unit: 'packet', type: 'fixed', stock: 8, lowStock: 15 }, // Intentional low stock
        { name: 'Triple Action Toothpaste', barcode: '8801019202069', sku: 'PASTE-TRI-100', category: 'Personal Care', price: 3.49, unit: 'pcs', type: 'fixed', stock: 65, lowStock: 10 },
        
        // Loose products
        { name: 'Premium Basmati Rice', barcode: '8801019202076', sku: 'RICE-BAS-KG', category: 'Grains & Pantry', price: 3.80, unit: 'kg', type: 'loose', stock: 450.5, lowStock: 100.0 },
        { name: 'Refined White Sugar', barcode: '8801019202083', sku: 'SUGR-WHT-KG', category: 'Grains & Pantry', price: 1.50, unit: 'kg', type: 'loose', stock: 600.0, lowStock: 100.0 },
        { name: 'Whole Wheat Flour', barcode: '8801019202090', sku: 'FLR-WHT-KG', category: 'Grains & Pantry', price: 2.20, unit: 'kg', type: 'loose', stock: 350.0, lowStock: 50.0 },
        { name: 'Fresh Tomatoes', barcode: '8801019202106', sku: 'VEG-TOM-KG', category: 'Produce', price: 2.50, unit: 'kg', type: 'loose', stock: 45.3, lowStock: 25.0 },
        { name: 'Refined Sunflower Oil', barcode: '8801019202113', sku: 'OIL-SUN-L', category: 'Grains & Pantry', price: 4.50, unit: 'L', type: 'loose', stock: 150.0, lowStock: 30.0 }
      ];

      for (const p of defaultProducts) {
        await query.run(
          `INSERT INTO products (name, barcode, sku, category, price, unit, weight_or_count_type, stock, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.barcode, p.sku, p.category, p.price * 83, p.unit, p.type, p.stock, p.lowStock]
        );
      }
      console.log('Products seeded successfully.');
    }

  } catch (error) {
    console.error('Error initializing database schema/seeds:', error);
  }
}

// Perform initialization on import
initializeDatabase();

module.exports = {
  db,
  query
};
