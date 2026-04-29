const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// TEST AND RESET (TOP LEVEL)
app.get('/api/test', (req, res) => {
  res.send('Server is alive and running the latest version! Time: ' + new Date().toISOString());
});

app.post('/api/reset', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    await db.query('BEGIN');
    await db.query('TRUNCATE TABLE alterations, attendance, employee_transactions, employees, expenses, inventory_branches, inventory, order_items, orders, rentals, stock_transfers, supplier_transactions, supply_records, suppliers, customers CASCADE');
    
    await db.query(`
      SELECT setval(pg_get_serial_sequence('inventory', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('orders', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('customers', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('suppliers', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('rentals', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('employees', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('expenses', 'id'), 1, false);
      SELECT setval(pg_get_serial_sequence('alterations', 'id'), 1, false);
    `);

    await db.query('COMMIT');
    res.json({ success: true, message: 'All data wiped' });
  } catch (err) {
    if (db) await db.query('ROLLBACK');
    console.error('Reset failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Settings API
// Settings API moved below middleware



// Authentication Middleware
app.use((req, res, next) => {
  // Allow public access to login page and login API, and assets
  if (
    req.path === '/login.html' || 
    req.path === '/api/login' || 
    req.path.endsWith('.css') || 
    req.path.endsWith('.js')
  ) {
    return next();
  }

  const token = req.cookies.token;
  
  if (!token) {
    // If it's an API call, return 401
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    // If it's a page navigation or root, redirect to login
    if (req.path === '/' || req.path.endsWith('.html')) return res.redirect('/login.html');
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, branch_id }
    
    // Redirect authenticated users trying to access root to index.html
    if (req.path === '/') return res.redirect('/index.html');
    
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Invalid token' });
    if (req.path.endsWith('.html')) return res.redirect('/login.html');
    next();
  }
});

// Settings API (Protected)
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => settings[row.key] = row.value);
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const settings = req.body; 
  try {
    await db.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value.toString()]);
    }
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Serve static HTML files
app.use(express.static(path.join(__dirname)));

/* =========================================================================
   AUTHENTICATION
   ========================================================================= */

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, branch_id: user.branch_id, permissions: user.permissions },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 12 * 60 * 60 * 1000 });
    res.json({ success: true, role: user.role, branch_id: user.branch_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user });
});




// API Endpoints

