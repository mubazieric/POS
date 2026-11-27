let currency = 'UGX';
export const setCurrency = (c) => { if (c) currency = c; };

export function money(v, { compact = false, symbol = true } = {}) {
  const n = Number(v || 0);
  const decimals = ['UGX', 'KES', 'TZS', 'RWF'].includes(currency) ? 0 : 2;
  const body = compact && Math.abs(n) >= 1000
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : new Intl.NumberFormat('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  return symbol ? `${currency} ${body}` : body;
}

export const num = (v) => new Intl.NumberFormat('en').format(Number(v || 0));

export function ago(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dateTime = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const METHOD_LABEL = { cash: 'Cash', card: 'Card', mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', bank: 'Bank transfer' };
export const TYPE_LABEL = { dine_in: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery' };
export const ROLE_LABEL = { superadmin: 'Platform admin', owner: 'Owner', manager: 'Manager', cashier: 'Cashier', kitchen: 'Kitchen' };

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));
