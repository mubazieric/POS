// Offline storage: the catalog and a queue of sales waiting to upload.
// Every sale is written here first, then uploaded, so nothing is lost when the line drops mid-sale.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api.js';

let dbp;
function db() {
  if (!dbp) dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open('iwat-pos', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('queue', { keyPath: 'client_ref' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
  });
}

export const kv = {
  get: (k) => run('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => run('kv', 'readwrite', (s) => s.put(v, k)),
};
export const queue = {
  all: () => run('queue', 'readonly', (s) => s.getAll()),
  add: (o) => run('queue', 'readwrite', (s) => s.put(o)),
  remove: (ref) => run('queue', 'readwrite', (s) => s.delete(ref)),
};

/* ---------- sync state shared across the app ---------- */
let state = { online: navigator.onLine, pending: 0, syncing: false, lastSync: localStorage.getItem('iwat.lastSync'), failed: 0 };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useSyncState = () => useSyncExternalStore(subscribe, () => state);

async function refreshCount() {
  const all = await queue.all();
  set({ pending: all.length, failed: all.filter((o) => o._error).length });
}

let running = null;
export function syncNow() {
  if (running) return running;
  running = (async () => {
    const items = await queue.all();
    if (!items.length) { set({ pending: 0 }); return; }
    set({ syncing: true });
    try {
      const { results } = await api('/pos/orders/sync', { method: 'POST', body: { orders: items }, timeout: 20000 });
      for (const r of results) {
        if (r.status === 'created' || r.status === 'duplicate') await queue.remove(r.client_ref);
        else {
          const o = items.find((i) => i.client_ref === r.client_ref);
          if (o) await queue.add({ ...o, _error: r.error });
        }
      }
      const now = new Date().toISOString();
      localStorage.setItem('iwat.lastSync', now);
      set({ online: true, lastSync: now });
    } catch (e) {
      if (e.status === 0) set({ online: false });
    } finally {
      set({ syncing: false });
      await refreshCount();
      running = null;
    }
  })();
  return running;
}

export async function enqueueSale(order) {
  await queue.add(order);
  await refreshCount();
  syncNow(); // fire and forget; the queue keeps the sale safe if this upload fails
}

// "Online" means "can reach the IWAT server", not just "has Wi-Fi".
async function heartbeat() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    set({ online: r.ok });
    if (r.ok && state.pending) syncNow();
  } catch { set({ online: false }); }
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  refreshCount();
  heartbeat();
  window.addEventListener('online', heartbeat);
  window.addEventListener('offline', () => set({ online: false }));
  setInterval(heartbeat, 15000);
}

/* ---------- catalog with offline fallback ---------- */
export function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [source, setSource] = useState('loading');
  const load = async () => {
    try {
      const fresh = await api('/pos/catalog');
      await kv.set('catalog', fresh);
      setCatalog(fresh); setSource('live');
    } catch {
      const cached = await kv.get('catalog');
      if (cached) { setCatalog(cached); setSource('cache'); } else setSource('empty');
    }
  };
  useEffect(() => { load(); }, []);
  const update = (next) => { setCatalog(next); kv.set('catalog', next); };
  return { catalog, setCatalog: update, source, reload: load };
}

export function nextOrderNumber() {
  const seq = Number(localStorage.getItem('iwat.seq') || 0) + 1;
  localStorage.setItem('iwat.seq', String(seq));
  return `${deviceCode()}-${String(seq).padStart(4, '0')}`;
}
export function deviceCode() {
  let dev = localStorage.getItem('iwat.device');
  if (!dev) { dev = String.fromCharCode(65 + Math.floor(Math.random() * 26)); localStorage.setItem('iwat.device', dev); }
  return dev;
}
export const deviceName = () => `Till ${deviceCode()}`;
