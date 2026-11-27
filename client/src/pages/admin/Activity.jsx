import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { api } from '../../lib/api.js';
import { dateTime, money } from '../../lib/format.js';
import { PageHeader, Spinner, Empty, Badge } from '../../components/ui.jsx';

const LABEL = {
  refund: ['Refund', 'red'], 'purchase.create': ['Purchase order created', 'blue'], 'purchase.ordered': ['Purchase order sent', 'blue'], 'purchase.cancelled': ['Purchase order cancelled', 'grey'],
  'purchase.receive': ['Goods received', 'green'], 'purchase.pay': ['Supplier paid', 'green'], 'expense.create': ['Expense recorded', 'amber'], 'expense.delete': ['Expense deleted', 'red'],
  'inventory.count': ['Stock count', 'blue'], 'support.impersonate': ['IWAT support signed in', 'amber'],
};
const describe = (a) => {
  const d = a.detail || {};
  if (d.order) return `Order #${d.order}${d.total ? `, ${money(d.total)}` : ''}`;
  if (d.po) return `${d.po}${d.amount ? `, ${money(d.amount)}` : d.total ? `, ${money(d.total)}` : ''}`;
  if (d.category) return `${d.category}, ${money(d.amount)}`;
  if (d.changed !== undefined) return `${d.changed} of ${d.products} products adjusted`;
  if (d.as) return `As ${d.as}`;
  return '';
};

export default function Activity() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/ops/activity').then(setRows); }, []);
  return (
    <div>
      <PageHeader title="Activity log" subtitle="Who did what with money and stock. Entries can’t be edited or deleted." />
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : !rows.length ? <Empty icon={History} title="Nothing logged yet">Refunds, deliveries, supplier payments, expenses and stock counts appear here.</Empty> : (
          <ol className="relative px-5 py-4">
            <span className="absolute left-[27px] top-6 bottom-6 w-px bg-steel-200" />
            {rows.map((a) => {
              const [label, tone] = LABEL[a.action] || [a.action, 'grey'];
              return (
                <li key={a.id} className="relative flex gap-4 py-2.5">
                  <span className="relative z-10 mt-1.5 h-3 w-3 rounded-full bg-white ring-[3px] ring-brand-400" />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={tone}>{label}</Badge>
                    <span className="text-sm text-steel-800">{describe(a)}</span>
                    <span className="text-xs text-steel-500 ml-auto">{a.user_name || 'System'}, {dateTime(a.created_at)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
