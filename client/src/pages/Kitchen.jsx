import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Maximize2, Volume2, VolumeX, LogOut, Clock, ChefHat, Check, Bell } from 'lucide-react';
import { LogoMark } from '../components/Logo.jsx';
import ConnectionPill from '../components/ConnectionPill.jsx';
import { Empty, cx } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { TYPE_LABEL, time } from '../lib/format.js';

const COLS = [
  { id: 'new', label: 'New', next: 'preparing', action: 'Start cooking', tone: 'bg-brand-500' },
  { id: 'preparing', label: 'Cooking', next: 'ready', action: 'Mark ready', tone: 'bg-amber-500' },
  { id: 'ready', label: 'Ready to serve', next: 'served', action: 'Served', tone: 'bg-emerald-500' },
];

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((d) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.15);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.16);
    });
  } catch {}
}

export default function Kitchen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(Date.now());
  const seen = useRef(new Set());

  async function load() {
    try {
      const rows = await api('/pos/kitchen');
      const fresh = rows.filter((o) => o.kitchen_status === 'new' && !seen.current.has(o.id));
      if (seen.current.size && fresh.length && sound) beep();
      rows.forEach((o) => seen.current.add(o.id));
      setOrders(rows);
    } catch { if (!orders) setOrders([]); }
  }
  useEffect(() => { load(); const t = setInterval(load, 6000); const c = setInterval(() => setNow(Date.now()), 15000); return () => { clearInterval(t); clearInterval(c); }; }, [sound]);

  async function advance(o, status) {
    setOrders((xs) => (status === 'served' ? xs.filter((x) => x.id !== o.id) : xs.map((x) => (x.id === o.id ? { ...x, kitchen_status: status } : x))));
    try { await api(`/pos/orders/${o.id}/kitchen`, { method: 'PATCH', body: { status } }); } catch { load(); }
  }

  const age = (d) => Math.floor((now - new Date(d).getTime()) / 60000);

  return (
    <div className="h-full flex flex-col bg-steel-200">
      <header className="h-14 shrink-0 bg-ink flex items-center gap-3 px-4">
        {user?.role !== 'kitchen' && <button onClick={() => navigate(-1)} className="p-2 rounded-md text-steel-300 hover:text-white hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>}
        <LogoMark className="h-8 w-8" />
        <div className="text-white font-bold flex items-center gap-2"><ChefHat className="h-5 w-5 text-brand-300" />Kitchen display</div>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionPill dark />
          <button onClick={() => setSound((s) => !s)} className="h-9 w-9 grid place-items-center rounded-lg text-steel-300 hover:text-white hover:bg-white/10" title={sound ? 'Mute new-order chime' : 'Turn on new-order chime'}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="h-9 w-9 grid place-items-center rounded-lg text-steel-300 hover:text-white hover:bg-white/10" title="Full screen"><Maximize2 className="h-5 w-5" /></button>
          {user?.role === 'kitchen' && <button onClick={() => { logout(); navigate('/login'); }} className="h-9 w-9 grid place-items-center rounded-lg text-steel-300 hover:text-white hover:bg-white/10" title="Sign out"><LogOut className="h-5 w-5" /></button>}
        </div>
      </header>
      <div className="flex-1 min-h-0 grid md:grid-cols-3 gap-3 p-3 overflow-x-auto">
        {COLS.map((col) => {
          const list = (orders || []).filter((o) => o.kitchen_status === col.id);
          return (
            <section key={col.id} className="flex flex-col min-h-0 rounded-2xl bg-steel-100 min-w-[300px]">
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className={cx('h-2.5 w-2.5 rounded-full', col.tone)} />
                <h2 className="font-extrabold text-steel-900">{col.label}</h2>
                <span className="ml-auto text-sm font-bold text-steel-500 num">{list.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 space-y-3">
                {orders && list.length === 0 && <Empty icon={col.id === 'ready' ? Bell : ChefHat} title={col.id === 'new' ? 'No new tickets' : col.id === 'preparing' ? 'Nothing cooking' : 'Nothing waiting'} />}
                <AnimatePresence>
                  {list.map((o) => {
                    const mins = age(o.created_at);
                    const late = mins >= 20; const warn = mins >= 10;
                    return (
                      <motion.article key={o.id} layout initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className={cx('rounded-xl bg-white shadow-card overflow-hidden ring-2', late ? 'ring-bad' : warn ? 'ring-amber-300' : 'ring-transparent')}>
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-steel-100">
                          <span className="text-[17px] font-extrabold text-ink num">#{o.number}</span>
                          <span className="text-xs font-bold rounded-md bg-steel-100 px-1.5 py-0.5 text-steel-700">{o.table_name ? `Table ${o.table_name}` : TYPE_LABEL[o.order_type]}</span>
                          <span className={cx('ml-auto inline-flex items-center gap-1 text-xs font-bold num', late ? 'text-bad' : warn ? 'text-amber-600' : 'text-steel-500')}><Clock className="h-3.5 w-3.5" />{mins} min</span>
                        </div>
                        <ul className="px-4 py-3 space-y-1.5">
                          {o.items.map((i, k) => (
                            <li key={k} className="flex gap-2.5 text-[15px]"><span className="font-extrabold text-brand-600 num w-6">{i.qty}×</span><span className="font-semibold text-steel-900">{i.name}{i.note && <span className="block text-xs text-amber-700">{i.note}</span>}</span></li>
                          ))}
                        </ul>
                        {o.note && <div className="mx-4 mb-3 text-xs font-semibold text-amber-900 bg-amber-50 rounded-md px-2.5 py-1.5">{o.note}</div>}
                        <div className="flex items-center gap-2 px-4 pb-3">
                          <span className="text-xs text-steel-400">{time(o.created_at)}{o.cashier ? `, ${o.cashier.split(' ')[0]}` : ''}</span>
                          <button onClick={() => advance(o, col.next)} className={cx('ml-auto h-10 px-4 rounded-lg text-white text-sm font-bold inline-flex items-center gap-1.5 hover:brightness-95 active:scale-95 transition', col.tone)}>
                            <Check className="h-4 w-4" />{col.action}
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
