import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Minus, Plus, Trash2, UserRound, Percent, StickyNote, LayoutGrid, Armchair, LayoutDashboard, ChefHat,
  LogOut, History, Lock, ChevronUp, X, ScanBarcode, Printer, RotateCcw, CloudOff, UserPlus,
} from 'lucide-react';
import { LogoMark } from '../../components/Logo.jsx';
import ConnectionPill from '../../components/ConnectionPill.jsx';
import { Button, Modal, Segmented, Spinner, Empty, Input, useToast, cx, Badge } from '../../components/ui.jsx';
import { useAuth } from '../../lib/auth.jsx';
import { api } from '../../lib/api.js';
import { useCatalog, enqueueSale, nextOrderNumber, deviceName, useSyncState, queue } from '../../lib/offline.js';
import { money, uuid, TYPE_LABEL, METHOD_LABEL, time, ROLE_LABEL } from '../../lib/format.js';
import { totals } from './totals.js';
import Floor from './Floor.jsx';
import Payment from './Payment.jsx';
import Receipt from './Receipt.jsx';

const TICKETS_KEY = 'iwat.tickets';
const newTicket = (patch = {}) => ({ id: uuid(), order_type: 'takeaway', table_id: null, table_name: null, customer: null, lines: [], discount_pct: 0, note: '', ...patch });

function useTickets() {
  const [state, setState] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(TICKETS_KEY)); if (s?.active && s.tickets?.[s.active]) return s; } catch {}
    const t = newTicket();
    return { active: t.id, tickets: { [t.id]: t } };
  });
  useEffect(() => { localStorage.setItem(TICKETS_KEY, JSON.stringify(state)); }, [state]);
  const ticket = state.tickets[state.active];
  const update = (fn) => setState((s) => ({ ...s, tickets: { ...s.tickets, [s.active]: fn(s.tickets[s.active]) } }));
  const open = (t) => setState((s) => ({ active: t.id, tickets: { ...s.tickets, [t.id]: t } }));
  const close = (id) => setState((s) => {
    const rest = { ...s.tickets }; delete rest[id];
    const leftover = Object.values(rest).find((t) => t.lines.length);
    if (leftover) return { active: leftover.id, tickets: rest };
    const t = newTicket(); return { active: t.id, tickets: { ...rest, [t.id]: t } };
  });
  return { tickets: state.tickets, ticket, update, open, close, setActive: (id) => setState((s) => ({ ...s, active: id })) };
}

