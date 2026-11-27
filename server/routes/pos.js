import { Router } from 'express';
import { one, many, q, tx } from '../db.js';
import { requireAuth, requireTenant, requireRole, h } from '../auth.js';

const r = Router();
r.use(requireAuth, requireTenant);

r.get('/catalog', h(async (req, res) => {
  const tid = req.user.tid;
  const [tenant, categories, products, tables, customers, staff] = await Promise.all([
    one('SELECT id, name, currency, tax_rate, tax_inclusive, receipt_footer, phone, address, city, accent FROM tenants WHERE id=$1', [tid]),
    many('SELECT * FROM categories WHERE tenant_id=$1 ORDER BY sort, name', [tid]),
    many('SELECT id, category_id, name, sku, barcode, price, emoji, description, track_stock, stock, low_stock, to_kitchen FROM products WHERE tenant_id=$1 AND active ORDER BY name', [tid]),
    many('SELECT * FROM floor_tables WHERE tenant_id=$1 ORDER BY area, name', [tid]),
    many('SELECT id, name, phone, points FROM customers WHERE tenant_id=$1 ORDER BY name LIMIT 500', [tid]),
    many('SELECT id, name, role FROM users WHERE tenant_id=$1 AND active ORDER BY name', [tid]),
  ]);
  res.json({ tenant, categories, products, tables, customers, staff, fetched_at: new Date().toISOString() });
}));

