import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, many, q, tx } from '../db.js';
import { requireAuth, requireTenant, requireRole, h } from '../auth.js';

const r = Router();
r.use(requireAuth, requireTenant, requireRole('owner', 'manager'));

const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);

r.get('/stats', h(async (req, res) => {
  const tid = req.user.tid;
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const cur = `o.created_at >= now() - ($2 || ' days')::interval`;
  const prev = `o.created_at < now() - ($2 || ' days')::interval AND o.created_at >= now() - ($2::int * 2 || ' days')::interval`;
  const p = [tid, String(days)];

  const kpi = async (where) => one(
    `SELECT coalesce(sum(o.total),0) AS revenue, count(*)::int AS orders, coalesce(avg(o.total),0) AS avg_ticket,
       coalesce(sum(o.discount),0) AS discounts,
       coalesce((SELECT sum(i.line_total - i.cost*i.qty) FROM order_items i JOIN orders o2 ON o2.id=i.order_id
          WHERE o2.tenant_id=$1 AND o2.status='paid' AND ${where.replaceAll('o.', 'o2.')}),0) AS gross_profit
     FROM orders o WHERE o.tenant_id=$1 AND o.status='paid' AND ${where}`, p);

  const [now, before, daily, hourly, top, byCat, payMix, typeMix, lowStock, recent, staff, today] = await Promise.all([
    kpi(cur), kpi(prev),
    many(`SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(o.total),0) AS revenue, count(o.id)::int AS orders
          FROM generate_series(date_trunc('day', now()) - ($2::int - 1 || ' days')::interval, date_trunc('day', now()), '1 day') d
          LEFT JOIN orders o ON o.tenant_id=$1 AND o.status='paid' AND date_trunc('day', o.created_at)=d
          GROUP BY d ORDER BY d`, p),
    many(`SELECT extract(dow FROM o.created_at)::int AS dow, extract(hour FROM o.created_at)::int AS hour, count(*)::int AS orders
          FROM orders o WHERE o.tenant_id=$1 AND o.status='paid' AND ${cur} GROUP BY 1,2`, p),
    many(`SELECT i.name, max(pr.emoji) AS emoji, sum(i.qty)::float AS qty, sum(i.line_total) AS revenue
          FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN products pr ON pr.id=i.product_id
          WHERE o.tenant_id=$1 AND o.status='paid' AND ${cur} GROUP BY i.name ORDER BY revenue DESC LIMIT 8`, p),
    many(`SELECT coalesce(c.name,'Other') AS name, max(c.color) AS color, sum(i.line_total) AS revenue
          FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN products pr ON pr.id=i.product_id LEFT JOIN categories c ON c.id=pr.category_id
          WHERE o.tenant_id=$1 AND o.status='paid' AND ${cur} GROUP BY 1 ORDER BY revenue DESC`, p),
    many(`SELECT pa.method, sum(pa.amount) AS amount, count(*)::int AS count FROM payments pa JOIN orders o ON o.id=pa.order_id
          WHERE o.tenant_id=$1 AND o.status='paid' AND ${cur} GROUP BY 1 ORDER BY amount DESC`, p),
    many(`SELECT o.order_type AS type, count(*)::int AS orders, sum(o.total) AS revenue FROM orders o
          WHERE o.tenant_id=$1 AND o.status='paid' AND ${cur} GROUP BY 1`, p),
    many(`SELECT id, name, emoji, stock, low_stock FROM products WHERE tenant_id=$1 AND active AND track_stock AND stock <= low_stock ORDER BY stock LIMIT 10`, [tid]),
    many(`SELECT o.id, o.number, o.total, o.order_type, o.status, o.created_at, o.created_offline, u.name AS cashier
          FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.tenant_id=$1 ORDER BY o.created_at DESC LIMIT 8`, [tid]),
    many(`SELECT u.name, u.role, count(o.id)::int AS orders, coalesce(sum(o.total),0) AS revenue
          FROM users u LEFT JOIN orders o ON o.user_id=u.id AND o.status='paid' AND ${cur}
          WHERE u.tenant_id=$1 AND u.role <> 'kitchen' GROUP BY u.id ORDER BY revenue DESC`, p),
    one(`SELECT coalesce(sum(total),0) AS revenue, count(*)::int AS orders FROM orders WHERE tenant_id=$1 AND status='paid' AND created_at >= date_trunc('day', now())`, [tid]),
  ]);

  res.json({
    days,
    kpis: {
      revenue: now.revenue, orders: now.orders, avg_ticket: now.avg_ticket, gross_profit: now.gross_profit, discounts: now.discounts,
      change: {
        revenue: pct(now.revenue, before.revenue), orders: pct(now.orders, before.orders),
        avg_ticket: pct(now.avg_ticket, before.avg_ticket), gross_profit: pct(now.gross_profit, before.gross_profit),
      },
    },
    today, daily, hourly, top, byCat, payMix, typeMix, lowStock, recent, staff,
  });
}));

