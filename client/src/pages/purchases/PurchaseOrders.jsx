import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Truck, PackageCheck, Send, Ban, Wallet, Pencil, Printer, FileText, ClipboardList, HandCoins } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num, ago, METHOD_LABEL } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Button, Modal, Field, Input, Select, Badge, Table, Segmented, Spinner, Empty, useToast } from '../../components/ui.jsx';
import { Stat } from '../../components/kit.jsx';

export const PO_STATUS = { draft: ['Draft', 'grey'], ordered: ['Ordered', 'blue'], received: ['Received', 'green'], cancelled: ['Cancelled', 'red'] };
const payState = (po) => (po.status !== 'received' ? null : po.paid >= po.total - 0.5 ? ['Paid', 'green'] : po.paid > 0 ? ['Part paid', 'amber'] : ['Unpaid', 'red']);

export default function PurchaseOrders() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [openId, setOpenId] = useState(params.get('open') ? Number(params.get('open')) : null);
  const [edit, setEdit] = useState(null);

  const load = () => api('/ops/purchases').then(setRows);
  useEffect(() => { load(); api('/ops/suppliers').then(setSuppliers); api('/admin/products').then((p) => setProducts(p.filter((x) => x.active))); }, []);
  useEffect(() => { if (!openId && params.get('open')) setParams({}, { replace: true }); }, [openId]);

  const list = (rows || []).filter((r) => !status || r.status === status);
  const open = (rows || []).filter((r) => ['draft', 'ordered'].includes(r.status));
  const owed = (rows || []).filter((r) => r.status === 'received').reduce((s, r) => s + (r.total - r.paid), 0);
  const thisMonth = (rows || []).filter((r) => r.status === 'received' && new Date(r.received_at).getMonth() === new Date().getMonth() && new Date(r.received_at).getFullYear() === new Date().getFullYear()).reduce((s, r) => s + r.total, 0);

  async function save(po) {
    const body = { supplier_id: po.supplier_id ? Number(po.supplier_id) : null, expected_on: po.expected_on || null, notes: po.notes, items: po.items.filter((i) => i.name && Number(i.qty) > 0) };
    if (!body.items.length) return toast('Add at least one product', 'warn');
    try {
      if (po.id) { await api(`/ops/purchases/${po.id}`, { method: 'PATCH', body }); toast('Purchase order saved'); setEdit(null); setOpenId(po.id); }
      else { const r = await api('/ops/purchases', { method: 'POST', body }); toast(`${r.number} created`); setEdit(null); setOpenId(r.id); }
      load();
    } catch (e) { toast(e.message, 'warn'); }
  }

  return (
    <div>
      <PageHeader title="Purchase orders" subtitle="Order from suppliers, receive goods into stock, and track what you owe."
        actions={<Button icon={Plus} onClick={() => setEdit({ supplier_id: '', expected_on: '', notes: '', items: [{ product_id: '', name: '', qty: 1, unit_cost: 0 }] })}>New purchase order</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat i={0} dark icon={HandCoins} label="Owed to suppliers" value={money(owed, { compact: true })} sub="On goods already received" />
        <Stat i={1} icon={ClipboardList} label="Open orders" value={num(open.length)} sub={money(open.reduce((s, r) => s + r.total, 0), { compact: true }) + ' on order'} />
        <Stat i={2} icon={Truck} label="Received this month" value={money(thisMonth, { compact: true })} />
      </div>
      <div className="mb-4"><Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'draft', label: 'Drafts' }, { value: 'ordered', label: 'Ordered' }, { value: 'received', label: 'Received' }, { value: 'cancelled', label: 'Cancelled' }]} /></div>
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={list} onRow={(r) => setOpenId(r.id)} empty={<Empty icon={FileText} title="No purchase orders here" />} columns={[
            { key: 'number', label: 'Order', render: (r) => <span className="font-extrabold text-ink num">{r.number}</span> },
            { key: 'supplier', label: 'Supplier', render: (r) => r.supplier || <span className="text-steel-400">No supplier</span> },
            { key: 'created_at', label: 'Created', render: (r) => <span className="text-steel-600">{ago(r.created_at)}</span> },
            { key: 'lines', label: 'Lines', align: 'right' },
            { key: 'status', label: 'Status', render: (r) => { const [l, t] = PO_STATUS[r.status]; const p = payState(r); return <span className="inline-flex gap-1"><Badge tone={t}>{l}</Badge>{p && <Badge tone={p[1]}>{p[0]}</Badge>}</span>; } },
            { key: 'total', label: 'Total', align: 'right', render: (r) => <b>{money(r.total, { symbol: false })}</b> },
          ]} />
        )}
      </div>
      <PODetail id={openId} onClose={() => setOpenId(null)} onChanged={load} onEdit={(po) => { setOpenId(null); setEdit({ ...po, supplier_id: po.supplier_id || '', expected_on: po.expected_on || '', items: po.items.map((i) => ({ product_id: i.product_id || '', name: i.name, qty: i.qty, unit_cost: i.unit_cost })) }); }} />
      <POEditor value={edit} onClose={() => setEdit(null)} onSave={save} suppliers={suppliers} products={products} />
    </div>
  );
}

