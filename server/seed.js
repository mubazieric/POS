import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { one, tx } from './db.js';

const PLANS = [
  ['starter', 'Starter', 99000, 1, 3, ['POS terminal', 'Offline mode', 'Basic reports']],
  ['growth', 'Growth', 249000, 3, 10, ['Everything in Starter', 'Kitchen display', 'Floor plan', 'Inventory']],
  ['enterprise', 'Enterprise', 690000, 25, 100, ['Everything in Growth', 'Multi-branch', 'Priority support', 'API access']],
];

const CATEGORIES = [
  ['Coffee & Tea', '#6B4E3D', '☕'],
  ['Breakfast', '#D97A1E', '🍳'],
  ['Mains', '#F26A1B', '🍛'],
  ['Drinks', '#0E9F8E', '🥤'],
  ['Desserts', '#C2417A', '🍰'],
  ['Bakery', '#9A6B2F', '🥐'],
];

// [category index, name, price UGX, cost, emoji, stock, description]
const PRODUCTS = [
  [0, 'Espresso', 6000, 1500, '☕', 400, 'Double shot, Bugisu arabica'],
  [0, 'Cappuccino', 9000, 2500, '☕', 400, 'Silky foam, cocoa dust'],
  [0, 'Café Latte', 10000, 2800, '🥛', 400, 'Smooth and milky'],
  [0, 'Iced Mocha', 12000, 3500, '🧋', 300, 'Chocolate, espresso, ice'],
  [0, 'Masala Chai', 7000, 1800, '🍵', 300, 'Spiced African tea'],
  [1, 'Rolex', 7000, 2500, '🌯', 200, 'Chapati rolled with eggs & veg'],
  [1, 'Full Breakfast', 28000, 11000, '🍳', 80, 'Eggs, sausage, beans, toast'],
  [1, 'Pancake Stack', 18000, 6000, '🥞', 90, 'Honey and berries'],
  [1, 'Avocado Toast', 16000, 5500, '🥑', 90, 'Sourdough, chilli flakes'],
  [2, 'Chicken Luwombo', 35000, 14000, '🍲', 60, 'Steamed in banana leaves'],
  [2, 'Matoke & Beef', 25000, 9500, '🍛', 70, 'Classic Ugandan stew'],
  [2, 'Whole Tilapia', 45000, 19000, '🐟', 40, 'Lake Victoria, grilled'],
  [2, 'Beef Burger', 30000, 11000, '🍔', 70, 'Cheddar, house sauce, fries'],
  [2, 'Margherita Pizza', 32000, 10000, '🍕', 60, 'Wood-fired, basil'],
  [2, 'Chicken Wings', 22000, 8000, '🍗', 80, 'Peri-peri glaze'],
  [2, 'Veggie Pasta', 24000, 7000, '🍝', 60, 'Tomato, garden greens'],
  [3, 'Passion Juice', 8000, 2000, '🧃', 150, 'Freshly pressed'],
  [3, 'Mango Smoothie', 10000, 3000, '🥭', 120, 'Mango, yoghurt'],
  [3, 'Soda', 3000, 1400, '🥤', 300, '300 ml bottle'],
  [3, 'Mineral Water', 2000, 800, '💧', 4, '500 ml'],
  [3, 'Nile Special', 6000, 3500, '🍺', 3, 'Local lager, 500 ml'],
  [4, 'Chocolate Cake', 12000, 4000, '🍰', 40, 'Rich dark chocolate'],
  [4, 'Ice Cream', 9000, 2500, '🍨', 60, 'Two scoops'],
  [4, 'Fruit Salad', 8000, 2500, '🍉', 50, 'Seasonal fruit'],
  [5, 'Croissant', 6000, 2000, '🥐', 60, 'Butter, baked daily'],
  [5, 'Samosas (3)', 4500, 1500, '🥟', 100, 'Beef or vegetable'],
  [5, 'Mandazi', 2000, 600, '🍩', 2, 'Coconut doughnut'],
  [5, 'Banana Bread', 7000, 2200, '🍞', 40, 'Slice, toasted'],
];

