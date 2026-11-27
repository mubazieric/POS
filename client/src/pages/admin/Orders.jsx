import { useEffect, useState } from 'react';
import { Search, Receipt as ReceiptIcon, Printer, RotateCcw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, dateTime, METHOD_LABEL, TYPE_LABEL } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Button, Modal, Input, Badge, Table, Segmented, Spinner, Empty, useToast } from '../../components/ui.jsx';
import Receipt from '../pos/Receipt.jsx';

export default function Orders() {
  const { tenant } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);

  const load = () => api(`/admin/orders?page=${page}&search=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`).then(setData);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [page, status, q]);

  async function refund(o) {
    if (!confirm(`Refund order #${o.number} for ${money(o.total)}? Stock goes back on the shelf.`)) return;
    try { await api(`/pos/orders/${o.id}/refund`, { method: 'POST' }); toast(`Order #${o.number} refunded`); setSel(null); load(); } catch (e) { toast(e.message, 'warn'); }
  }

  function exportCsv() {
    const rows = [['Order', 'Date', 'Type', 'Table', 'Customer', 'Cashier', 'Status', 'Subtotal', 'Discount', 'VAT', 'Total', 'Payment']];
    data.rows.forEach((o) => rows.push([o.number, new Date(o.created_at).toISOString(), TYPE_LABEL[o.order_type], o.table_name || '', o.customer_name || '', o.cashier || '', o.status, o.subtotal, o.discount, o.tax, o.total, (o.payments || []).map((p) => METHOD_LABEL[p.method]).join('+')]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `iwat-orders-page${page}.csv`; a.click();
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle={data ? `${data.total.toLocaleString()} orders on record` : ' '} actions={<Button variant="outline" icon={Download} onClick={exportCsv} disabled={!data?.rows.length}>Export CSV</Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'refunded', label: 'Refunded' }]} />
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400" />
          <Input className="pl-9" placeholder="Order number, customer or cashier" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      <div className="card">
        {!data ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <>
            <Table rows={data.rows} onRow={setSel} empty={<Empty icon={ReceiptIcon} title="No orders match">Try another search.</Empty>}
              columns={[
                { key: 'number', label: 'Order', render: (o) => <span className="font-extrabold text-ink num">#{o.number}</span> },
                { key: 'created_at', label: 'Date', render: (o) => <span className="text-steel-600">{dateTime(o.created_at)}</span> },
                { key: 'type', label: 'Type', render: (o) => <span>{TYPE_LABEL[o.order_type]}{o.table_name ? `, ${o.table_name}` : ''}</span> },
                { key: 'customer', label: 'Customer', render: (o) => o.customer_name || <span className="text-steel-400">Walk-in</span> },
                { key: 'cashier', label: 'Cashier', render: (o) => o.cashier || '–' },
                { key: 'pay', label: 'Payment', render: (o) => (o.payments || []).map((p) => METHOD_LABEL[p.method]).join(' + ') },
                { key: 'status', label: 'Status', render: (o) => <span className="inline-flex gap-1">{o.status === 'refunded' ? <Badge tone="red">Refunded</Badge> : <Badge tone="green">Paid</Badge>}{o.created_offline && <Badge tone="amber">Offline</Badge>}</span> },
                { key: 'total', label: 'Total', align: 'right', render: (o) => <b>{money(o.total, { symbol: false })}</b> },
              ]} />
            <div className="flex items-center justify-between px-4 py-3 border-t border-steel-100 text-sm text-steel-500">
              <span>Page {data.page} of {Math.max(data.pages, 1)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={`Order #${sel?.number}`} width="max-w-md"
        footer={<>{sel?.status === 'paid' && <Button variant="danger" className="mr-auto" icon={RotateCcw} onClick={() => refund(sel)}>Refund</Button>}<Button variant="outline" icon={Printer} onClick={() => window.print()}>Print receipt</Button></>}>
        <div className="flex justify-center bg-steel-100 -m-5 p-6"><div className="shadow-ticket"><Receipt order={sel} tenant={tenant} id="print-receipt" /></div></div>
      </Modal>
    </div>
  );
}
