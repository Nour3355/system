const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf-8');

// Filter Rentals
server = server.replace(
  `const { rows } = await db.query('SELECT * FROM rentals ORDER BY booking_date DESC');`,
  `let query = 'SELECT * FROM rentals';
    let params = [];
    if (req.user && req.user.role === 'branch_user') {
      query += ' WHERE branch_id = $1';
      params.push(req.user.branch_id);
    }
    query += ' ORDER BY booking_date DESC';
    const { rows } = await db.query(query, params);`
);

// Filter Employees
server = server.replace(
  `SELECT e.*, b.name as branch_name 
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      ORDER BY e.name ASC`,
  `SELECT e.*, b.name as branch_name 
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      \${req.user && req.user.role === 'branch_user' ? \`WHERE e.branch_id = \${req.user.branch_id}\` : ''}
      ORDER BY e.name ASC`
);

// Filter Expenses
server = server.replace(
  `SELECT e.*, b.name as branch_name 
      FROM expenses e
      LEFT JOIN branches b ON e.branch_id = b.id
      ORDER BY e.expense_date DESC, e.id DESC`,
  `SELECT e.*, b.name as branch_name 
      FROM expenses e
      LEFT JOIN branches b ON e.branch_id = b.id
      \${req.user && req.user.role === 'branch_user' ? \`WHERE e.branch_id = \${req.user.branch_id}\` : ''}
      ORDER BY e.expense_date DESC, e.id DESC`
);

// Fix POST /api/orders to use req.user.branch_id if available
server = server.replace(
  `const { customer_id, order_items, total_amount, branch_id, payment_method } = req.body;`,
  `const { customer_id, order_items, total_amount, payment_method } = req.body;
  const branch_id = (req.user && req.user.role === 'branch_user') ? req.user.branch_id : req.body.branch_id || 1;`
);

// Fix POST /api/expenses
server = server.replace(
  `const { branch_id, category, amount, expense_date, notes } = req.body;`,
  `let { branch_id, category, amount, expense_date, notes } = req.body;
  if (req.user && req.user.role === 'branch_user') branch_id = req.user.branch_id;`
);

// Fix POST /api/employees
server = server.replace(
  `const { name, position, branch_id, basic_salary, phone, join_date } = req.body;`,
  `let { name, position, branch_id, basic_salary, phone, join_date } = req.body;
  if (req.user && req.user.role === 'branch_user') branch_id = req.user.branch_id;`
);

fs.writeFileSync('server.js', server, 'utf-8');
console.log('Patched server.js with RBAC restrictions');
