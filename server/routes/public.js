import { Router } from 'express';
import { one, many } from '../db.js';
import { h } from '../auth.js';

// Public, no sign-in: the menu a guest sees after scanning the QR code on their table.
const r = Router();

r.get('/menu/:slug', h(async (req, res) => {
  const t = await one(`SELECT id, name, slug, currency, phone, address, city, menu_enabled, menu_message, status, tax_inclusive, tax_rate
    FROM tenants WHERE slug=$1`, [req.params.slug]);
  if (!t || t.status === 'suspended') return res.status(404).json({ error: 'This menu isn’t available.' });
  if (!t.menu_enabled) return res.status(404).json({ error: 'This restaurant has turned its online menu off. Ask your waiter for a menu.' });
  const tableId = Number(req.query.table) || null;
  const [categories, products, table, popular] = await Promise.all([
    many('SELECT id, name, icon, color FROM categories WHERE tenant_id=$1 ORDER BY sort, name', [t.id]),
    many(`SELECT id, category_id, name, price, emoji, description, (track_stock AND stock <= 0) AS sold_out
          FROM products WHERE tenant_id=$1 AND active AND on_menu ORDER BY name`, [t.id]),
    tableId ? one('SELECT id, name, area FROM floor_tables WHERE id=$1 AND tenant_id=$2', [tableId, t.id]) : null,
    many(`SELECT i.product_id FROM order_items i JOIN orders o ON o.id=i.order_id
          WHERE o.tenant_id=$1 AND o.status='paid' AND o.created_at > now() - interval '30 days' AND i.product_id IS NOT NULL
          GROUP BY 1 ORDER BY sum(i.qty) DESC LIMIT 4`, [t.id]),
  ]);
  res.set('Cache-Control', 'public, max-age=60');
  const { id, status, menu_enabled, ...tenant } = t;
  res.json({ tenant, table, categories: categories.filter((c) => products.some((p) => p.category_id === c.id)), products, popular: popular.map((p) => p.product_id) });
}));

export default r;
