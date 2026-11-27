import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import { num, dateTime } from '../../lib/format.js';
import { PageHeader, Select, Spinner, Table, Badge, Empty, cx } from '../../components/ui.jsx';
import { REASON } from './InventoryOverview.jsx';

export default function StockMoves() {
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { api('/admin/products').then((p) => setProducts(p.filter((x) => x.track_stock))); }, []);
  useEffect(() => { setRows(null); api(`/ops/inventory/moves?limit=300${product ? `&product_id=${product}` : ''}${reason ? `&reason=${reason}` : ''}`).then(setRows); }, [product, reason]);
  return (
    <div>
      <PageHeader title="Stock movements" subtitle="Every unit that came in or went out, newest first." />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select className="w-auto" value={product} onChange={(e) => setProduct(e.target.value)}><option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}</Select>
        <Select className="w-auto" value={reason} onChange={(e) => setReason(e.target.value)}><option value="">All movement types</option>{Object.entries(REASON).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select>
      </div>
      <div className="card">
        {!rows ? <div className="py-20 grid place-items-center"><Spinner /></div> : (
          <Table rows={rows} empty={<Empty icon={ArrowLeftRight} title="No movements match" />} columns={[
            { key: 'created_at', label: 'When', render: (m) => <span className="text-steel-600">{dateTime(m.created_at)}</span> },
            { key: 'name', label: 'Product', render: (m) => <span className="font-semibold text-steel-900">{m.emoji} {m.name}</span> },
            { key: 'reason', label: 'Type', render: (m) => { const [l, t] = REASON[m.reason] || [m.reason, 'grey']; return <Badge tone={t}>{l}</Badge>; } },
            { key: 'ref', label: 'Reference', render: (m) => <span className="text-steel-500">{m.ref || '–'}</span> },
            { key: 'qty', label: 'Quantity', align: 'right', render: (m) => <b className={cx(m.qty > 0 ? 'text-emerald-600' : '')}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</b> },
          ]} />
        )}
      </div>
    </div>
  );
}