export default function POS() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { online } = useSyncState();
  const { catalog, setCatalog, source } = useCatalog();
  const { tickets, ticket, update, open, close, setActive } = useTickets();

  const [view, setView] = useState(() => (localStorage.getItem('iwat.posView') || 'register'));
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [modal, setModal] = useState(null); // customer | discount | note | pin | history
  const [bump, setBump] = useState(null);
  const searchRef = useRef();

  useEffect(() => localStorage.setItem('iwat.posView', view), [view]);
  const shopTenant = catalog?.tenant || tenant;
  const t = totals(ticket, shopTenant);
  const hasTables = (catalog?.tables?.length || 0) > 0;

  const products = useMemo(() => {
    if (!catalog) return [];
    const term = q.trim().toLowerCase();
    return catalog.products.filter((p) => (cat === 'all' || p.category_id === cat) &&
      (!term || p.name.toLowerCase().includes(term) || p.sku?.toLowerCase() === term || p.barcode === term));
  }, [catalog, cat, q]);

  const catColor = useMemo(() => Object.fromEntries((catalog?.categories || []).map((c) => [c.id, c.color])), [catalog]);

  function add(p) {
    update((tk) => {
      const existing = tk.lines.find((l) => l.product_id === p.id && !l.note);
      const lines = existing
        ? tk.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
        : [...tk.lines, { key: uuid(), product_id: p.id, name: p.name, emoji: p.emoji, unit_price: Number(p.price), qty: 1, note: '', to_kitchen: p.to_kitchen }];
      return { ...tk, lines };
    });
    setBump(p.id); setTimeout(() => setBump(null), 350);
  }
  const setQty = (key, qty) => update((tk) => ({ ...tk, lines: qty <= 0 ? tk.lines.filter((l) => l.key !== key) : tk.lines.map((l) => (l.key === key ? { ...l, qty } : l)) }));

  // Barcode scanners type fast and press Enter: match on SKU/barcode first.
  function onSearchKey(e) {
    if (e.key !== 'Enter') return;
    const term = q.trim().toLowerCase();
    const hit = catalog?.products.find((p) => p.barcode === term || p.sku?.toLowerCase() === term) || (products.length === 1 && products[0]);
    if (hit) { add(hit); setQ(''); }
  }

  useEffect(() => {
    const k = (e) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  async function completeSale(payments) {
    const order = {
      client_ref: uuid(), number: nextOrderNumber(), order_type: ticket.order_type, table_id: ticket.table_id,
      customer_id: ticket.customer?.id || null, discount: t.discount, note: ticket.note, device: deviceName(),
      created_offline: !online, created_at: new Date().toISOString(),
      items: ticket.lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty, unit_price: l.unit_price, note: l.note, to_kitchen: l.to_kitchen })),
      payments,
    };
    await enqueueSale(order);
    // Reflect stock on this device right away, even before the upload lands.
    setCatalog({ ...catalog, products: catalog.products.map((p) => { const l = ticket.lines.find((x) => x.product_id === p.id); return l && p.track_stock ? { ...p, stock: p.stock - l.qty } : p; }) });
    const receipt = { ...order, ...t, items: order.items, table_name: ticket.table_name, customer_name: ticket.customer?.name, cashier: user.name, queued: !online };
    close(ticket.id);
    return receipt;
  }

  function openTable(table) {
    const existing = Object.values(tickets).find((x) => x.table_id === table.id);
    if (existing) setActive(existing.id); else open(newTicket({ order_type: 'dine_in', table_id: table.id, table_name: table.name }));
    setView('register');
  }
  function quick(type) {
    const empty = Object.values(tickets).find((x) => !x.lines.length && !x.table_id);
    if (empty) { setActive(empty.id); update((tk) => ({ ...tk, order_type: type })); } else open(newTicket({ order_type: type }));
    setView('register');
  }

  const openTickets = Object.values(tickets).filter((x) => x.lines.length || x.id === ticket.id);

  if (!catalog) {
    return (
      <div className="h-full grid place-items-center bg-steel-100">
        {source === 'empty'
          ? <Empty icon={CloudOff} title="This till hasn’t been set up yet">Connect to the internet once so the menu can download. After that, the register works offline.</Empty>
          : <Spinner className="h-8 w-8" />}
      </div>
    );
  }

  const ticketPanel = (
    <TicketPanel ticket={ticket} totals={t} tenant={shopTenant} hasTables={hasTables} bumpKey={bump}
      onType={(type) => update((tk) => ({ ...tk, order_type: type, ...(type !== 'dine_in' ? { table_id: null, table_name: null } : {}) }))}
      onQty={setQty} onClear={() => update((tk) => ({ ...tk, lines: [], discount_pct: 0, note: '' }))}
      onCustomer={() => setModal('customer')} onDiscount={() => setModal('discount')} onNote={() => setModal('note')}
      onPay={() => { setSheet(false); setPayOpen(true); }} onPickTable={() => setView('floor')} />
  );

  return (
    <div className="h-full flex flex-col bg-steel-100">
      {/* Top bar */}
      <header className="h-14 shrink-0 bg-ink flex items-center gap-2 sm:gap-3 px-3 sm:px-4">
        <LogoMark className="h-8 w-8 shrink-0" />
        <div className="hidden md:block min-w-0 mr-2">
          <div className="text-[13px] font-bold text-white truncate max-w-[180px]">{shopTenant?.name}</div>
          <div className="text-[11px] text-steel-400">{deviceName()}</div>
        </div>
        {hasTables && (
          <div className="flex rounded-lg bg-white/5 p-1">
            {[['floor', Armchair, 'Floor'], ['register', LayoutGrid, 'Register']].map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} className={cx('relative h-8 px-3 rounded-md text-[13px] font-bold inline-flex items-center gap-1.5', view === v ? 'text-white' : 'text-steel-400 hover:text-white')}>
                {view === v && <motion.span layoutId="pos-view" className="absolute inset-0 rounded-md bg-brand-500" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <Icon className="relative h-4 w-4" /><span className="relative hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}
        {/* Open tickets, Odoo-style */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto scroll-thin max-w-[40vw]">
          {openTickets.map((x) => (
            <button key={x.id} onClick={() => { setActive(x.id); setView('register'); }}
              className={cx('h-8 px-3 rounded-md text-xs font-bold whitespace-nowrap transition-colors', x.id === ticket.id ? 'bg-white text-ink' : 'bg-white/10 text-steel-200 hover:bg-white/15')}>
              {x.table_name ? `Table ${x.table_name}` : TYPE_LABEL[x.order_type]}{x.lines.length ? ` · ${totals(x, shopTenant).items}` : ''}
            </button>
          ))}
          <button onClick={() => quick('takeaway')} className="h-8 w-8 rounded-md bg-white/10 text-steel-200 hover:bg-white/15 grid place-items-center" title="New order" aria-label="New order"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ConnectionPill dark />
          <IconBtn icon={History} label="Recent orders" onClick={() => setModal('history')} />
          <button onClick={() => setModal('pin')} className="hidden sm:flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-white/10 hover:bg-white/15" title="Switch staff">
            <span className="h-7 w-7 rounded-full bg-brand-500 grid place-items-center text-white text-xs font-bold">{user?.name?.[0]}</span>
            <span className="text-[13px] font-semibold text-white">{user?.name?.split(' ')[0]}</span>
          </button>
          {['owner', 'manager'].includes(user?.role) && <IconBtn icon={LayoutDashboard} label="Dashboard" onClick={() => navigate('/admin')} />}
          <IconBtn icon={ChefHat} label="Kitchen display" onClick={() => navigate('/kitchen')} />
          <IconBtn icon={LogOut} label="Sign out" onClick={() => { logout(); navigate('/login'); }} />
        </div>
      </header>

      {source === 'cache' && (
        <div className="bg-amber-50 text-amber-900 text-[13px] font-semibold px-4 py-1.5 border-b border-amber-200 flex items-center gap-2">
          <CloudOff className="h-4 w-4" />Working offline with the menu saved on this device. Sales upload when the connection returns.
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {view === 'floor' && hasTables ? (
          <div className="flex-1 min-w-0"><Floor tables={catalog.tables} tickets={tickets} tenant={shopTenant} onOpenTable={openTable} onQuick={quick} /></div>
        ) : (
          <>
            <section className="flex-1 min-w-0 flex flex-col">
              <div className="px-3 sm:px-5 pt-4 pb-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-steel-400" />
                  <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey}
                    placeholder="Search products or scan a barcode" className="w-full h-12 rounded-xl bg-white pl-11 pr-11 text-[15px] shadow-card outline-none focus:ring-4 focus:ring-brand-100" />
                  <ScanBarcode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-steel-300" />
                </div>
                <div className="flex gap-2 overflow-x-auto scroll-thin pb-1 -mx-1 px-1">
                  <CatChip active={cat === 'all'} onClick={() => setCat('all')} color="#1F1D1B" icon="✦" label="All" count={catalog.products.length} />
                  {catalog.categories.map((c) => (
                    <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} color={c.color} icon={c.icon} label={c.name}
                      count={catalog.products.filter((p) => p.category_id === c.id).length} />
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scroll-thin px-3 sm:px-5 pb-28 lg:pb-6">
                {products.length ? (
                  <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {products.map((p) => <ProductCard key={p.id} p={p} color={catColor[p.category_id] || '#F26A1B'} onAdd={() => add(p)}
                      inCart={ticket.lines.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.qty, 0)} />)}
                  </motion.div>
                ) : (
                  <Empty icon={Search} title="No products match">Try a different name, or clear the search to see everything.</Empty>
                )}
              </div>
            </section>
            <aside className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 p-4 pl-0">{ticketPanel}</aside>
          </>
        )}
      </div>

      {/* Mobile ticket bar + sheet */}
      {view === 'register' && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 p-3 z-30" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button onClick={() => setSheet(true)} className="w-full h-14 rounded-2xl bg-ink text-white flex items-center px-5 shadow-lift">
            <span className="h-7 min-w-7 px-2 rounded-full bg-brand-500 text-xs font-bold grid place-items-center num">{t.items}</span>
            <span className="ml-3 font-bold">View order</span>
            <span className="ml-auto font-extrabold num">{money(t.total)}</span>
            <ChevronUp className="h-5 w-5 ml-2" />
          </button>
        </div>
      )}
      <AnimatePresence>
        {sheet && (
          <motion.div className="lg:hidden fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-900/50" onClick={() => setSheet(false)} />
            <motion.div className="absolute inset-x-0 bottom-0 top-12 flex p-2" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
              {ticketPanel}
              <button onClick={() => setSheet(false)} className="absolute -top-10 right-4 h-9 w-9 rounded-full bg-white grid place-items-center" aria-label="Close order"><X className="h-5 w-5" /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Payment open={payOpen} total={t.total} tenant={shopTenant} online={online} onClose={() => setPayOpen(false)} onComplete={completeSale} />

      <CustomerModal open={modal === 'customer'} onClose={() => setModal(null)} catalog={catalog} setCatalog={setCatalog} online={online}
        selected={ticket.customer} onPick={(c) => { update((tk) => ({ ...tk, customer: c })); setModal(null); }} />
      <DiscountModal open={modal === 'discount'} onClose={() => setModal(null)} value={ticket.discount_pct}
        onSave={(v) => { update((tk) => ({ ...tk, discount_pct: v })); setModal(null); }} />
      <NoteModal open={modal === 'note'} onClose={() => setModal(null)} value={ticket.note}
        onSave={(v) => { update((tk) => ({ ...tk, note: v })); setModal(null); }} />
      <PinModal open={modal === 'pin'} onClose={() => setModal(null)} staff={catalog.staff} />
      <HistoryModal open={modal === 'history'} onClose={() => setModal(null)} tenant={shopTenant} canRefund={['owner', 'manager'].includes(user?.role)} toast={toast} />
    </div>
  );
}

const IconBtn = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} title={label} aria-label={label} className="h-9 w-9 rounded-lg grid place-items-center text-steel-300 hover:text-white hover:bg-white/10"><Icon className="h-[18px] w-[18px]" /></button>
);

function CatChip({ active, onClick, color, icon, label, count }) {
  return (
    <button onClick={onClick} className={cx('shrink-0 h-11 pl-2 pr-4 rounded-xl inline-flex items-center gap-2.5 text-[14px] font-bold transition-all',
      active ? 'text-white shadow-lift' : 'bg-white text-steel-700 shadow-card hover:text-steel-900')} style={active ? { background: color } : undefined}>
      <span className={cx('h-7 w-7 rounded-lg grid place-items-center text-base', active ? 'bg-white/20' : '')} style={!active ? { background: color + '14' } : undefined}>{icon}</span>
      {label}
      <span className={cx('text-xs font-semibold', active ? 'text-white/70' : 'text-steel-400')}>{count}</span>
    </button>
  );
}

function ProductCard({ p, color, onAdd, inCart }) {
  const out = p.track_stock && p.stock <= 0;
  const low = p.track_stock && !out && p.stock <= p.low_stock;
  return (
    <motion.button layout onClick={onAdd} whileTap={{ scale: 0.96 }}
      className={cx('group relative text-left rounded-2xl bg-white shadow-card overflow-hidden transition-shadow hover:shadow-lift focus-visible:ring-4 focus-visible:ring-brand-200', out && 'opacity-60')}>
      <div className="relative h-[104px] grid place-items-center overflow-hidden" style={{ background: `linear-gradient(140deg, ${color}1f, ${color}0a 60%, #fff)` }}>
        <span className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full" style={{ background: color + '14' }} />
        <span className="text-[52px] drop-shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">{p.emoji}</span>
        <AnimatePresence>
          {inCart > 0 && (
            <motion.span key={inCart} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
              className="absolute top-2.5 right-2.5 h-7 min-w-7 px-2 rounded-full bg-brand-500 text-white text-xs font-extrabold grid place-items-center shadow-md num">{inCart}</motion.span>
          )}
        </AnimatePresence>
        {(out || low) && <span className={cx('absolute top-2.5 left-2.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold', out ? 'bg-bad text-white' : 'bg-amber-100 text-amber-800')}>{out ? 'Sold out' : `${p.stock} left`}</span>}
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[14px] font-bold text-steel-900 leading-snug line-clamp-1">{p.name}</div>
        <div className="mt-0.5 text-[14px] font-extrabold num" style={{ color }}>{money(p.price)}</div>
      </div>
    </motion.button>
  );
}

function TicketPanel({ ticket, totals: t, tenant, hasTables, bumpKey, onType, onQty, onClear, onCustomer, onDiscount, onNote, onPay, onPickTable }) {
  const listRef = useRef();
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [ticket.lines.length]);
  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-white shadow-ticket overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-dashed border-steel-300">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[18px] font-extrabold text-ink tracking-[-0.01em]">{ticket.table_name ? `Table ${ticket.table_name}` : 'Current order'}</div>
            <div className="text-xs text-steel-500">{t.items} item{t.items === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onCustomer} className={cx('inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-bold', ticket.customer ? 'bg-brand-50 text-brand-700' : 'bg-steel-100 text-steel-700 hover:bg-steel-200')}>
            <UserRound className="h-4 w-4" />{ticket.customer ? ticket.customer.name.split(' ')[0] : 'Customer'}
          </button>
        </div>
        <Segmented size="sm" value={ticket.order_type} onChange={(v) => (v === 'dine_in' && !ticket.table_id && hasTables ? onPickTable() : onType(v))}
          options={[{ value: 'dine_in', label: 'Dine-in' }, { value: 'takeaway', label: 'Takeaway' }, { value: 'delivery', label: 'Delivery' }]} />
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto scroll-thin px-2 py-2">
        {ticket.lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 py-10">
            <div className="text-5xl mb-3 opacity-80">🧾</div>
            <div className="font-bold text-steel-800">Tap a product to start the order</div>
            <div className="text-sm text-steel-500 mt-1">Press / to search or scan a barcode.</div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {ticket.lines.map((l) => (
              <motion.div key={l.key} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, backgroundColor: bumpKey === l.product_id ? '#FFF5ED' : '#ffffff' }} exit={{ opacity: 0, x: -24, height: 0 }}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                <span className="h-10 w-10 shrink-0 rounded-lg bg-steel-100 grid place-items-center text-xl">{l.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-steel-900 truncate">{l.name}</div>
                  <div className="text-xs text-steel-500 num">{money(l.unit_price, { symbol: false })} each</div>
                </div>
                <div className="flex items-center rounded-lg ring-1 ring-steel-200">
                  <button onClick={() => onQty(l.key, l.qty - 1)} className="h-8 w-8 grid place-items-center text-steel-600 hover:text-bad" aria-label={`One less ${l.name}`}>{l.qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button>
                  <span className="w-7 text-center text-[14px] font-extrabold num">{l.qty}</span>
                  <button onClick={() => onQty(l.key, l.qty + 1)} className="h-8 w-8 grid place-items-center text-steel-600 hover:text-brand-600" aria-label={`One more ${l.name}`}><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <div className="w-[76px] text-right text-[14px] font-extrabold text-steel-900 num">{money(l.unit_price * l.qty, { symbol: false })}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="border-t border-dashed border-steel-300 px-4 pt-3 pb-4 bg-steel-50/60">
        {ticket.note && <div className="text-xs text-steel-600 bg-amber-50 ring-1 ring-amber-200 rounded-md px-2.5 py-1.5 mb-2.5"><b>Note:</b> {ticket.note}</div>}
        <div className="space-y-1 text-[13px]">
          <Row label="Subtotal" value={money(t.subtotal)} />
          {t.discount > 0 && <Row label={`Discount ${ticket.discount_pct}%`} value={`−${money(t.discount)}`} accent />}
          <Row label={`VAT ${tenant?.tax_rate}%${tenant?.tax_inclusive !== false ? ' included' : ''}`} value={money(t.tax)} muted />
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <span className="text-[15px] font-bold text-steel-700">Total</span>
          <motion.span key={t.total} initial={{ y: -4, opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} className="text-[28px] leading-none font-extrabold tracking-[-0.02em] text-ink num">{money(t.total)}</motion.span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          <SmallAction icon={Percent} label="Discount" onClick={onDiscount} disabled={!ticket.lines.length} />
          <SmallAction icon={StickyNote} label="Note" onClick={onNote} />
          <SmallAction icon={RotateCcw} label="Clear" onClick={onClear} disabled={!ticket.lines.length} />
        </div>
        <Button size="xl" className="w-full mt-2.5 text-[17px]" disabled={!ticket.lines.length} onClick={onPay}>
          Charge {money(t.total)}
        </Button>
      </div>
    </div>
  );
}
const Row = ({ label, value, muted, accent }) => (
  <div className={cx('flex justify-between', muted ? 'text-steel-500' : 'text-steel-700', accent && 'text-emerald-700 font-semibold')}><span>{label}</span><span className="num">{value}</span></div>
);
const SmallAction = ({ icon: Icon, label, ...p }) => (
  <button {...p} className="h-10 rounded-lg bg-white ring-1 ring-steel-200 text-[13px] font-bold text-steel-700 hover:bg-steel-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-40"><Icon className="h-4 w-4" />{label}</button>
);

/* ---------- modals ---------- */
function CustomerModal({ open, onClose, catalog, setCatalog, selected, onPick, online }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [err, setErr] = useState('');
  const list = (catalog.customers || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone?.replace(/\s/g, '').includes(q.replace(/\s/g, '')));
  async function save() {
    try {
      const c = await api('/pos/customers', { method: 'POST', body: form });
      setCatalog({ ...catalog, customers: [...catalog.customers, c] });
      onPick(c); setAdding(false); setForm({ name: '', phone: '' });
    } catch (e) { setErr(e.message); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Customer">
      {!adding ? (
        <>
          <div className="flex gap-2">
            <Input autoFocus placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="soft" icon={UserPlus} onClick={() => setAdding(true)} disabled={!online} title={online ? '' : 'Adding customers needs a connection'}>New</Button>
          </div>
          <div className="mt-3 max-h-[50vh] overflow-y-auto scroll-thin -mx-2">
            {selected && <button onClick={() => onPick(null)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-bad hover:bg-red-50">Remove {selected.name} from this order</button>}
            {list.map((c) => (
              <button key={c.id} onClick={() => onPick(c)} className={cx('w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-steel-50', selected?.id === c.id && 'bg-brand-50')}>
                <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-bold">{c.name[0]}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-steel-900">{c.name}</span><span className="block text-xs text-steel-500">{c.phone}</span></span>
                <Badge tone="blue">{c.points} pts</Badge>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <label className="block"><span className="label">Name</span><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block"><span className="label">Phone</span><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256 7xx xxx xxx" /></label>
          {err && <p className="text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={save} disabled={!form.name}>Add customer</Button></div>
        </div>
      )}
    </Modal>
  );
}

function DiscountModal({ open, onClose, value, onSave }) {
  const [v, setV] = useState(value || 0);
  useEffect(() => setV(value || 0), [value, open]);
  return (
    <Modal open={open} onClose={onClose} title="Discount" width="max-w-sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(Math.min(Math.max(Number(v) || 0, 0), 100))}>Apply discount</Button></>}>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[0, 5, 10, 15, 20, 25, 50, 100].map((p) => (
          <button key={p} onClick={() => setV(p)} className={cx('h-11 rounded-lg text-sm font-bold', Number(v) === p ? 'bg-brand-500 text-white' : 'bg-steel-100 text-steel-700 hover:bg-steel-200')}>{p === 0 ? 'None' : `${p}%`}</button>
        ))}
      </div>
      <label className="block"><span className="label">Custom percentage</span><Input type="number" min="0" max="100" value={v} onChange={(e) => setV(e.target.value)} /></label>
    </Modal>
  );
}

function NoteModal({ open, onClose, value, onSave }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value, open]);
  return (
    <Modal open={open} onClose={onClose} title="Order note" width="max-w-md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(v.trim())}>Save note</Button></>}>
      <textarea autoFocus rows={4} value={v} onChange={(e) => setV(e.target.value)} className="input h-auto py-2.5" placeholder="Shown on the kitchen display and the receipt, e.g. no onions, extra spicy" />
      <div className="flex flex-wrap gap-2 mt-3">
        {['No onions', 'Extra spicy', 'Allergy: nuts', 'Serve together', 'Pack to go'].map((s) => (
          <button key={s} onClick={() => setV((x) => (x ? `${x}, ${s.toLowerCase()}` : s))} className="h-8 px-3 rounded-full bg-steel-100 text-xs font-semibold text-steel-700 hover:bg-steel-200">{s}</button>
        ))}
      </div>
    </Modal>
  );
}

function PinModal({ open, onClose, staff }) {
  const { pin } = useAuth();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setV(''); setErr(''); } }, [open]);
  async function press(k) {
    const next = k === 'del' ? v.slice(0, -1) : (v + k).slice(0, 4);
    setV(next); setErr('');
    if (next.length === 4) {
      setBusy(true);
      try { await pin(next); onClose(); } catch (e) { setErr(e.status === 0 ? 'Switching staff needs a connection.' : e.message); setV(''); } finally { setBusy(false); }
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Switch staff" width="max-w-sm">
      <div className="flex justify-center gap-3 mb-2">
        {[0, 1, 2, 3].map((i) => <motion.span key={i} animate={err ? { x: [0, -6, 6, -4, 4, 0] } : {}} className={cx('h-4 w-4 rounded-full', i < v.length ? 'bg-brand-500' : 'bg-steel-200')} />)}
      </div>
      <p className={cx('text-center text-sm h-5 mb-3', err ? 'text-bad' : 'text-steel-500')}>{busy ? 'Checking…' : err || 'Enter your 4-digit PIN'}</p>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => k === '' ? <span key={i} /> : (
          <button key={k} onClick={() => press(k)} className="h-14 rounded-xl bg-steel-100 text-xl font-bold hover:bg-steel-200 active:scale-95 transition">{k === 'del' ? '⌫' : k}</button>
        ))}
      </div>
      <div className="mt-4 text-xs text-steel-500 text-center">Demo PINs: owner 1111, manager 2222, cashier 1234, kitchen 5555</div>
      {staff?.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-1.5">{staff.map((s) => <Badge key={s.id}>{s.name.split(' ')[0]}, {ROLE_LABEL[s.role]}</Badge>)}</div>}
    </Modal>
  );
}

function HistoryModal({ open, onClose, tenant, canRefund, toast }) {
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState([]);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState('');
  const load = () => {
    setError('');
    queue.all().then(setPending);
    api('/pos/orders?limit=40').then(setRows).catch((e) => { setRows([]); setError(e.status === 0 ? 'Offline: showing sales saved on this device only.' : e.message); });
  };
  useEffect(() => { if (open) { setSel(null); load(); } }, [open]);
  async function refund(o) {
    try { await api(`/pos/orders/${o.id}/refund`, { method: 'POST' }); toast(`Order #${o.number} refunded`); load(); setSel(null); }
    catch (e) { toast(e.message, 'warn'); }
  }
  const all = [...pending.map((p) => ({ ...p, total: p.payments.reduce((s, x) => s + x.amount, 0), _pending: true, id: p.client_ref })), ...(rows || [])];
  return (
    <Modal open={open} onClose={onClose} title="Recent orders" width="max-w-3xl">
      {error && <div className="mb-3 text-sm rounded-lg bg-amber-50 text-amber-900 ring-1 ring-amber-200 px-3 py-2">{error}</div>}
      {!rows ? <div className="py-10 grid place-items-center"><Spinner /></div> : (
        <div className="grid md:grid-cols-[1fr_auto] gap-5">
          <div className="max-h-[60vh] overflow-y-auto scroll-thin -mx-2">
            {all.length === 0 && <Empty icon={History} title="No orders yet">Completed sales appear here.</Empty>}
            {all.map((o) => (
              <button key={o.id} onClick={() => setSel(o)} className={cx('w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg hover:bg-steel-50', sel?.id === o.id && 'bg-brand-50')}>
                <span className="text-sm font-extrabold text-ink num w-[74px]">#{o.number}</span>
                <span className="text-xs text-steel-500 w-12 num">{time(o.created_at)}</span>
                <span className="text-xs text-steel-600 flex-1 truncate">{TYPE_LABEL[o.order_type]}{o.table_name ? `, ${o.table_name}` : ''}</span>
                {o._pending ? <Badge tone="amber">Waiting to upload</Badge> : o.status === 'refunded' ? <Badge tone="red">Refunded</Badge> : <Badge tone="green">Paid</Badge>}
                <span className="text-sm font-bold num w-24 text-right">{money(o.total)}</span>
              </button>
            ))}
          </div>
          {sel && !sel._pending && (
            <div className="flex flex-col items-center gap-3">
              <div className="shadow-ticket"><Receipt order={sel} tenant={tenant} id="print-receipt" /></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
                {canRefund && sel.status === 'paid' && <Button size="sm" variant="danger" icon={RotateCcw} onClick={() => refund(sel)}>Refund</Button>}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