function POEditor({ value, onClose, onSave, suppliers, products }) {
  const { tenant } = useAuth();
  const [po, setPo] = useState(value);
  useEffect(() => setPo(value), [value]);
  if (!po) return <Modal open={false} />;
  const setLine = (i, patch) => setPo({ ...po, items: po.items.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const subtotal = po.items.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_cost || 0), 0);
  const tax = Math.round(subtotal * Number(tenant?.tax_rate ?? 18) / 100);
  return (
    <Modal open={!!value} onClose={onClose} title={po.id ? `Edit ${po.number}` : 'New purchase order'} width="max-w-3xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(po)}>Save order</Button></>}>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Supplier"><Select value={po.supplier_id} onChange={(e) => setPo({ ...po, supplier_id: e.target.value })}><option value="">Choose a supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Expected delivery"><Input type="date" value={po.expected_on || ''} onChange={(e) => setPo({ ...po, expected_on: e.target.value })} /></Field>
        <Field label="Notes"><Input value={po.notes || ''} onChange={(e) => setPo({ ...po, notes: e.target.value })} placeholder="e.g. deliver before 8 am" /></Field>
      </div>
      <div className="mt-5 rounded-xl ring-1 ring-steel-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_110px_110px_36px] gap-2 bg-steel-50 px-3 py-2 text-[12px] font-semibold text-steel-500"><span>Product</span><span className="text-right">Qty</span><span className="text-right">Unit cost</span><span className="text-right">Line total</span><span /></div>
        {po.items.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_110px_110px_36px] gap-2 items-center px-3 py-2 border-t border-steel-100">
            <Select value={l.product_id} onChange={(e) => { const p = products.find((x) => x.id === Number(e.target.value)); setLine(i, { product_id: e.target.value, name: p?.name || '', unit_cost: p?.cost ?? l.unit_cost }); }}>
              <option value="">Pick a product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name} ({num(p.stock)} in stock)</option>)}
            </Select>
            <Input type="number" min="0" className="text-right num" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" />
            <Input type="number" min="0" className="text-right num" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} aria-label="Unit cost" />
            <span className="text-right font-bold num">{money(Number(l.qty || 0) * Number(l.unit_cost || 0), { symbol: false })}</span>
            <button onClick={() => setPo({ ...po, items: po.items.filter((_, k) => k !== i) })} className="h-8 w-8 grid place-items-center rounded-md text-steel-400 hover:text-bad hover:bg-red-50" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="border-t border-steel-100 px-3 py-2"><Button size="sm" variant="ghost" icon={Plus} onClick={() => setPo({ ...po, items: [...po.items, { product_id: '', name: '', qty: 1, unit_cost: 0 }] })}>Add a line</Button></div>
      </div>
      <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-steel-500">Subtotal</span><span className="num">{money(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-steel-500">VAT {tenant?.tax_rate ?? 18}%</span><span className="num">{money(tax)}</span></div>
        <div className="flex justify-between text-base font-extrabold"><span>Total</span><span className="num">{money(subtotal + tax)}</span></div>
      </div>
    </Modal>
  );
}

