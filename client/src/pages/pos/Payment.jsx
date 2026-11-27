import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, CreditCard, Smartphone, X, Delete, Printer, Plus, Check, CloudOff } from 'lucide-react';
import { money, METHOD_LABEL } from '../../lib/format.js';
import { Button, cx } from '../../components/ui.jsx';
import Receipt from './Receipt.jsx';

const METHODS = [
  { id: 'cash', icon: Banknote, color: '#12A971' },
  { id: 'mtn_momo', icon: Smartphone, color: '#E8A317' },
  { id: 'airtel_money', icon: Smartphone, color: '#D64545' },
  { id: 'card', icon: CreditCard, color: '#2357D9' },
];

function quickCash(due) {
  const steps = [1000, 5000, 10000, 20000, 50000];
  const set = new Set([due]);
  for (const s of steps) { const v = Math.ceil(due / s) * s; if (v > due) set.add(v); }
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

export default function Payment({ open, total, onClose, onComplete, tenant, online }) {
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState('cash');
  const [entry, setEntry] = useState('');
  const [reference, setReference] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(total - paid, 0);
  const change = Math.max(paid - total, 0);
  const amount = entry === '' ? remaining : Number(entry);
  const quick = useMemo(() => quickCash(remaining || total), [remaining, total]);

  const reset = () => { setPayments([]); setEntry(''); setReference(''); setMethod('cash'); setDone(null); };
  const close = () => { reset(); onClose(); };

  function addPayment(value = amount) {
    if (!value || value <= 0) return;
    // Only cash can be over-tendered; other methods are capped at what's due.
    const capped = method === 'cash' ? value : Math.min(value, remaining);
    if (capped <= 0) return;
    setPayments((p) => [...p, { method, amount: capped, reference: reference || undefined }]);
    setEntry(''); setReference('');
  }

  const press = (k) => setEntry((e) => (k === 'del' ? e.slice(0, -1) : k === '000' ? (e ? e + '000' : '') : (e + k).replace(/^0+/, '')));

  async function complete() {
    let final = payments;
    if (remaining > 0) {
      if (method !== 'cash' && amount >= remaining) final = [...payments, { method, amount: remaining, reference: reference || undefined }];
      else if (amount >= remaining) final = [...payments, { method, amount, reference: reference || undefined }];
      else return;
    }
    setBusy(true);
    try {
      const order = await onComplete(final);
      setPayments(final);
      setDone(order);
    } finally { setBusy(false); }
  }

  const canComplete = remaining === 0 || amount >= remaining;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-steel-100 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="h-14 bg-ink flex items-center px-4 gap-3 shrink-0">
            <button onClick={close} className="p-2 rounded-md text-steel-300 hover:text-white hover:bg-white/10" aria-label="Back to ticket"><X className="h-5 w-5" /></button>
            <span className="text-white font-bold">{done ? 'Sale complete' : 'Take payment'}</span>
            {!online && <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-amber-300"><CloudOff className="h-4 w-4" />Offline: the sale is saved on this device and uploads later</span>}
          </div>

          {!done ? (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto p-4 sm:p-8 grid lg:grid-cols-[1fr_1.1fr] gap-6">
                <div className="space-y-5">
                  <div className="card p-6">
                    <div className="text-sm font-semibold text-steel-500">Amount due</div>
                    <motion.div key={remaining} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="text-[44px] leading-none font-extrabold tracking-[-0.03em] text-ink num mt-1">{money(remaining)}</motion.div>
                    <div className="text-sm text-steel-500 mt-2 num">Order total {money(total)}</div>
                    {change > 0 && <div className="mt-4 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 flex justify-between items-center"><span className="font-semibold text-emerald-800">Change to give</span><span className="text-2xl font-extrabold text-emerald-700 num">{money(change)}</span></div>}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {METHODS.map((m) => (
                      <button key={m.id} onClick={() => setMethod(m.id)}
                        className={cx('relative flex items-center gap-3 rounded-xl p-4 text-left transition ring-1',
                          method === m.id ? 'bg-white ring-2 ring-brand-500 shadow-lift' : 'bg-white ring-steel-200 hover:ring-steel-300')}>
                        <span className="h-10 w-10 rounded-lg grid place-items-center" style={{ background: m.color + '1a', color: m.color }}><m.icon className="h-5 w-5" /></span>
                        <span className="font-bold text-steel-900">{METHOD_LABEL[m.id]}</span>
                        {method === m.id && <motion.span layoutId="pay-check" className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 grid place-items-center"><Check className="h-3 w-3 text-white" /></motion.span>}
                      </button>
                    ))}
                  </div>

                  {payments.length > 0 && (
                    <div className="card divide-y divide-steel-100">
                      {payments.map((p, i) => (
                        <div key={i} className="flex items-center px-4 py-3 text-sm">
                          <span className="font-semibold">{METHOD_LABEL[p.method]}</span>
                          {p.reference && <span className="text-steel-500 ml-2">{p.reference}</span>}
                          <span className="ml-auto font-bold num">{money(p.amount)}</span>
                          <button onClick={() => setPayments((x) => x.filter((_, k) => k !== i))} className="ml-3 p-1 rounded text-steel-400 hover:text-bad" aria-label="Remove payment"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card p-5">
                  {(method === 'mtn_momo' || method === 'airtel_money' || method === 'card') && (
                    <label className="block mb-4">
                      <span className="label">{method === 'card' ? 'Card approval code (optional)' : 'Customer phone or transaction ID'}</span>
                      <input className="input h-11" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'card' ? 'e.g. 482913' : 'e.g. 0772 123456'} />
                    </label>
                  )}
                  <div className="rounded-xl bg-steel-50 ring-1 ring-steel-200 px-4 h-16 flex items-center justify-between">
                    <span className="text-sm font-semibold text-steel-500">{METHOD_LABEL[method]} received</span>
                    <span className="text-[28px] font-extrabold text-ink num">{money(amount, { symbol: false })}</span>
                  </div>
                  {method === 'cash' && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {quick.map((v) => <button key={v} onClick={() => setEntry(String(v))} className="h-11 rounded-lg bg-brand-50 text-brand-700 text-[13px] font-bold hover:bg-brand-100 num">{money(v, { compact: true, symbol: false })}</button>)}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'].map((k) => (
                      <button key={k} onClick={() => press(k)} className="h-14 rounded-xl bg-white ring-1 ring-steel-200 text-xl font-bold text-steel-800 hover:bg-steel-50 active:scale-[.97] transition grid place-items-center">
                        {k === 'del' ? <Delete className="h-5 w-5" /> : k}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2 mt-4">
                    <Button variant="outline" size="xl" icon={Plus} onClick={() => addPayment()} disabled={!remaining || !amount} title="Add this as a part payment and pay the rest another way">Split</Button>
                    <Button size="xl" onClick={complete} disabled={!canComplete} loading={busy}>Complete sale</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Success order={done} tenant={tenant} onNew={close} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// The memorable moment: the receipt prints up out of the till.
function Success({ order, tenant, onNew }) {
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const change = paid - order.total;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 sm:p-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
            className="h-16 w-16 rounded-full bg-emerald-500 grid place-items-center shadow-lg shadow-emerald-500/30">
            <motion.svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.35, duration: 0.4 }} />
            </motion.svg>
          </motion.div>
          <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-ink mt-5">Order #{order.number} paid</h2>
          <p className="text-steel-500 mt-1">{order.queued ? 'Saved on this device. It uploads automatically when the connection is back.' : 'Recorded and sent to the kitchen.'}</p>
          {change > 0 && (
            <div className="mt-6 rounded-xl bg-white shadow-card px-5 py-4">
              <div className="text-sm font-semibold text-steel-500">Change to give</div>
              <div className="text-[40px] font-extrabold text-emerald-600 num leading-tight">{money(change)}</div>
            </div>
          )}
          <div className="flex gap-2 mt-7">
            <Button size="xl" onClick={onNew} className="flex-1">New order</Button>
            <Button size="xl" variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
        </div>
        <div className="relative flex justify-center">
          <div className="absolute top-0 h-3 w-[330px] rounded-full bg-ink shadow-lg z-10" />
          <div className="overflow-hidden pt-1.5">
            <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1], delay: 0.2 }} className="shadow-ticket">
              <Receipt order={order} tenant={tenant} id="print-receipt" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
