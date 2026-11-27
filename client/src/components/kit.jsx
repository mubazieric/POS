// Building blocks shared by the Sales, Inventory, Purchases and Accounting portals.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { cx } from './ui.jsx';

const iso = (d) => d.toLocaleDateString('en-CA');
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
export const PRESETS = {
  today: { label: 'Today', get: () => [iso(new Date()), iso(new Date())] },
  '7d': { label: '7 days', get: () => [iso(daysAgo(6)), iso(new Date())] },
  '30d': { label: '30 days', get: () => [iso(daysAgo(29)), iso(new Date())] },
  month: { label: 'This month', get: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]; } },
  last: { label: 'Last month', get: () => { const d = new Date(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; } },
};

export function useRange(initial = '30d') {
  const [preset, setPreset] = useState(initial);
  const [[from, to], setRange] = useState(PRESETS[initial].get());
  return {
    from, to, preset, qs: `from=${from}&to=${to}`,
    pick(p) { setPreset(p); setRange(PRESETS[p].get()); },
    custom(f, t) { setPreset('custom'); setRange([f || from, t || to]); },
  };
}

export function RangePicker({ range }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg bg-steel-100 p-1 gap-1">
        {Object.entries(PRESETS).map(([k, v]) => (
          <button key={k} onClick={() => range.pick(k)} className={cx('relative h-8 px-3 rounded-md text-[13px] font-semibold', range.preset === k ? 'text-steel-900' : 'text-steel-500 hover:text-steel-800')}>
            {range.preset === k && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-md bg-white shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{v.label}</span>
          </button>
        ))}
      </div>
      <div className={cx('inline-flex items-center gap-1.5 h-10 rounded-lg bg-white ring-1 px-2.5 text-[13px]', range.preset === 'custom' ? 'ring-brand-400' : 'ring-steel-200')}>
        <CalendarDays className="h-4 w-4 text-steel-400" />
        <input type="date" value={range.from} max={range.to} onChange={(e) => range.custom(e.target.value, null)} className="bg-transparent outline-none num" aria-label="From" />
        <span className="text-steel-400">to</span>
        <input type="date" value={range.to} min={range.from} onChange={(e) => range.custom(null, e.target.value)} className="bg-transparent outline-none num" aria-label="To" />
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon: Icon, i = 0, dark }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
      className={cx('rounded-xl p-5', dark ? 'bg-ink text-white' : 'bg-white shadow-card')}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cx('h-4 w-4', dark ? 'text-brand-300' : 'text-brand-500')} />}
        <span className={cx('text-[13px] font-semibold', dark ? 'text-steel-300' : 'text-steel-500')}>{label}</span>
      </div>
      <div className={cx('text-[26px] font-extrabold tracking-[-0.02em] num mt-1', tone === 'bad' ? 'text-bad' : tone === 'ok' ? 'text-emerald-600' : '')}>{value}</div>
      {sub && <div className={cx('text-xs mt-0.5', dark ? 'text-steel-300' : 'text-steel-500')}>{sub}</div>}
    </motion.div>
  );
}

export function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
}

export const Card = ({ title, sub, action, children, className }) => (
  <section className={cx('card p-5', className)}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>{title && <h3 className="font-bold text-steel-900">{title}</h3>}{sub && <p className="text-[13px] text-steel-500">{sub}</p>}</div>
        {action}
      </div>
    )}
    {children}
  </section>
);
