const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database for migration:', err);
    process.exit(1);
  }
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function migrate() {
  try {
    // Check if products table exists and has rows
    const tableCheck = await getQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    if (!tableCheck) {
      console.log('Products table does not exist yet. Seeding will handle it.');
      return;
    }

    const row = await getQuery("SELECT MIN(price) as minPrice FROM products");
    if (!row || row.minPrice === null) {
      console.log('No products found to migrate.');
      return;
    }

    if (row.minPrice < 10.0) {
      console.log(`Found minimum price ${row.minPrice} USD. Migrating currency database to INR (multiplier = 83)...`);
      
      db.serialize(async () => {
        await runQuery("BEGIN TRANSACTION");
        
        try {
          // 1. Update products price
          const u1 = await runQuery("UPDATE products SET price = price * 83");
          console.log(`Updated ${u1.changes} products.`);

          // 2. Update sales prices
          const u2 = await runQuery("UPDATE sales SET subtotal = subtotal * 83, tax = tax * 83, discount = discount * 83, total_amount = total_amount * 83");
          console.log(`Updated ${u2.changes} sales transactions.`);

          // 3. Update sale_items prices
          const u3 = await runQuery("UPDATE sale_items SET price = price * 83, total_price = total_price * 83");
          console.log(`Updated ${u3.changes} transaction items.`);

          await runQuery("COMMIT");
          console.log("Currency migration to INR completed successfully!");
        } catch (txErr) {
          await runQuery("ROLLBACK");
          console.error("Migration failed, rolled back changes:", txErr);
          process.exit(1);
        } finally {
          db.close();
        }
      });
    } else {
      console.log(`Minimum price is ${row.minPrice}. Database is already converted to INR. Skipping migration.`);
      db.close();
    }
  } catch (err) {
    console.error("Migration check failed:", err);
    db.close();
    process.exit(1);
  }
}

migrate();
