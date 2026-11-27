import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../../lib/api.js';
import { dateTime } from '../../lib/format.js';
import { PageHeader, Table, Spinner, Empty, Badge } from '../../components/ui.jsx';

const LABEL = { 'tenant.create': 'Business created', 'tenant.update': 'Business changed', 'support.impersonate': 'Support sign-in', refund: 'Refund' };

export default function Audit() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/super/audit').then(setRows); }, []);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Sensitive actions across the platform, newest first." />
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={rows} empty={<Empty icon={ScrollText} title="Nothing logged yet">Plan changes, suspensions, support sign-ins and refunds show up here.</Empty>}
            columns={[
              { key: 'created_at', label: 'When', render: (r) => dateTime(r.created_at) },
              { key: 'action', label: 'Action', render: (r) => <Badge tone={r.action === 'support.impersonate' ? 'amber' : 'blue'}>{LABEL[r.action] || r.action}</Badge> },
              { key: 'user_name', label: 'By' },
              { key: 'tenant_name', label: 'Business', render: (r) => r.tenant_name || '–' },
              { key: 'detail', label: 'Details', render: (r) => <code className="text-xs text-steel-500">{JSON.stringify(r.detail)}</code> },
            ]} />
        )}
      </div>
    </div>
  );
}