/* ---------- Products & categories ---------- */
r.get('/products', h(async (req, res) => {
  res.json(await many(`SELECT p.*, c.name AS category_name, c.color AS category_color FROM products p LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.tenant_id=$1 ORDER BY p.active DESC, p.name`, [req.user.tid]));
}));

const PRODUCT_FIELDS = ['category_id', 'name', 'sku', 'barcode', 'price', 'cost', 'emoji', 'description', 'track_stock', 'stock', 'low_stock', 'to_kitchen', 'active'];
const pickFields = (body, fields) => fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f] === '' ? null : body[f]]);

r.post('/products', h(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Give the product a name.' });
  const f = pickFields({ emoji: '🍽️', price: 0, cost: 0, stock: 0, ...b }, PRODUCT_FIELDS);
  const row = await one(`INSERT INTO products (tenant_id, ${f.map(([k]) => k).join(',')}) VALUES ($1, ${f.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`,
    [req.user.tid, ...f.map(([, v]) => v)]);
  res.json(row);
}));

r.patch('/products/:id', h(async (req, res) => {
  const f = pickFields(req.body || {}, PRODUCT_FIELDS);
  if (!f.length) return res.json(await one('SELECT * FROM products WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]));
  const row = await one(`UPDATE products SET ${f.map(([k], i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, ...f.map(([, v]) => v)]);
  res.json(row);
}));

r.delete('/products/:id', h(async (req, res) => {
  // Archive rather than delete, so past receipts keep their history.
  await q('UPDATE products SET active=false WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  res.json({ ok: true });
}));

r.post('/products/:id/stock', h(async (req, res) => {
  const qty = Number(req.body?.qty || 0);
  const reason = ['restock', 'adjustment', 'waste'].includes(req.body?.reason) ? req.body.reason : 'adjustment';
  const row = await tx(async (c) => {
    const p = (await c.query('UPDATE products SET stock = stock + $1 WHERE id=$2 AND tenant_id=$3 RETURNING *', [qty, req.params.id, req.user.tid])).rows[0];
    if (p) await c.query('INSERT INTO stock_moves (tenant_id, product_id, qty, reason) VALUES ($1,$2,$3,$4)', [req.user.tid, p.id, qty, reason]);
    return p;
  });
  res.json(row);
}));

r.get('/categories', h(async (req, res) => {
  res.json(await many(`SELECT c.*, (SELECT count(*)::int FROM products p WHERE p.category_id=c.id AND p.active) AS products
    FROM categories c WHERE tenant_id=$1 ORDER BY sort, name`, [req.user.tid]));
}));
r.post('/categories', h(async (req, res) => {
  const { name, color = '#2357D9', icon = '🍽️' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Give the category a name.' });
  res.json(await one('INSERT INTO categories (tenant_id, name, color, icon, sort) VALUES ($1,$2,$3,$4,(SELECT coalesce(max(sort),0)+1 FROM categories WHERE tenant_id=$1)) RETURNING *',
    [req.user.tid, name, color, icon]));
}));
r.patch('/categories/:id', h(async (req, res) => {
  const f = pickFields(req.body || {}, ['name', 'color', 'icon', 'sort']);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE categories SET ${f.map(([k], i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, ...f.map(([, v]) => v)]));
}));
r.delete('/categories/:id', h(async (req, res) => {
  await q('DELETE FROM categories WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  res.json({ ok: true });
}));

/* ---------- Orders ---------- */
r.get('/orders', h(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const size = 25;
  const status = req.query.status || null;
  const search = `%${req.query.search || ''}%`;
  const where = `o.tenant_id=$1 AND ($2::text IS NULL OR o.status=$2) AND (o.number ILIKE $3 OR coalesce(c.name,'') ILIKE $3 OR coalesce(u.name,'') ILIKE $3)`;
  const [rows, count] = await Promise.all([
    many(`SELECT o.*, t.name AS table_name, c.name AS customer_name, u.name AS cashier,
            (SELECT json_agg(json_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total)) FROM order_items i WHERE i.order_id=o.id) AS items,
            (SELECT json_agg(json_build_object('method', p.method, 'amount', p.amount)) FROM payments p WHERE p.order_id=o.id) AS payments
          FROM orders o LEFT JOIN floor_tables t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=o.user_id
          WHERE ${where} ORDER BY o.created_at DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, [req.user.tid, status, search]),
    one(`SELECT count(*)::int AS n FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=o.user_id WHERE ${where}`, [req.user.tid, status, search]),
  ]);
  res.json({ rows, total: count.n, page, pages: Math.ceil(count.n / size) });
}));

