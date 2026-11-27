import { Router } from 'express';
import { one, many, q, tx } from '../db.js';
import { requireAuth, requireTenant, requireRole, h } from '../auth.js';

const r = Router();
r.use(requireAuth, requireTenant, requireRole('owner', 'manager'));

const audit = (c, tid, uid, action, detail) =>
  c.query('INSERT INTO audit_log (tenant_id, user_id, action, detail) VALUES ($1,$2,$3,$4)', [tid, uid, action, JSON.stringify(detail || {})]);

// Date range from ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, business-local days). Defaults to the last 30 days.
function range(req) {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  const to = ok(req.query.to) ? req.query.to : new Date().toLocaleDateString('en-CA');
  const from = ok(req.query.from) ? req.query.from : new Date(Date.now() - 29 * 864e5).toLocaleDateString('en-CA');
  return { from, to };
}
const inRange = (col) => `${col} >= $2::date AND ${col} < ($3::date + 1)`;

/* =========================== SALES =========================== */
r.get('/sales/report', h(async (req, res) => {
  const tid = req.user.tid; const { from, to } = range(req); const p = [tid, from, to];
  const paid = `o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')}`;
  const [k, refunds, cogs, daily, byProduct, byCategory, byCashier, byMethod, byType, byHour] = await Promise.all([
    one(`SELECT coalesce(sum(total),0) AS gross, coalesce(sum(tax),0) AS vat, coalesce(sum(discount),0) AS discounts, count(*)::int AS orders, coalesce(avg(total),0) AS avg FROM orders o WHERE ${paid}`, p),
    one(`SELECT count(*)::int AS n, coalesce(sum(total),0) AS total FROM orders o WHERE o.tenant_id=$1 AND o.status='refunded' AND ${inRange('o.created_at')}`, p),
    one(`SELECT coalesce(sum(i.cost*i.qty),0) AS cogs, coalesce(sum(i.qty),0)::float AS items FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${paid}`, p),
    many(`SELECT to_char(d,'YYYY-MM-DD') AS day, coalesce(sum(o.total),0) AS gross, count(o.id)::int AS orders
          FROM generate_series($2::date, $3::date, '1 day') d LEFT JOIN orders o ON o.tenant_id=$1 AND o.status='paid' AND o.created_at::date = d::date
          GROUP BY d ORDER BY d`, p),
    many(`SELECT i.name, max(pr.emoji) AS emoji, max(c.name) AS category, sum(i.qty)::float AS qty, sum(i.line_total) AS revenue, sum(i.cost*i.qty) AS cost
          FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN products pr ON pr.id=i.product_id LEFT JOIN categories c ON c.id=pr.category_id
          WHERE ${paid} GROUP BY i.name ORDER BY revenue DESC`, p),
    many(`SELECT coalesce(c.name,'Other') AS name, sum(i.line_total) AS revenue, sum(i.qty)::float AS qty FROM order_items i JOIN orders o ON o.id=i.order_id
          LEFT JOIN products pr ON pr.id=i.product_id LEFT JOIN categories c ON c.id=pr.category_id WHERE ${paid} GROUP BY 1 ORDER BY revenue DESC`, p),
    many(`SELECT coalesce(u.name,'Unknown') AS name, count(o.id)::int AS orders, sum(o.total) AS revenue, avg(o.total) AS avg FROM orders o LEFT JOIN users u ON u.id=o.user_id
          WHERE ${paid} GROUP BY 1 ORDER BY revenue DESC`, p),
    many(`SELECT pa.method, sum(pa.amount) AS amount, count(*)::int AS count FROM payments pa JOIN orders o ON o.id=pa.order_id WHERE ${paid} GROUP BY 1 ORDER BY amount DESC`, p),
    many(`SELECT order_type AS type, count(*)::int AS orders, sum(total) AS revenue FROM orders o WHERE ${paid} GROUP BY 1 ORDER BY revenue DESC`, p),
    many(`SELECT extract(hour FROM o.created_at)::int AS hour, count(*)::int AS orders, sum(o.total) AS revenue FROM orders o WHERE ${paid} GROUP BY 1 ORDER BY 1`, p),
  ]);
  res.json({
    from, to,
    kpis: { ...k, net: k.gross - k.vat, cogs: cogs.cogs, items: cogs.items, profit: k.gross - k.vat - cogs.cogs, refunds: refunds.n, refunds_total: refunds.total },
    daily, byProduct, byCategory, byCashier, byMethod, byType, byHour,
  });
}));

