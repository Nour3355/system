const db = require('../db');

async function addBarcodeColumn() {
  try {
    console.log('Adding barcode column to inventory...');
    await db.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode VARCHAR(255)');
    console.log('Success!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

addBarcodeColumn();
