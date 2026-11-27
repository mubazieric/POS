import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { num, money } from '../../lib/format.js';
import { PageHeader, Button, Input, Spinner, Modal, useToast, cx } from '../../components/ui.jsx';

export default function StockCount() {
  const toast = useToast();
  const [products, setProducts] = useState(null);
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(false);
  const load = () => api('/admin/products').then((p) => setProducts(p.filter((x) => x.active && x.track_stock)));
  useEffect(() => { load(); }, []);
  const list = useMemo(() => (products || []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [products, q]);
  const changes = (products || []).filter((p) => counts[p.id] !== undefined && counts[p.id] !== '' && Number(counts[p.id]) !== Number(p.stock));
  const valueDiff = changes.reduce((s, p) => s + (Number(counts[p.id]) - p.stock) * p.cost, 0);

  async function submit() {
    const r = await api('/ops/inventory/count', { method: 'POST', body: { counts: changes.map((p) => ({ product_id: p.id, counted: Number(counts[p.id]) })) } });
    toast(`Stock updated for ${r.changed} products`); setConfirm(false); setCounts({}); load();
  }

  return (
    <div>
      <PageHeader title="Stock count" subtitle="Count what’s on the shelf and type the number. Only products you change are adjusted."
        actions={<Button icon={ClipboardCheck} disabled={!changes.length} onClick={() => setConfirm(true)}>Review {changes.length || ''} changes</Button>} />
      <div className="relative max-w-sm mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400" /><Input className="pl-9" placeholder="Find a product" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!products ? <Spinner /> : (
        <div className="card divide-y divide-steel-100">
          <div className="grid grid-cols-[1fr_90px_110px_90px] gap-3 px-4 py-2.5 text-[12px] font-semibold text-steel-500"><span>Product</span><span className="text-right">System</span><span className="text-right">Counted</span><span className="text-right">Difference</span></div>
          {list.map((p) => {
            const v = counts[p.id];
            const diff = v === undefined || v === '' ? null : Number(v) - p.stock;
            return (
              <div key={p.id} className={cx('grid grid-cols-[1fr_90px_110px_90px] gap-3 items-center px-4 py-2', diff && 'bg-brand-50/50')}>
                <span className="font-semibold text-steel-900 truncate">{p.emoji} {p.name}</span>
                <span className="text-right num text-steel-600">{num(p.stock)}</span>
                <input type="number" inputMode="numeric" className="input h-9 text-right num" placeholder={String(p.stock)} value={v ?? ''} onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })} aria-label={`Counted ${p.name}`} />
                <span className={cx('text-right font-bold num', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-bad' : 'text-steel-300')}>{diff === null ? '–' : `${diff > 0 ? '+' : ''}${num(diff)}`}</span>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Apply stock count" width="max-w-md"
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep counting</Button><Button onClick={submit}>Apply {changes.length} changes</Button></>}>
        <div className="space-y-1.5 text-sm max-h-64 overflow-y-auto scroll-thin">
          {changes.map((p) => <div key={p.id} className="flex justify-between"><span>{p.emoji} {p.name}</span><span className="num font-semibold">{num(p.stock)} → {num(counts[p.id])}</span></div>)}
        </div>
        <div className="mt-4 rounded-lg bg-steel-50 px-3 py-2.5 text-sm flex justify-between"><span className="text-steel-600">Change in stock value</span><b className={cx('num', valueDiff < 0 ? 'text-bad' : 'text-emerald-600')}>{money(valueDiff)}</b></div>
      </Modal>
    </div>
  );
}