/* =========================== INVENTORY =========================== */
r.get('/inventory/overview', h(async (req, res) => {
  const tid = req.user.tid;
  const [totals, byCategory, reorder, moves30, recent] = await Promise.all([
    one(`SELECT count(*)::int AS products, coalesce(sum(greatest(stock,0)*cost),0) AS value_cost, coalesce(sum(greatest(stock,0)*price),0) AS value_retail,
           count(*) FILTER (WHERE stock <= 0)::int AS out, count(*) FILTER (WHERE stock > 0 AND stock <= low_stock)::int AS low
         FROM products WHERE tenant_id=$1 AND active AND track_stock`, [tid]),
    many(`SELECT coalesce(c.name,'Other') AS name, max(c.color) AS color, sum(greatest(p.stock,0)*p.cost) AS value, count(*)::int AS products
          FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.tenant_id=$1 AND p.active AND p.track_stock GROUP BY 1 ORDER BY value DESC`, [tid]),
    many(`SELECT p.id, p.name, p.emoji, p.stock, p.low_stock, p.cost,
            greatest(p.low_stock*4 - p.stock, p.low_stock)::int AS suggested,
            (SELECT po.supplier_id FROM purchase_items pi JOIN purchase_orders po ON po.id=pi.po_id WHERE pi.product_id=p.id ORDER BY po.created_at DESC LIMIT 1) AS supplier_id,
            (SELECT s.name FROM purchase_items pi JOIN purchase_orders po ON po.id=pi.po_id JOIN suppliers s ON s.id=po.supplier_id WHERE pi.product_id=p.id ORDER BY po.created_at DESC LIMIT 1) AS supplier
          FROM products p WHERE p.tenant_id=$1 AND p.active AND p.track_stock AND p.stock <= p.low_stock ORDER BY p.stock`, [tid]),
    many(`SELECT reason, sum(qty)::float AS qty, count(*)::int AS moves FROM stock_moves WHERE tenant_id=$1 AND created_at > now() - interval '30 days' GROUP BY 1`, [tid]),
    many(`SELECT m.*, p.name, p.emoji FROM stock_moves m JOIN products p ON p.id=m.product_id WHERE m.tenant_id=$1 ORDER BY m.created_at DESC LIMIT 8`, [tid]),
  ]);
  res.json({ totals, byCategory, reorder, moves30, recent });
}));

r.get('/inventory/moves', h(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(await many(
    `SELECT m.*, p.name, p.emoji FROM stock_moves m JOIN products p ON p.id=m.product_id
     WHERE m.tenant_id=$1 AND ($2::int IS NULL OR m.product_id=$2) AND ($3::text IS NULL OR m.reason=$3)
     ORDER BY m.created_at DESC LIMIT ${limit}`,
    [req.user.tid, req.query.product_id ? Number(req.query.product_id) : null, req.query.reason || null]));
}));

// Physical stock count: set each product to the counted quantity and log the difference.
r.post('/inventory/count', h(async (req, res) => {
  const counts = (req.body?.counts || []).filter((c) => c.product_id && c.counted !== '' && c.counted !== null && !isNaN(Number(c.counted)));
  const out = await tx(async (c) => {
    let changed = 0;
    for (const k of counts) {
      const p = (await c.query('SELECT id, stock FROM products WHERE id=$1 AND tenant_id=$2', [k.product_id, req.user.tid])).rows[0];
      if (!p) continue;
      const diff = Number(k.counted) - Number(p.stock);
      if (!diff) continue;
      await c.query('UPDATE products SET stock=$1 WHERE id=$2', [Number(k.counted), p.id]);
      await c.query(`INSERT INTO stock_moves (tenant_id, product_id, qty, reason, ref) VALUES ($1,$2,$3,'count','Stock count')`, [req.user.tid, p.id, diff]);
      changed++;
    }
    await audit(c, req.user.tid, req.user.uid, 'inventory.count', { products: counts.length, changed });
    return { counted: counts.length, changed };
  });
  res.json(out);
}));

