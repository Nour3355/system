const db = require('../db');

async function setupSoftDelete() {
  try {
    console.log('Adding is_deleted column to inventory...');
    await db.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE');
    console.log('Success!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

setupSoftDelete();
