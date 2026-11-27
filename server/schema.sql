-- IWAT POS schema (PostgreSQL). Idempotent: safe to run on every boot.

CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_terminals INT NOT NULL DEFAULT 1,
  max_users     INT NOT NULL DEFAULT 3,
  features      JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS tenants (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  industry    TEXT NOT NULL DEFAULT 'restaurant',
  plan_code   TEXT NOT NULL DEFAULT 'starter' REFERENCES plans(code),
  status      TEXT NOT NULL DEFAULT 'active',      -- active | trial | suspended
  currency    TEXT NOT NULL DEFAULT 'UGX',
  tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 18,
  tax_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  phone       TEXT, email TEXT, address TEXT, city TEXT, country TEXT DEFAULT 'Uganda',
  receipt_footer TEXT DEFAULT 'Thank you for visiting!',
  accent      TEXT DEFAULT '#F26A1B',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for super admins
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pin         TEXT,
  role        TEXT NOT NULL,          -- superadmin | owner | manager | cashier | kitchen
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#F26A1B',
  icon       TEXT NOT NULL DEFAULT '🍽️',
  sort       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  sku         TEXT,
  barcode     TEXT,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  emoji       TEXT NOT NULL DEFAULT '🍽️',
  description TEXT,
  track_stock BOOLEAN NOT NULL DEFAULT TRUE,
  stock       NUMERIC(12,2) NOT NULL DEFAULT 0,
  low_stock   NUMERIC(12,2) NOT NULL DEFAULT 5,
  to_kitchen  BOOLEAN NOT NULL DEFAULT TRUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floor_tables (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  seats      INT NOT NULL DEFAULT 4,
  area       TEXT NOT NULL DEFAULT 'Main hall',
  shape      TEXT NOT NULL DEFAULT 'square',   -- square | round | long
  x          INT NOT NULL DEFAULT 0,
  y          INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  points     INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  tenant_id    INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_ref   TEXT NOT NULL,                 -- uuid generated on device, makes offline sync idempotent
  number       TEXT NOT NULL,
  order_type   TEXT NOT NULL DEFAULT 'takeaway',  -- dine_in | takeaway | delivery
  table_id     INT REFERENCES floor_tables(id) ON DELETE SET NULL,
  customer_id  INT REFERENCES customers(id) ON DELETE SET NULL,
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'paid',  -- open | paid | refunded | void
  kitchen_status TEXT NOT NULL DEFAULT 'new', -- new | preparing | ready | served | none
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  note         TEXT,
  device       TEXT,
  created_offline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_ref)
);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  qty         NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL,
  cost        NUMERIC(12,2) NOT NULL DEFAULT 0,
  note        TEXT,
  line_total  NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method     TEXT NOT NULL,     -- cash | card | mtn_momo | airtel_money | bank
  amount     NUMERIC(12,2) NOT NULL,
  reference  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        NUMERIC(12,2) NOT NULL,
  reason     TEXT NOT NULL,     -- sale | restock | adjustment | waste
  ref        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders(tenant_id, kitchen_status);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ===== v2: purchases, accounting, QR menu =====
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS menu_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS menu_message TEXT DEFAULT 'Welcome! Order from your waiter when you are ready.';
ALTER TABLE products ADD COLUMN IF NOT EXISTS on_menu BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  contact    TEXT, phone TEXT, email TEXT, address TEXT,
  terms_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  number      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',     -- draft | ordered | received | cancelled
  expected_on DATE,
  notes       TEXT,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid        NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id         SERIAL PRIMARY KEY,
  po_id      INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  qty        NUMERIC(12,2) NOT NULL,
  unit_cost  NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_id      INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL,
  method     TEXT NOT NULL DEFAULT 'bank',
  reference  TEXT,
  paid_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,      -- rent | salaries | utilities | transport | marketing | repairs | supplies | other
  description TEXT,
  amount      NUMERIC(12,2) NOT NULL,
  method      TEXT NOT NULL DEFAULT 'cash',
  paid_to     TEXT,
  spent_on    DATE NOT NULL DEFAULT current_date,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS idx_moves_tenant ON stock_moves(tenant_id, created_at DESC);

-- v2 theme: move the old blue defaults to the new orange brand colour
UPDATE categories SET color='#F26A1B' WHERE upper(color)='#2357D9';
UPDATE tenants SET accent='#F26A1B' WHERE upper(accent)='#2357D9';
