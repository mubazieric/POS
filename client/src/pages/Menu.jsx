import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Plus, Minus, MapPin, Phone, Flame, ClipboardList, UtensilsCrossed } from 'lucide-react';
import { money, setCurrency } from '../lib/format.js';
import { LogoMark } from '../components/Logo.jsx';
import { cx } from '../components/ui.jsx';

export default function Menu() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);
  const [item, setItem] = useState(null);
  const [list, setList] = useState({});
  const [showList, setShowList] = useState(false);
  const sections = useRef({});
  const tabs = useRef();

  useEffect(() => {
    fetch(`/api/public/menu/${slug}${params.get('table') ? `?table=${params.get('table')}` : ''}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; })
      .then((j) => { setCurrency(j.tenant.currency); setD(j); setActive(j.categories[0]?.id); document.title = `${j.tenant.name} menu`; })
      .catch((e) => setErr(e.message || 'This menu couldn’t load. Check your connection and try again.'));
  }, [slug]);

  // Highlight the category you're scrolling through.
  useEffect(() => {
    if (!d) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(Number(e.target.dataset.cat))), { rootMargin: '-120px 0px -65% 0px' });
    Object.values(sections.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [d, q]);
  useEffect(() => { tabs.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [active]);

  const filtered = useMemo(() => (d?.products || []).filter((p) => !q || `${p.name} ${p.description || ''}`.toLowerCase().includes(q.toLowerCase())), [d, q]);
  const byId = useMemo(() => Object.fromEntries((d?.products || []).map((p) => [p.id, p])), [d]);
  const count = Object.values(list).reduce((s, n) => s + n, 0);
  const total = Object.entries(list).reduce((s, [id, n]) => s + (byId[id]?.price || 0) * n, 0);
  const change = (id, by) => setList((l) => { const n = Math.max((l[id] || 0) + by, 0); const x = { ...l, [id]: n }; if (!n) delete x[id]; return x; });

  if (err) return (
    <div className="min-h-full grid place-items-center bg-steel-50 p-8 text-center">
      <div><UtensilsCrossed className="h-10 w-10 text-brand-500 mx-auto mb-3" /><p className="font-bold text-steel-900 text-lg">Menu unavailable</p><p className="text-steel-500 mt-1 max-w-xs">{err}</p></div>
    </div>
  );
  if (!d) return (
    <div className="min-h-full grid place-items-center bg-brand-500">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}><LogoMark className="h-14 w-14" /></motion.div>
    </div>
  );

  const { tenant, table, categories, popular } = d;
  return (
    <div className="min-h-full bg-steel-50 pb-28">
      {/* Hero */}
      <header className="relative overflow-hidden bg-brand-500 text-white px-5 pt-8 pb-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-[-70px] h-40 w-40 rounded-full bg-black/10" />
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-xl mx-auto">
          {table && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-bold">You’re at table {table.name}</span>}
          <h1 className="text-[32px] leading-tight font-extrabold tracking-[-0.02em] mt-3">{tenant.name}</h1>
          {tenant.menu_message && <p className="text-white/90 mt-1.5 text-[15px]">{tenant.menu_message}</p>}
        </motion.div>
      </header>

      <div className="max-w-xl mx-auto">
        {/* Search + category tabs */}
        <div className="sticky top-0 z-20 bg-steel-50/95 backdrop-blur pt-3 pb-2 -mt-6">
          <div className="px-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-steel-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu" className="w-full h-12 rounded-2xl bg-white pl-11 pr-10 text-[15px] shadow-card outline-none focus:ring-4 focus:ring-brand-100" />
              {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-steel-400" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            </div>
          </div>
          {!q && (
            <div ref={tabs} className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 [scrollbar-width:none]">
              {categories.map((c) => (
                <button key={c.id} data-tab={c.id} onClick={() => sections.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={cx('relative shrink-0 h-9 px-4 rounded-full text-[13px] font-bold transition-colors', active === c.id ? 'text-white' : 'bg-white text-steel-700 shadow-card')}>
                  {active === c.id && <motion.span layoutId="menu-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <span className="relative">{c.icon} {c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Popular */}
        {!q && popular.length > 0 && (
          <section className="px-4 mt-3">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-steel-900 mb-2.5"><Flame className="h-4 w-4 text-brand-500" />Popular right now</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 [scrollbar-width:none]">
              {popular.map((id) => byId[id]).filter(Boolean).map((p, i) => (
                <motion.button key={p.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} onClick={() => setItem(p)}
                  className="shrink-0 w-[148px] rounded-2xl bg-white shadow-card overflow-hidden text-left">
                  <div className="h-24 grid place-items-center text-5xl bg-gradient-to-br from-brand-100 to-white">{p.emoji}</div>
                  <div className="p-3"><div className="text-[13px] font-bold text-steel-900 line-clamp-1">{p.name}</div><div className="text-[13px] font-extrabold text-brand-600 num">{money(p.price)}</div></div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* Menu */}
        {categories.map((c) => {
          const items = filtered.filter((p) => p.category_id === c.id);
          if (!items.length) return null;
          return (
            <section key={c.id} data-cat={c.id} ref={(el) => (sections.current[c.id] = el)} className="px-4 mt-6 scroll-mt-36">
              <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-steel-900 mb-3">{c.icon} {c.name}</h2>
              <div className="space-y-2.5">
                {items.map((p) => (
                  <motion.button key={p.id} layout onClick={() => !p.sold_out && setItem(p)} whileTap={{ scale: 0.98 }}
                    className={cx('w-full flex items-center gap-3.5 rounded-2xl bg-white p-3 shadow-card text-left', p.sold_out && 'opacity-55')}>
                    <span className="h-[72px] w-[72px] shrink-0 rounded-xl grid place-items-center text-4xl" style={{ background: `linear-gradient(140deg, ${c.color}22, #fff)` }}>{p.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-steel-900">{p.name}</span>
                      {p.description && <span className="block text-[13px] text-steel-500 line-clamp-2 mt-0.5">{p.description}</span>}
                      <span className="flex items-center gap-2 mt-1.5">
                        <span className="font-extrabold text-steel-900 num">{money(p.price)}</span>
                        {p.sold_out && <span className="text-[11px] font-bold rounded-md bg-steel-200 text-steel-700 px-1.5 py-0.5">Sold out today</span>}
                      </span>
                    </span>
                    {!p.sold_out && (list[p.id]
                      ? <span className="h-8 min-w-8 px-2 rounded-full bg-brand-500 text-white text-sm font-extrabold grid place-items-center num">{list[p.id]}</span>
                      : <span className="h-8 w-8 rounded-full bg-brand-50 text-brand-600 grid place-items-center"><Plus className="h-4 w-4" /></span>)}
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })}
        {q && !filtered.length && <p className="text-center text-steel-500 py-16">Nothing on the menu matches “{q}”.</p>}

        <footer className="px-4 mt-10 text-center text-xs text-steel-500 space-y-1.5">
          {(tenant.address || tenant.city) && <p className="flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[tenant.address, tenant.city].filter(Boolean).join(', ')}</p>}
          {tenant.phone && <p className="flex items-center justify-center gap-1.5"><Phone className="h-3.5 w-3.5" /><a href={`tel:${tenant.phone.replace(/\s/g, '')}`} className="underline">{tenant.phone}</a></p>}
          <p>Prices in {tenant.currency}{tenant.tax_inclusive ? `, VAT ${tenant.tax_rate}% included` : ''}.</p>
          <p className="flex items-center justify-center gap-1.5 pt-3 text-steel-400"><LogoMark className="h-4 w-4" />Menu by IWAT POS</p>
        </footer>
      </div>

      {/* My list bar */}
      <AnimatePresence>
        {count > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed inset-x-0 bottom-0 z-30 p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <button onClick={() => setShowList(true)} className="max-w-xl mx-auto w-full h-14 rounded-2xl bg-ink text-white flex items-center px-5 shadow-lift">
              <ClipboardList className="h-5 w-5 text-brand-300" />
              <span className="ml-3 font-bold">My choices</span>
              <span className="ml-2 h-6 min-w-6 px-1.5 rounded-full bg-brand-500 text-xs font-extrabold grid place-items-center num">{count}</span>
              <span className="ml-auto font-extrabold num">{money(total)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!item} onClose={() => setItem(null)}>
        {item && (
          <div>
            <div className="h-48 -mx-5 -mt-5 mb-4 grid place-items-center text-[96px] bg-gradient-to-br from-brand-100 via-brand-50 to-white rounded-t-3xl">
              <motion.span initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>{item.emoji}</motion.span>
            </div>
            <h3 className="text-[22px] font-extrabold text-steel-900">{item.name}</h3>
            {item.description && <p className="text-steel-600 mt-1">{item.description}</p>}
            <div className="text-[20px] font-extrabold text-brand-600 num mt-2">{money(item.price)}</div>
            <div className="flex items-center gap-3 mt-5">
              <div className="flex items-center rounded-xl ring-1 ring-steel-200">
                <button onClick={() => change(item.id, -1)} className="h-12 w-12 grid place-items-center" aria-label="One less"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-lg font-extrabold num">{list[item.id] || 0}</span>
                <button onClick={() => change(item.id, 1)} className="h-12 w-12 grid place-items-center" aria-label="One more"><Plus className="h-4 w-4" /></button>
              </div>
              <button onClick={() => { if (!list[item.id]) change(item.id, 1); setItem(null); }} className="flex-1 h-12 rounded-xl bg-brand-500 text-white font-bold">
                {list[item.id] ? 'Done' : 'Add to my choices'}
              </button>
            </div>
            <p className="text-xs text-steel-400 mt-3">Your choices stay on this phone. Show them to your waiter to order.</p>
          </div>
        )}
      </Sheet>

      <Sheet open={showList} onClose={() => setShowList(false)}>
        <h3 className="text-[20px] font-extrabold text-steel-900">My choices</h3>
        <p className="text-sm text-steel-500">{table ? `Show this to your waiter at table ${table.name}.` : 'Show this to your waiter.'}</p>
        <div className="mt-4 divide-y divide-steel-100">
          {Object.entries(list).map(([id, n]) => (
            <div key={id} className="flex items-center gap-3 py-3">
              <span className="text-2xl">{byId[id]?.emoji}</span>
              <span className="flex-1 font-semibold">{byId[id]?.name}</span>
              <div className="flex items-center rounded-lg ring-1 ring-steel-200">
                <button onClick={() => change(id, -1)} className="h-9 w-9 grid place-items-center" aria-label="One less"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-6 text-center font-extrabold num">{n}</span>
                <button onClick={() => change(id, 1)} className="h-9 w-9 grid place-items-center" aria-label="One more"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <span className="w-24 text-right font-bold num">{money((byId[id]?.price || 0) * n, { symbol: false })}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center border-t-2 border-steel-200 pt-3 mt-1">
          <span className="font-bold">Estimated total</span><span className="text-xl font-extrabold num">{money(total)}</span>
        </div>
        <button onClick={() => { setList({}); setShowList(false); }} className="w-full h-11 rounded-xl ring-1 ring-steel-200 font-semibold text-steel-600 mt-4">Clear my choices</button>
      </Sheet>
    </div>
  );
}

function Sheet({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(e, i) => i.offset.y > 100 && onClose()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="relative w-full max-w-xl bg-white rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <span className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-white/80 z-10" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
