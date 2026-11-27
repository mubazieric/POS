export function totals(ticket, tenant) {
  const lines = ticket?.lines || [];
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const discount = Math.round(subtotal * (ticket?.discount_pct || 0) / 100);
  const base = subtotal - discount;
  const rate = Number(tenant?.tax_rate ?? 18) / 100;
  const inclusive = tenant?.tax_inclusive ?? true;
  const tax = inclusive ? Math.round(base - base / (1 + rate)) : Math.round(base * rate);
  const total = inclusive ? base : base + tax;
  const items = lines.reduce((s, l) => s + l.qty, 0);
  return { subtotal, discount, tax, total, items };
}
