import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Boxes, AlertTriangle, PackageX, Coins, ShoppingCart, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num, ago } from '../../lib/format.js';
import { PageHeader, Button, Spinner, Badge, Modal, Field, Select, Empty, useToast, cx } from '../../components/ui.jsx';
import { Stat, Card } from '../../components/kit.jsx';

export const REASON = { sale: ['Sold', 'grey'], purchase: ['Received', 'green'], restock: ['Restocked', 'green'], waste: ['Wasted', 'red'], adjustment: ['Adjusted', 'amber'], count: ['Stock count', 'blue'] };

export default function InventoryOverview() {
  const toast = useToast();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [pick, setPick] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api('/ops/inventory/overview').then((x) => { setD(x); setPick(Object.fromEntries(x.reorder.map((r) => [r.id, r.suggested]))); });
    api('/ops/suppliers').then(setSuppliers);
  }, []);
  if (!d) return <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div>;
  const t = d.totals;
  const maxCat = Math.max(...d.byCategory.map((c) => c.value), 1);
  const chosen = d.reorder.filter((r) => pick[r.id] > 0);

  async function createPO() {
    const po = await api('/ops/purchases', { method: 'POST', body: { supplier_id: supplier ? Number(supplier) : null, items: chosen.map((r) => ({ product_id: r.id, name: r.name, qty: Number(pick[r.id]), unit_cost: r.cost })) } });
    toast(`${po.number} created as a draft`);
    navigate(`/admin/purchases?open=${po.id}`);
  }

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock on hand, what it’s worth, and what to reorder."
        actions={<><Link to="/admin/inventory/count"><Button variant="outline">Count stock</Button></Link><Link to="/admin/products"><Button>Products</Button></Link></>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat i={0} dark icon={Coins} label="Stock value at cost" value={money(t.value_cost, { compact: true })} sub={`${money(t.value_retail, { compact: true })} at selling price`} />
        <Stat i={1} icon={Boxes} label="Products tracked" value={num(t.products)} />
        <Stat i={2} icon={AlertTriangle} label="Running low" value={num(t.low)} tone={t.low ? 'bad' : undefined} />
        <Stat i={3} icon={PackageX} label="Sold out" value={num(t.out)} tone={t.out ? 'bad' : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Card className="lg:col-span-2" title="Reorder suggestions" sub="Products at or below their warning level. Quantities bring them back to about four times that level."
          action={<Button icon={ShoppingCart} disabled={!chosen.length} onClick={() => { setSupplier(String(chosen[0]?.supplier_id || '')); setOpen(true); }}>Create purchase order</Button>}>
          {d.reorder.length === 0 ? <Empty icon={Boxes} title="Nothing needs reordering" /> : (
            <div className="divide-y divide-steel-100 -mx-1">
              {d.reorder.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-1 py-2.5">
                  <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={pick[r.id] > 0} onChange={(e) => setPick({ ...pick, [r.id]: e.target.checked ? r.suggested : 0 })} aria-label={`Include ${r.name}`} />
                  <span className="text-xl">{r.emoji}</span>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-steel-900 truncate">{r.name}</div><div className="text-xs text-steel-500">{r.supplier ? `Last bought from ${r.supplier}` : 'No supplier yet'}</div></div>
                  <Badge tone={r.stock <= 0 ? 'red' : 'amber'}>{r.stock <= 0 ? 'Sold out' : `${num(r.stock)} left`}</Badge>
                  <input type="number" min="0" className="input w-20 h-9 text-right num" value={pick[r.id] ?? 0} onChange={(e) => setPick({ ...pick, [r.id]: Number(e.target.value) })} aria-label={`Quantity of ${r.name}`} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Value by category">
          <div className="space-y-3.5">
            {d.byCategory.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{c.name}</span><span className="font-bold num">{money(c.value, { compact: true })}</span></div>
                <div className="h-2 rounded-full bg-steel-100 mt-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.value / maxCat) * 100}%`, background: c.color || '#F26A1B' }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Card title="Last 30 days" sub="Units in and out of stock.">
          <div className="space-y-2.5">
            {d.moves30.map((m) => (
              <div key={m.reason} className="flex items-center gap-3 text-sm">
                <span className={cx('h-8 w-8 rounded-lg grid place-items-center', m.qty >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-steel-100 text-steel-600')}>{m.qty >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                <span className="font-semibold flex-1">{REASON[m.reason]?.[0] || m.reason}</span>
                <span className="font-bold num">{m.qty > 0 ? '+' : ''}{num(m.qty)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2" title="Latest stock movements" action={<Link to="/admin/inventory/moves" className="text-[13px] font-semibold text-brand-600 hover:underline">All movements</Link>}>
          <div className="divide-y divide-steel-100">{d.recent.map((m) => <MoveRow key={m.id} m={m} />)}</div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New purchase order" width="max-w-md"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={createPO}>Create draft</Button></>}>
        <p className="text-sm text-steel-600 mb-4">{chosen.length} products, about {money(chosen.reduce((s, r) => s + r.cost * pick[r.id], 0))} before VAT. You can edit it before sending.</p>
        <Field label="Supplier"><Select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Choose later</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      </Modal>
    </div>
  );
}

export function MoveRow({ m }) {
  const [label, tone] = REASON[m.reason] || [m.reason, 'grey'];
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <span className="text-lg">{m.emoji}</span>
      <span className="font-semibold text-steel-900 flex-1 truncate">{m.name}</span>
      <Badge tone={tone}>{label}</Badge>
      <span className="hidden sm:block text-xs text-steel-500 w-24 truncate">{m.ref}</span>
      <span className="text-xs text-steel-400 w-20 text-right">{ago(m.created_at)}</span>
      <span className={cx('w-16 text-right font-bold num', m.qty > 0 ? 'text-emerald-600' : 'text-steel-800')}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</span>
    </div>
  );
}
