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

    // 1. Update Orders Table (Sales System)
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
    `);

    // 2. Create Rentals Table (Rental System)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        inventory_id INTEGER REFERENCES inventory(id),
        branch_id INTEGER REFERENCES branches(id),
        booking_date DATE DEFAULT CURRENT_DATE,
        pickup_date DATE NOT NULL,
        return_date DATE NOT NULL,
        actual_return_date DATE,
        status VARCHAR(50) DEFAULT 'booked', -- booked, active, returned
        total_price NUMERIC(10, 2) NOT NULL,
        fine_amount NUMERIC(10, 2) DEFAULT 0,
        id_card_guarantee BOOLEAN DEFAULT FALSE,
        notes TEXT
      );
    `);

    await client.query('COMMIT');
    console.log('Migration for sales and rentals completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