const TABLES = [
  ['T1', 2, 'Main hall', 'round', 10, 14], ['T2', 2, 'Main hall', 'round', 30, 14],
  ['T3', 4, 'Main hall', 'square', 50, 14], ['T4', 4, 'Main hall', 'square', 70, 14],
  ['T5', 6, 'Main hall', 'long', 12, 52], ['T6', 4, 'Main hall', 'square', 42, 52],
  ['T7', 4, 'Main hall', 'square', 62, 52], ['T8', 8, 'Main hall', 'long', 30, 82],
  ['P1', 2, 'Terrace', 'round', 12, 20], ['P2', 2, 'Terrace', 'round', 40, 20],
  ['P3', 4, 'Terrace', 'square', 68, 20], ['P4', 6, 'Terrace', 'long', 30, 64],
];

const CUSTOMERS = [
  ['Grace Nakato', '+256 772 123456'], ['Brian Ssemwogerere', '+256 701 998877'],
  ['Aisha Namubiru', '+256 752 445566'], ['David Okello', '+256 782 334455'],
  ['Sarah Achieng', '+256 704 112233'], ['Moses Kato', '+256 774 556677'],
  ['Esther Nambi', '+256 755 667788'], ['Joel Mugisha', '+256 789 001122'],
];

const OTHER_TENANTS = [
  ['Rwenzori Grill House', 'rwenzori-grill', 'restaurant', 'enterprise', 'active', 'Fort Portal'],
  ['Nile Breeze Café', 'nile-breeze', 'cafe', 'growth', 'active', 'Jinja'],
  ['Kololo Fresh Mart', 'kololo-fresh', 'retail', 'growth', 'active', 'Kampala'],
  ['Entebbe Bakery Co.', 'entebbe-bakery', 'bakery', 'starter', 'trial', 'Entebbe'],
  ['Gulu Corner Shop', 'gulu-corner', 'retail', 'starter', 'suspended', 'Gulu'],
  ['Mbarara Dairy Bar', 'mbarara-dairy', 'cafe', 'starter', 'active', 'Mbarara'],
];

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
};
const HOURS = [[7, 4], [8, 7], [9, 6], [10, 4], [11, 5], [12, 10], [13, 12], [14, 7], [15, 4], [16, 4], [17, 6], [18, 9], [19, 11], [20, 8], [21, 4]];
const METHODS = [['cash', 38], ['mtn_momo', 30], ['airtel_money', 12], ['card', 20]];