function PODetail({ id, onClose, onChanged, onEdit }) {
  const toast = useToast();
  const { tenant } = useAuth();
  const [po, setPo] = useState(null);
  const [pay, setPay] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api(`/ops/purchases/${id}`).then(setPo).catch(() => onClose());
  useEffect(() => { setPo(null); if (id) load(); }, [id]);

  async function act(path, body, msg) {
    setBusy(true);
    try { await api(`/ops/purchases/${id}/${path}`, { method: 'POST', body }); toast(msg); await load(); onChanged(); }
    catch (e) { toast(e.message, 'warn'); } finally { setBusy(false); }
  }
  const due = po ? po.total - po.paid : 0;

  return (
    <>
    <Modal open={!!id} onClose={onClose} title={po ? `${po.number}${po.supplier ? `, ${po.supplier}` : ''}` : 'Purchase order'} width="max-w-2xl"
      footer={po && <>
        <Button variant="ghost" className="mr-auto" icon={Printer} onClick={() => window.print()}>Print</Button>
        {['draft', 'ordered'].includes(po.status) && <>
          <Button variant="ghost" icon={Ban} onClick={() => confirm('Cancel this purchase order?') && act('status', { status: 'cancelled' }, 'Order cancelled')}>Cancel order</Button>
          <Button variant="outline" icon={Pencil} onClick={() => onEdit(po)}>Edit</Button>
          {po.status === 'draft' && <Button variant="outline" icon={Send} loading={busy} onClick={() => act('status', { status: 'ordered' }, 'Marked as ordered')}>Mark as ordered</Button>}
          <Button icon={PackageCheck} loading={busy} onClick={() => act('receive', {}, 'Goods received into stock')}>Receive goods</Button>
        </>}
        {po.status === 'received' && due > 0.5 && <Button icon={Wallet} onClick={() => setPay({ amount: due, method: 'bank', reference: '' })}>Record payment</Button>}
      </>}>
      {!po ? <div className="py-10 grid place-items-center"><Spinner /></div> : (
        <div id="print-receipt" className="bg-white">
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <Badge tone={PO_STATUS[po.status][1]}>{PO_STATUS[po.status][0]}</Badge>
            {payState(po) && <Badge tone={payState(po)[1]}>{payState(po)[0]}</Badge>}
            <span className="text-sm text-steel-500">Created {new Date(po.created_at).toLocaleDateString('en-GB')}{po.expected_on ? `, expected ${new Date(po.expected_on).toLocaleDateString('en-GB')}` : ''}{po.received_at ? `, received ${new Date(po.received_at).toLocaleDateString('en-GB')}` : ''}</span>
          </div>
          <div className="hidden print:block mb-4 text-sm"><b>{tenant?.name}</b><br />Purchase order {po.number} to {po.supplier}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[12px] text-steel-500 border-b border-steel-200"><th className="py-2">Product</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit cost</th><th className="py-2 text-right">Total</th></tr></thead>
            <tbody>{po.items.map((i) => (
              <tr key={i.id} className="border-b border-steel-100"><td className="py-2.5 font-semibold">{i.emoji} {i.name}</td><td className="py-2.5 text-right num">{num(i.qty)}</td><td className="py-2.5 text-right num">{money(i.unit_cost, { symbol: false })}</td><td className="py-2.5 text-right font-bold num">{money(i.line_total, { symbol: false })}</td></tr>
            ))}</tbody>
          </table>
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-steel-500">Subtotal</span><span className="num">{money(po.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-steel-500">VAT</span><span className="num">{money(po.tax)}</span></div>
            <div className="flex justify-between text-base font-extrabold"><span>Total</span><span className="num">{money(po.total)}</span></div>
            {po.status === 'received' && <>
              <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="num">{money(po.paid)}</span></div>
              <div className="flex justify-between font-bold"><span>Still owed</span><span className="num">{money(due)}</span></div>
            </>}
          </div>
          {po.notes && <p className="mt-4 text-sm rounded-lg bg-steel-50 px-3 py-2"><b>Notes:</b> {po.notes}</p>}
          {po.payments.length > 0 && (
            <div className="mt-5">
              <div className="text-[13px] font-bold text-steel-700 mb-2">Payments</div>
              {po.payments.map((p) => <div key={p.id} className="flex justify-between text-sm py-1"><span>{new Date(p.paid_at).toLocaleDateString('en-GB')}, {METHOD_LABEL[p.method] || p.method}{p.reference ? ` (${p.reference})` : ''}</span><span className="num font-semibold">{money(p.amount)}</span></div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
      <Modal open={!!pay} onClose={() => setPay(null)} title="Record supplier payment" width="max-w-sm"
        footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button loading={busy} onClick={async () => { await act('pay', { ...pay, amount: Number(pay.amount) }, 'Payment recorded'); setPay(null); }}>Save payment</Button></>}>
        {pay && <div className="space-y-4">
          <Field label="Amount" hint={`${money(due)} is owed`}><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
          <Field label="Paid by"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{['bank', 'cash', 'mtn_momo', 'airtel_money', 'card'].map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</Select></Field>
          <Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Transfer or receipt number" /></Field>
        </div>}
      </Modal>
    </>
  );
}
