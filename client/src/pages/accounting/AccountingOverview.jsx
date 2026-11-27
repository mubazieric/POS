import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Landmark, TrendingUp, Receipt, HandCoins, Download } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, METHOD_LABEL } from '../../lib/format.js';
import { PageHeader, Button, Spinner, cx } from '../../components/ui.jsx';
import { useRange, RangePicker, Stat, Card, downloadCsv } from '../../components/kit.jsx';
import { AXIS, GRID, ChartTip } from '../../components/charts.jsx';

export const EXPENSE_LABEL = { rent: 'Rent', salaries: 'Salaries & wages', utilities: 'Utilities', transport: 'Transport', marketing: 'Marketing', repairs: 'Repairs & maintenance', supplies: 'Supplies', other: 'Other' };

export default function AccountingOverview() {
  const range = useRange('month');
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); api(`/ops/accounting/summary?${range.qs}`).then(setD); }, [range.qs]);

  function exportPnl() {
    const p = d.pnl;
    downloadCsv(`profit-and-loss_${d.from}_${d.to}.csv`, [
      ['Profit and loss', `${d.from} to ${d.to}`], [],
      ['Gross sales (incl. VAT)', p.gross_sales], ['Less VAT collected', -p.vat_out], ['Revenue', p.revenue],
      ['Cost of goods sold', -p.cogs], ['Gross profit', p.gross_profit], [],
      ...d.expensesByCategory.map((e) => [EXPENSE_LABEL[e.category] || e.category, -e.amount]),
      ['Total expenses', -p.expenses], [], ['Net profit', p.net_profit],
    ]);
  }

  return (
    <div>
      <PageHeader title="Accounting" subtitle="Profit and loss, VAT and cash, built automatically from your sales, purchases and expenses."
        actions={<Button variant="outline" icon={Download} onClick={exportPnl} disabled={!d}>Export P&L</Button>} />
      <div className="mb-5"><RangePicker range={range} /></div>
      {!d ? <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat i={0} dark icon={TrendingUp} label="Net profit" value={money(d.pnl.net_profit, { compact: true })} sub={d.pnl.revenue ? `${((d.pnl.net_profit / d.pnl.revenue) * 100).toFixed(1)}% of revenue` : ''} />
            <Stat i={1} icon={Landmark} label="Revenue (excl. VAT)" value={money(d.pnl.revenue, { compact: true })} />
            <Stat i={2} icon={Receipt} label="VAT to pay URA" value={money(d.vat.payable, { compact: true })} sub="Output VAT less input VAT" />
            <Stat i={3} icon={HandCoins} label="Owed to suppliers" value={money(d.payables.owed, { compact: true })} sub={`${d.payables.bills} unpaid bills`} />
          </div>

          <div className="grid lg:grid-cols-5 gap-5 mt-5">
            <Card className="lg:col-span-2" title="Profit and loss" sub={`${new Date(d.from).toLocaleDateString('en-GB')} to ${new Date(d.to).toLocaleDateString('en-GB')}`}>
              <div className="text-sm">
                <Line2 label="Gross sales (incl. VAT)" value={d.pnl.gross_sales} />
                <Line2 label="Less VAT collected" value={-d.pnl.vat_out} muted />
                <Line2 label="Revenue" value={d.pnl.revenue} strong />
                <Line2 label="Cost of goods sold" value={-d.pnl.cogs} muted />
                <Line2 label="Gross profit" value={d.pnl.gross_profit} strong />
                <div className="mt-3 mb-1 text-[12px] font-semibold text-steel-500">Operating expenses</div>
                {d.expensesByCategory.map((e) => <Line2 key={e.category} label={EXPENSE_LABEL[e.category] || e.category} value={-e.amount} muted indent />)}
                {!d.expensesByCategory.length && <p className="text-steel-400 py-1">No expenses in this period.</p>}
                <Line2 label="Total expenses" value={-d.pnl.expenses} />
                <div className={cx('mt-3 flex justify-between items-center rounded-lg px-3 py-3 font-extrabold text-base', d.pnl.net_profit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>
                  <span>Net profit</span><span className="num">{money(d.pnl.net_profit)}</span>
                </div>
              </div>
            </Card>
            <Card className="lg:col-span-3" title="Last six months" sub="Revenue, costs and what was left.">
              <div className="h-[340px] -ml-2">
                <ResponsiveContainer>
                  <ComposedChart data={d.monthly}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="month" {...AXIS} />
                    <YAxis {...AXIS} tickFormatter={(v) => money(v, { compact: true, symbol: false })} width={48} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF5ED' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="revenue" name="Revenue" fill="#F26A1B" radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="cogs" name="Cost of goods" fill="#FDAA70" radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="expenses" name="Expenses" fill="#A19D98" radius={[5, 5, 0, 0]} maxBarSize={26} />
                    <Line dataKey="profit" name="Net profit" stroke="#1F1D1B" strokeWidth={2.5} type="monotone" dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mt-5">
            <Card title="VAT for the period" sub="What you collected from customers against what you paid suppliers.">
              <div className="text-sm">
                <Line2 label="Output VAT (on sales)" value={d.vat.output} />
                <Line2 label="Input VAT (on purchases)" value={-d.vat.input} muted />
                <Line2 label="VAT payable" value={d.vat.payable} strong />
              </div>
              <div className="h-[120px] mt-3 -ml-2">
                <ResponsiveContainer>
                  <BarChart data={d.monthly}>
                    <XAxis dataKey="month" {...AXIS} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#FFF5ED' }} />
                    <Bar dataKey="vat_net" name="Net VAT" fill="#1F1D1B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Cash in and out" sub="By payment method for the period.">
              <CashTable cin={d.cash.in} cout={d.cash.out} />
            </Card>
            <Card title="Purchases" action={<Link to="/admin/purchases" className="text-[13px] font-semibold text-brand-600 hover:underline">Open purchases</Link>}>
              <div className="text-sm">
                <Line2 label={`Goods received (${d.purchases.n} orders)`} value={d.purchases.subtotal} />
                <Line2 label="VAT on purchases" value={d.purchases.vat} muted />
                <Line2 label="Total billed" value={d.purchases.total} strong />
                <Line2 label="Still owed, all time" value={d.payables.owed} />
              </div>
              <Link to="/admin/accounting/expenses"><Button variant="soft" className="w-full mt-4">Record an expense</Button></Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Line2({ label, value, strong, muted, indent }) {
  return (
    <div className={cx('flex justify-between py-1.5', strong && 'border-t border-steel-200 mt-1 pt-2 font-bold text-steel-900', muted && 'text-steel-500', indent && 'pl-3')}>
      <span>{label}</span><span className="num">{value < 0 ? `(${money(-value, { symbol: false })})` : money(value, { symbol: false })}</span>
    </div>
  );
}

function CashTable({ cin, cout }) {
  const methods = [...new Set([...Object.keys(cin), ...Object.keys(cout)])];
  const tIn = Object.values(cin).reduce((s, v) => s + v, 0); const tOut = Object.values(cout).reduce((s, v) => s + v, 0);
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-[12px] text-steel-500"><th className="text-left font-semibold pb-2">Method</th><th className="text-right font-semibold pb-2">In</th><th className="text-right font-semibold pb-2">Out</th></tr></thead>
      <tbody>
        {methods.map((m) => <tr key={m} className="border-t border-steel-100"><td className="py-2">{METHOD_LABEL[m] || m}</td><td className="py-2 text-right num text-emerald-700">{money(cin[m] || 0, { compact: true, symbol: false })}</td><td className="py-2 text-right num">{money(cout[m] || 0, { compact: true, symbol: false })}</td></tr>)}
        <tr className="border-t-2 border-steel-200 font-bold"><td className="py-2">Net</td><td colSpan={2} className={cx('py-2 text-right num', tIn - tOut < 0 && 'text-bad')}>{money(tIn - tOut)}</td></tr>
      </tbody>
    </table>
  );
}
