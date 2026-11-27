import { createContext, useContext, useEffect, useState } from 'react';
import { api, session } from './api.js';
import { setCurrency } from './format.js';

const Ctx = createContext(null);
setCurrency(session.get()?.tenant?.currency);

export function AuthProvider({ children }) {
  const [s, setS] = useState(() => session.get());
  useEffect(() => {
    const onUnauth = () => { session.clear(); setS(null); };
    window.addEventListener('iwat:unauthorized', onUnauth);
    return () => window.removeEventListener('iwat:unauthorized', onUnauth);
  }, []);
  const save = (next) => { session.set(next); setCurrency(next?.tenant?.currency); setS(next); return next; };
  const value = {
    user: s?.user, tenant: s?.tenant, token: s?.token,
    async login(email, password) { return save(await api('/auth/login', { method: 'POST', body: { email, password } })); },
    async pin(pin) { return save(await api('/auth/pin', { method: 'POST', body: { pin } })); },
    // Platform admins can open a business as its owner for support; we remember the way back.
    impersonate(next) {
      localStorage.setItem('iwat.superSession', JSON.stringify(s));
      return save(next);
    },
    returnToSuper() {
      const prev = JSON.parse(localStorage.getItem('iwat.superSession') || 'null');
      localStorage.removeItem('iwat.superSession');
      if (prev) save(prev);
      return prev;
    },
    isImpersonating: !!localStorage.getItem('iwat.superSession'),
    logout() { session.clear(); localStorage.removeItem('iwat.superSession'); setS(null); },
    setTenant(t) { save({ ...s, tenant: { ...s.tenant, ...t } }); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const homeFor = (role) => ({ superadmin: '/super', kitchen: '/kitchen', cashier: '/pos' }[role] || '/admin');
