import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, many, q, tx } from '../db.js';
import { requireAuth, requireRole, sign, h } from '../auth.js';

const r = Router();
r.use(requireAuth, requireRole('superadmin'));

r.get('/overview', h(async (req, res) => {
  const [totals, mrr, gmv, prevGmv, series, signups, planMix, top, statusMix, offline] = await Promise.all([
    one(`SELECT count(*)::int AS tenants, count(*) FILTER (WHERE status='active')::int AS active, count(*) FILTER (WHERE status='trial')::int AS trial,
           count(*) FILTER (WHERE status='suspended')::int AS suspended, (SELECT count(*)::int FROM users WHERE tenant_id IS NOT NULL AND active) AS users FROM tenants`),
    one(`SELECT coalesce(sum(p.price_monthly),0) AS mrr FROM tenants t JOIN plans p ON p.code=t.plan_code WHERE t.status='active'`),
    one(`SELECT coalesce(sum(total),0) AS gmv, count(*)::int AS orders FROM orders WHERE status='paid' AND created_at >= now() - interval '30 days'`),
    one(`SELECT coalesce(sum(total),0) AS gmv, count(*)::int AS orders FROM orders WHERE status='paid' AND created_at < now() - interval '30 days' AND created_at >= now() - interval '60 days'`),
    many(`SELECT to_char(d,'YYYY-MM-DD') AS day, coalesce(sum(o.total),0) AS gmv, count(o.id)::int AS orders
          FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), '1 day') d
          LEFT JOIN orders o ON o.status='paid' AND date_trunc('day', o.created_at)=d GROUP BY d ORDER BY d`),
    many(`SELECT to_char(date_trunc('month', created_at),'Mon YY') AS month, count(*)::int AS signups, min(created_at) AS m
          FROM tenants GROUP BY date_trunc('month', created_at) ORDER BY m`),
    many(`SELECT p.name, p.code, count(t.id)::int AS tenants, p.price_monthly FROM plans p LEFT JOIN tenants t ON t.plan_code=p.code GROUP BY p.id ORDER BY p.price_monthly`),
    many(`SELECT t.id, t.name, t.city, t.plan_code, coalesce(sum(o.total),0) AS gmv, count(o.id)::int AS orders
          FROM tenants t LEFT JOIN orders o ON o.tenant_id=t.id AND o.status='paid' AND o.created_at >= now() - interval '30 days'
          GROUP BY t.id ORDER BY gmv DESC LIMIT 6`),
    many(`SELECT status, count(*)::int AS n FROM tenants GROUP BY status`),
    one(`SELECT count(*) FILTER (WHERE created_offline)::int AS offline, count(*)::int AS total FROM orders WHERE created_at >= now() - interval '30 days'`),
  ]);
  const change = (a, b) => (b ? ((a - b) / b) * 100 : null);
  res.json({
    totals, mrr: mrr.mrr, arr: mrr.mrr * 12,
    gmv: gmv.gmv, orders: gmv.orders,
    change: { gmv: change(gmv.gmv, prevGmv.gmv), orders: change(gmv.orders, prevGmv.orders) },
    series, signups, planMix, top, statusMix, offline,
  });
}));

r.get('/plans', h(async (req, res) => res.json(await many('SELECT * FROM plans ORDER BY price_monthly'))));

r.get('/tenants', h(async (req, res) => {
  res.json(await many(`SELECT t.*, p.name AS plan_name, p.price_monthly,
      (SELECT count(*)::int FROM users u WHERE u.tenant_id=t.id AND u.active) AS users,
      (SELECT coalesce(sum(total),0) FROM orders o WHERE o.tenant_id=t.id AND o.status='paid' AND o.created_at >= now() - interval '30 days') AS gmv_30d,
      (SELECT max(created_at) FROM orders o WHERE o.tenant_id=t.id) AS last_order,
      (SELECT email FROM users u WHERE u.tenant_id=t.id AND u.role='owner' ORDER BY id LIMIT 1) AS owner_email
    FROM tenants t JOIN plans p ON p.code=t.plan_code ORDER BY t.created_at DESC`));
}));

r.post('/tenants', h(async (req, res) => {
  const { name, industry = 'restaurant', plan_code = 'starter', status = 'trial', city = 'Kampala', owner_name, owner_email, owner_password } = req.body || {};
  if (!name || !owner_email || !owner_password) return res.status(400).json({ error: 'Business name, owner email and password are needed.' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  try {
    const out = await tx(async (c) => {
      const t = (await c.query(`INSERT INTO tenants (name, slug, industry, plan_code, status, city) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, slug, industry, plan_code, status, city])).rows[0];
      await c.query(`INSERT INTO users (tenant_id, name, email, password_hash, pin, role) VALUES ($1,$2,$3,$4,'1111','owner')`,
        [t.id, owner_name || `${name} Owner`, owner_email.toLowerCase(), bcrypt.hashSync(owner_password, 10)]);
      await c.query(`INSERT INTO categories (tenant_id, name, color, icon) VALUES ($1,'General','#2357D9','🛍️')`, [t.id]);
      await c.query(`INSERT INTO audit_log (user_id, action, detail) VALUES ($1,'tenant.create',$2)`, [req.user.uid, JSON.stringify({ tenant: t.id, name })]);
      return t;
    });
    res.json(out);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'That owner email is already in use.' });
    throw e;
  }
}));

r.patch('/tenants/:id', h(async (req, res) => {
  const { status, plan_code, name } = req.body || {};
  const row = await one(`UPDATE tenants SET status=coalesce($2,status), plan_code=coalesce($3,plan_code), name=coalesce($4,name) WHERE id=$1 RETURNING *`,
    [req.params.id, status || null, plan_code || null, name || null]);
  await q(`INSERT INTO audit_log (user_id, action, detail) VALUES ($1,'tenant.update',$2)`, [req.user.uid, JSON.stringify({ tenant: Number(req.params.id), status, plan_code })]);
  res.json(row);
}));

// Support access: sign in as the business owner to troubleshoot. Every use is written to the audit log.
r.post('/tenants/:id/impersonate', h(async (req, res) => {
  const u = await one(`SELECT * FROM users WHERE tenant_id=$1 AND role='owner' AND active ORDER BY id LIMIT 1`, [req.params.id]);
  if (!u) return res.status(404).json({ error: 'This business has no active owner account.' });
  const tenant = await one('SELECT id, name, slug, currency, tax_rate, tax_inclusive, status, plan_code, receipt_footer, accent FROM tenants WHERE id=$1', [req.params.id]);
  await q(`INSERT INTO audit_log (tenant_id, user_id, action, detail) VALUES ($1,$2,'support.impersonate',$3)`, [u.tenant_id, req.user.uid, JSON.stringify({ as: u.email })]);
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, tenant_id: u.tenant_id }, tenant });
}));

r.get('/audit', h(async (req, res) => {
  res.json(await many(`SELECT a.*, u.name AS user_name, t.name AS tenant_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN tenants t ON t.id=a.tenant_id ORDER BY a.created_at DESC LIMIT 50`));
}));

export default r;
