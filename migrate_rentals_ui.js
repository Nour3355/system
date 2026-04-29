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

    // Add new columns to rentals table
    await client.query(`
      ALTER TABLE rentals 
      ADD COLUMN IF NOT EXISTS national_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS deposit NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS remaining NUMERIC(10, 2) DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('Rentals migration for new UI completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
