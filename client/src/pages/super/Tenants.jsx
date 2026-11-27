import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LogIn, Building2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, ago } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Button, Modal, Field, Input, Select, Badge, Table, Spinner, Empty, Segmented, useToast } from '../../components/ui.jsx';

const STATUS_TONE = { active: 'green', trial: 'blue', suspended: 'red' };

export default function Tenants() {
  const toast = useToast();
  const navigate = useNavigate();
  const { impersonate } = useAuth();
  const [rows, setRows] = useState(null);
  const [plans, setPlans] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sel, setSel] = useState(null);
  const [create, setCreate] = useState(null);
  const load = () => api('/super/tenants').then(setRows);
  useEffect(() => { load(); api('/super/plans').then(setPlans); }, []);

  const list = (rows || []).filter((t) => (status === 'all' || t.status === status) && (!q || t.name.toLowerCase().includes(q.toLowerCase()) || t.city?.toLowerCase().includes(q.toLowerCase())));

  async function update(t, patch) {
    const row = await api(`/super/tenants/${t.id}`, { method: 'PATCH', body: patch });
    toast(`${row.name} updated`); setSel({ ...sel, ...row }); load();
  }
  async function supportLogin(t) {
    try { const s = await api(`/super/tenants/${t.id}/impersonate`, { method: 'POST' }); impersonate(s); navigate('/admin'); }
    catch (e) { toast(e.message, 'warn'); }
  }
  async function submit() {
    try { await api('/super/tenants', { method: 'POST', body: create }); toast('Business created'); setCreate(null); load(); }
    catch (e) { toast(e.message, 'warn'); }
  }

  return (
    <div>
      <PageHeader title="Businesses" subtitle="Create accounts, change plans and suspend access."
        actions={<Button icon={Plus} onClick={() => setCreate({ name: '', industry: 'restaurant', plan_code: 'starter', status: 'trial', city: 'Kampala', owner_name: '', owner_email: '', owner_password: '' })}>New business</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'trial', label: 'Trial' }, { value: 'suspended', label: 'Suspended' }]} />
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400" /><Input className="pl-9" placeholder="Search name or city" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={list} onRow={setSel} empty={<Empty icon={Building2} title="No businesses match" />}
            columns={[
              { key: 'name', label: 'Business', render: (t) => <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center font-extrabold">{t.name[0]}</span><div><div className="font-bold text-steel-900">{t.name}</div><div className="text-xs text-steel-500 capitalize">{t.industry}, {t.city}</div></div></div> },
              { key: 'plan', label: 'Plan', render: (t) => <span className="font-semibold">{t.plan_name}</span> },
              { key: 'status', label: 'Status', render: (t) => <Badge tone={STATUS_TONE[t.status]}><span className="capitalize">{t.status}</span></Badge> },
              { key: 'users', label: 'Staff', align: 'right' },
              { key: 'last', label: 'Last sale', render: (t) => t.last_order ? ago(t.last_order) : <span className="text-steel-400">None yet</span> },
              { key: 'mrr', label: 'Pays / month', align: 'right', render: (t) => money(t.status === 'active' ? t.price_monthly : 0, { symbol: false }) },
              { key: 'gmv', label: 'Sales, 30 days', align: 'right', render: (t) => <b>{money(t.gmv_30d, { compact: true, symbol: false })}</b> },
            ]} />
        )}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name} width="max-w-lg">
        {sel && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[['Owner', sel.owner_email], ['Joined', new Date(sel.created_at).toLocaleDateString('en-GB')], ['Sales, 30 days', money(sel.gmv_30d)], ['Staff accounts', sel.users]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-steel-50 px-3 py-2.5"><dt className="text-xs text-steel-500">{k}</dt><dd className="font-bold text-steel-900 truncate">{v}</dd></div>
              ))}
            </dl>
            <Field label="Plan"><Select value={sel.plan_code} onChange={(e) => update(sel, { plan_code: e.target.value })}>{plans.map((p) => <option key={p.code} value={p.code}>{p.name}, {money(p.price_monthly)} / month</option>)}</Select></Field>
            <Field label="Access"><Segmented value={sel.status} onChange={(v) => update(sel, { status: v })} options={[{ value: 'active', label: 'Active' }, { value: 'trial', label: 'Trial' }, { value: 'suspended', label: 'Suspended' }]} /></Field>
            {sel.status === 'suspended' && <p className="text-sm text-bad">Staff of this business can’t sign in until access is restored.</p>}
            <div className="border-t border-steel-100 pt-4">
              <Button variant="dark" icon={LogIn} onClick={() => supportLogin(sel)} className="w-full">Open as owner for support</Button>
              <p className="text-xs text-steel-500 mt-2 text-center">Signs you in to their dashboard. Each use is written to the audit log.</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!create} onClose={() => setCreate(null)} title="New business" width="max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setCreate(null)}>Cancel</Button><Button onClick={submit} disabled={!create?.name || !create?.owner_email || !create?.owner_password}>Create business</Button></>}>
        {create && <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name" className="sm:col-span-2"><Input autoFocus value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} /></Field>
          <Field label="Type"><Select value={create.industry} onChange={(e) => setCreate({ ...create, industry: e.target.value })}>{['restaurant', 'cafe', 'bar', 'bakery', 'retail', 'pharmacy', 'salon'].map((i) => <option key={i} value={i} className="capitalize">{i}</option>)}</Select></Field>
          <Field label="City"><Input value={create.city} onChange={(e) => setCreate({ ...create, city: e.target.value })} /></Field>
          <Field label="Plan"><Select value={create.plan_code} onChange={(e) => setCreate({ ...create, plan_code: e.target.value })}>{plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
          <Field label="Start as"><Select value={create.status} onChange={(e) => setCreate({ ...create, status: e.target.value })}><option value="trial">Trial</option><option value="active">Active</option></Select></Field>
          <div className="sm:col-span-2 border-t border-steel-100 pt-4 text-sm font-bold text-steel-900">Owner account</div>
          <Field label="Owner name"><Input value={create.owner_name} onChange={(e) => setCreate({ ...create, owner_name: e.target.value })} /></Field>
          <Field label="Owner email"><Input type="email" value={create.owner_email} onChange={(e) => setCreate({ ...create, owner_email: e.target.value })} /></Field>
          <Field label="Temporary password" hint="Share it with the owner; they can change it later." className="sm:col-span-2"><Input value={create.owner_password} onChange={(e) => setCreate({ ...create, owner_password: e.target.value })} /></Field>
        </div>}
      </Modal>
    </div>
  );
}
