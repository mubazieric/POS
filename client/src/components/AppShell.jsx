import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X, MonitorSmartphone, ChefHat, ShieldCheck, Undo2 } from 'lucide-react';
import { Logo } from './Logo.jsx';
import ConnectionPill from './ConnectionPill.jsx';
import { useAuth } from '../lib/auth.jsx';
import { ROLE_LABEL } from '../lib/format.js';
import { Button, cx } from './ui.jsx';

function Nav({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) =>
        it.section ? (
          <div key={it.section} className="px-3 pt-5 pb-1.5 text-[11px] font-semibold text-steel-400/80">{it.section}</div>
        ) : (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate}
            className={({ isActive }) => cx('relative flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-semibold transition-colors',
              isActive ? 'text-white' : 'text-steel-300 hover:text-white hover:bg-white/5')}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-brand-500" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <it.icon className="relative h-[18px] w-[18px]" />
                <span className="relative">{it.label}</span>
                {it.badge && <span className="relative ml-auto text-[11px] rounded-md bg-white/10 px-1.5 py-0.5">{it.badge}</span>}
              </>
            )}
          </NavLink>
        )
      )}
    </nav>
  );
}

export default function AppShell({ items, area }) {
  const { user, tenant, logout, isImpersonating, returnToSuper } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const sidebar = (
    <div className="h-full flex flex-col bg-ink px-3 py-4">
      <div className="px-2 mb-4 flex items-center justify-between">
        <Logo dark />
        <button className="lg:hidden p-1.5 text-steel-300" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      {area === 'super' ? (
        <div className="mx-1 mb-2 rounded-lg bg-white/5 px-3 py-2.5 flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-brand-300" />
          <div className="text-xs"><div className="font-bold text-white">Platform console</div><div className="text-steel-400">All businesses</div></div>
        </div>
      ) : (
        <div className="mx-1 mb-2 rounded-lg bg-white/5 px-3 py-2.5">
          <div className="text-[13px] font-bold text-white truncate">{tenant?.name}</div>
          <div className="text-xs text-steel-400 capitalize">{tenant?.plan_code} plan</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto scroll-thin"><Nav items={items} onNavigate={() => setOpen(false)} /></div>
      {area !== 'super' && (
        <div className="grid grid-cols-2 gap-2 mt-3 mx-1">
          <button onClick={() => navigate('/pos')} className="flex flex-col items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 py-2.5 text-[12px] font-semibold text-steel-200"><MonitorSmartphone className="h-4 w-4" />Register</button>
          <button onClick={() => navigate('/kitchen')} className="flex flex-col items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 py-2.5 text-[12px] font-semibold text-steel-200"><ChefHat className="h-4 w-4" />Kitchen</button>
        </div>
      )}
      <div className="mt-3 mx-1 flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="h-9 w-9 rounded-full bg-brand-500 grid place-items-center text-white text-sm font-bold">{user?.name?.[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white truncate">{user?.name}</div>
          <div className="text-xs text-steel-400">{ROLE_LABEL[user?.role]}</div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-md text-steel-400 hover:text-white hover:bg-white/10" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex">
      <aside className="hidden lg:block w-[248px] shrink-0">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <motion.div className="lg:hidden fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-900/60" onClick={() => setOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[264px]" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }}>
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 min-w-0 flex flex-col">
        {isImpersonating && (
          <div className="bg-amber-400 text-ink text-[13px] font-semibold px-4 py-2 flex items-center justify-between gap-3">
            <span>Support access: you are signed in as {user?.name} of {tenant?.name}. Everything you do here is logged.</span>
            <Button size="sm" variant="dark" icon={Undo2} onClick={() => { returnToSuper(); navigate('/super/tenants'); }}>Back to platform</Button>
          </div>
        )}
        <header className="h-14 shrink-0 bg-white border-b border-steel-200 flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden p-2 -ml-2 rounded-md text-steel-700 hover:bg-steel-100" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="text-sm text-steel-500 truncate">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
