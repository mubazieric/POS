import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, PackagePlus, Pencil, Trash2, Tags, Package } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, num } from '../../lib/format.js';
import { PageHeader, Button, Modal, Field, Input, Select, Badge, Table, Segmented, Spinner, Empty, useToast, cx } from '../../components/ui.jsx';

const EMOJI = ['☕', '🍵', '🥛', '🧋', '🌯', '🍳', '🥞', '🥑', '🍲', '🍛', '🐟', '🍔', '🍕', '🍗', '🍝', '🥗', '🍟', '🌮', '🍜', '🍣', '🥩', '🍖', '🧃', '🥭', '🥤', '💧', '🍺', '🍷', '🍸', '🍰', '🍨', '🍉', '🍌', '🥐', '🥟', '🍩', '🍞', '🧁', '🍪', '🛍️', '🧴', '📦'];
const COLORS = ['#F26A1B', '#1F1D1B', '#0E9F8E', '#12A971', '#D97A1E', '#C2417A', '#6B4E3D', '#9A6B2F', '#75716C', '#7C3AED'];
const blank = { name: '', category_id: '', price: '', cost: '', emoji: '🍽️', sku: '', barcode: '', stock: 0, low_stock: 5, track_stock: true, to_kitchen: true, description: '' };

export default function Products() {
  const toast = useToast();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState(null);
  const [stock, setStock] = useState(null);
  const [catEdit, setCatEdit] = useState(null);

  const load = () => Promise.all([api('/admin/products'), api('/admin/categories')]).then(([p, c]) => { setProducts(p); setCats(c); });
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (products || []).filter((p) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.sku?.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'low') return p.active && p.track_stock && p.stock <= p.low_stock;
    if (filter === 'archived') return !p.active;
    if (filter !== 'all') return p.active && p.category_id === Number(filter);
    return p.active;
  }), [products, q, filter]);

  const stockValue = (products || []).filter((p) => p.active && p.track_stock).reduce((s, p) => s + Math.max(p.stock, 0) * p.cost, 0);
  const lowCount = (products || []).filter((p) => p.active && p.track_stock && p.stock <= p.low_stock).length;

  async function save(p) {
    const body = { ...p, price: Number(p.price) || 0, cost: Number(p.cost) || 0, stock: Number(p.stock) || 0, low_stock: Number(p.low_stock) || 0, category_id: p.category_id ? Number(p.category_id) : null };
    try {
      if (p.id) await api(`/admin/products/${p.id}`, { method: 'PATCH', body }); else await api('/admin/products', { method: 'POST', body });
      toast(p.id ? 'Product saved' : 'Product added'); setEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }
  async function archive(p) {
    if (!confirm(`Remove ${p.name} from the menu? Past sales keep their history.`)) return;
    await api(`/admin/products/${p.id}`, { method: 'DELETE' }); toast('Product removed from the menu'); setEdit(null); load();
  }
  async function saveCat(c) {
    try {
      if (c.id) await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: c }); else await api('/admin/categories', { method: 'POST', body: c });
      toast('Category saved'); setCatEdit(null); load();
    } catch (e) { toast(e.message, 'warn'); }
  }

  if (!products) return <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Menu & stock" subtitle={`${num(products.filter((p) => p.active).length)} products, stock on hand worth ${money(stockValue)} at cost.`}
        actions={tab === 'products'
          ? <Button icon={Plus} onClick={() => setEdit({ ...blank, category_id: cats[0]?.id || '' })}>Add product</Button>
          : <Button icon={Plus} onClick={() => setCatEdit({ name: '', color: COLORS[0], icon: '🍽️' })}>Add category</Button>} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'products', label: 'Products', icon: Package }, { value: 'categories', label: 'Categories', icon: Tags }]} />
        {tab === 'products' && (
          <>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-steel-400" />
              <Input className="pl-9" placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              <option value="low">Low stock ({lowCount})</option>
              <option value="archived">Removed from menu</option>
            </Select>
          </>
        )}
      </div>

      {tab === 'products' ? (
        <div className="card">
          <Table rows={rows} onRow={setEdit}
            empty={<Empty icon={Package} title="No products here">Add a product or change the filter.</Empty>}
            columns={[
              { key: 'name', label: 'Product', render: (p) => (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-lg grid place-items-center text-xl" style={{ background: (p.category_color || '#F26A1B') + '18' }}>{p.emoji}</span>
                  <div><div className="font-bold text-steel-900">{p.name}</div><div className="text-xs text-steel-500">{p.sku || 'No SKU'}</div></div>
                </div>) },
              { key: 'category', label: 'Category', render: (p) => p.category_name ? <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-steel-700"><span className="h-2 w-2 rounded-full" style={{ background: p.category_color }} />{p.category_name}</span> : <span className="text-steel-400">None</span> },
              { key: 'price', label: 'Price', align: 'right', render: (p) => <b>{money(p.price, { symbol: false })}</b> },
              { key: 'margin', label: 'Margin', align: 'right', render: (p) => p.price ? <span className={cx('font-semibold', (p.price - p.cost) / p.price < 0.3 ? 'text-amber-600' : 'text-emerald-600')}>{(((p.price - p.cost) / p.price) * 100).toFixed(0)}%</span> : '–' },
              { key: 'stock', label: 'In stock', align: 'right', render: (p) => !p.track_stock ? <span className="text-steel-400">Not tracked</span>
                : <Badge tone={p.stock <= 0 ? 'red' : p.stock <= p.low_stock ? 'amber' : 'grey'}>{num(p.stock)}</Badge> },
              { key: 'act', label: '', align: 'right', render: (p) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {p.track_stock && <Button size="sm" variant="soft" icon={PackagePlus} onClick={() => setStock(p)}>Stock</Button>}
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(p)} aria-label={`Edit ${p.name}`} />
                </div>) },
            ]} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCatEdit(c)} className="card p-5 text-left flex items-center gap-4 hover:shadow-lift transition">
              <span className="h-14 w-14 rounded-xl grid place-items-center text-3xl" style={{ background: c.color + '1f' }}>{c.icon}</span>
              <div className="flex-1"><div className="font-bold text-steel-900">{c.name}</div><div className="text-sm text-steel-500">{c.products} products</div></div>
              <span className="h-4 w-4 rounded-full" style={{ background: c.color }} />
            </button>
          ))}
        </div>
      )}

      <ProductModal value={edit} cats={cats} onClose={() => setEdit(null)} onSave={save} onArchive={archive} />
      <StockModal product={stock} onClose={() => setStock(null)} onDone={() => { setStock(null); load(); toast('Stock updated'); }} />
      <Modal open={!!catEdit} onClose={() => setCatEdit(null)} title={catEdit?.id ? 'Edit category' : 'New category'}
        footer={<>
          {catEdit?.id && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={async () => { if (confirm('Delete this category? Its products stay, without a category.')) { await api(`/admin/categories/${catEdit.id}`, { method: 'DELETE' }); setCatEdit(null); load(); } }}>Delete</Button>}
          <Button variant="ghost" onClick={() => setCatEdit(null)}>Cancel</Button><Button onClick={() => saveCat(catEdit)} disabled={!catEdit?.name}>Save category</Button></>}>
        {catEdit && (
          <div className="space-y-4">
            <Field label="Name"><Input autoFocus value={catEdit.name} onChange={(e) => setCatEdit({ ...catEdit, name: e.target.value })} /></Field>
            <Field label="Icon"><EmojiPick value={catEdit.icon} onChange={(icon) => setCatEdit({ ...catEdit, icon })} /></Field>
            <Field label="Colour">
              <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} onClick={() => setCatEdit({ ...catEdit, color: c })} className={cx('h-8 w-8 rounded-full ring-offset-2', catEdit.color === c && 'ring-2 ring-steel-800')} style={{ background: c }} aria-label={c} />)}</div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmojiPick({ value, onChange }) {
  return (
    <div className="grid grid-cols-10 gap-1 rounded-lg ring-1 ring-steel-200 p-2 max-h-36 overflow-y-auto scroll-thin">
      {EMOJI.map((e) => <button type="button" key={e} onClick={() => onChange(e)} className={cx('h-9 rounded-md text-xl hover:bg-steel-100', value === e && 'bg-brand-100 ring-2 ring-brand-400')}>{e}</button>)}
    </div>
  );
}