async function generateHistory(c, { tenantId, products, tables, customers, userIds, days, perDay, taxRate }) {
  let counter = 0;
  const now = new Date();
  for (let d = days; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dow = day.getDay();
    const growth = 0.75 + (days - d) / days * 0.35; // gentle upward trend looks realistic
    const n = Math.round(rand(perDay[0], perDay[1]) * (dow === 5 || dow === 6 ? 1.35 : 1) * growth);
    for (let i = 0; i < n; i++) {
      const hour = weighted(HOURS);
      const ts = new Date(day);
      ts.setHours(hour, rand(0, 59), rand(0, 59), 0);
      if (ts > now) continue;
      counter++;
      const type = weighted([['dine_in', 55], ['takeaway', 35], ['delivery', 10]]);
      const lines = [];
      const count = weighted([[1, 3], [2, 4], [3, 3], [4, 2], [5, 1]]);
      for (let k = 0; k < count; k++) {
        const p = pick(products);
        const qty = weighted([[1, 8], [2, 3], [3, 1]]);
        lines.push({ p, qty });
      }
      const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
      const discount = Math.random() < 0.06 ? Math.round(subtotal * 0.1) : 0;
      const total = subtotal - discount;
      const tax = Math.round(total - total / (1 + taxRate / 100));
      const isToday = d === 0;
      const minutesAgo = (now - ts) / 60000;
      const kitchen = isToday && minutesAgo < 25 ? pick(['new', 'preparing', 'preparing', 'ready']) : 'served';
      const o = await c.query(
        `INSERT INTO orders (tenant_id, client_ref, number, order_type, table_id, customer_id, user_id, status, kitchen_status,
           subtotal, discount, tax, total, device, created_at, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9,$10,$11,$12,'Till 1',$13,$13) RETURNING id`,
        [tenantId, crypto.randomUUID(), `#${String(1000 + counter)}`, type,
          type === 'dine_in' && tables.length ? pick(tables) : null,
          customers.length && Math.random() < 0.3 ? pick(customers) : null,
          pick(userIds), kitchen, subtotal, discount, tax, total, ts]
      );
      const oid = o.rows[0].id;
      for (const l of lines) {
        await c.query(
          `INSERT INTO order_items (order_id, product_id, name, qty, unit_price, cost, line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [oid, l.p.id, l.p.name, l.qty, l.p.price, l.p.cost, l.p.price * l.qty]
        );
      }
      await c.query(`INSERT INTO payments (order_id, method, amount, created_at) VALUES ($1,$2,$3,$4)`,
        [oid, weighted(METHODS), total, ts]);
    }
  }
}

async function createTenant(c, { name, slug, industry, plan, status, city, createdDaysAgo }) {
  const t = await c.query(
    `INSERT INTO tenants (name, slug, industry, plan_code, status, city, phone, email, address, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - ($10 || ' days')::interval) RETURNING *`,
    [name, slug, industry, plan, status, city, '+256 700 000000', `hello@${slug}.ug`, `Plot ${rand(1, 90)}, Main Street`, String(createdDaysAgo)]
  );
  return t.rows[0];
}

export async function seedIfEmpty() {
  const existing = await one('SELECT count(*)::int AS n FROM plans');
  if (existing.n > 0) return false;
  console.log('🌱 Seeding IWAT POS demo data…');
  const hash = (p) => bcrypt.hashSync(p, 10);

  await tx(async (c) => {
    for (const [code, name, price, terms, users, features] of PLANS) {
      await c.query(`INSERT INTO plans (code, name, price_monthly, max_terminals, max_users, features) VALUES ($1,$2,$3,$4,$5,$6)`,
        [code, name, price, terms, users, JSON.stringify(features)]);
    }
    await c.query(`INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (NULL,'Platform Admin','super@iwatpos.com',$1,'superadmin')`,
      [hash('Super@123')]);

    // The main demo business
    const demo = await createTenant(c, { name: 'IWAT Demo Bistro', slug: 'demo', industry: 'restaurant', plan: 'growth', status: 'active', city: 'Kampala', createdDaysAgo: 120 });
    const staff = [
      ['Eric Mubazi', 'owner@demo.com', 'Owner@123', '1111', 'owner'],
      ['Joan Atim', 'manager@demo.com', 'Manager@123', '2222', 'manager'],
      ['Peter Kasozi', 'cashier@demo.com', 'Cashier@123', '1234', 'cashier'],
      ['Ruth Akello', 'kitchen@demo.com', 'Kitchen@123', '5555', 'kitchen'],
    ];
    const userIds = [];
    for (const [n, e, p, pin, r] of staff) {
      const u = await c.query(`INSERT INTO users (tenant_id, name, email, password_hash, pin, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [demo.id, n, e, hash(p), pin, r]);
      if (r !== 'kitchen') userIds.push(u.rows[0].id);
    }
    const catIds = [];
    for (let i = 0; i < CATEGORIES.length; i++) {
      const [n, color, icon] = CATEGORIES[i];
      const r = await c.query(`INSERT INTO categories (tenant_id, name, color, icon, sort) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [demo.id, n, color, icon, i]);
      catIds.push(r.rows[0].id);
    }
    const products = [];
    for (const [ci, n, price, cost, emoji, stock, desc] of PRODUCTS) {
      const r = await c.query(
        `INSERT INTO products (tenant_id, category_id, name, sku, price, cost, emoji, stock, description, to_kitchen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name, price, cost`,
        [demo.id, catIds[ci], n, `SKU-${1000 + products.length}`, price, cost, emoji, stock, desc, ci !== 3]
      );
      products.push(r.rows[0]);
    }
    const tableIds = [];
    for (const [n, seats, area, shape, x, y] of TABLES) {
      const r = await c.query(`INSERT INTO floor_tables (tenant_id, name, seats, area, shape, x, y) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [demo.id, n, seats, area, shape, x, y]);
      tableIds.push(r.rows[0].id);
    }
    const custIds = [];
    for (const [n, ph] of CUSTOMERS) {
      const r = await c.query(`INSERT INTO customers (tenant_id, name, phone, points) VALUES ($1,$2,$3,$4) RETURNING id`, [demo.id, n, ph, rand(20, 900)]);
      custIds.push(r.rows[0].id);
    }
    await generateHistory(c, { tenantId: demo.id, products, tables: tableIds, customers: custIds, userIds, days: 75, perDay: [28, 46], taxRate: 18 });

    // Other businesses so the platform dashboard has something to show
    for (const [i, [name, slug, industry, plan, status, city]] of OTHER_TENANTS.entries()) {
      const t = await createTenant(c, { name, slug, industry, plan, status, city, createdDaysAgo: 70 + i * 32 });
      const u = await c.query(`INSERT INTO users (tenant_id, name, email, password_hash, pin, role) VALUES ($1,$2,$3,$4,'1111','owner') RETURNING id`,
        [t.id, `${name} Owner`, `owner@${slug}.ug`, hash('Owner@123')]);
      const cat = await c.query(`INSERT INTO categories (tenant_id, name, color, icon) VALUES ($1,'General','#F26A1B','🛍️') RETURNING id`, [t.id]);
      const ps = [];
      for (const [, n, price, cost, emoji, stock] of PRODUCTS.slice(i * 4, i * 4 + 6)) {
        const r = await c.query(`INSERT INTO products (tenant_id, category_id, name, price, cost, emoji, stock) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, price, cost`,
          [t.id, cat.rows[0].id, n, price, cost, emoji, stock]);
        ps.push(r.rows[0]);
      }
      if (status !== 'suspended') {
        await generateHistory(c, { tenantId: t.id, products: ps, tables: [], customers: [], userIds: [u.rows[0].id], days: 65, perDay: [4, 14], taxRate: 18 });
      }
    }
  });
  console.log('✅ Demo data ready.');
  return true;
}

/* ---------- v2 demo data: suppliers, purchases, expenses ---------- */
const SUPPLIERS = [
  ['Mukwano Wholesalers', 'Sarah Nanyonga', '+256 414 200111', 14],
  ['Owino Fresh Produce', 'Hassan Kibuuka', '+256 772 404040', 0],
  ['Bugisu Coffee Co-op', 'Fred Wanyama', '+256 754 818181', 30],
  ['Kampala Beverages Ltd', 'Diana Auma', '+256 312 777000', 30],
  ['Lake Victoria Fisheries', 'John Ochieng', '+256 701 525252', 7],
];
const EXPENSES = [
  ['rent', 'Monthly rent, Plot 12 Main Street', 3500000, 'bank', 'Kololo Properties', 30],
  ['salaries', 'Staff salaries', 6200000, 'bank', 'Payroll', 30],
  ['utilities', 'UMEME electricity', 640000, 'mtn_momo', 'UMEME', 30],
  ['utilities', 'NWSC water', 180000, 'mtn_momo', 'NWSC', 30],
  ['utilities', 'Internet', 250000, 'bank', 'MTN Business', 30],
  ['transport', 'Market runs and deliveries', 85000, 'cash', 'Boda rider', 7],
  ['supplies', 'Cleaning supplies and takeaway boxes', 120000, 'cash', 'Game Stores', 14],
  ['marketing', 'Social media adverts', 300000, 'card', 'Meta', 30],
];

export async function seedV2() {
  const demo = await one(`SELECT id FROM tenants WHERE slug='demo'`);
  if (!demo) return;
  const has = await one('SELECT count(*)::int AS n FROM suppliers WHERE tenant_id=$1', [demo.id]);
  if (has.n > 0) return;
  console.log('🌱 Adding purchases, suppliers and expenses demo data…');
  await tx(async (c) => {
    const owner = (await c.query(`SELECT id FROM users WHERE tenant_id=$1 AND role='owner' LIMIT 1`, [demo.id])).rows[0];
    const products = (await c.query('SELECT id, name, cost, category_id FROM products WHERE tenant_id=$1 AND track_stock', [demo.id])).rows;
    const sup = [];
    for (const [name, contact, phone, terms] of SUPPLIERS) {
      const r = await c.query(`INSERT INTO suppliers (tenant_id, name, contact, phone, email, terms_days, address) VALUES ($1,$2,$3,$4,$5,$6,'Kampala') RETURNING id`,
        [demo.id, name, contact, phone, `orders@${name.toLowerCase().replace(/[^a-z]+/g, '')}.ug`, terms]);
      sup.push(r.rows[0].id);
    }
    // Purchase orders across the last 75 days; the newest few are still open.
    const count = 16;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.round(74 - (i * 74) / (count - 1));
      const status = i === count - 1 ? 'draft' : i >= count - 3 ? 'ordered' : 'received';
      const lines = [];
      const picks = [...products].sort(() => Math.random() - 0.5).slice(0, rand(3, 6));
      for (const p of picks) lines.push({ p, qty: rand(10, 60), cost: Math.round(p.cost * (0.95 + Math.random() * 0.1)) });
      const subtotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
      const tax = Math.round(subtotal * 0.18);
      const total = subtotal + tax;
      const paid = status !== 'received' ? 0 : i < count - 6 ? total : i % 2 ? Math.round(total / 2) : 0;
      const po = await c.query(
        `INSERT INTO purchase_orders (tenant_id, supplier_id, number, status, expected_on, subtotal, tax, total, paid, created_by, created_at, received_at)
         VALUES ($1,$2,$3,$4,(now() - ($5 || ' days')::interval + interval '2 days')::date,$6,$7,$8,$9,$10, now() - ($5 || ' days')::interval,
           CASE WHEN $4='received' THEN now() - ($5 || ' days')::interval + interval '1 day' END) RETURNING id, number, received_at`,
        [demo.id, sup[i % sup.length], `PO-${String(i + 1).padStart(4, '0')}`, status, String(daysAgo), subtotal, tax, total, paid, owner.id]);
      for (const l of lines) {
        await c.query(`INSERT INTO purchase_items (po_id, product_id, name, qty, unit_cost, line_total) VALUES ($1,$2,$3,$4,$5,$6)`,
          [po.rows[0].id, l.p.id, l.p.name, l.qty, l.cost, l.qty * l.cost]);
        if (status === 'received') {
          await c.query(`INSERT INTO stock_moves (tenant_id, product_id, qty, reason, ref, created_at) VALUES ($1,$2,$3,'purchase',$4,$5)`,
            [demo.id, l.p.id, l.qty, po.rows[0].number, po.rows[0].received_at]);
        }
      }
      if (paid > 0) {
        await c.query(`INSERT INTO supplier_payments (tenant_id, po_id, amount, method, reference, paid_at) VALUES ($1,$2,$3,'bank',$4,$5)`,
          [demo.id, po.rows[0].id, paid, `TRF${rand(100000, 999999)}`, po.rows[0].received_at]);
      }
    }
    // Recurring expenses
    for (const [cat, desc, amount, method, to, every] of EXPENSES) {
      for (let d = 74; d >= 0; d -= every) {
        const jitter = every >= 30 ? 1 : 0.8 + Math.random() * 0.4;
        await c.query(`INSERT INTO expenses (tenant_id, category, description, amount, method, paid_to, spent_on, created_by) VALUES ($1,$2,$3,$4,$5,$6,(now() - ($7 || ' days')::interval)::date,$8)`,
          [demo.id, cat, desc, Math.round(amount * jitter / 1000) * 1000, method, to, String(d), owner.id]);
      }
    }
    // A few sale-side stock moves so the ledger shows both directions
    const recent = (await c.query(`SELECT o.number, o.created_at, i.product_id, i.qty FROM orders o JOIN order_items i ON i.order_id=o.id
      JOIN products p ON p.id=i.product_id AND p.track_stock WHERE o.tenant_id=$1 ORDER BY o.created_at DESC LIMIT 120`, [demo.id])).rows;
    for (const r of recent) {
      await c.query(`INSERT INTO stock_moves (tenant_id, product_id, qty, reason, ref, created_at) VALUES ($1,$2,$3,'sale',$4,$5)`, [demo.id, r.product_id, -r.qty, r.number, r.created_at]);
    }
  });
  console.log('✅ Purchases and accounting demo data ready.');
}
