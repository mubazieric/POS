import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { QrCode, Printer, ExternalLink, Download, Copy, Eye, EyeOff, Smartphone } from 'lucide-react';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';
import { PageHeader, Button, Field, Input, Spinner, Segmented, Badge, useToast, cx } from '../../components/ui.jsx';
import { Card } from '../../components/kit.jsx';

export const menuUrl = (slug, tableId) => `${window.location.origin}/m/${slug}${tableId ? `?table=${tableId}` : ''}`;

function QR({ text, size = 140 }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1F1D1B', light: '#ffffff' } }).then(setSvg); }, [text]);
  return <div style={{ width: size, height: size }} className="[&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function TableCard({ name, table, url }) {
  return (
    <div className="qr-card w-[230px] rounded-2xl bg-white ring-1 ring-steel-200 overflow-hidden shadow-card">
      <div className="bg-brand-500 px-4 pt-4 pb-6 text-center text-white">
        <div className="text-[11px] font-semibold tracking-wide opacity-90">{name}</div>
        <div className="text-[19px] font-extrabold leading-tight mt-0.5">Scan for our menu</div>
      </div>
      <div className="-mt-3 mx-4 rounded-xl bg-white p-3 shadow-card grid place-items-center"><QR text={url} size={156} /></div>
      <div className="px-4 py-3 text-center">
        {table ? <div className="text-[13px] font-bold text-steel-800">Table {table.name}</div> : <div className="text-[13px] font-bold text-steel-800">Any table</div>}
        <div className="text-[10px] text-steel-400 mt-0.5">Point your phone camera at the code</div>
      </div>
    </div>
  );
}

export default function QRMenu() {
  const toast = useToast();
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [area, setArea] = useState('all');
  useEffect(() => {
    api('/admin/settings').then(setS);
    api('/admin/tables').then(setTables);
    api('/admin/products').then((p) => setProducts(p.filter((x) => x.active)));
  }, []);
  const areas = useMemo(() => ['all', ...new Set(tables.map((t) => t.area))], [tables]);
  if (!s) return <div className="py-32 grid place-items-center"><Spinner className="h-8 w-8" /></div>;
  const shown = tables.filter((t) => area === 'all' || t.area === area);
  const owner = user.role === 'owner';

  async function saveSettings(patch) {
    try { const t = await api('/admin/settings', { method: 'PATCH', body: patch }); setS({ ...s, ...t }); toast('Menu settings saved'); }
    catch (e) { toast(e.message, 'warn'); }
  }
  async function toggleProduct(p) {
    setProducts((xs) => xs.map((x) => (x.id === p.id ? { ...x, on_menu: !x.on_menu } : x)));
    await api(`/admin/products/${p.id}`, { method: 'PATCH', body: { on_menu: !p.on_menu } });
  }
  async function downloadPng(t) {
    const url = await QRCode.toDataURL(menuUrl(s.slug, t?.id), { width: 1024, margin: 2, color: { dark: '#1F1D1B', light: '#ffffff' } });
    const a = document.createElement('a'); a.href = url; a.download = `menu-qr-${t ? `table-${t.name}` : 'general'}.png`; a.click();
  }

  return (
    <div>
      <PageHeader title="QR menu" subtitle="Put a code on each table. Guests scan it and see your menu on their phone, no app needed."
        actions={<>
          <a href={menuUrl(s.slug)} target="_blank" rel="noreferrer"><Button variant="outline" icon={ExternalLink}>Preview menu</Button></a>
          <Button icon={Printer} onClick={() => window.print()} disabled={!s.menu_enabled}>Print table cards</Button>
        </>} />

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Online menu" sub="Prices and sold-out items update live from your products.">
          <label className={cx('flex items-center justify-between rounded-xl px-4 py-3 ring-1', s.menu_enabled ? 'bg-emerald-50 ring-emerald-200' : 'bg-steel-50 ring-steel-200')}>
            <span><span className="block font-bold text-steel-900">{s.menu_enabled ? 'Menu is live' : 'Menu is off'}</span><span className="text-xs text-steel-500">{s.menu_enabled ? 'Anyone with the code can view it.' : 'Scanning shows a polite “ask your waiter” message.'}</span></span>
            <input type="checkbox" disabled={!owner} className="h-5 w-5 accent-brand-500" checked={s.menu_enabled} onChange={(e) => saveSettings({ menu_enabled: e.target.checked })} />
          </label>
          <Field label="Welcome message" className="mt-4"><Input disabled={!owner} defaultValue={s.menu_message || ''} onBlur={(e) => e.target.value !== s.menu_message && saveSettings({ menu_message: e.target.value })} /></Field>
          <Field label="Menu link" className="mt-4">
            <div className="flex gap-2"><Input readOnly value={menuUrl(s.slug)} className="text-xs" /><Button variant="outline" icon={Copy} onClick={() => { navigator.clipboard?.writeText(menuUrl(s.slug)); toast('Link copied'); }} aria-label="Copy link" /></div>
          </Field>
          <p className="text-xs text-steel-500 mt-2">Share this link on WhatsApp, Instagram or Google Maps too.</p>
        </Card>

        <Card className="lg:col-span-2" title="Phone preview" sub="Roughly what guests see after scanning.">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative w-[230px] h-[440px] rounded-[34px] bg-ink p-2.5 shadow-lift shrink-0">
              <iframe title="Menu preview" src={menuUrl(s.slug, tables[0]?.id)} className="w-full h-full rounded-[26px] bg-white" />
            </motion.div>
            <div className="space-y-3 text-sm text-steel-600">
              <div className="flex gap-3"><Smartphone className="h-5 w-5 text-brand-500 shrink-0" /><p>Works on any phone camera. Guests don’t install anything or sign in.</p></div>
              <div className="flex gap-3"><QrCode className="h-5 w-5 text-brand-500 shrink-0" /><p>Each table has its own code, so the menu greets them with their table number.</p></div>
              <div className="flex gap-3"><Eye className="h-5 w-5 text-brand-500 shrink-0" /><p>Sold-out items show as unavailable automatically when stock runs out.</p></div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Table codes" sub="Print, cut and place in table stands. Each card is about 6 × 9 cm."
        action={areas.length > 2 && <Segmented size="sm" value={area} onChange={setArea} options={areas.map((a) => ({ value: a, label: a === 'all' ? 'All areas' : a }))} />}>
        <div id="print-sheet" className="flex flex-wrap gap-5">
          {[null, ...shown].map((t) => (
            <div key={t?.id || 'general'} className="group relative">
              <TableCard name={s.name} table={t} url={menuUrl(s.slug, t?.id)} />
              <button onClick={() => downloadPng(t)} className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/90 text-steel-700 grid place-items-center opacity-0 group-hover:opacity-100 transition print:hidden" title="Download QR as image" aria-label="Download QR image"><Download className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5" title="What’s on the menu" sub="Hide items you sell at the till but don’t want guests to see, like staff meals.">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {products.map((p) => (
            <button key={p.id} onClick={() => toggleProduct(p)} className={cx('flex items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 transition', p.on_menu ? 'ring-steel-200 bg-white' : 'ring-steel-200 bg-steel-50 opacity-60')}>
              <span className="text-xl">{p.emoji}</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{p.name}</span><span className="text-xs text-steel-500 num">{money(p.price)}</span></span>
              {p.on_menu ? <Badge tone="green"><Eye className="h-3 w-3" />Shown</Badge> : <Badge><EyeOff className="h-3 w-3" />Hidden</Badge>}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