function ProductModal({ value, cats, onClose, onSave, onArchive }) {
  const [p, setP] = useState(value);
  useEffect(() => setP(value), [value]);
  const f = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const margin = p && Number(p.price) ? ((Number(p.price) - Number(p.cost || 0)) / Number(p.price)) * 100 : null;
  return (
    <Modal open={!!value} onClose={onClose} title={p?.id ? `Edit ${p?.name}` : 'New product'} width="max-w-2xl"
      footer={<>
        {p?.id && p.active && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2} onClick={() => onArchive(p)}>Remove from menu</Button>}
        {p?.id && !p.active && <Button variant="soft" className="mr-auto" onClick={() => onSave({ ...p, active: true })}>Put back on menu</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(p)} disabled={!p?.name}>Save product</Button></>}>
      {p && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" className="sm:col-span-2"><Input autoFocus value={p.name} onChange={f('name')} placeholder="e.g. Chicken Luwombo" /></Field>
          <Field label="Category"><Select value={p.category_id || ''} onChange={f('category_id')}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select></Field>
          <Field label="SKU"><Input value={p.sku || ''} onChange={f('sku')} /></Field>
          <Field label="Selling price"><Input type="number" min="0" value={p.price} onChange={f('price')} /></Field>
          <Field label="Cost" hint={margin !== null ? `Margin ${margin.toFixed(0)}%` : 'Used for profit reports'}><Input type="number" min="0" value={p.cost} onChange={f('cost')} /></Field>
          <Field label="Barcode" hint="Scan it straight into the field"><Input value={p.barcode || ''} onChange={f('barcode')} /></Field>
          <Field label="Warn when stock falls to"><Input type="number" min="0" value={p.low_stock} onChange={f('low_stock')} /></Field>
          {!p.id && <Field label="Opening stock"><Input type="number" value={p.stock} onChange={f('stock')} /></Field>}
          <div className="sm:col-span-2 flex flex-wrap gap-5 text-sm font-semibold text-steel-700">
            <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={!!p.track_stock} onChange={f('track_stock')} />Track stock</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-500" checked={!!p.to_kitchen} onChange={f('to_kitchen')} />Send to kitchen display</label>
          </div>
          <Field label="Picture" className="sm:col-span-2"><EmojiPick value={p.emoji} onChange={(emoji) => setP({ ...p, emoji })} /></Field>
        </div>
      )}
    </Modal>
  );
}

function StockModal({ product, onClose, onDone }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('restock');
  useEffect(() => { setQty(''); setReason('restock'); }, [product]);
  const delta = (reason === 'waste' ? -1 : 1) * Math.abs(Number(qty) || 0) * (reason === 'adjustment' && Number(qty) < 0 ? -1 : 1);
  async function save() { await api(`/admin/products/${product.id}/stock`, { method: 'POST', body: { qty: reason === 'adjustment' ? Number(qty) : delta, reason } }); onDone(); }
  return (
    <Modal open={!!product} onClose={onClose} title={`Stock: ${product?.name}`} width="max-w-sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!Number(qty)}>Update stock</Button></>}>
      {product && (
        <div className="space-y-4">
          <div className="rounded-lg bg-steel-50 px-4 py-3 flex justify-between"><span className="text-sm text-steel-500">Now in stock</span><b className="num">{num(product.stock)}</b></div>
          <Segmented value={reason} onChange={setReason} options={[{ value: 'restock', label: 'Received' }, { value: 'waste', label: 'Wasted' }, { value: 'adjustment', label: 'Correct count' }]} />
          <Field label={reason === 'adjustment' ? 'Change (use minus to reduce)' : 'Quantity'}><Input autoFocus type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  );
}
