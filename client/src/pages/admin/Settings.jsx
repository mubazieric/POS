import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Armchair, MonitorSmartphone, Plus, Trash2, Download, Check, CreditCard } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { useSyncState, deviceName } from '../../lib/offline.js';
import { PageHeader, Button, Field, Input, Select, Segmented, Spinner, Badge, Modal, useToast, cx } from '../../components/ui.jsx';

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

export default function Settings() {
  const [tab, setTab] = useState('business');
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="mb-5"><Segmented value={tab} onChange={setTab} options={[
        { value: 'business', label: 'Business', icon: Building2 }, { value: 'floor', label: 'Floor plan', icon: Armchair },
        { value: 'devices', label: 'Devices & app', icon: MonitorSmartphone }, { value: 'plan', label: 'Plan', icon: CreditCard }]} /></div>
      {tab === 'business' && <Business />}
      {tab === 'floor' && <FloorEditor />}
      {tab === 'devices' && <Devices />}
      {tab === 'plan' && <Plan />}
    </div>
  );
}

function Business() {
  const { user, setTenant } = useAuth();
  const toast = useToast();
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/settings').then(setS); }, []);
  if (!s) return <Spinner />;
  const f = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const readOnly = user.role !== 'owner';
  async function save() {
    try {
      const t = await api('/admin/settings', { method: 'PATCH', body: { name: s.name, phone: s.phone, email: s.email, address: s.address, city: s.city, currency: s.currency, tax_rate: Number(s.tax_rate), tax_inclusive: s.tax_inclusive, receipt_footer: s.receipt_footer } });
      setTenant({ name: t.name, currency: t.currency, tax_rate: t.tax_rate, tax_inclusive: t.tax_inclusive, receipt_footer: t.receipt_footer, phone: t.phone, address: t.address, city: t.city });
      toast('Settings saved');
    } catch (e) { toast(e.message, 'warn'); }
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-6 space-y-4">
        <h3 className="font-bold text-steel-900">Business details</h3>
        <Field label="Business name"><Input disabled={readOnly} value={s.name} onChange={f('name')} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Phone"><Input disabled={readOnly} value={s.phone || ''} onChange={f('phone')} /></Field>
          <Field label="Email"><Input disabled={readOnly} value={s.email || ''} onChange={f('email')} /></Field>
          <Field label="Address"><Input disabled={readOnly} value={s.address || ''} onChange={f('address')} /></Field>
          <Field label="City"><Input disabled={readOnly} value={s.city || ''} onChange={f('city')} /></Field>
        </div>
      </section>
      <section className="card p-6 space-y-4">
        <h3 className="font-bold text-steel-900">Money and receipts</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Currency"><Select disabled={readOnly} value={s.currency} onChange={f('currency')}>{['UGX', 'KES', 'TZS', 'RWF', 'USD', 'EUR', 'GBP', 'AUD'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="VAT rate (%)"><Input disabled={readOnly} type="number" value={s.tax_rate} onChange={f('tax_rate')} /></Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm font-semibold text-steel-700"><input disabled={readOnly} type="checkbox" className="h-4 w-4 accent-brand-500" checked={s.tax_inclusive} onChange={f('tax_inclusive')} />Menu prices already include VAT</label>
        <Field label="Receipt footer"><Input disabled={readOnly} value={s.receipt_footer || ''} onChange={f('receipt_footer')} /></Field>
        {!readOnly ? <div className="flex justify-end pt-2"><Button onClick={save}>Save settings</Button></div> : <p className="text-sm text-steel-500">Only the owner can change these settings.</p>}
      </section>
    </div>
  );
}

