import { useEffect, useState } from 'react';
import { Plus, Receipt, Trash2, Download } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, METHOD_LABEL } from '../../lib/format.js';
import { PageHeader, Button, Modal, Field, Input, Select, Table, Spinner, Empty, Badge, useToast } from '../../components/ui.jsx';
import { useRange, RangePicker, downloadCsv } from '../../components/kit.jsx';
import { EXPENSE_LABEL } from './AccountingOverview.jsx';

export default function Expenses() {
  const toast = useToast();
  const range = useRange('month');
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api(`/ops/expenses?${range.qs}`).then(setRows);
  useEffect(() => { setRows(null); load(); }, [range.qs]);
  const total = (rows || []).reduce((s, e) => s + e.amount, 0);
  const byCat = Object.entries((rows || []).reduce((o, e) => ({ ...o, [e.category]: (o[e.category] || 0) + e.amount }), {})).sort((a, b) => b[1] - a[1]);

  async function save() {
    const body = { ...edit, amount: Number(edit.amount) };
    try {
      if (edit.id) await api(`/ops/expenses/${edit.id}`, { method: 'PATCH', body }); else await api('/ops/expenses', { method: 'POST', body });
      toast('Expense saved'); setEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }
  const f = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Rent, wages, bills and everything else that isn’t stock."
        actions={<>
          <Button variant="outline" icon={Download} disabled={!rows?.length} onClick={() => downloadCsv(`expenses_${range.from}_${range.to}.csv`, [['Date', 'Category', 'Description', 'Paid to', 'Method', 'Amount'], ...rows.map((e) => [e.spent_on, EXPENSE_LABEL[e.category], e.description, e.paid_to, METHOD_LABEL[e.method], e.amount])])}>Export</Button>
          <Button icon={Plus} onClick={() => setEdit({ category: 'utilities', description: '', amount: '', method: 'cash', paid_to: '', spent_on: new Date().toLocaleDateString('en-CA') })}>Record expense</Button>
        </>} />
      <div className="mb-5"><RangePicker range={range} /></div>
      {rows && (
        <div className="card p-5 mb-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div><div className="text-[13px] font-semibold text-steel-500">Total spent</div><div className="text-[28px] font-extrabold num">{money(total)}</div></div>
            <div className="flex flex-wrap gap-2">{byCat.map(([c, v]) => <Badge key={c}>{EXPENSE_LABEL[c] || c}: {money(v, { compact: true, symbol: false })}</Badge>)}</div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden mt-4 bg-steel-100">
            {byCat.map(([c, v], i) => <span key={c} title={EXPENSE_LABEL[c]} style={{ width: `${(v / (total || 1)) * 100}%`, background: ['#F26A1B', '#1F1D1B', '#FA8638', '#75716C', '#FDAA70', '#403D3A', '#FFCDA8', '#CFCCC8'][i % 8] }} />)}
          </div>
        </div>
      )}
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={rows} onRow={(e) => setEdit({ ...e })} empty={<Empty icon={Receipt} title="No expenses in this period" />} columns={[
            { key: 'spent_on', label: 'Date', render: (e) => new Date(e.spent_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { key: 'category', label: 'Category', render: (e) => <Badge tone="blue">{EXPENSE_LABEL[e.category] || e.category}</Badge> },
            { key: 'description', label: 'Description', render: (e) => <span className="text-steel-800">{e.description || '–'}</span> },
            { key: 'paid_to', label: 'Paid to', render: (e) => e.paid_to || '–' },
            { key: 'method', label: 'Method', render: (e) => METHOD_LABEL[e.method] || e.method },
            { key: 'amount', label: 'Amount', align: 'right', render: (e) => <b>{money(e.amount, { symbol: false })}</b> },
          ]} />
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit expense' : 'Record expense'}
        footer={<>{edit?.id && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={async () => { if (confirm('Delete this expense?')) { await api(`/ops/expenses/${edit.id}`, { method: 'DELETE' }); setEdit(null); load(); } }}>Delete</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!(Number(edit?.amount) > 0)}>Save expense</Button></>}>
        {edit && <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category"><Select value={edit.category} onChange={f('category')}>{Object.entries(EXPENSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Amount"><Input autoFocus type="number" min="0" value={edit.amount} onChange={f('amount')} /></Field>
          <Field label="Description" className="sm:col-span-2"><Input value={edit.description || ''} onChange={f('description')} placeholder="e.g. UMEME electricity for November" /></Field>
          <Field label="Paid to"><Input value={edit.paid_to || ''} onChange={f('paid_to')} /></Field>
          <Field label="Paid by"><Select value={edit.method} onChange={f('method')}>{['cash', 'mtn_momo', 'airtel_money', 'bank', 'card'].map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</Select></Field>
          <Field label="Date"><Input type="date" value={edit.spent_on} onChange={f('spent_on')} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
