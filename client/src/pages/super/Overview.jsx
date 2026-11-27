import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { Building2, Wallet, Receipt, CloudOff, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num } from '../../lib/format.js';
import { PageHeader, Spinner, Delta, Badge } from '../../components/ui.jsx';
import { AXIS, GRID, ChartTip, shortDay, longDay } from '../../components/charts.jsx';

const STATUS_TONE = { active: 'green', trial: 'blue', suspended: 'red' };

export default function Overview() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/super/overview').then(setD); }, []);
  if (!d) return <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div>;
  const offlinePct = d.offline.total ? (d.offline.offline / d.offline.total) * 100 : 0;
  const stats = [
    { icon: Wallet, label: 'Monthly recurring revenue', value: money(d.mrr, { compact: true }), sub: `${money(d.arr, { compact: true })} a year` },
    { icon: Building2, label: 'Businesses', value: num(d.totals.tenants), sub: `${d.totals.active} active, ${d.totals.trial} on trial` },
    { icon: Receipt, label: 'Sales processed, 30 days', value: money(d.gmv, { compact: true }), delta: d.change.gmv },
    { icon: Users, label: 'Active staff accounts', value: num(d.totals.users), sub: `${num(d.orders)} orders in 30 days` },
  ];
  return (
    <div>
      <PageHeader title="Platform overview" subtitle="Every business running on IWAT POS." />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={i === 0 ? 'rounded-xl bg-ink p-5 text-white' : 'card p-5'}>
            <s.icon className={i === 0 ? 'h-5 w-5 text-brand-300' : 'h-5 w-5 text-brand-500'} />
            <div className={i === 0 ? 'text-[13px] font-semibold text-steel-300 mt-3' : 'text-[13px] font-semibold text-steel-500 mt-3'}>{s.label}</div>
            <div className="text-[28px] font-extrabold tracking-[-0.02em] num">{s.value}</div>
            <div className="mt-1 text-xs">{s.delta !== undefined ? <Delta value={s.delta} /> : <span className={i === 0 ? 'text-steel-300' : 'text-steel-500'}>{s.sub}</span>}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <section className="card p-5 lg:col-span-2">
          <h3 className="font-bold text-steel-900">Sales processed across all businesses</h3>
          <p className="text-[13px] text-steel-500">Last 30 days</p>
          <div className="h-[280px] mt-4 -ml-2">
            <ResponsiveContainer>
              <AreaChart data={d.series}>
                <defs><linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F26A1B" stopOpacity={0.3} /><stop offset="100%" stopColor="#F26A1B" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={24} />
                <YAxis {...AXIS} tickFormatter={(v) => money(v, { compact: true, symbol: false })} width={48} />
                <Tooltip content={<ChartTip labelFmt={longDay} />} />
                <Area type="monotone" dataKey="gmv" name="Sales" stroke="#F26A1B" strokeWidth={2.5} fill="url(#gmv)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <h3 className="font-bold text-steel-900 mb-4">Plans</h3>
          <div className="space-y-3">
            {d.planMix.map((p) => (
              <div key={p.code} className="rounded-lg bg-steel-50 px-4 py-3 flex items-center">
                <div><div className="font-bold text-steel-900">{p.name}</div><div className="text-xs text-steel-500 num">{money(p.price_monthly)} / month</div></div>
                <div className="ml-auto text-right"><div className="text-xl font-extrabold num">{p.tenants}</div><div className="text-xs text-steel-500">businesses</div></div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg ring-1 ring-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-amber-600" />
            <div className="text-sm"><b className="num">{offlinePct.toFixed(1)}%</b> of sales this month were taken offline and synced later.</div>
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-steel-900">Top businesses by sales, 30 days</h3><Link to="/super/tenants" className="text-[13px] font-semibold text-brand-600 hover:underline">All businesses</Link></div>
          <div className="divide-y divide-steel-100">
            {d.top.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="w-5 text-xs font-bold text-steel-400">{i + 1}</span>
                <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center font-extrabold">{t.name[0]}</span>
                <div className="flex-1 min-w-0"><div className="font-bold text-steel-900 truncate">{t.name}</div><div className="text-xs text-steel-500">{t.city}, {t.plan_code}</div></div>
                <span className="text-xs text-steel-500 num">{num(t.orders)} orders</span>
                <span className="w-28 text-right font-bold num">{money(t.gmv, { compact: true })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h3 className="font-bold text-steel-900 mb-3">New businesses by month</h3>
          <div className="h-[200px] -ml-2">
            <ResponsiveContainer>
              <BarChart data={d.signups}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="month" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} width={28} />
                <Tooltip content={<ChartTip fmt={(v) => num(v)} />} cursor={{ fill: '#FFF5ED' }} />
                <Bar dataKey="signups" name="New businesses" fill="#F26A1B" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-3">{d.statusMix.map((s) => <Badge key={s.status} tone={STATUS_TONE[s.status]}>{s.n} {s.status}</Badge>)}</div>
        </section>
      </div>
    </div>
  );
}
