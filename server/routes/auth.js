import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, q } from '../db.js';
import { sign, requireAuth, requireTenant, h } from '../auth.js';

const r = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, tenant_id: u.tenant_id });

async function tenantFor(u) {
  if (!u.tenant_id) return null;
  return one('SELECT id, name, slug, currency, tax_rate, tax_inclusive, status, plan_code, receipt_footer, accent, phone, address, city FROM tenants WHERE id=$1', [u.tenant_id]);
}

r.post('/login', h(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await one('SELECT * FROM users WHERE lower(email)=lower($1) AND active', [String(email || '').trim()]);
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    return res.status(401).json({ error: 'That email and password do not match an account.' });
  }
  const tenant = await tenantFor(u);
  if (tenant?.status === 'suspended') {
    return res.status(403).json({ error: 'This business account is suspended. Contact IWAT support to restore access.' });
  }
  await q('UPDATE users SET last_login=now() WHERE id=$1', [u.id]);
  res.json({ token: sign(u), user: publicUser(u), tenant });
}));

// Quick staff switch on a shared till: any signed-in device of the business can switch user by PIN.
r.post('/pin', requireAuth, requireTenant, h(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE tenant_id=$1 AND pin=$2 AND active', [req.user.tid, String(req.body?.pin || '')]);
  if (!u) return res.status(401).json({ error: 'That PIN does not match anyone on this team.' });
  await q('UPDATE users SET last_login=now() WHERE id=$1', [u.id]);
  res.json({ token: sign(u), user: publicUser(u), tenant: await tenantFor(u) });
}));

r.get('/me', requireAuth, h(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=$1', [req.user.uid]);
  if (!u) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(u), tenant: await tenantFor(u) });
}));

export default r;
