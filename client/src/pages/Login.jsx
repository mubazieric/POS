import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, MonitorSmartphone, ChefHat, ShieldCheck, Cloud, CloudOff, Check } from 'lucide-react';
import { Logo } from '../components/Logo.jsx';
import { Button, Field, Input, cx } from '../components/ui.jsx';
import { useAuth, homeFor } from '../lib/auth.jsx';

const DEMO = [
  { label: 'Business owner', email: 'owner@demo.com', password: 'Owner@123', icon: Store, note: 'Dashboard, menu, staff' },
  { label: 'Cashier', email: 'cashier@demo.com', password: 'Cashier@123', icon: MonitorSmartphone, note: 'Register and floor plan' },
  { label: 'Kitchen', email: 'kitchen@demo.com', password: 'Kitchen@123', icon: ChefHat, note: 'Kitchen display' },
  { label: 'Platform admin', email: 'super@iwatpos.com', password: 'Super@123', icon: ShieldCheck, note: 'All businesses' },
];

const FEED = [
  { n: 'A-0141', items: 'Rolex ×2, Masala Chai', total: '21,000', method: 'MTN MoMo' },
  { n: 'A-0142', items: 'Chicken Luwombo, Passion Juice', total: '43,000', method: 'Cash' },
  { n: 'A-0143', items: 'Cappuccino ×3, Croissant ×2', total: '39,000', method: 'Card' },
  { n: 'A-0144', items: 'Whole Tilapia, Nile Special ×2', total: '57,000', method: 'Airtel Money' },
  { n: 'A-0145', items: 'Beef Burger, Iced Mocha', total: '42,000', method: 'Cash' },
  { n: 'A-0146', items: 'Pancake Stack, Café Latte', total: '28,000', method: 'MTN MoMo' },
];

// The one animated moment: sales keep landing while the line goes down, then upload when it returns.
function OfflineStory() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1900); return () => clearInterval(t); }, []);
  const offline = tick % 10 >= 3 && tick % 10 < 7;
  const visible = [0, 1, 2].map((k) => ({ ...FEED[(tick + k) % FEED.length], key: tick + k, age: k }));
  return (
    <div className="relative w-full max-w-[360px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-semibold text-steel-300">Till A, Kampala Road</span>
        <motion.span layout className={cx('inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold ring-1 ring-inset',
          offline ? 'bg-amber-400/15 text-amber-300 ring-amber-400/30' : 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30')}>
          {offline ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
          {offline ? 'Network down, still selling' : 'Online'}
        </motion.span>
      </div>
      <div className="relative h-[300px]">
        <AnimatePresence initial={false}>
          {visible.map((o) => {
            const saved = offline && o.age === 0;
            return (
              <motion.div key={o.key} layout
                initial={{ opacity: 0, y: -30, scale: 0.96 }}
                animate={{ opacity: 1 - o.age * 0.22, y: o.age * 100, scale: 1 - o.age * 0.03 }}
                exit={{ opacity: 0, y: 290 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="absolute inset-x-0 top-0 rounded-xl bg-white px-4 py-3.5 shadow-ticket">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold text-ink num">#{o.n}</span>
                  <span className="text-[15px] font-extrabold text-ink num">UGX {o.total}</span>
                </div>
                <div className="text-[13px] text-steel-500 mt-0.5 truncate">{o.items}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-steel-600">{o.method}</span>
                  <span className={cx('inline-flex items-center gap-1 text-xs font-bold', saved ? 'text-amber-600' : 'text-emerald-600')}>
                    {saved ? <>Saved on device</> : <><Check className="h-3.5 w-3.5" />Uploaded</>}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  async function submit(e, demo) {
    e?.preventDefault();
    const creds = demo || { email, password };
    setBusy(demo?.email || 'form'); setError('');
    try {
      const s = await login(creds.email, creds.password);
      navigate(homeFor(s.user.role), { replace: true });
    } catch (err) {
      setError(err.status === 0 ? 'Can’t reach the server. Sign-in needs a connection once; after that the till works offline.' : err.message);
    } finally { setBusy(null); }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden lg:flex flex-col justify-between bg-ink px-14 py-12 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <Logo dark className="relative" />
        <div className="relative">
          <h1 className="text-[44px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white max-w-[13ch]">The till that keeps selling when the network drops.</h1>
          <p className="text-steel-300 mt-5 max-w-[46ch] text-[15px] leading-relaxed">
            Take orders, send them to the kitchen and accept cash, card or mobile money. Sales save on the device and upload the moment you’re back online.
          </p>
          <div className="mt-10"><OfflineStory /></div>
        </div>
        <p className="relative text-xs text-steel-400">Restaurants, cafés, bars and shops across East Africa.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10 bg-steel-50">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[420px]">
          <Logo className="lg:hidden mb-8" />
          <h2 className="text-[28px] font-extrabold tracking-[-0.02em] text-steel-900">Sign in</h2>
          <p className="text-sm text-steel-500 mt-1 mb-7">Use your work email, or open a demo account below.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" required /></Field>
            <Field label="Password"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></Field>
            {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2.5 ring-1 ring-red-200">{error}</div>}
            <Button type="submit" size="lg" className="w-full" loading={busy === 'form'}>Sign in</Button>
          </form>

          <div className="mt-9">
            <div className="text-[13px] font-semibold text-steel-700 mb-3">Try the demo</div>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMO.map((d) => (
                <button key={d.email} onClick={(e) => submit(e, d)} disabled={!!busy}
                  className="group text-left rounded-xl bg-white p-3.5 shadow-card hover:shadow-lift hover:-translate-y-0.5 transition disabled:opacity-60">
                  <d.icon className={cx('h-5 w-5 text-brand-500 mb-2', busy === d.email && 'animate-pulse')} />
                  <div className="text-[13px] font-bold text-steel-900">{d.label}</div>
                  <div className="text-xs text-steel-500">{d.note}</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
