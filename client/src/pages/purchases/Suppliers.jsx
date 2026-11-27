import { useEffect, useState } from 'react';
import { Plus, Truck, Trash2, Phone, Mail } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num, ago } from '../../lib/format.js';
import { PageHeader, Button, Modal, Field, Input, Table, Spinner, Empty, Badge, useToast } from '../../components/ui.jsx';

export default function Suppliers() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api('/ops/suppliers').then(setRows);
  useEffect(() => { load(); }, []);
  async function save() {
    try {
      if (edit.id) await api(`/ops/suppliers/${edit.id}`, { method: 'PATCH', body: edit }); else await api('/ops/suppliers', { method: 'POST', body: edit });
      toast('Supplier saved'); setEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }
  const f = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Who you buy from, how much, and what you still owe."
        actions={<Button icon={Plus} onClick={() => setEdit({ name: '', contact: '', phone: '', email: '', address: '', terms_days: 0 })}>Add supplier</Button>} />
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={rows} onRow={setEdit} empty={<Empty icon={Truck} title="No suppliers yet">Add the businesses you buy stock from.</Empty>} columns={[
            { key: 'name', label: 'Supplier', render: (s) => <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center font-extrabold">{s.name[0]}</span><div><div className="font-bold text-steel-900">{s.name}</div><div className="text-xs text-steel-500">{s.contact}</div></div></div> },
            { key: 'phone', label: 'Contact', render: (s) => <div className="text-xs text-steel-600 space-y-0.5">{s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</div>}{s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{s.email}</div>}</div> },
            { key: 'terms', label: 'Terms', render: (s) => (s.terms_days ? `${s.terms_days} days` : 'On delivery') },
            { key: 'orders', label: 'Orders', align: 'right', render: (s) => num(s.orders) },
            { key: 'last', label: 'Last order', render: (s) => (s.last_order ? ago(s.last_order) : '–') },
            { key: 'purchased', label: 'Bought', align: 'right', render: (s) => money(s.purchased, { compact: true, symbol: false }) },
            { key: 'balance', label: 'You owe', align: 'right', render: (s) => (s.balance > 0.5 ? <Badge tone="red">{money(s.balance, { symbol: false })}</Badge> : <span className="text-steel-400">Nothing</span>) },
          ]} />
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.name : 'New supplier'}
        footer={<>{edit?.id && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={async () => { if (confirm('Delete this supplier? Their past orders stay, without a supplier name.')) { await api(`/ops/suppliers/${edit.id}`, { method: 'DELETE' }); setEdit(null); load(); } }}>Delete</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.name}>Save supplier</Button></>}>
        {edit && <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name" className="sm:col-span-2"><Input autoFocus value={edit.name} onChange={f('name')} /></Field>
          <Field label="Contact person"><Input value={edit.contact || ''} onChange={f('contact')} /></Field>
          <Field label="Phone"><Input value={edit.phone || ''} onChange={f('phone')} /></Field>
          <Field label="Email"><Input type="email" value={edit.email || ''} onChange={f('email')} /></Field>
          <Field label="Payment terms (days)" hint="0 means pay on delivery"><Input type="number" min="0" value={edit.terms_days} onChange={f('terms_days')} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={edit.address || ''} onChange={f('address')} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