// Customers
app.get('/api/customers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customers ORDER BY join_date DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, email, phone } = req.body;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  try {
    const { rows } = await db.query(
      'INSERT INTO customers (name, initials, email, phone, join_date, total_spent, status) VALUES ($1, $2, $3, $4, CURRENT_DATE, 0, $5) RETURNING *',
      [name, initials, email, phone, 'نشط']
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  try {
    const { rows } = await db.query(
      'UPDATE customers SET name = $1, initials = $2, email = $3, phone = $4 WHERE id = $5 RETURNING *',
      [name, initials, email, phone, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('BEGIN');
    // 1. Unlink orders from this customer so they become 'Guest' orders in history
    await db.query('UPDATE orders SET customer_id = NULL WHERE customer_id = $1', [id]);

    // 2. Now it's safe to delete the customer
    await db.query('DELETE FROM customers WHERE id = $1', [id]);

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Branches
app.get('/api/branches', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM branches ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Inventory
app.get('/api/inventory', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT i.id, i.code, i.name, i.category, i.size_cut, i.color, i.barcode, i.min_stock_level, i.preferred_supplier_id, i.price, i.cost_price, i.image_url,
             s.name as supplier_name, 
             COALESCE((SELECT SUM(stock_level) FROM inventory_branches WHERE inventory_id = i.id), 0) as stock_level,
             (SELECT json_agg(json_build_object('branch_id', branch_id, 'stock_level', stock_level)) FROM inventory_branches WHERE inventory_id = i.id) as branch_stocks
      FROM inventory i 
      LEFT JOIN suppliers s ON i.preferred_supplier_id = s.id 
      WHERE i.is_deleted = FALSE
      ORDER BY i.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/inventory', async (req, res) => {
  const { code, name, category, size_cut, color, stock_level, min_stock_level, branch_id, price, cost_price, image_url, barcode } = req.body;
  const initialStock = parseInt(stock_level) || 0;
  const b_id = parseInt(branch_id) || 1; // Default to 1 if not provided
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      'INSERT INTO inventory (code, name, category, size_cut, color, stock_level, min_stock_level, price, cost_price, image_url, barcode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [code, name, category, size_cut, color, initialStock, min_stock_level || 5, price, cost_price, image_url, barcode]
    );
    const newId = rows[0].id;
    
    // Initialize stock for all branches
    // Put all initial stock in the SELECTED branch and 0 in others
    await db.query(`
      INSERT INTO inventory_branches (inventory_id, branch_id, stock_level) 
      SELECT $1, id, CASE WHEN id = $2 THEN $3 ELSE 0 END FROM branches
    `, [newId, b_id, initialStock]);

    await db.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  const { code, name, category, size_cut, color, stock_level, min_stock_level, preferred_supplier_id, price, cost_price, image_url, barcode } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE inventory SET code = $1, name = $2, category = $3, size_cut = $4, color = $5, stock_level = $6, min_stock_level = $7, preferred_supplier_id = $8, price = $9, cost_price = $10, image_url = $11, barcode = $12 WHERE id = $13 RETURNING *',
      [code, name, category, size_cut, color, stock_level, min_stock_level, preferred_supplier_id, price, cost_price, image_url, barcode, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE inventory SET is_deleted = TRUE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Stock Transfers
app.post('/api/inventory/transfer', async (req, res) => {
  let { inventory_id, from_branch_id, to_branch_id, quantity } = req.body;
  if (req.user && req.user.role === 'branch_user') {
    from_branch_id = req.user.branch_id;
  }
  try {
    await db.query('BEGIN');
    
    // Check stock
    const stockCheck = await db.query('SELECT stock_level FROM inventory_branches WHERE inventory_id = $1 AND branch_id = $2', [inventory_id, from_branch_id]);
    if (!stockCheck.rows.length || stockCheck.rows[0].stock_level < quantity) {
      throw new Error('عفواً، المخزون في الفرع المصدر غير كافٍ لإتمام عملية التحويل');
    }

    // Deduct from source
    await db.query('UPDATE inventory_branches SET stock_level = stock_level - $1 WHERE inventory_id = $2 AND branch_id = $3', [quantity, inventory_id, from_branch_id]);
    
    // Add to destination
    await db.query(`
      INSERT INTO inventory_branches (inventory_id, branch_id, stock_level) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (inventory_id, branch_id) DO UPDATE SET stock_level = inventory_branches.stock_level + $3
    `, [inventory_id, to_branch_id, quantity]);

    // Record transfer
    await db.query(
      'INSERT INTO stock_transfers (inventory_id, from_branch_id, to_branch_id, quantity) VALUES ($1, $2, $3, $4)',
      [inventory_id, from_branch_id, to_branch_id, quantity]
    );

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM suppliers ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { name, category, contact_person, phone, supply_type } = req.body;
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  try {
    const { rows } = await db.query(
      'INSERT INTO suppliers (name, initials, category, contact_person, phone, supply_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, initials, category, contact_person, phone, supply_type]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, contact_person, phone, supply_type } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE suppliers SET name = $1, category = $2, contact_person = $3, phone = $4, supply_type = $5 WHERE id = $6 RETURNING *',
      [name, category, contact_person, phone, supply_type, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('BEGIN');
    // Remove related records first to avoid FK violations
    await db.query('DELETE FROM supplier_transactions WHERE supplier_id = $1', [id]);
    await db.query('DELETE FROM supply_records WHERE supplier_id = $1', [id]);
    await db.query('UPDATE inventory SET preferred_supplier_id = NULL WHERE preferred_supplier_id = $1', [id]);
    await db.query('DELETE FROM suppliers WHERE id = $1', [id]);
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Supply Records
app.get('/api/supply-records', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT sr.*, s.name as supplier_name, i.name as inventory_name
      FROM supply_records sr
      JOIN suppliers s ON sr.supplier_id = s.id
      JOIN inventory i ON sr.inventory_id = i.id
      ORDER BY sr.supply_date DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/supply-records', async (req, res) => {
  let { supplier_id, inventory_id, quantity, cost_price, notes, branch_id } = req.body;
  if (req.user && req.user.role === 'branch_user') {
    branch_id = req.user.branch_id;
  }
  const b_id = branch_id || 1; // Default to main warehouse
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      'INSERT INTO supply_records (supplier_id, inventory_id, quantity, cost_price, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [supplier_id, inventory_id, quantity, cost_price, notes]
    );
    
    // Add stock to specific branch
    await db.query(`
      INSERT INTO inventory_branches (inventory_id, branch_id, stock_level) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (inventory_id, branch_id) DO UPDATE SET stock_level = inventory_branches.stock_level + $3
    `, [inventory_id, b_id, quantity]);

    // Update global stock_level in inventory table as well just for legacy compatibility if needed
    await db.query('UPDATE inventory SET stock_level = stock_level + $1 WHERE id = $2', [quantity, inventory_id]);

    // Record the purchase transaction for the supplier
    const total_cost = quantity * cost_price;
    await db.query(
      'INSERT INTO supplier_transactions (supplier_id, transaction_type, amount, notes) VALUES ($1, $2, $3, $4)',
      [supplier_id, 'purchase', total_cost, 'فاتورة مشتريات بضاعة (إذن إضافة)']
    );

    // Update supplier balance
    await db.query('UPDATE suppliers SET total_purchases = total_purchases + $1, balance = balance - $1 WHERE id = $2', [total_cost, supplier_id]);

    await db.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Supplier Transactions (Payments / Purchase Total)
app.post('/api/suppliers/transactions', async (req, res) => {
  const { supplier_id, transaction_type, amount, notes } = req.body;
  try {
    await db.query('BEGIN');
    
    await db.query(
      'INSERT INTO supplier_transactions (supplier_id, transaction_type, amount, notes) VALUES ($1, $2, $3, $4)',
      [supplier_id, transaction_type, amount, notes]
    );

    if (transaction_type === 'purchase') {
      await db.query('UPDATE suppliers SET total_purchases = total_purchases + $1, balance = balance - $1 WHERE id = $2', [amount, supplier_id]);
    } else if (transaction_type === 'payment') {
      await db.query('UPDATE suppliers SET total_paid = total_paid + $1, balance = balance + $1 WHERE id = $2', [amount, supplier_id]);
    }

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/suppliers/:id/transactions', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM supplier_transactions WHERE supplier_id = $1 ORDER BY transaction_date DESC', [id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Dashboard Data
app.get('/api/dashboard', async (req, res) => {
  try {
    let branchFilter = '';
    let params = [];
    if (req.user && req.user.role === 'branch_user') {
      branchFilter = 'WHERE branch_id = $1';
      params.push(req.user.branch_id);
    }
    const whereAnd = branchFilter ? branchFilter + ' AND' : 'WHERE';

    const totalSalesRes = await db.query(`SELECT SUM(total_amount) as total FROM orders ${branchFilter}`, params);
    const ordersTodayRes = await db.query(`SELECT COUNT(*) as count FROM orders ${whereAnd} DATE(order_date) = CURRENT_DATE`, params);
    const newCustomersRes = await db.query('SELECT COUNT(*) as count FROM customers'); // Global
    
    // Low stock per branch
    let lowStockQuery = 'SELECT COUNT(*) as count FROM inventory_branches WHERE stock_level < 5';
    if (branchFilter) lowStockQuery += ' AND branch_id = $1';
    const lowStockRes = await db.query(lowStockQuery, params);

    const recentOrdersRes = await db.query(`
      SELECT o.id, c.name as customer_name, o.order_date, o.status, o.total_amount
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ${branchFilter}
      ORDER BY o.order_date DESC
      LIMIT 5
    `, params);

    const topProductsRes = await db.query(`
      SELECT i.name, i.image_url as image, i.price, SUM(oi.quantity) as sales
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN inventory i ON oi.inventory_id = i.id
      ${branchFilter}
      GROUP BY i.id, i.name, i.image_url, i.price
      ORDER BY sales DESC
      LIMIT 20
    `, params);

    const revenueTrendRes = await db.query(`
      SELECT TO_CHAR(d, 'Day') as day, COALESCE(SUM(o.total_amount), 0) as total, d as date_val
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
      LEFT JOIN orders o ON DATE(o.order_date) = d ${branchFilter ? 'AND o.branch_id = $1' : ''}
      GROUP BY d
      ORDER BY d ASC
    `, params);

    res.json({
      totalSales: totalSalesRes.rows[0].total || 0,
      ordersToday: ordersTodayRes.rows[0].count || 0,
      newCustomers: newCustomersRes.rows[0].count || 0,
      lowStock: lowStockRes.rows[0].count || 0,
      recentOrders: recentOrdersRes.rows,
      topProducts: topProductsRes.rows,
      revenueTrend: revenueTrendRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create Order (for POS)
app.post('/api/orders', async (req, res) => {
  let { customer_name, customer_phone, items, total_amount, branch_id, payment_method } = req.body;
  if (req.user && req.user.role === 'branch_user') {
    branch_id = req.user.branch_id;
  }
  const b_id = branch_id || 1;
  const p_method = payment_method || 'cash';

  try {
    await db.query('BEGIN');

    // 1. Handle Customer (Create or Update)
    let customerId;
    const existingCustomer = await db.query('SELECT id FROM customers WHERE phone = $1', [customer_phone]);

    if (existingCustomer.rows.length > 0) {
      // Update existing customer
      customerId = existingCustomer.rows[0].id;
      await db.query(
        'UPDATE customers SET total_spent = total_spent + $1 WHERE id = $2',
        [total_amount, customerId]
      );
    } else {
      // Create new customer
      const initials = customer_name.split(' ').map(n => n[0]).join('').toUpperCase();
      const newCust = await db.query(
        'INSERT INTO customers (name, initials, phone, join_date, total_spent, status) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5) RETURNING id',
        [customer_name, initials, customer_phone, total_amount, 'نشط']
      );
      customerId = newCust.rows[0].id;
    }

    // 2. Create the Order
    const orderResult = await db.query(
      'INSERT INTO orders (customer_id, total_amount, order_date, branch_id, payment_method) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4) RETURNING id',
      [customerId, total_amount, b_id, p_method]
    );
    const orderId = orderResult.rows[0].id;

    // 3. Add Items & Update Inventory
    for (const item of items) {
      await db.query(
        'INSERT INTO order_items (order_id, inventory_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
        [orderId, item.id, item.quantity, item.price]
      );
      
      // Update specific branch stock
      await db.query(
        'UPDATE inventory_branches SET stock_level = stock_level - $1 WHERE inventory_id = $2 AND branch_id = $3',
        [item.quantity, item.id, b_id]
      );
      
      // Update global legacy stock
      await db.query(
        'UPDATE inventory SET stock_level = stock_level - $1 WHERE id = $2',
        [item.quantity, item.id]
      );
    }

    await db.query('COMMIT');
    res.json({ success: true, orderId });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Rentals System
app.get('/api/rentals', async (req, res) => {
  try {
    let queryStr = `
      SELECT r.*, c.name as customer_name, c.phone as customer_phone, 
             i.name as inventory_name, i.barcode as inventory_barcode, i.color as inventory_color, i.size_cut as inventory_size, i.image_url, b.name as branch_name 
      FROM rentals r
      JOIN customers c ON r.customer_id = c.id
      JOIN inventory i ON r.inventory_id = i.id
      JOIN branches b ON r.branch_id = b.id
    `;
    let params = [];
    if (req.user && req.user.role === 'branch_user') {
      queryStr += ' WHERE r.branch_id = $1 ';
      params.push(req.user.branch_id);
    }
    queryStr += ' ORDER BY r.pickup_date DESC';
    const { rows } = await db.query(queryStr, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/rentals', async (req, res) => {
  let { customer_name, customer_phone, national_id, inventory_id, branch_id, pickup_date, return_date, total_price, deposit, remaining, notes } = req.body;
  if (req.user && req.user.role === 'branch_user') {
    branch_id = req.user.branch_id;
  }
  try {
    await db.query('BEGIN');
    
    // 1. Handle Customer
    let customerId;
    const existingCustomer = await db.query('SELECT id FROM customers WHERE phone = $1', [customer_phone]);
    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id;
    } else {
      const initials = customer_name.split(' ').map(n => n[0]).join('').toUpperCase();
      const newCust = await db.query(
        'INSERT INTO customers (name, initials, phone, join_date, total_spent, status) VALUES ($1, $2, $3, CURRENT_DATE, 0, $4) RETURNING id',
        [customer_name, initials, customer_phone, 'نشط']
      );
      customerId = newCust.rows[0].id;
    }

    // 2. Create Rental
    const { rows } = await db.query(`
      INSERT INTO rentals (customer_id, inventory_id, branch_id, pickup_date, return_date, total_price, national_id, deposit, remaining, notes, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active') RETURNING *
    `, [customerId, inventory_id, branch_id, pickup_date, return_date, total_price, national_id, deposit, remaining, notes]);

    // 3. Deduct Inventory
    await db.query('UPDATE inventory_branches SET stock_level = stock_level - 1 WHERE inventory_id = $1 AND branch_id = $2', [inventory_id, branch_id]);

    await db.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/rentals/:id/return', async (req, res) => {
  const { id } = req.params;
  const { fine_amount } = req.body;
  try {
    await db.query('BEGIN');
    
    const rentalRes = await db.query('SELECT inventory_id, branch_id FROM rentals WHERE id = $1', [id]);
    if(rentalRes.rows.length === 0) throw new Error('Rental not found');
    const { inventory_id, branch_id } = rentalRes.rows[0];

    // Mark as returned and apply fine
    await db.query(`
      UPDATE rentals 
      SET status = 'returned', actual_return_date = CURRENT_DATE, fine_amount = $1 
      WHERE id = $2
    `, [fine_amount || 0, id]);

    // Return to inventory
    await db.query('UPDATE inventory_branches SET stock_level = stock_level + 1 WHERE inventory_id = $1 AND branch_id = $2', [inventory_id, branch_id]);

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/rentals/:id/sell', async (req, res) => {
  const { id } = req.params;
  const { sell_price } = req.body;
  try {
    await db.query('BEGIN');
    
    const rentalRes = await db.query('SELECT * FROM rentals WHERE id = $1', [id]);
    if(rentalRes.rows.length === 0) throw new Error('Rental not found');
    const rental = rentalRes.rows[0];

    // Create an order for the sale
    const orderResult = await db.query(
      'INSERT INTO orders (customer_id, total_amount, order_date, branch_id, payment_method) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4) RETURNING id',
      [rental.customer_id, sell_price, rental.branch_id, 'cash']
    );
    const orderId = orderResult.rows[0].id;

    // Add item to order
    await db.query(
      'INSERT INTO order_items (order_id, inventory_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
      [orderId, rental.inventory_id, 1, sell_price]
    );

    // Update customer total_spent
    await db.query('UPDATE customers SET total_spent = total_spent + $1 WHERE id = $2', [sell_price, rental.customer_id]);

    // Update rental status to 'sold'
    await db.query(`UPDATE rentals SET status = 'sold', actual_return_date = CURRENT_DATE WHERE id = $1`, [id]);

    // Note: We DO NOT increment inventory back because it's sold and already deducted when rented.

    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* =========================================================================
   EMPLOYEES & ATTENDANCE & HR
   ========================================================================= */

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, b.name as branch_name, u.username, u.role as user_role, u.permissions as user_permissions
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN users u ON u.employee_id = e.id
      ${req.user && req.user.role === 'branch_user' ? `WHERE e.branch_id = ${req.user.branch_id}` : ''}
      ORDER BY e.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
  let { name, position, branch_id, basic_salary, phone, join_date, create_account, username, password, role, permissions } = req.body;
  if (req.user && req.user.role === 'branch_user') branch_id = req.user.branch_id;
  
  try {
    await db.query('BEGIN');

    // 1. Insert Employee
    const empResult = await db.query(
      'INSERT INTO employees (name, position, branch_id, basic_salary, phone, join_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, position, branch_id || null, basic_salary || 0, phone, join_date || new Date().toISOString().split('T')[0]]
    );

    // 2. If create_account is true, create user
    if (create_account && username && password) {
      const userCheck = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (userCheck.rows.length > 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً، الرجاء اختيار اسم آخر' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const userPermissions = permissions ? JSON.stringify(permissions) : '[]';
      await db.query(
        'INSERT INTO users (username, password_hash, role, branch_id, permissions, employee_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, password_hash, role || 'branch_user', branch_id || null, userPermissions, empResult.rows[0].id]
      );
    }

    await db.query('COMMIT');
    res.json(empResult.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { name, position, branch_id, basic_salary, phone, join_date, create_account, username, password, role, permissions } = req.body;
  try {
    await db.query('BEGIN');
    
    // 1. Update Employee
    const result = await db.query(
      'UPDATE employees SET name = $1, position = $2, branch_id = $3, basic_salary = $4, phone = $5, join_date = $6 WHERE id = $7 RETURNING *',
      [name, position, branch_id || null, basic_salary || 0, phone, join_date, id]
    );
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }

    // 2. Update or Create User Account
    const userCheck = await db.query('SELECT id FROM users WHERE employee_id = $1', [id]);
    
    if (userCheck.rows.length > 0) {
      // Update existing user
      let updateQuery = 'UPDATE users SET username = $1, role = $2, branch_id = $3, permissions = $4';
      let params = [username, role, branch_id || null, JSON.stringify(permissions || [])];
      
      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        updateQuery += ', password_hash = $5 WHERE employee_id = $6';
        params.push(password_hash, id);
      } else {
        updateQuery += ' WHERE employee_id = $5';
        params.push(id);
      }
      await db.query(updateQuery, params);
    } else if (create_account && username && password) {
      // Create new user if requested
      const usernameExists = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (usernameExists.rows.length > 0) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      await db.query(
        'INSERT INTO users (username, password_hash, role, branch_id, permissions, employee_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, password_hash, role || 'branch_user', branch_id || null, JSON.stringify(permissions || []), id]
      );
    }

    await db.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete attendance and transactions first (or let CASCADE handle it)
    await db.query('DELETE FROM attendance WHERE employee_id = $1', [id]);
    await db.query('DELETE FROM employee_transactions WHERE employee_id = $1', [id]);
    const result = await db.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Record Attendance
app.post('/api/attendance', async (req, res) => {
  const { employee_id, date, check_in, check_out, status, notes } = req.body;
  try {
    // Upsert attendance for the day
    const result = await db.query(
      `INSERT INTO attendance (employee_id, date, check_in, check_out, status, notes) 
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, date) 
       DO UPDATE SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, status = EXCLUDED.status, notes = EXCLUDED.notes
       RETURNING *`,
      [employee_id, date, check_in, check_out, status || 'present', notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Attendance by date
app.get('/api/attendance/:date', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM attendance WHERE date = $1', [req.params.date]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Employee Transactions (Advances, Deductions, Salary Payment)
app.post('/api/employee_transactions', async (req, res) => {
  const { employee_id, type, amount, transaction_date, notes } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO employee_transactions (employee_id, type, amount, transaction_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employee_id, type, amount, transaction_date || new Date().toISOString().split('T')[0], notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get employee summary (Salary + advances - deductions) for a month
app.get('/api/employees/:id/summary', async (req, res) => {
  const { id } = req.params;
  const month = req.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
  try {
    const empRes = await db.query('SELECT basic_salary FROM employees WHERE id = $1', [id]);
    if(empRes.rows.length === 0) return res.status(404).json({error: 'Not found'});
    const basic_salary = Number(empRes.rows[0].basic_salary);

    const transRes = await db.query(
      `SELECT type, SUM(amount) as total 
       FROM employee_transactions 
       WHERE employee_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
       GROUP BY type`,
      [id, month]
    );

    let advances = 0;
    let deductions = 0;
    let bonuses = 0;
    
    transRes.rows.forEach(r => {
      if(r.type === 'advance') advances = Number(r.total);
      if(r.type === 'deduction') deductions = Number(r.total);
      if(r.type === 'bonus') bonuses = Number(r.total);
    });

    const net_salary = basic_salary + bonuses - advances - deductions;
    res.json({ basic_salary, advances, deductions, bonuses, net_salary, month });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* =========================================================================
   EXPENSES
   ========================================================================= */

app.get('/api/expenses', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, b.name as branch_name 
      FROM expenses e
      LEFT JOIN branches b ON e.branch_id = b.id
      ${req.user && req.user.role === 'branch_user' ? `WHERE e.branch_id = ${req.user.branch_id}` : ''}
      ORDER BY e.expense_date DESC, e.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/expenses', async (req, res) => {
  let { branch_id, category, amount, expense_date, notes } = req.body;
  if (req.user && req.user.role === 'branch_user') branch_id = req.user.branch_id;
  try {
    const result = await db.query(
      'INSERT INTO expenses (branch_id, category, amount, expense_date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [branch_id, category, amount, expense_date || new Date().toISOString().split('T')[0], notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* =========================================================================
   REPORTS
   ========================================================================= */

app.get('/api/reports/profit', async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
  
  try {
    // 1. Get Branches (excluding main warehouse from sales reports)
    let branchQuery = 'SELECT id, name FROM branches WHERE is_main_warehouse = false';
    let params = [];
    if (req.user && req.user.role === 'branch_user') {
      branchQuery += ' AND id = $1';
      params.push(req.user.branch_id);
    }
    const branchesRes = await db.query(branchQuery, params);
    const branches = branchesRes.rows;

    const report = [];

    for (const branch of branches) {
      // 2. Sales (Orders total + Fines from rentals)
      const salesRes = await db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total 
         FROM orders 
         WHERE branch_id = $1 AND TO_CHAR(order_date, 'YYYY-MM') = $2`, 
        [branch.id, month]
      );
      
      const finesRes = await db.query(
        `SELECT COALESCE(SUM(fine_amount), 0) as total 
         FROM rentals 
         WHERE branch_id = $1 AND TO_CHAR(return_date, 'YYYY-MM') = $2`, 
        [branch.id, month]
      );
      
      const total_sales = Number(salesRes.rows[0].total) + Number(finesRes.rows[0].total);

      // 3. Cost of Goods Sold (simplified: total cost of items sold this month)
      const cogsRes = await db.query(
        `SELECT COALESCE(SUM(oi.quantity * COALESCE((SELECT AVG(cost_price) FROM supply_records WHERE inventory_id = oi.inventory_id), 0)), 0) as total 
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.branch_id = $1 AND TO_CHAR(o.order_date, 'YYYY-MM') = $2`,
        [branch.id, month]
      );
      const cogs = Number(cogsRes.rows[0].total);

      // 4. Expenses
      const expRes = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM expenses 
         WHERE branch_id = $1 AND TO_CHAR(expense_date, 'YYYY-MM') = $2`,
        [branch.id, month]
      );
      const expenses = Number(expRes.rows[0].total);

      // 5. Salaries & Advances & Deductions (Net Salary Paid)
      const empRes = await db.query(
        `SELECT id, basic_salary FROM employees WHERE branch_id = $1`, [branch.id]
      );
      
      let total_salaries_paid = 0;
      for (const emp of empRes.rows) {
         const transRes = await db.query(
           `SELECT type, SUM(amount) as total 
            FROM employee_transactions 
            WHERE employee_id = $1 AND TO_CHAR(transaction_date, 'YYYY-MM') = $2
            GROUP BY type`,
           [emp.id, month]
         );
         let adv = 0, ded = 0, bon = 0;
         transRes.rows.forEach(r => {
           if(r.type === 'advance') adv = Number(r.total);
           if(r.type === 'deduction') ded = Number(r.total);
           if(r.type === 'bonus') bon = Number(r.total);
         });
         total_salaries_paid += (Number(emp.basic_salary) + bon - adv - ded);
      }

      // Net Profit = Sales - (COGS + Expenses + Salaries)
      const net_profit = total_sales - (cogs + expenses + total_salaries_paid);

      report.push({
        branch_id: branch.id,
        branch_name: branch.name,
        total_sales,
        cogs,
        expenses,
        total_salaries_paid,
        net_profit
      });
    }

    // Totals across all branches
    const summary = report.reduce((acc, curr) => {
       acc.total_sales += curr.total_sales;
       acc.cogs += curr.cogs;
       acc.expenses += curr.expenses;
       acc.total_salaries_paid += curr.total_salaries_paid;
       acc.net_profit += curr.net_profit;
       return acc;
    }, { total_sales: 0, cogs: 0, expenses: 0, total_salaries_paid: 0, net_profit: 0 });

    res.json({ month, branch_reports: report, summary });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/reports/top-products', async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7); // YYYY-MM
  
  try {
    let branchFilterSales = '';
    let branchFilterRentals = '';
    let params = [month];
    if (req.user && req.user.role === 'branch_user') {
      branchFilterSales = 'AND o.branch_id = $2';
      branchFilterRentals = 'AND r.branch_id = $2';
      params.push(req.user.branch_id);
    }

    // Top 5 Selling Products
    const topSalesRes = await db.query(
      `SELECT i.name, i.category, i.color, i.size, b.name as branch_name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * oi.price_at_time) as revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN inventory i ON oi.inventory_id = i.id
       LEFT JOIN branches b ON o.branch_id = b.id
       WHERE TO_CHAR(o.order_date, 'YYYY-MM') = $1 AND b.is_main_warehouse = false ${branchFilterSales}
       GROUP BY i.id, i.name, i.category, i.color, i.size, b.name
       ORDER BY total_sold DESC
       LIMIT 5`,
      params
    );

    // Top 5 Rented Products
    const topRentalsRes = await db.query(
      `SELECT i.name, i.category, i.color, i.size, b.name as branch_name, COUNT(r.id) as times_rented, SUM(r.total_price) as rental_revenue
       FROM rentals r
       JOIN inventory i ON r.inventory_id = i.id
       LEFT JOIN branches b ON r.branch_id = b.id
       WHERE TO_CHAR(r.rental_date, 'YYYY-MM') = $1 AND b.is_main_warehouse = false ${branchFilterRentals}
       GROUP BY i.id, i.name, i.category, i.color, i.size, b.name
       ORDER BY times_rented DESC
       LIMIT 5`,
      params
    );

    res.json({
      top_sales: topSalesRes.rows,
      top_rentals: topRentalsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* =========================================================================
   ALTERATIONS (Tailoring & Adjustments)
   ========================================================================= */

app.get('/api/alterations', async (req, res) => {
  try {
    let query = `
      SELECT alt.*, c.name as customer_name, b.name as branch_name 
      FROM alterations alt
      LEFT JOIN customers c ON alt.customer_id = c.id
      LEFT JOIN branches b ON alt.branch_id = b.id
    `;
    let params = [];
    
    if (req.user.role === 'branch_user') {
      query += ` WHERE alt.branch_id = $1`;
      params.push(req.user.branch_id);
    }

    query += ` ORDER BY alt.created_at DESC`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/alterations', async (req, res) => {
  const { order_id, customer_id, description, due_date } = req.body;
  const branch_id = req.user.branch_id || req.body.branch_id || 1;
  try {
    const { rows } = await db.query(
      'INSERT INTO alterations (order_id, customer_id, branch_id, description, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order_id, customer_id, branch_id, description, due_date]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/alterations/:id', async (req, res) => {
  const { id } = req.params;
  const { status, description, due_date } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE alterations SET status = COALESCE($1, status), description = COALESCE($2, description), due_date = COALESCE($3, due_date) WHERE id = $4 RETURNING *',
      [status, description, due_date, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