/* Drag tables around the room; positions are stored as percentages so the plan fits any screen. */
function FloorEditor() {
  const toast = useToast();
  const [tables, setTables] = useState(null);
  const [area, setArea] = useState(null);
  const [edit, setEdit] = useState(null);
  const box = useRef();
  const load = () => api('/admin/tables').then((t) => { setTables(t); setArea((a) => a || t[0]?.area || 'Main hall'); });
  useEffect(() => { load(); }, []);
  if (!tables) return <Spinner />;
  const areas = [...new Set([...tables.map((t) => t.area), area].filter(Boolean))];

  function onDragEnd(t, info) {
    const r = box.current.getBoundingClientRect();
    const el = document.getElementById(`tbl-${t.id}`).getBoundingClientRect();
    const x = Math.round(Math.min(Math.max(((el.left - r.left) / r.width) * 100, 0), 85));
    const y = Math.round(Math.min(Math.max(((el.top - r.top) / r.height) * 100, 0), 85));
    setTables((xs) => xs.map((z) => (z.id === t.id ? { ...z, x, y } : z)));
    api(`/admin/tables/${t.id}`, { method: 'PATCH', body: { x, y } }).catch(() => toast('Couldn’t save the new position', 'warn'));
  }
  async function save() {
    const body = { ...edit, seats: Number(edit.seats) };
    if (edit.id) await api(`/admin/tables/${edit.id}`, { method: 'PATCH', body }); else await api('/admin/tables', { method: 'POST', body: { ...body, area, x: 40, y: 40 } });
    setEdit(null); load(); toast('Table saved');
  }
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented value={area} onChange={setArea} options={areas.map((a) => ({ value: a, label: a }))} />
        <Button size="sm" variant="ghost" onClick={() => { const n = prompt('Name the new area, e.g. Rooftop'); if (n) setArea(n); }}>New area</Button>
        <span className="text-sm text-steel-500">Drag tables to match your room.</span>
        <Button className="ml-auto" icon={Plus} onClick={() => setEdit({ name: '', seats: 4, shape: 'square' })}>Add table</Button>
      </div>
      <div ref={box} className="relative h-[520px] rounded-xl bg-steel-50 grid-dots ring-1 ring-steel-200 overflow-hidden">
        {tables.filter((t) => t.area === area).map((t) => (
          <motion.div id={`tbl-${t.id}`} key={`${t.id}-${t.x}-${t.y}`} drag dragMomentum={false} dragConstraints={box} onDragEnd={(e, i) => onDragEnd(t, i)}
            onDoubleClick={() => setEdit(t)} whileDrag={{ scale: 1.06, zIndex: 10 }}
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            className={cx('absolute cursor-grab active:cursor-grabbing bg-white ring-2 ring-brand-300 shadow-card flex flex-col items-center justify-center select-none',
              t.shape === 'round' ? 'h-20 w-20 rounded-full' : t.shape === 'long' ? 'h-20 w-40 rounded-2xl' : 'h-20 w-20 rounded-2xl')}>
            <span className="font-extrabold text-ink">{t.name}</span><span className="text-[11px] text-steel-500">{t.seats} seats</span>
            <button onClick={() => setEdit(t)} className="absolute -top-2 -right-2 h-6 px-1.5 rounded-full bg-ink text-white text-[10px] font-bold">Edit</button>
          </motion.div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Table ${edit.name}` : 'New table'} width="max-w-sm"
        footer={<>{edit?.id && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={async () => { await api(`/admin/tables/${edit.id}`, { method: 'DELETE' }); setEdit(null); load(); }}>Delete</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.name}>Save table</Button></>}>
        {edit && <div className="space-y-4">
          <Field label="Name"><Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. T9" /></Field>
          <Field label="Seats"><Input type="number" min="1" value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: e.target.value })} /></Field>
          <Field label="Shape"><Segmented value={edit.shape} onChange={(shape) => setEdit({ ...edit, shape })} options={[{ value: 'square', label: 'Square' }, { value: 'round', label: 'Round' }, { value: 'long', label: 'Long' }]} /></Field>
        </div>}
      </Modal>
    </section>
  );
}

function Devices() {
  const { online, pending, lastSync } = useSyncState();
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const r = await deferredPrompt.userChoice;
    if (r.outcome === 'accepted') setInstalled(true);
    deferredPrompt = null;
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-6">
        <h3 className="font-bold text-steel-900">This device</h3>
        <dl className="mt-4 divide-y divide-steel-100 text-sm">
          {[['Name', deviceName()], ['Connection', online ? 'Online' : 'Offline'], ['Sales waiting to upload', String(pending)], ['Last upload', lastSync ? new Date(lastSync).toLocaleString('en-GB') : 'Not yet']].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5"><dt className="text-steel-500">{k}</dt><dd className="font-semibold text-steel-900">{v}</dd></div>
          ))}
        </dl>
      </section>
      <section className="card p-6">
        <h3 className="font-bold text-steel-900">Install the app</h3>
        <p className="text-sm text-steel-500 mt-1 mb-4">Installing puts IWAT POS on the home screen, opens full-screen and keeps working without internet.</p>
        {installed ? <Badge tone="green"><Check className="h-3.5 w-3.5" />Installed on this device</Badge>
          : deferredPrompt ? <Button icon={Download} onClick={install}>Install IWAT POS</Button>
          : <div className="text-sm text-steel-700 space-y-2">
              <p><b>Android / Chrome:</b> open the browser menu and choose “Install app”.</p>
              <p><b>iPhone / iPad:</b> tap Share, then “Add to Home Screen”.</p>
              <p><b>Windows / Mac:</b> click the install icon at the right of the address bar.</p>
            </div>}
      </section>
    </div>
  );
}

function Plan() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/settings').then(setS); }, []);
  if (!s) return <Spinner />;
  return (
    <section className="card p-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div><div className="text-sm text-steel-500">Current plan</div><div className="text-2xl font-extrabold text-ink">{s.plan_name}</div></div>
        <div className="text-right"><div className="text-2xl font-extrabold num">{money(s.price_monthly)}</div><div className="text-sm text-steel-500">per month</div></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg bg-steel-50 p-3"><div className="text-xs text-steel-500">Tills</div><div className="font-bold">{s.max_terminals}</div></div>
        <div className="rounded-lg bg-steel-50 p-3"><div className="text-xs text-steel-500">Team members</div><div className="font-bold">{s.max_users}</div></div>
      </div>
      <ul className="mt-5 space-y-2 text-sm">{(s.features || []).map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-ok" />{f}</li>)}</ul>
      <p className="text-sm text-steel-500 mt-5">To change plan, contact IWAT support.</p>
    </section>
  );
}
