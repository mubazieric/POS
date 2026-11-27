import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart } from 'recharts';
import { Download, Receipt, TrendingUp, Percent, Package, RotateCcw, Wallet } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num, METHOD_LABEL, TYPE_LABEL } from '../../lib/format.js';
import { PageHeader, Button, Spinner, Table, Segmented, Input } from '../../components/ui.jsx';
import { useRange, RangePicker, Stat, Card, downloadCsv } from '../../components/kit.jsx';
import { AXIS, GRID, ChartTip, shortDay, longDay } from '../../components/charts.jsx';

export default function SalesReport() {
  const range = useRange('30d');
  const [d, setD] = useState(null);
  const [view, setView] = useState('product');
  const [q, setQ] = useState('');
  useEffect(() => { setD(null); api(`/ops/sales/report?${range.qs}`).then(setD); }, [range.qs]);

  const products = useMemo(() => (d?.byProduct || []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [d, q]);

  function exportCsv() {
    downloadCsv(`sales-by-product_${d.from}_${d.to}.csv`, [
      ['Product', 'Category', 'Qty sold', 'Revenue', 'Cost', 'Profit', 'Margin %'],
      ...d.byProduct.map((p) => [p.name, p.category, p.qty, p.revenue, p.cost, p.revenue - p.cost, p.revenue ? (((p.revenue - p.cost) / p.revenue) * 100).toFixed(1) : '']),
    ]);
  }

  return (
    <div>
      <PageHeader title="Sales" subtitle="What sold, when, and how much you kept." actions={<Button variant="outline" icon={Download} onClick={exportCsv} disabled={!d}>Export CSV</Button>} />
      <div className="mb-5"><RangePicker range={range} /></div>
      {!d ? <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
            <Stat i={0} dark icon={Wallet} label="Gross sales" value={money(d.kpis.gross, { compact: true })} sub={`${num(d.kpis.orders)} orders`} />
            <Stat i={1} icon={Receipt} label="Net of VAT" value={money(d.kpis.net, { compact: true })} sub={`VAT ${money(d.kpis.vat, { compact: true })}`} />
            <Stat i={2} icon={TrendingUp} label="Gross profit" value={money(d.kpis.profit, { compact: true })} sub={d.kpis.net ? `${((d.kpis.profit / d.kpis.net) * 100).toFixed(1)}% margin` : ''} tone="ok" />
            <Stat i={3} icon={Package} label="Items sold" value={num(d.kpis.items)} sub={`Avg order ${money(d.kpis.avg, { compact: true })}`} />
            <Stat i={4} icon={RotateCcw} label="Refunds and discounts" value={money(d.kpis.refunds_total + d.kpis.discounts, { compact: true })} sub={`${d.kpis.refunds} refunds`} />
          </div>

          <Card title="Daily sales" sub="Bars show revenue, the line shows number of orders." className="mt-5">
            <div className="h-[280px] -ml-2">
              <ResponsiveContainer>
                <ComposedChart data={d.daily}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={20} />
                  <YAxis yAxisId="l" {...AXIS} tickFormatter={(v) => money(v, { compact: true, symbol: false })} width={48} />
                  <YAxis yAxisId="r" orientation="right" {...AXIS} width={32} />
                  <Tooltip content={<ChartTip labelFmt={longDay} fmt={(v, k) => (k === 'orders' ? num(v) : money(v))} />} cursor={{ fill: '#FFF5ED' }} />
                  <Bar yAxisId="l" dataKey="gross" name="Revenue" fill="#F26A1B" radius={[5, 5, 0, 0]} maxBarSize={28} animationDuration={700} />
                  <Line yAxisId="r" dataKey="orders" name="Orders" stroke="#1F1D1B" strokeWidth={2} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid lg:grid-cols-3 gap-5 mt-5">
            <Card title="By hour of day">
              <div className="h-[200px] -ml-2">
                <ResponsiveContainer>
                  <BarChart data={d.byHour}>
                    <XAxis dataKey="hour" {...AXIS} tickFormatter={(h) => `${h}h`} />
                    <YAxis hide />
                    <Tooltip content={<ChartTip labelFmt={(h) => `${h}:00 to ${h}:59`} />} cursor={{ fill: '#FFF5ED' }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#FA8638" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Payment methods">
              <Bars rows={d.byMethod.map((m) => ({ label: METHOD_LABEL[m.method], value: m.amount, note: `${num(m.count)} payments` }))} />
            </Card>
            <Card title="Order types">
              <Bars rows={d.byType.map((m) => ({ label: TYPE_LABEL[m.type], value: m.revenue, note: `${num(m.orders)} orders` }))} />
            </Card>
          </div>

          <section className="card mt-5">
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-steel-100">
              <Segmented value={view} onChange={setView} options={[{ value: 'product', label: 'By product' }, { value: 'category', label: 'By category' }, { value: 'cashier', label: 'By cashier' }]} />
              {view === 'product' && <Input className="max-w-xs ml-auto" placeholder="Filter products" value={q} onChange={(e) => setQ(e.target.value)} />}
            </div>
            {view === 'product' && (
              <Table rows={products} columns={[
                { key: 'name', label: 'Product', render: (p) => <span className="font-semibold text-steel-900">{p.emoji} {p.name}</span> },
                { key: 'category', label: 'Category', render: (p) => <span className="text-steel-500">{p.category || '–'}</span> },
                { key: 'qty', label: 'Sold', align: 'right', render: (p) => num(p.qty) },
                { key: 'revenue', label: 'Revenue', align: 'right', render: (p) => <b>{money(p.revenue, { symbol: false })}</b> },
                { key: 'cost', label: 'Cost', align: 'right', render: (p) => money(p.cost, { symbol: false }) },
                { key: 'profit', label: 'Profit', align: 'right', render: (p) => money(p.revenue - p.cost, { symbol: false }) },
                { key: 'margin', label: 'Margin', align: 'right', render: (p) => <MarginPill v={p.revenue ? (p.revenue - p.cost) / p.revenue : 0} /> },
              ]} />
            )}
            {view === 'category' && <Table rows={d.byCategory} columns={[
              { key: 'name', label: 'Category', render: (c) => <span className="font-semibold">{c.name}</span> },
              { key: 'qty', label: 'Items sold', align: 'right', render: (c) => num(c.qty) },
              { key: 'share', label: 'Share', align: 'right', render: (c) => `${((c.revenue / (d.kpis.gross || 1)) * 100).toFixed(1)}%` },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (c) => <b>{money(c.revenue, { symbol: false })}</b> },
            ]} />}
            {view === 'cashier' && <Table rows={d.byCashier} columns={[
              { key: 'name', label: 'Cashier', render: (c) => <span className="font-semibold">{c.name}</span> },
              { key: 'orders', label: 'Orders', align: 'right', render: (c) => num(c.orders) },
              { key: 'avg', label: 'Average order', align: 'right', render: (c) => money(c.avg, { symbol: false }) },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (c) => <b>{money(c.revenue, { symbol: false })}</b> },
            ]} />}
          </section>
        </>
      )}
    </div>
  );
}

export function Bars({ rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-sm"><span className="font-semibold text-steel-800">{r.label}</span><span className="font-bold num">{money(r.value, { compact: true })}</span></div>
          <div className="h-2 rounded-full bg-steel-100 mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          {r.note && <div className="text-xs text-steel-500 mt-1">{r.note}</div>}
        </div>
      ))}
    </div>
  );
}

const MarginPill = ({ v }) => (
  <span className={`inline-block min-w-[52px] text-center rounded-md px-1.5 py-0.5 text-xs font-bold ${v < 0.3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{(v * 100).toFixed(0)}%</span>
);
