const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkStock() {
  try {
    const invRes = await pool.query('SELECT id, name, stock_level FROM inventory');
    console.log('Inventory Table:');
    console.table(invRes.rows);

    const branchInvRes = await pool.query('SELECT * FROM inventory_branches');
    console.log('Inventory Branches Table:');
    console.table(branchInvRes.rows);

    // Sync if missing or zero
    console.log('Syncing branches...');
    // 1. Insert missing
    await pool.query(`
      INSERT INTO inventory_branches (inventory_id, branch_id, stock_level)
      SELECT i.id, b.id, CASE WHEN b.id = 1 THEN i.stock_level ELSE 0 END
      FROM inventory i, branches b
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory_branches ib 
        WHERE ib.inventory_id = i.id AND ib.branch_id = b.id
      )
    `);
    
    // 2. Update existing zero records for branch 1 if inventory has stock
    await pool.query(`
      UPDATE inventory_branches ib
      SET stock_level = i.stock_level
      FROM inventory i
      WHERE ib.inventory_id = i.id 
      AND ib.branch_id = 1 
      AND ib.stock_level = 0 
      AND i.stock_level > 0
    `);
    console.log('Sync complete.');

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkStock();
