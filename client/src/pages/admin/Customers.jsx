import { useEffect, useState } from 'react';
import { Plus, Search, Users, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, ago, num } from '../../lib/format.js';
import { PageHeader, Button, Modal, Field, Input, Badge, Table, Spinner, Empty, useToast } from '../../components/ui.jsx';

export default function Customers() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/customers').then(setRows);
  useEffect(() => { load(); }, []);
  async function save() {
    try {
      if (edit.id) await api(`/admin/customers/${edit.id}`, { method: 'PATCH', body: edit }); else await api('/admin/customers', { method: 'POST', body: edit });
      toast('Customer saved'); setEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }
  const list = (rows || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q));
  const tier = (s) => (s > 1500000 ? ['Gold', 'amber'] : s > 500000 ? ['Silver', 'grey'] : ['Member', 'blue']);
  return (
    <div>
      <PageHeader title="Customers" subtitle="Regulars earn 1 point per 1,000 spent." actions={<Button icon={Plus} onClick={() => setEdit({ name: '', phone: '', email: '' })}>Add customer</Button>} />
      <div className="relative max-w-sm mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400" /><Input className="pl-9" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={list} onRow={setEdit} empty={<Empty icon={Users} title="No customers yet">Add customers here or from the register while taking an order.</Empty>}
            columns={[
              { key: 'name', label: 'Customer', render: (c) => <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold">{c.name[0]}</span><div><div className="font-bold text-steel-900">{c.name}</div><div className="text-xs text-steel-500">{c.phone}</div></div></div> },
              { key: 'tier', label: 'Tier', render: (c) => { const [l, t] = tier(c.spent); return <Badge tone={t}>{l}</Badge>; } },
              { key: 'visits', label: 'Visits', align: 'right', render: (c) => num(c.visits) },
              { key: 'points', label: 'Points', align: 'right', render: (c) => num(c.points) },
              { key: 'last', label: 'Last visit', render: (c) => c.last_visit ? ago(c.last_visit) : <span className="text-steel-400">Never</span> },
              { key: 'spent', label: 'Total spent', align: 'right', render: (c) => <b>{money(c.spent, { symbol: false })}</b> },
            ]} />
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.name : 'New customer'}
        footer={<>{edit?.id && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={async () => { if (confirm('Delete this customer? Their past orders stay.')) { await api(`/admin/customers/${edit.id}`, { method: 'DELETE' }); setEdit(null); load(); } }}>Delete</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.name}>Save customer</Button></>}>
        {edit && <div className="space-y-4">
          <Field label="Name"><Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+256 7xx xxx xxx" /></Field>
          <Field label="Email"><Input type="email" value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          {edit.id && <Field label="Loyalty points"><Input type="number" value={edit.points} onChange={(e) => setEdit({ ...edit, points: Number(e.target.value) })} /></Field>}
        </div>}
      </Modal>
    </div>
  );
}
