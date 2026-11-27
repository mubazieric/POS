import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ShoppingBag, Bike } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, ago } from '../../lib/format.js';
import { Segmented, cx } from '../../components/ui.jsx';
import { totals } from './totals.js';

const SIZE = { round: 'h-[84px] w-[84px] rounded-full', square: 'h-[88px] w-[88px] rounded-2xl', long: 'h-[84px] w-[170px] rounded-2xl' };

export default function Floor({ tables, tickets, tenant, onOpenTable, onQuick }) {
  const areas = useMemo(() => [...new Set(tables.map((t) => t.area))], [tables]);
  const [area, setArea] = useState(areas[0]);
  const [status, setStatus] = useState({});
  useEffect(() => { if (!areas.includes(area)) setArea(areas[0]); }, [areas, area]);

  useEffect(() => {
    let alive = true;
    const load = () => api('/pos/tables/status').then((rows) => alive && setStatus(Object.fromEntries(rows.map((r) => [r.table_id, r])))).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const draftFor = (id) => Object.values(tickets).find((t) => t.table_id === id && t.lines.length);
  const shown = tables.filter((t) => t.area === area);
  const busy = tables.filter((t) => draftFor(t.id) || status[t.id]).length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-steel-200">
        {areas.length > 1 && <Segmented value={area} onChange={setArea} options={areas.map((a) => ({ value: a, label: a }))} />}
        <span className="text-sm text-steel-500"><b className="text-steel-800">{busy}</b> of {tables.length} tables in use</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => onQuick('takeaway')} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-600"><ShoppingBag className="h-4 w-4" />New takeaway</button>
          <button onClick={() => onQuick('delivery')} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white ring-1 ring-steel-300 text-sm font-bold text-steel-800 hover:bg-steel-50"><Bike className="h-4 w-4" />Delivery</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-4 sm:p-6">
        <div className="relative min-w-[720px] h-[560px] rounded-2xl bg-white shadow-card grid-dots">
          {shown.map((t, i) => {
            const draft = draftFor(t.id);
            const s = status[t.id];
            const state = s?.kitchen_status === 'ready' ? 'ready' : s ? 'kitchen' : draft ? 'draft' : 'free';
            const styles = {
              free: 'bg-steel-50 ring-steel-300 text-steel-700',
              draft: 'bg-brand-500 ring-brand-600 text-white shadow-lg shadow-brand-500/30',
              kitchen: 'bg-amber-50 ring-amber-300 text-amber-900',
              ready: 'bg-emerald-500 ring-emerald-600 text-white shadow-lg shadow-emerald-500/30',
            }[state];
            return (
              <motion.button key={t.id} onClick={() => onOpenTable(t)}
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                className={cx('absolute flex flex-col items-center justify-center ring-2 transition-colors', SIZE[t.shape] || SIZE.square, styles)}>
                <span className="text-[17px] font-extrabold">{t.name}</span>
                {draft ? <span className="text-[11px] font-bold num opacity-90">{money(totals(draft, tenant).total, { compact: true })}</span>
                  : s ? <span className="text-[11px] font-bold">{state === 'ready' ? 'Food ready' : `Cooking, ${ago(s.since).replace(' ago', '')}`}</span>
                  : <span className="text-[11px] font-semibold inline-flex items-center gap-1 opacity-70"><Users className="h-3 w-3" />{t.seats}</span>}
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-5 mt-4 text-xs font-semibold text-steel-600">
          {[['bg-steel-50 ring-steel-300', 'Free'], ['bg-brand-500 ring-brand-600', 'Order in progress'], ['bg-amber-50 ring-amber-300', 'In the kitchen'], ['bg-emerald-500 ring-emerald-600', 'Food ready to serve']].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-2"><span className={cx('h-3.5 w-3.5 rounded ring-2', c)} />{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
