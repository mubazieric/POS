import { useEffect, useState } from 'react';
import { Plus, UserCog } from 'lucide-react';
import { api } from '../../lib/api.js';
import { ago, ROLE_LABEL } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Button, Modal, Field, Input, Select, Badge, Table, Spinner, Empty, useToast } from '../../components/ui.jsx';

const ROLE_HELP = { owner: 'Everything, including billing and staff', manager: 'Dashboard, menu, refunds', cashier: 'Register only', kitchen: 'Kitchen display only' };

export default function Staff() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const isOwner = user?.role === 'owner';
  const load = () => api('/admin/users').then(setRows);
  useEffect(() => { load(); }, []);
  async function save() {
    const body = { ...edit }; if (!body.password) delete body.password; if (!body.pin) delete body.pin;
    try {
      if (edit.id) await api(`/admin/users/${edit.id}`, { method: 'PATCH', body }); else await api('/admin/users', { method: 'POST', body });
      toast('Team member saved'); setEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }
  return (
    <div>
      <PageHeader title="Team" subtitle="Each person signs in with email, then switches at the till with a 4-digit PIN."
        actions={isOwner && <Button icon={Plus} onClick={() => setEdit({ name: '', email: '', password: '', pin: '', role: 'cashier' })}>Add team member</Button>} />
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={rows} onRow={isOwner ? (u) => setEdit({ ...u, password: '', pin: '' }) : undefined} empty={<Empty icon={UserCog} title="No team yet" />}
            columns={[
              { key: 'name', label: 'Name', render: (u) => <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-full bg-ink text-white grid place-items-center font-bold">{u.name[0]}</span><div><div className="font-bold text-steel-900">{u.name}</div><div className="text-xs text-steel-500">{u.email}</div></div></div> },
              { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'owner' ? 'dark' : u.role === 'manager' ? 'blue' : 'grey'}>{ROLE_LABEL[u.role]}</Badge> },
              { key: 'pin', label: 'Till PIN', render: (u) => u.has_pin ? 'Set' : <span className="text-steel-400">Not set</span> },
              { key: 'last', label: 'Last signed in', render: (u) => u.last_login ? ago(u.last_login) : <span className="text-steel-400">Never</span> },
              { key: 'active', label: 'Status', render: (u) => u.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge> },
            ]} />
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.name : 'New team member'}
        footer={<>{edit?.id && edit.id !== user.id && <Button variant="ghost" className="mr-auto" onClick={() => setEdit({ ...edit, active: !edit.active })}>{edit.active ? 'Disable access' : 'Restore access'}</Button>}<Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.name || !edit?.email || (!edit?.id && !edit?.password)}>Save</Button></>}>
        {edit && <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" className="sm:col-span-2"><Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Email" className="sm:col-span-2"><Input type="email" disabled={!!edit.id} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="Role" hint={ROLE_HELP[edit.role]} className="sm:col-span-2"><Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{['owner', 'manager', 'cashier', 'kitchen'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
          <Field label={edit.id ? 'New password' : 'Password'} hint={edit.id ? 'Leave blank to keep it' : undefined}><Input type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          <Field label="Till PIN" hint="4 digits"><Input inputMode="numeric" maxLength={4} value={edit.pin} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, '') })} /></Field>
          {edit.id && !edit.active && <p className="sm:col-span-2 text-sm text-amber-700">This person can’t sign in until you restore access and save.</p>}
        </div>}
      </Modal>
    </div>
  );
}
