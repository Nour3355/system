const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function initializeDatabase() {
  try {
    // 1. Create Customers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        initials VARCHAR(10),
        email VARCHAR(255),
        phone VARCHAR(50),
        join_date DATE,
        total_spent DECIMAL(10, 2),
        status VARCHAR(50)
      );
    `);

    // 2. Create Suppliers Table (MUST be before Inventory since Inventory references it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        initials VARCHAR(10),
        category VARCHAR(100),
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        supply_type VARCHAR(100),
        last_supply_date DATE,
        balance NUMERIC(10, 2) DEFAULT 0,
        total_purchases NUMERIC(10, 2) DEFAULT 0,
        total_paid NUMERIC(10, 2) DEFAULT 0
      );
    `);

    // 3. Create Inventory Table (references suppliers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        size_cut VARCHAR(100),
        color VARCHAR(50),
        barcode VARCHAR(100),
        stock_level INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 5,
        preferred_supplier_id INTEGER REFERENCES suppliers(id),
        price DECIMAL(10, 2),
        image_url TEXT,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `);

    // Ensure columns exist if table was already created before these were added
    try {
      await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);`);
      await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
      await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 5;`);
      await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS preferred_supplier_id INTEGER REFERENCES suppliers(id);`);
    } catch (e) { /* ignore if column already exists */ }

    console.log("Core tables created successfully.");

    // 4. Create Branches Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        type VARCHAR(50) DEFAULT 'men'
      );
    `);

    // Insert Default Branches if empty
    const { rows: branchRows } = await pool.query('SELECT COUNT(*) FROM branches');
    if (parseInt(branchRows[0].count) === 0) {
      await pool.query(`
        INSERT INTO branches (name, type) VALUES 
        ('المخزن الرئيسي', 'main'),
        ('فرع الرجالي', 'men'),
        ('فرع الحريمي', 'women');
      `);
    }

    // 5. Create Inventory Branches (Stock per branch)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_branches (
        inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        stock_level INTEGER DEFAULT 0,
        PRIMARY KEY (inventory_id, branch_id)
      );
    `);

    // 6. Create Stock Transfers
    await pool.query(`
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

    // 7. Create Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        branch_id INTEGER REFERENCES branches(id) DEFAULT 1,
        payment_method VARCHAR(50) DEFAULT 'cash'
      );
    `);

    // 8. Create Order Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        inventory_id INTEGER REFERENCES inventory(id),
        quantity INTEGER NOT NULL,
        price_at_time DECIMAL(10, 2) NOT NULL
      );
    `);

    // 9. Create Supply Records Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supply_records (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id),
        inventory_id INTEGER REFERENCES inventory(id),
        quantity INTEGER NOT NULL,
        supply_date DATE DEFAULT CURRENT_DATE,
        cost_price DECIMAL(10, 2) NOT NULL,
        notes TEXT
      );
    `);

    // 10. Create Supplier Transactions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_transactions (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
        transaction_type VARCHAR(50) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);

    // 11. Create Rentals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        inventory_id INTEGER REFERENCES inventory(id),
        branch_id INTEGER REFERENCES branches(id),
        booking_date DATE DEFAULT CURRENT_DATE,
        pickup_date DATE NOT NULL,
        return_date DATE NOT NULL,
        actual_return_date DATE,
        status VARCHAR(50) DEFAULT 'booked',
        total_price NUMERIC(10, 2) NOT NULL,
        fine_amount NUMERIC(10, 2) DEFAULT 0,
        national_id VARCHAR(20),
        deposit NUMERIC(10, 2) DEFAULT 0,
        remaining NUMERIC(10, 2) DEFAULT 0,
        id_card_guarantee BOOLEAN DEFAULT FALSE,
        notes TEXT
      );
    `);

    // 12. Create Employees Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(100),
        branch_id INTEGER REFERENCES branches(id),
        basic_salary NUMERIC(10, 2) NOT NULL DEFAULT 0,
        phone VARCHAR(50),
        join_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'active'
      );
    `);

    // 13. Create Attendance Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        check_in TIME,
        check_out TIME,
        status VARCHAR(50) DEFAULT 'present',
        notes TEXT,
        UNIQUE(employee_id, date)
      );
    `);

    // 14. Create Employee Transactions Table (Advances, Deductions, Bonuses, Salaries)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_transactions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'advance', 'deduction', 'bonus', 'salary_payment'
        amount NUMERIC(10, 2) NOT NULL,
        transaction_date DATE DEFAULT CURRENT_DATE,
        notes TEXT
      );
    `);

    // 15. Create Expenses Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL, -- 'rent', 'electricity', 'labor', 'other'
        amount NUMERIC(10, 2) NOT NULL,
        expense_date DATE DEFAULT CURRENT_DATE,
        notes TEXT
      );
    `);

    // 16. Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'branch_user', -- 'admin' or 'branch_user'
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default users if none exist
    const bcrypt = require('bcrypt');
    const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userRows[0].count) === 0) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const branch1Hash = await bcrypt.hash('branch123', 10);
      const branch2Hash = await bcrypt.hash('branch123', 10);

      await pool.query(`
        INSERT INTO users (username, password_hash, role, branch_id) VALUES 
        ('admin', $1, 'admin', NULL),
        ('branch1', $2, 'branch_user', 2),
        ('branch2', $3, 'branch_user', 3)
      `, [adminHash, branch1Hash, branch2Hash]);
      console.log('Seeded default users: admin (pass: admin123), branch1 (pass: branch123), branch2 (pass: branch123)');
    }

    console.log("Database initialization complete — all tables created.");
  } catch (err) {
    console.error("Error initializing database:", err);
  } finally {
    pool.end();
  }
}

initializeDatabase();
