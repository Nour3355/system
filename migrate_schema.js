const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Branches Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        type VARCHAR(50) DEFAULT 'men'
      );
    `);

    // Insert Default Branches if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM branches');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO branches (name, type) VALUES 
        ('المخزن الرئيسي', 'main'),
        ('فرع الرجالي', 'men'),
        ('فرع الحريمي', 'women');
      `);
    }

    // 2. Inventory Branches (Stock per branch)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_branches (
        inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        stock_level INTEGER DEFAULT 0,
        PRIMARY KEY (inventory_id, branch_id)
      );
    `);

    // Migrate existing stock to Main Branch (id 1 usually, let's just do a SELECT to get id)
    // We assume branch id 1 is 'المخزن الرئيسي'
    await client.query(`
      INSERT INTO inventory_branches (inventory_id, branch_id, stock_level)
      SELECT id, 1, stock_level FROM inventory
      ON CONFLICT (inventory_id, branch_id) DO NOTHING;
    `);

    // 3. Stock Transfers
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        inventory_id INTEGER REFERENCES inventory(id),
        from_branch_id INTEGER REFERENCES branches(id),
        to_branch_id INTEGER REFERENCES branches(id),
        quantity INTEGER NOT NULL,
        transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'completed'
      );
    `);

    // 4. Supplier Transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_transactions (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
        transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'payment'
        amount NUMERIC(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);

    // Add balance columns to suppliers if not exists
    await client.query(`
      ALTER TABLE suppliers 
      ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_paid NUMERIC(10, 2) DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
