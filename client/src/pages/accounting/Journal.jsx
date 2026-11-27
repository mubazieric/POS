import { Fragment, useEffect, useState } from 'react';
import { ChevronRight, BookOpen, Download } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { PageHeader, Button, Segmented, Spinner, Empty, Badge, cx } from '../../components/ui.jsx';
import { useRange, RangePicker, downloadCsv } from '../../components/kit.jsx';

const JTONE = { Sales: 'green', Purchases: 'blue', Bank: 'dark', Expenses: 'amber' };

export default function Journal() {
  const range = useRange('30d');
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('journal');
  const [journal, setJournal] = useState('');
  const [open, setOpen] = useState({});
  useEffect(() => { setD(null); api(`/ops/accounting/journal?${range.qs}`).then(setD); }, [range.qs]);
  const entries = (d?.entries || []).filter((e) => !journal || e.journal === journal);
  const sum = (e, k) => e.lines.reduce((s, l) => s + l[k], 0);

  function exportCsv() {
    if (tab === 'trial') downloadCsv(`trial-balance_${d.from}_${d.to}.csv`, [['Account', 'Debit', 'Credit', 'Balance'], ...d.trial.map((a) => [a.account, a.debit, a.credit, a.debit - a.credit])]);
    else downloadCsv(`journal_${d.from}_${d.to}.csv`, [['Date', 'Journal', 'Reference', 'Description', 'Account', 'Debit', 'Credit'], ...entries.flatMap((e) => e.lines.map((l) => [new Date(e.date).toLocaleDateString('en-CA'), e.journal, e.ref, e.label, l.account, l.debit || '', l.credit || '']))]);
  }

  return (
    <div>
      <PageHeader title="Journal" subtitle="Double-entry records generated from every sale, delivery, supplier payment and expense."
        actions={<Button variant="outline" icon={Download} onClick={exportCsv} disabled={!d}>Export CSV</Button>} />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <RangePicker range={range} />
        <Segmented value={tab} onChange={setTab} options={[{ value: 'journal', label: 'Entries' }, { value: 'trial', label: 'Trial balance' }]} />
      </div>
      {!d ? <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div> : tab === 'trial' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[12px] font-semibold text-steel-500 border-b border-steel-200"><th className="px-4 py-2.5">Account</th><th className="px-4 py-2.5 text-right">Debit</th><th className="px-4 py-2.5 text-right">Credit</th><th className="px-4 py-2.5 text-right">Balance</th></tr></thead>
            <tbody>
              {d.trial.map((a) => (
                <tr key={a.account} className="border-b border-steel-100"><td className="px-4 py-2.5 font-semibold">{a.account}</td><td className="px-4 py-2.5 text-right num">{money(a.debit, { symbol: false })}</td><td className="px-4 py-2.5 text-right num">{money(a.credit, { symbol: false })}</td><td className={cx('px-4 py-2.5 text-right num font-bold', a.debit - a.credit < 0 && 'text-steel-500')}>{money(a.debit - a.credit, { symbol: false })}</td></tr>
              ))}
              <tr className="bg-steel-50 font-extrabold"><td className="px-4 py-3">Total</td><td className="px-4 py-3 text-right num">{money(d.trial.reduce((s, a) => s + a.debit, 0), { symbol: false })}</td><td className="px-4 py-3 text-right num">{money(d.trial.reduce((s, a) => s + a.credit, 0), { symbol: false })}</td><td className="px-4 py-3 text-right text-emerald-700 text-xs">Balanced</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mb-3"><Segmented size="sm" value={journal} onChange={setJournal} options={[{ value: '', label: 'All journals' }, ...['Sales', 'Purchases', 'Bank', 'Expenses'].map((j) => ({ value: j, label: j }))]} /></div>
          <div className="card divide-y divide-steel-100">
            {!entries.length && <Empty icon={BookOpen} title="No entries in this period" />}
            {entries.map((e, i) => {
              const k = `${e.ref}-${i}`;
              return (
                <Fragment key={k}>
                  <button onClick={() => setOpen({ ...open, [k]: !open[k] })} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-steel-50">
                    <ChevronRight className={cx('h-4 w-4 text-steel-400 transition-transform', open[k] && 'rotate-90')} />
                    <span className="text-xs text-steel-500 w-20 num">{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    <Badge tone={JTONE[e.journal]}>{e.journal}</Badge>
                    <span className="text-sm font-semibold text-steel-900 flex-1 truncate">{e.label}</span>
                    <span className="hidden sm:block text-xs text-steel-500 w-36 truncate">{e.ref}</span>
                    <span className="text-sm font-bold num w-28 text-right">{money(sum(e, 'debit'), { symbol: false })}</span>
                  </button>
                  {open[k] && (
                    <div className="bg-steel-50 px-4 pb-3 pt-1">
                      <table className="w-full text-[13px] ml-7 max-w-3xl">
                        <thead><tr className="text-steel-500"><th className="text-left font-semibold py-1">Account</th><th className="text-right font-semibold py-1">Debit</th><th className="text-right font-semibold py-1">Credit</th></tr></thead>
                        <tbody>{e.lines.map((l, j) => <tr key={j}><td className={cx('py-1', l.credit && 'pl-6')}>{l.account}</td><td className="py-1 text-right num">{l.debit ? money(l.debit, { symbol: false }) : ''}</td><td className="py-1 text-right num">{l.credit ? money(l.credit, { symbol: false }) : ''}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
