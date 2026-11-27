import { motion } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncState, syncNow } from '../lib/offline.js';
import { ago } from '../lib/format.js';
import { cx } from './ui.jsx';

export default function ConnectionPill({ dark = false }) {
  const { online, pending, syncing, lastSync } = useSyncState();
  const label = syncing ? `Uploading ${pending}…` : !online ? (pending ? `Offline · ${pending} sale${pending > 1 ? 's' : ''} saved` : 'Offline · still selling') : pending ? `${pending} to upload` : 'Online';
  const tone = !online ? 'bg-amber-400/15 text-amber-300 ring-amber-400/30' : pending ? 'bg-brand-400/15 text-brand-200 ring-brand-300/30' : 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30';
  const light = !online ? 'bg-amber-50 text-amber-800 ring-amber-200' : pending ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  const Icon = syncing ? RefreshCw : online ? Cloud : CloudOff;
  return (
    <button onClick={() => syncNow()} title={lastSync ? `Last upload ${ago(lastSync)}. Click to upload now.` : 'Click to upload now'}
      className={cx('inline-flex items-center gap-2 h-8 rounded-full pl-2.5 pr-3 text-xs font-bold ring-1 ring-inset transition-colors', dark ? tone : light)}>
      <span className="relative flex h-2 w-2">
        {online && !pending && <motion.span className="absolute inset-0 rounded-full bg-emerald-400" animate={{ scale: [1, 2.4], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
        <span className={cx('relative h-2 w-2 rounded-full', !online ? 'bg-amber-400' : pending ? 'bg-brand-400' : 'bg-emerald-400')} />
      </span>
      <Icon className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