/* ---------- Customers ---------- */
r.get('/customers', h(async (req, res) => {
  res.json(await many(`SELECT c.*, count(o.id)::int AS visits, coalesce(sum(o.total),0) AS spent, max(o.created_at) AS last_visit
    FROM customers c LEFT JOIN orders o ON o.customer_id=c.id AND o.status='paid'
    WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY spent DESC`, [req.user.tid]));
}));
r.post('/customers', h(async (req, res) => {
  const { name, phone, email } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Add the customer’s name.' });
  res.json(await one('INSERT INTO customers (tenant_id, name, phone, email) VALUES ($1,$2,$3,$4) RETURNING *', [req.user.tid, name, phone, email]));
}));
r.patch('/customers/:id', h(async (req, res) => {
  const f = pickFields(req.body || {}, ['name', 'phone', 'email', 'points']);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE customers SET ${f.map(([k], i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, ...f.map(([, v]) => v)]));
}));
r.delete('/customers/:id', h(async (req, res) => {
  await q('DELETE FROM customers WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  res.json({ ok: true });
}));

/* ---------- Staff ---------- */
r.get('/users', h(async (req, res) => {
  res.json(await many(`SELECT id, name, email, role, active, last_login, created_at, (pin IS NOT NULL) AS has_pin FROM users WHERE tenant_id=$1 ORDER BY active DESC, name`, [req.user.tid]));
}));
r.post('/users', requireRole('owner'), h(async (req, res) => {
  const { name, email, password, pin, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and a password are needed.' });
  if (!['owner', 'manager', 'cashier', 'kitchen'].includes(role)) return res.status(400).json({ error: 'Pick a role.' });
  const limit = await one(`SELECT p.max_users, (SELECT count(*)::int FROM users WHERE tenant_id=$1 AND active) AS used FROM tenants t JOIN plans p ON p.code=t.plan_code WHERE t.id=$1`, [req.user.tid]);
  if (limit && limit.used >= limit.max_users) return res.status(400).json({ error: `Your plan allows ${limit.max_users} active staff. Upgrade the plan to add more.` });
  try {
    res.json(await one('INSERT INTO users (tenant_id, name, email, password_hash, pin, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, active',
      [req.user.tid, name, email.toLowerCase(), bcrypt.hashSync(password, 10), pin || null, role]));
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Someone already uses that email.' });
    throw e;
  }
}));
r.patch('/users/:id', requireRole('owner'), h(async (req, res) => {
  const b = { ...req.body };
  if (b.password) b.password_hash = bcrypt.hashSync(b.password, 10);
  const f = pickFields(b, ['name', 'role', 'active', 'pin', 'password_hash']);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE users SET ${f.map(([k], i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING id, name, email, role, active`,
    [req.params.id, req.user.tid, ...f.map(([, v]) => v)]));
}));

/* ---------- Floor plan ---------- */
r.get('/tables', h(async (req, res) => res.json(await many('SELECT * FROM floor_tables WHERE tenant_id=$1 ORDER BY area, name', [req.user.tid]))));
r.post('/tables', h(async (req, res) => {
  const { name, seats = 4, area = 'Main hall', shape = 'square', x = 10, y = 10 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name the table.' });
  res.json(await one('INSERT INTO floor_tables (tenant_id, name, seats, area, shape, x, y) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [req.user.tid, name, seats, area, shape, x, y]));
}));
r.patch('/tables/:id', h(async (req, res) => {
  const f = pickFields(req.body || {}, ['name', 'seats', 'area', 'shape', 'x', 'y']);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE floor_tables SET ${f.map(([k], i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, ...f.map(([, v]) => v)]));
}));
r.delete('/tables/:id', h(async (req, res) => {
  await q('DELETE FROM floor_tables WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  res.json({ ok: true });
}));

/* ---------- Business settings ---------- */
r.get('/settings', h(async (req, res) => {
  res.json(await one(`SELECT t.*, p.name AS plan_name, p.price_monthly, p.max_terminals, p.max_users, p.features
    FROM tenants t JOIN plans p ON p.code=t.plan_code WHERE t.id=$1`, [req.user.tid]));
}));
r.patch('/settings', requireRole('owner'), h(async (req, res) => {
  const f = pickFields(req.body || {}, ['name', 'currency', 'tax_rate', 'tax_inclusive', 'phone', 'email', 'address', 'city', 'country', 'receipt_footer', 'accent']);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE tenants SET ${f.map(([k], i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [req.user.tid, ...f.map(([, v]) => v)]));
}));

export default r;
