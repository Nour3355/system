const db = require('./db');

async function testReset() {
  try {
    console.log('Testing reset...');
    await db.query('BEGIN');
    await db.query('TRUNCATE TABLE alterations, attendance, employee_transactions, employees, expenses, inventory_branches, inventory, order_items, orders, rentals, stock_transfers, supplier_transactions, supply_records, suppliers, customers CASCADE');
    console.log('Truncate successful');
    await db.query('ROLLBACK'); // Don't actually wipe it yet
    console.log('Test complete (rolled back)');
  } catch (err) {
    console.error('Error during reset test:', err);
  } finally {
    process.exit();
  }
}

testReset();
