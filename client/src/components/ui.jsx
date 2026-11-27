import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm shadow-brand-500/20',
  dark: 'bg-ink text-white hover:bg-ink-700',
  ghost: 'text-steel-700 hover:bg-steel-100',
  outline: 'border border-steel-300 bg-white text-steel-800 hover:border-steel-400 hover:bg-steel-50',
  danger: 'bg-bad text-white hover:brightness-95',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
};
const SIZES = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-[15px] gap-2', xl: 'h-14 px-6 text-base gap-2.5' };

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none', VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint && <span className="mt-1 block text-xs text-steel-500">{hint}</span>}
    </label>
  );
}

export const Input = (props) => <input {...props} className={cx('input', props.className)} />;
export const Select = ({ children, ...props }) => <select {...props} className={cx('input pr-8', props.className)}>{children}</select>;

const TONES = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-200', grey: 'bg-steel-100 text-steel-700 ring-steel-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200', dark: 'bg-ink text-white ring-ink',
};
export const Badge = ({ tone = 'grey', children, className }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', TONES[tone], className)}>{children}</span>
);

export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal="true"
            className={cx('relative w-full bg-white rounded-t-2xl sm:rounded-2xl shadow-lift max-h-[92vh] flex flex-col', width)}
            initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-steel-200">
                <h2 className="text-[17px] font-bold text-steel-900">{title}</h2>
                <button onClick={onClose} className="p-1.5 rounded-md text-steel-500 hover:bg-steel-100" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
            )}
            <div className="overflow-y-auto scroll-thin p-5 flex-1">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-steel-200 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink text-white pl-3.5 pr-4 py-3 shadow-lift text-sm font-medium">
              {t.tone === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertTriangle className="h-5 w-5 text-amber-400" />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export const Spinner = ({ className }) => <Loader2 className={cx('h-5 w-5 animate-spin text-brand-500', className)} />;

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && <div className="h-12 w-12 rounded-xl bg-steel-100 grid place-items-center mb-3"><Icon className="h-6 w-6 text-steel-500" /></div>}
      <p className="font-semibold text-steel-800">{title}</p>
      {children && <p className="text-sm text-steel-500 mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, size = 'md' }) {
  return (
    <div className="inline-flex rounded-lg bg-steel-100 p-1 gap-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('relative rounded-md font-semibold transition-colors', size === 'sm' ? 'px-2.5 h-7 text-xs' : 'px-3.5 h-8 text-[13px]',
            value === o.value ? 'text-steel-900' : 'text-steel-500 hover:text-steel-800')}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-md bg-white shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative inline-flex items-center gap-1.5">{o.icon && <o.icon className="h-3.5 w-3.5" />}{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-steel-900">{title}</h1>
        {subtitle && <p className="text-sm text-steel-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Delta({ value }) {
  if (value === null || value === undefined || !isFinite(value)) return <span className="text-xs text-steel-400">no prior data</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-bold', up ? 'text-emerald-600' : 'text-bad')}>
      <Icon className="h-3.5 w-3.5" />{Math.abs(value).toFixed(1)}%
      <span className="font-medium text-steel-400">vs previous</span>
    </span>
  );
}

export function Table({ columns, rows, onRow, empty }) {
  if (!rows?.length) return empty || null;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[12px] font-semibold text-steel-500 border-b border-steel-200">
            {columns.map((c) => <th key={c.key} className={cx('px-4 py-2.5 whitespace-nowrap', c.align === 'right' && 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined}
              className={cx('border-b border-steel-100 last:border-0', onRow && 'cursor-pointer hover:bg-brand-50/50')}>
              {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 whitespace-nowrap', c.align === 'right' && 'text-right num')}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
