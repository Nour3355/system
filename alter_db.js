const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '[]'");
    // Update admin to have all permissions
    await pool.query(`UPDATE users SET permissions = '["Dashboard.html", "index.html", "Rentals.html", "Customers.html", "Inventory.html", "Suppliers.html", "Employees.html", "Expenses.html", "Reports.html", "Settings.html"]' WHERE role = 'admin'`);
    // Update branch users to have limited permissions
    await pool.query(`UPDATE users SET permissions = '["Dashboard.html", "index.html", "Rentals.html", "Customers.html", "Inventory.html"]' WHERE role = 'branch_user'`);
    console.log('Permissions column added and seeded');
  } catch (err) {
    if (err.code === '42701') console.log('Column already exists');
    else console.error(err);
  } finally {
    pool.end();
  }
}
run();