// Orders arrive one-by-one when online or in a batch after reconnecting.
// client_ref makes this idempotent: a retried upload never creates a duplicate sale.
r.post('/orders/sync', h(async (req, res) => {
  const tid = req.user.tid;
  const incoming = Array.isArray(req.body?.orders) ? req.body.orders.slice(0, 200) : [];
  const results = [];
  for (const o of incoming) {
    try {
      const out = await tx(async (c) => {
        const dup = await c.query('SELECT id, number FROM orders WHERE tenant_id=$1 AND client_ref=$2', [tid, o.client_ref]);
        if (dup.rows[0]) return { client_ref: o.client_ref, id: dup.rows[0].id, number: dup.rows[0].number, status: 'duplicate' };
        const lines = (o.items || []).filter((i) => i.qty > 0);
        if (!lines.length) throw new Error('Order has no items');
        const subtotal = lines.reduce((s, i) => s + Number(i.unit_price) * Number(i.qty), 0);
        const discount = Math.min(Number(o.discount || 0), subtotal);
        const t = await c.query('SELECT tax_rate, tax_inclusive FROM tenants WHERE id=$1', [tid]);
        const rate = Number(t.rows[0].tax_rate) / 100;
        const base = subtotal - discount;
        const tax = t.rows[0].tax_inclusive ? Math.round(base - base / (1 + rate)) : Math.round(base * rate);
        const total = t.rows[0].tax_inclusive ? base : base + tax;
        const anyKitchen = lines.some((i) => i.to_kitchen !== false);
        const ins = await c.query(
          `INSERT INTO orders (tenant_id, client_ref, number, order_type, table_id, customer_id, user_id, status, kitchen_status,
             subtotal, discount, tax, total, note, device, created_offline, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, number`,
          [tid, o.client_ref, o.number, o.order_type || 'takeaway', o.table_id || null, o.customer_id || null, req.user.uid,
            anyKitchen ? 'new' : 'none', subtotal, discount, tax, total, o.note || null, o.device || null, !!o.created_offline,
            o.created_at ? new Date(o.created_at) : new Date()]
        );
        const oid = ins.rows[0].id;
        for (const i of lines) {
          const p = i.product_id ? (await c.query('SELECT cost, track_stock FROM products WHERE id=$1 AND tenant_id=$2', [i.product_id, tid])).rows[0] : null;
          await c.query(`INSERT INTO order_items (order_id, product_id, name, qty, unit_price, cost, note, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [oid, p ? i.product_id : null, i.name, i.qty, i.unit_price, p?.cost || 0, i.note || null, Number(i.unit_price) * Number(i.qty)]);
          if (p?.track_stock) {
            await c.query('UPDATE products SET stock = stock - $1 WHERE id=$2', [i.qty, i.product_id]);
            await c.query(`INSERT INTO stock_moves (tenant_id, product_id, qty, reason, ref) VALUES ($1,$2,$3,'sale',$4)`, [tid, i.product_id, -i.qty, ins.rows[0].number]);
          }
        }
        for (const p of o.payments || []) {
          if (Number(p.amount) > 0) await c.query('INSERT INTO payments (order_id, method, amount, reference) VALUES ($1,$2,$3,$4)', [oid, p.method, p.amount, p.reference || null]);
        }
        if (o.customer_id) await c.query('UPDATE customers SET points = points + $1 WHERE id=$2 AND tenant_id=$3', [Math.floor(total / 1000), o.customer_id, tid]);
        return { client_ref: o.client_ref, id: oid, number: ins.rows[0].number, status: 'created' };
      });
      results.push(out);
    } catch (e) {
      results.push({ client_ref: o.client_ref, status: 'error', error: e.message });
    }
  }
  res.json({ results });
}));

r.get('/orders', h(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const search = `%${req.query.search || ''}%`;
  const rows = await many(
    `SELECT o.*, t.name AS table_name, c.name AS customer_name, u.name AS cashier,
       (SELECT json_agg(json_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total, 'note', i.note)) FROM order_items i WHERE i.order_id=o.id) AS items,
       (SELECT json_agg(json_build_object('method', p.method, 'amount', p.amount)) FROM payments p WHERE p.order_id=o.id) AS payments
     FROM orders o LEFT JOIN floor_tables t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=o.user_id
     WHERE o.tenant_id=$1 AND (o.number ILIKE $2 OR coalesce(c.name,'') ILIKE $2)
     ORDER BY o.created_at DESC LIMIT $3`, [req.user.tid, search, limit]);
  res.json(rows);
}));

r.get('/kitchen', h(async (req, res) => {
  const rows = await many(
    `SELECT o.id, o.number, o.order_type, o.kitchen_status, o.note, o.created_at, t.name AS table_name, u.name AS cashier,
       (SELECT json_agg(json_build_object('name', i.name, 'qty', i.qty, 'note', i.note) ORDER BY i.id) FROM order_items i
          LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id=o.id AND coalesce(p.to_kitchen, true)) AS items
     FROM orders o LEFT JOIN floor_tables t ON t.id=o.table_id LEFT JOIN users u ON u.id=o.user_id
     WHERE o.tenant_id=$1 AND o.kitchen_status IN ('new','preparing','ready') AND o.created_at > now() - interval '1 day'
     ORDER BY o.created_at ASC`, [req.user.tid]);
  res.json(rows.filter((o) => o.items));
}));

r.patch('/orders/:id/kitchen', h(async (req, res) => {
  const status = req.body?.status;
  if (!['new', 'preparing', 'ready', 'served'].includes(status)) return res.status(400).json({ error: 'Unknown kitchen status.' });
  const row = await one('UPDATE orders SET kitchen_status=$1 WHERE id=$2 AND tenant_id=$3 RETURNING id, kitchen_status', [status, req.params.id, req.user.tid]);
  res.json(row);
}));

r.post('/orders/:id/refund', requireRole('owner', 'manager'), h(async (req, res) => {
  const out = await tx(async (c) => {
    const o = (await c.query(`UPDATE orders SET status='refunded', kitchen_status='served' WHERE id=$1 AND tenant_id=$2 AND status='paid' RETURNING *`, [req.params.id, req.user.tid])).rows[0];
    if (!o) return null;
    const items = (await c.query('SELECT product_id, qty FROM order_items WHERE order_id=$1', [o.id])).rows;
    for (const i of items) if (i.product_id) await c.query('UPDATE products SET stock = stock + $1 WHERE id=$2 AND track_stock', [i.qty, i.product_id]);
    await c.query(`INSERT INTO audit_log (tenant_id, user_id, action, detail) VALUES ($1,$2,'refund',$3)`, [req.user.tid, req.user.uid, JSON.stringify({ order: o.number, total: o.total })]);
    return o;
  });
  if (!out) return res.status(400).json({ error: 'Only paid orders can be refunded.' });
  res.json(out);
}));

// Which tables have food on the way, for the floor plan.
r.get('/tables/status', h(async (req, res) => {
  const rows = await many(
    `SELECT table_id, count(*)::int AS orders, sum(total) AS total, min(created_at) AS since, max(kitchen_status) AS kitchen_status
     FROM orders WHERE tenant_id=$1 AND table_id IS NOT NULL AND kitchen_status IN ('new','preparing','ready') AND created_at > now() - interval '6 hours'
     GROUP BY table_id`, [req.user.tid]);
  res.json(rows);
}));

r.post('/customers', h(async (req, res) => {
  const { name, phone, email } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Add the customer’s name.' });
  res.json(await one('INSERT INTO customers (tenant_id, name, phone, email) VALUES ($1,$2,$3,$4) RETURNING id, name, phone, points', [req.user.tid, name, phone, email]));
}));

export default r;
