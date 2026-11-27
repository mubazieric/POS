import { money, dateTime, METHOD_LABEL, TYPE_LABEL } from '../../lib/format.js';
import { LogoMark } from '../../components/Logo.jsx';

export default function Receipt({ order, tenant, id }) {
  if (!order) return null;
  const change = (order.payments || []).reduce((s, p) => s + Number(p.amount), 0) - order.total;
  return (
    <div id={id} className="bg-white w-[300px] px-5 pt-6 pb-8 text-[12px] text-steel-800 tear-edge font-sans">
      <div className="flex flex-col items-center text-center">
        <LogoMark className="h-8 w-8 mb-2" />
        <div className="text-[14px] font-extrabold text-ink">{tenant?.name}</div>
        {tenant?.address && <div className="text-steel-500">{tenant.address}{tenant.city ? `, ${tenant.city}` : ''}</div>}
        {tenant?.phone && <div className="text-steel-500">{tenant.phone}</div>}
      </div>
      <div className="border-t border-dashed border-steel-300 my-3" />
      <div className="flex justify-between"><span>Order</span><span className="font-bold num">#{order.number}</span></div>
      <div className="flex justify-between"><span>{TYPE_LABEL[order.order_type]}{order.table_name ? `, table ${order.table_name}` : ''}</span><span className="num">{dateTime(order.created_at)}</span></div>
      {order.customer_name && <div className="flex justify-between"><span>Customer</span><span>{order.customer_name}</span></div>}
      {order.cashier && <div className="flex justify-between"><span>Served by</span><span>{order.cashier}</span></div>}
      <div className="border-t border-dashed border-steel-300 my-3" />
      {(order.items || order.lines || []).map((l, i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5">
          <span className="min-w-0"><span className="num">{l.qty}×</span> {l.name}{l.note ? <span className="block text-steel-500 italic">{l.note}</span> : null}</span>
          <span className="num shrink-0">{money(l.unit_price * l.qty, { symbol: false })}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-steel-300 my-3" />
      <div className="flex justify-between"><span>Subtotal</span><span className="num">{money(order.subtotal, { symbol: false })}</span></div>
      {order.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="num">−{money(order.discount, { symbol: false })}</span></div>}
      <div className="flex justify-between text-steel-500"><span>VAT {tenant?.tax_rate}%{tenant?.tax_inclusive !== false ? ' (included)' : ''}</span><span className="num">{money(order.tax, { symbol: false })}</span></div>
      <div className="flex justify-between text-[15px] font-extrabold text-ink mt-1.5"><span>Total</span><span className="num">{money(order.total)}</span></div>
      <div className="mt-2">
        {(order.payments || []).map((p, i) => (
          <div key={i} className="flex justify-between"><span>{METHOD_LABEL[p.method]}{p.reference ? ` (${p.reference})` : ''}</span><span className="num">{money(p.amount, { symbol: false })}</span></div>
        ))}
        {change > 0 && <div className="flex justify-between font-bold"><span>Change</span><span className="num">{money(change, { symbol: false })}</span></div>}
      </div>
      <div className="border-t border-dashed border-steel-300 my-3" />
      <div className="text-center text-steel-500">{tenant?.receipt_footer}</div>
      {order.created_offline && <div className="text-center text-[10px] text-steel-400 mt-1">Recorded offline</div>}
      <div className="text-center text-[10px] text-steel-400 mt-2">Powered by IWAT POS</div>
    </div>
  );
}