/* =========================== PURCHASES =========================== */
r.get('/suppliers', h(async (req, res) => {
  res.json(await many(`SELECT s.*,
      (SELECT count(*)::int FROM purchase_orders po WHERE po.supplier_id=s.id AND po.status<>'cancelled') AS orders,
      (SELECT coalesce(sum(total),0) FROM purchase_orders po WHERE po.supplier_id=s.id AND po.status='received') AS purchased,
      (SELECT coalesce(sum(total-paid),0) FROM purchase_orders po WHERE po.supplier_id=s.id AND po.status='received') AS balance,
      (SELECT max(created_at) FROM purchase_orders po WHERE po.supplier_id=s.id) AS last_order
    FROM suppliers s WHERE s.tenant_id=$1 ORDER BY s.name`, [req.user.tid]));
}));
const SUP = ['name', 'contact', 'phone', 'email', 'address', 'terms_days'];
r.post('/suppliers', h(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Give the supplier a name.' });
  res.json(await one(`INSERT INTO suppliers (tenant_id, name, contact, phone, email, address, terms_days) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.tid, b.name, b.contact || null, b.phone || null, b.email || null, b.address || null, Number(b.terms_days) || 0]));
}));
r.patch('/suppliers/:id', h(async (req, res) => {
  const f = SUP.filter((k) => req.body?.[k] !== undefined);
  if (!f.length) return res.json({});
  res.json(await one(`UPDATE suppliers SET ${f.map((k, i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, ...f.map((k) => (k === 'terms_days' ? Number(req.body[k]) || 0 : req.body[k]))]));
}));
r.delete('/suppliers/:id', h(async (req, res) => {
  await q('DELETE FROM suppliers WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  res.json({ ok: true });
}));

r.get('/purchases', h(async (req, res) => {
  res.json(await many(`SELECT po.*, s.name AS supplier, u.name AS created_by_name,
      (SELECT count(*)::int FROM purchase_items pi WHERE pi.po_id=po.id) AS lines
    FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id LEFT JOIN users u ON u.id=po.created_by
    WHERE po.tenant_id=$1 AND ($2::text IS NULL OR po.status=$2) ORDER BY po.created_at DESC LIMIT 300`, [req.user.tid, req.query.status || null]));
}));
r.get('/purchases/:id', h(async (req, res) => {
  const po = await one(`SELECT po.*, s.name AS supplier, s.phone AS supplier_phone, s.email AS supplier_email, s.terms_days FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=$1 AND po.tenant_id=$2`, [req.params.id, req.user.tid]);
  if (!po) return res.status(404).json({ error: 'Purchase order not found.' });
  const [items, payments] = await Promise.all([
    many('SELECT pi.*, p.emoji, p.stock FROM purchase_items pi LEFT JOIN products p ON p.id=pi.product_id WHERE pi.po_id=$1 ORDER BY pi.id', [po.id]),
    many('SELECT * FROM supplier_payments WHERE po_id=$1 ORDER BY paid_at', [po.id]),
  ]);
  res.json({ ...po, items, payments });
}));

async function writeLines(c, tid, poId, items) {
  const t = (await c.query('SELECT tax_rate FROM tenants WHERE id=$1', [tid])).rows[0];
  await c.query('DELETE FROM purchase_items WHERE po_id=$1', [poId]);
  let subtotal = 0;
  for (const i of items.filter((x) => Number(x.qty) > 0)) {
    const line = Number(i.qty) * Number(i.unit_cost || 0);
    subtotal += line;
    await c.query('INSERT INTO purchase_items (po_id, product_id, name, qty, unit_cost, line_total) VALUES ($1,$2,$3,$4,$5,$6)',
      [poId, i.product_id || null, i.name, Number(i.qty), Number(i.unit_cost || 0), line]);
  }
  const tax = Math.round(subtotal * Number(t.tax_rate) / 100);
  await c.query('UPDATE purchase_orders SET subtotal=$2, tax=$3, total=$4 WHERE id=$1', [poId, subtotal, tax, subtotal + tax]);
}

r.post('/purchases', h(async (req, res) => {
  const b = req.body || {};
  if (!b.items?.length) return res.status(400).json({ error: 'Add at least one product to the order.' });
  const out = await tx(async (c) => {
    const n = (await c.query(`SELECT count(*)::int + 1 AS n FROM purchase_orders WHERE tenant_id=$1`, [req.user.tid])).rows[0].n;
    const po = (await c.query(`INSERT INTO purchase_orders (tenant_id, supplier_id, number, status, expected_on, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, number`,
      [req.user.tid, b.supplier_id || null, `PO-${String(n).padStart(4, '0')}`, b.status === 'ordered' ? 'ordered' : 'draft', b.expected_on || null, b.notes || null, req.user.uid])).rows[0];
    await writeLines(c, req.user.tid, po.id, b.items);
    await audit(c, req.user.tid, req.user.uid, 'purchase.create', { po: po.number });
    return po;
  });
  res.json(out);
}));

r.patch('/purchases/:id', h(async (req, res) => {
  const b = req.body || {};
  const out = await tx(async (c) => {
    const po = (await c.query(`SELECT * FROM purchase_orders WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tid])).rows[0];
    if (!po) return { error: 'Purchase order not found.' };
    if (!['draft', 'ordered'].includes(po.status)) return { error: 'Received or cancelled orders can’t be edited.' };
    await c.query('UPDATE purchase_orders SET supplier_id=$2, expected_on=$3, notes=$4 WHERE id=$1', [po.id, b.supplier_id || null, b.expected_on || null, b.notes || null]);
    if (b.items) await writeLines(c, req.user.tid, po.id, b.items);
    return { ok: true };
  });
  if (out.error) return res.status(400).json(out);
  res.json(out);
}));

r.post('/purchases/:id/status', h(async (req, res) => {
  const status = req.body?.status;
  if (!['ordered', 'cancelled', 'draft'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  const row = await one(`UPDATE purchase_orders SET status=$3 WHERE id=$1 AND tenant_id=$2 AND status IN ('draft','ordered') RETURNING id, number, status`, [req.params.id, req.user.tid, status]);
  if (!row) return res.status(400).json({ error: 'Only open orders can change status.' });
  await audit({ query: q }, req.user.tid, req.user.uid, `purchase.${status}`, { po: row.number });
  res.json(row);
}));

// Receiving puts the goods on the shelf and updates cost using a weighted average.
r.post('/purchases/:id/receive', h(async (req, res) => {
  const out = await tx(async (c) => {
    const po = (await c.query(`SELECT * FROM purchase_orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [req.params.id, req.user.tid])).rows[0];
    if (!po || !['draft', 'ordered'].includes(po.status)) return null;
    const items = (await c.query('SELECT * FROM purchase_items WHERE po_id=$1', [po.id])).rows;
    for (const i of items) {
      if (!i.product_id) continue;
      const p = (await c.query('SELECT stock, cost FROM products WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [i.product_id, req.user.tid])).rows[0];
      if (!p) continue;
      const onHand = Math.max(Number(p.stock), 0);
      const newCost = onHand + Number(i.qty) > 0 ? (onHand * Number(p.cost) + Number(i.qty) * Number(i.unit_cost)) / (onHand + Number(i.qty)) : Number(i.unit_cost);
      await c.query('UPDATE products SET stock = stock + $1, cost = $2 WHERE id=$3', [i.qty, Math.round(newCost * 100) / 100, i.product_id]);
      await c.query(`INSERT INTO stock_moves (tenant_id, product_id, qty, reason, ref) VALUES ($1,$2,$3,'purchase',$4)`, [req.user.tid, i.product_id, i.qty, po.number]);
    }
    await c.query(`UPDATE purchase_orders SET status='received', received_at=now() WHERE id=$1`, [po.id]);
    await audit(c, req.user.tid, req.user.uid, 'purchase.receive', { po: po.number, total: po.total });
    return po;
  });
  if (!out) return res.status(400).json({ error: 'Only open orders can be received.' });
  res.json({ ok: true });
}));

r.post('/purchases/:id/pay', h(async (req, res) => {
  const amount = Number(req.body?.amount || 0);
  if (amount <= 0) return res.status(400).json({ error: 'Enter the amount paid.' });
  const out = await tx(async (c) => {
    const po = (await c.query(`SELECT * FROM purchase_orders WHERE id=$1 AND tenant_id=$2 AND status='received' FOR UPDATE`, [req.params.id, req.user.tid])).rows[0];
    if (!po) return { error: 'Only received orders can be paid.' };
    const due = Number(po.total) - Number(po.paid);
    if (amount > due + 0.5) return { error: `Only ${due.toLocaleString()} is still owed on this order.` };
    await c.query('INSERT INTO supplier_payments (tenant_id, po_id, amount, method, reference) VALUES ($1,$2,$3,$4,$5)', [req.user.tid, po.id, amount, req.body.method || 'bank', req.body.reference || null]);
    await c.query('UPDATE purchase_orders SET paid = paid + $2 WHERE id=$1', [po.id, amount]);
    await audit(c, req.user.tid, req.user.uid, 'purchase.pay', { po: po.number, amount });
    return { ok: true };
  });
  if (out.error) return res.status(400).json(out);
  res.json(out);
}));

/* =========================== ACCOUNTING =========================== */
r.get('/accounting/summary', h(async (req, res) => {
  const tid = req.user.tid; const { from, to } = range(req); const p = [tid, from, to];
  const [sales, cogs, exp, purch, payables, cashIn, outSup, outExp, monthly] = await Promise.all([
    one(`SELECT coalesce(sum(total),0) AS gross, coalesce(sum(tax),0) AS vat, coalesce(sum(discount),0) AS discounts, count(*)::int AS orders FROM orders o WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')}`, p),
    one(`SELECT coalesce(sum(i.cost*i.qty),0) AS cogs FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')}`, p),
    many(`SELECT category, sum(amount) AS amount, count(*)::int AS n FROM expenses e WHERE e.tenant_id=$1 AND e.spent_on BETWEEN $2::date AND $3::date GROUP BY 1 ORDER BY amount DESC`, p),
    one(`SELECT coalesce(sum(subtotal),0) AS subtotal, coalesce(sum(tax),0) AS vat, coalesce(sum(total),0) AS total, count(*)::int AS n FROM purchase_orders po WHERE po.tenant_id=$1 AND po.status='received' AND ${inRange('po.received_at')}`, p),
    one(`SELECT coalesce(sum(total-paid),0) AS owed, count(*) FILTER (WHERE total-paid > 0)::int AS bills FROM purchase_orders WHERE tenant_id=$1 AND status='received'`, [tid]),
    many(`SELECT pa.method, sum(pa.amount) AS amount FROM payments pa JOIN orders o ON o.id=pa.order_id WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')} GROUP BY 1`, p),
    many(`SELECT method, sum(amount) AS amount FROM supplier_payments sp WHERE sp.tenant_id=$1 AND ${inRange('sp.paid_at')} GROUP BY 1`, p),
    many(`SELECT method, sum(amount) AS amount FROM expenses e WHERE e.tenant_id=$1 AND e.spent_on BETWEEN $2::date AND $3::date GROUP BY 1`, p),
    Promise.all([
      many(`SELECT to_char(date_trunc('month', o.created_at),'YYYY-MM') AS k, sum(o.total - o.tax) AS revenue, sum(o.tax) AS vat_out FROM orders o
            WHERE o.tenant_id=$1 AND o.status='paid' AND o.created_at >= date_trunc('month', now()) - interval '5 months' GROUP BY 1`, [tid]),
      many(`SELECT to_char(date_trunc('month', o.created_at),'YYYY-MM') AS k, sum(i.cost*i.qty) AS cogs FROM order_items i JOIN orders o ON o.id=i.order_id
            WHERE o.tenant_id=$1 AND o.status='paid' AND o.created_at >= date_trunc('month', now()) - interval '5 months' GROUP BY 1`, [tid]),
      many(`SELECT to_char(date_trunc('month', spent_on),'YYYY-MM') AS k, sum(amount) AS expenses FROM expenses
            WHERE tenant_id=$1 AND spent_on >= date_trunc('month', now()) - interval '5 months' GROUP BY 1`, [tid]),
      many(`SELECT to_char(date_trunc('month', received_at),'YYYY-MM') AS k, sum(tax) AS vat_in FROM purchase_orders
            WHERE tenant_id=$1 AND status='received' AND received_at >= date_trunc('month', now()) - interval '5 months' GROUP BY 1`, [tid]),
    ]).then((sets) => {
      const out = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
        const k = d.toLocaleDateString('en-CA').slice(0, 7);
        const row = { month: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), revenue: 0, cogs: 0, expenses: 0, vat_out: 0, vat_in: 0 };
        sets.forEach((set) => Object.assign(row, Object.fromEntries(Object.entries(set.find((x) => x.k === k) || {}).filter(([f]) => f !== 'k'))));
        out.push(row);
      }
      return out;
    }),
  ]);
  const expenses = exp.reduce((s, e) => s + e.amount, 0);
  const revenue = sales.gross - sales.vat;
  const merge = (...lists) => { const o = {}; lists.flat().forEach((x) => { o[x.method] = (o[x.method] || 0) + Number(x.amount); }); return o; };
  res.json({
    from, to,
    pnl: { gross_sales: sales.gross, discounts: sales.discounts, vat_out: sales.vat, revenue, cogs: cogs.cogs, gross_profit: revenue - cogs.cogs, expenses, net_profit: revenue - cogs.cogs - expenses, orders: sales.orders },
    expensesByCategory: exp,
    purchases: purch,
    vat: { output: sales.vat, input: purch.vat, payable: sales.vat - purch.vat },
    payables,
    cash: { in: merge(cashIn), out: merge(outSup, outExp) },
    monthly: monthly.map((m) => ({ ...m, profit: m.revenue - m.cogs - m.expenses, vat_net: m.vat_out - m.vat_in })),
  });
}));

const ACC = {
  cash: '1000 Cash on hand', mtn_momo: '1010 Mobile money (MTN)', airtel_money: '1011 Mobile money (Airtel)', card: '1020 Card settlements', bank: '1030 Bank',
  inventory: '1200 Inventory', ap: '2000 Accounts payable', vat: '2100 VAT', sales: '4000 Sales revenue', cogs: '5000 Cost of goods sold',
};
const expAcc = (cat) => `6${{ rent: '100', salaries: '200', utilities: '300', transport: '400', marketing: '500', repairs: '600', supplies: '700' }[cat] || '900'} ${cat[0].toUpperCase() + cat.slice(1)}`;

// Journal built from the books: daily sales summaries, goods received, supplier payments and expenses.
r.get('/accounting/journal', h(async (req, res) => {
  const tid = req.user.tid; const { from, to } = range(req); const p = [tid, from, to];
  const [days, pays, cogs, receipts, supPays, exps] = await Promise.all([
    many(`SELECT o.created_at::date AS day, sum(total) AS gross, sum(tax) AS vat, count(*)::int AS n FROM orders o WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')} GROUP BY 1`, p),
    many(`SELECT o.created_at::date AS day, pa.method, sum(pa.amount) AS amount FROM payments pa JOIN orders o ON o.id=pa.order_id WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')} GROUP BY 1,2`, p),
    many(`SELECT o.created_at::date AS day, sum(i.cost*i.qty) AS cogs FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.tenant_id=$1 AND o.status='paid' AND ${inRange('o.created_at')} GROUP BY 1`, p),
    many(`SELECT po.received_at AS at, po.number, po.subtotal, po.tax, po.total, s.name AS supplier FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.tenant_id=$1 AND po.status='received' AND ${inRange('po.received_at')}`, p),
    many(`SELECT sp.paid_at AS at, sp.amount, sp.method, sp.reference, po.number FROM supplier_payments sp JOIN purchase_orders po ON po.id=sp.po_id WHERE sp.tenant_id=$1 AND ${inRange('sp.paid_at')}`, p),
    many(`SELECT spent_on AS at, category, description, amount, method, paid_to FROM expenses e WHERE e.tenant_id=$1 AND e.spent_on BETWEEN $2::date AND $3::date`, p),
  ]);
  const entries = [];
  const key = (d) => new Date(d).toLocaleDateString('en-CA');
  for (const d of days) {
    const k = key(d.day);
    const lines = pays.filter((x) => key(x.day) === k).map((x) => ({ account: ACC[x.method] || ACC.cash, debit: Number(x.amount), credit: 0 }));
    lines.push({ account: ACC.sales, debit: 0, credit: d.gross - d.vat }, { account: ACC.vat, debit: 0, credit: Number(d.vat) });
    const c = cogs.find((x) => key(x.day) === k);
    if (c?.cogs) lines.push({ account: ACC.cogs, debit: Number(c.cogs), credit: 0 }, { account: ACC.inventory, debit: 0, credit: Number(c.cogs) });
    entries.push({ date: d.day, ref: `SALES/${k}`, journal: 'Sales', label: `${d.n} sales on ${k}`, lines });
  }
  for (const r0 of receipts) entries.push({ date: r0.at, ref: r0.number, journal: 'Purchases', label: `Goods received from ${r0.supplier || 'supplier'}`,
    lines: [{ account: ACC.inventory, debit: Number(r0.subtotal), credit: 0 }, { account: ACC.vat, debit: Number(r0.tax), credit: 0 }, { account: ACC.ap, debit: 0, credit: Number(r0.total) }] });
  for (const s of supPays) entries.push({ date: s.at, ref: s.reference || s.number, journal: 'Bank', label: `Payment for ${s.number}`,
    lines: [{ account: ACC.ap, debit: Number(s.amount), credit: 0 }, { account: ACC[s.method] || ACC.bank, debit: 0, credit: Number(s.amount) }] });
  for (const e of exps) entries.push({ date: e.at, ref: e.paid_to || e.category, journal: 'Expenses', label: e.description || e.category,
    lines: [{ account: expAcc(e.category), debit: Number(e.amount), credit: 0 }, { account: ACC[e.method] || ACC.cash, debit: 0, credit: Number(e.amount) }] });
  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  // Trial balance for the period
  const tb = {};
  entries.forEach((e) => e.lines.forEach((l) => { tb[l.account] = tb[l.account] || { account: l.account, debit: 0, credit: 0 }; tb[l.account].debit += l.debit; tb[l.account].credit += l.credit; }));
  res.json({ from, to, entries: entries.slice(0, 400), trial: Object.values(tb).sort((a, b) => a.account.localeCompare(b.account)) });
}));

r.get('/expenses', h(async (req, res) => {
  const { from, to } = range(req);
  res.json(await many(`SELECT e.*, u.name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id=e.created_by
    WHERE e.tenant_id=$1 AND e.spent_on BETWEEN $2::date AND $3::date ORDER BY e.spent_on DESC, e.id DESC`, [req.user.tid, from, to]));
}));
r.post('/expenses', h(async (req, res) => {
  const b = req.body || {};
  if (!b.category || !(Number(b.amount) > 0)) return res.status(400).json({ error: 'Pick a category and enter the amount.' });
  const row = await one(`INSERT INTO expenses (tenant_id, category, description, amount, method, paid_to, spent_on, created_by) VALUES ($1,$2,$3,$4,$5,$6,coalesce($7::date, current_date),$8) RETURNING *`,
    [req.user.tid, b.category, b.description || null, Number(b.amount), b.method || 'cash', b.paid_to || null, b.spent_on || null, req.user.uid]);
  await audit({ query: q }, req.user.tid, req.user.uid, 'expense.create', { category: b.category, amount: Number(b.amount) });
  res.json(row);
}));
r.patch('/expenses/:id', h(async (req, res) => {
  const b = req.body || {};
  res.json(await one(`UPDATE expenses SET category=$3, description=$4, amount=$5, method=$6, paid_to=$7, spent_on=$8 WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tid, b.category, b.description || null, Number(b.amount), b.method, b.paid_to || null, b.spent_on]));
}));
r.delete('/expenses/:id', h(async (req, res) => {
  await q('DELETE FROM expenses WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tid]);
  await audit({ query: q }, req.user.tid, req.user.uid, 'expense.delete', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* =========================== ADMIN =========================== */
r.get('/activity', h(async (req, res) => {
  res.json(await many(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
    WHERE a.tenant_id=$1 ORDER BY a.created_at DESC LIMIT 200`, [req.user.tid]));
}));

export default r;
