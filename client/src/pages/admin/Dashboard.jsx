import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, CloudOff, MonitorSmartphone, PackageOpen } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num, time, METHOD_LABEL, TYPE_LABEL, ago } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Segmented, Spinner, Delta, Badge, Button, cx, Empty } from '../../components/ui.jsx';
import { AXIS, GRID, ChartTip, PALETTE, shortDay, longDay } from '../../components/charts.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const METHOD_COLOR = { cash: '#12A971', mtn_momo: '#E8A317', airtel_money: '#D64545', card: '#2357D9', bank: '#6A788D' };

function Kpi({ label, value, delta, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="px-5 py-4">
      <div className="text-[13px] font-semibold text-steel-500">{label}</div>
      <div className="text-[26px] font-extrabold tracking-[-0.02em] text-steel-900 num mt-0.5">{value}</div>
      <div className="mt-1"><Delta value={delta} /></div>
    </motion.div>
  );
}

function Heatmap({ data }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  const map = {}; let max = 1;
  data.forEach((d) => { map[`${d.dow}-${d.hour}`] = d.orders; max = Math.max(max, d.orders); });
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="inline-grid gap-1 min-w-full" style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(22px, 1fr))` }}>
        <span />
        {hours.map((h) => <span key={h} className="text-[10px] text-steel-400 text-center num">{h}</span>)}
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Fragment key={d}>
            <span className="text-[11px] font-semibold text-steel-500 self-center">{DAYS[d]}</span>
            {hours.map((h) => {
              const v = map[`${d}-${h}`] || 0;
              const a = v / max;
              return <span key={`${d}-${h}`} title={`${DAYS[d]} ${h}:00, ${v} orders`} className="h-6 rounded-[5px]" style={{ background: v ? `rgba(35,87,217,${0.08 + a * 0.92})` : '#EDF0F5' }} />;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setErr(''); api(`/admin/stats?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (err && !d) return <Empty icon={CloudOff} title="Couldn’t load your numbers">{err}</Empty>;
  if (!d) return <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div>;

  const k = d.kpis;
  const catTotal = d.byCat.reduce((s, c) => s + c.revenue, 0) || 1;
  const payTotal = d.payMix.reduce((s, c) => s + c.amount, 0) || 1;
  const topMax = Math.max(...d.top.map((t) => t.revenue), 1);

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0]}`}
        subtitle={<>Today so far: <b className="text-steel-800 num">{money(d.today.revenue)}</b> from <b className="text-steel-800 num">{d.today.orders}</b> orders.</>}
        actions={<>
          <Segmented value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]} />
          <Link to="/pos"><Button icon={MonitorSmartphone}>Open register</Button></Link>
        </>}
      />

      {/* Revenue: the main read of the page */}
      <section className="card overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-steel-100 border-b border-steel-100">
          <Kpi i={0} label="Revenue" value={money(k.revenue, { compact: true })} delta={k.change.revenue} />
          <Kpi i={1} label="Orders" value={num(k.orders)} delta={k.change.orders} />
          <Kpi i={2} label="Average order" value={money(k.avg_ticket, { compact: true })} delta={k.change.avg_ticket} />
          <Kpi i={3} label="Gross profit" value={money(k.gross_profit, { compact: true })} delta={k.change.gross_profit} />
        </div>
        <div className="h-[300px] px-2 pt-5 pb-2">
          <ResponsiveContainer>
            <AreaChart data={d.daily} margin={{ left: 8, right: 16 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2357D9" stopOpacity={0.28} /><stop offset="100%" stopColor="#2357D9" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={24} />
              <YAxis {...AXIS} tickFormatter={(v) => money(v, { compact: true, symbol: false })} width={48} />
              <Tooltip content={<ChartTip labelFmt={longDay} fmt={(v, key) => (key === 'orders' ? num(v) : money(v))} />} cursor={{ stroke: '#87A8F1', strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2357D9" strokeWidth={2.5} fill="url(#rev)" animationDuration={900} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <section className="card p-5 lg:col-span-2">
          <h3 className="font-bold text-steel-900">When you’re busiest</h3>
          <p className="text-[13px] text-steel-500 mb-4">Orders by day and hour. Use it to plan shifts and prep.</p>
          <Heatmap data={d.hourly} />
        </section>
        <section className="card p-5">
          <h3 className="font-bold text-steel-900 mb-4">How customers pay</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-5">
            {d.payMix.map((p) => <motion.span key={p.method} initial={{ width: 0 }} animate={{ width: `${(p.amount / payTotal) * 100}%` }} transition={{ duration: 0.8 }} style={{ background: METHOD_COLOR[p.method] }} />)}
          </div>
          <div className="space-y-3">
            {d.payMix.map((p) => (
              <div key={p.method} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: METHOD_COLOR[p.method] }} />
                <span className="font-semibold text-steel-800">{METHOD_LABEL[p.method]}</span>
                <span className="ml-auto text-steel-500 num">{((p.amount / payTotal) * 100).toFixed(0)}%</span>
                <span className="w-24 text-right font-bold num">{money(p.amount, { compact: true })}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-steel-100 mt-5 pt-4 grid grid-cols-3 gap-2">
            {d.typeMix.map((t) => (
              <div key={t.type} className="rounded-lg bg-steel-50 px-3 py-2.5">
                <div className="text-[11px] font-semibold text-steel-500">{TYPE_LABEL[t.type]}</div>
                <div className="text-base font-extrabold num">{num(t.orders)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-steel-900">Best sellers</h3><Link to="/admin/products" className="text-[13px] font-semibold text-brand-600 hover:underline">Manage menu</Link></div>
          <div className="space-y-2.5">
            {d.top.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-steel-400 num">{i + 1}</span>
                <span className="h-9 w-9 rounded-lg bg-steel-100 grid place-items-center text-lg">{t.emoji || '🍽️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm"><span className="font-semibold text-steel-900 truncate">{t.name}</span><span className="font-bold num">{money(t.revenue, { compact: true })}</span></div>
                  <div className="h-1.5 rounded-full bg-steel-100 mt-1.5 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${(t.revenue / topMax) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.04 }} />
                  </div>
                </div>
                <span className="w-14 text-right text-xs text-steel-500 num">{num(t.qty)} sold</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h3 className="font-bold text-steel-900 mb-2">Sales by category</h3>
          <div className="h-[180px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.byCat} dataKey="revenue" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" animationDuration={800}>
                  {d.byCat.map((c, i) => <Cell key={c.name} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {d.byCat.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="text-steel-700">{c.name}</span>
                <span className="ml-auto font-bold num">{((c.revenue / catTotal) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-warn" /><h3 className="font-bold text-steel-900">Running low</h3></div>
          {d.lowStock.length === 0 ? <Empty icon={PackageOpen} title="Stock looks healthy" /> : (
            <div className="divide-y divide-steel-100">
              {d.lowStock.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="text-lg">{p.emoji}</span><span className="font-semibold text-steel-800 flex-1 truncate">{p.name}</span>
                  <Badge tone={p.stock <= 0 ? 'red' : 'amber'}>{p.stock <= 0 ? 'Sold out' : `${num(p.stock)} left`}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-steel-900">Latest orders</h3><Link to="/admin/orders" className="text-[13px] font-semibold text-brand-600 hover:underline">All orders</Link></div>
          <div className="divide-y divide-steel-100">
            {d.recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="font-extrabold text-ink num w-16">#{o.number}</span>
                <span className="text-xs text-steel-500 flex-1">{ago(o.created_at)}{o.created_offline ? ', offline' : ''}</span>
                {o.status === 'refunded' && <Badge tone="red">Refunded</Badge>}
                <span className="font-bold num">{money(o.total, { compact: true })}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h3 className="font-bold text-steel-900 mb-3">Team</h3>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <BarChart data={d.staff} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" {...AXIS} width={92} tickFormatter={(n) => n.split(' ')[0]} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#EEF3FE' }} />
                <Bar dataKey="revenue" name="Sales" fill="#2357D9" radius={[0, 6, 6, 0]} barSize={18} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
