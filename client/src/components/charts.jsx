import { money } from '../lib/format.js';

export const AXIS = { stroke: '#97A3B5', fontSize: 11, tickLine: false, axisLine: false };
export const GRID = { stroke: '#E1E6EE', strokeDasharray: '3 4', vertical: false };
export const PALETTE = ['#2357D9', '#5480E6', '#0E2240', '#87A8F1', '#6A788D', '#B7CCF8', '#3A4556', '#C9D1DD'];

export function ChartTip({ active, payload, label, fmt = (v) => money(v), labelFmt = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-ink text-white px-3 py-2 shadow-lift text-xs">
      <div className="font-semibold text-steel-300 mb-1">{labelFmt(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 num">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-steel-300">{p.name}</span>
          <span className="font-bold ml-auto pl-3">{fmt(p.value, p.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

export const shortDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const longDay = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
