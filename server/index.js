import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate, pool } from './db.js';
import { seedIfEmpty, seedV2 } from './seed.js';
import authRoutes from './routes/auth.js';
import posRoutes from './routes/pos.js';
import adminRoutes from './routes/admin.js';
import superRoutes from './routes/super.js';
import opsRoutes from './routes/ops.js';
import publicRoutes from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'up', time: new Date().toISOString() }); }
  catch { res.status(503).json({ ok: false, db: 'down' }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super', superRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

// Serve the built web app. The service worker must never be cached by the browser.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'sw.js')); });
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false }));
  app.get('*', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something failed on the server. Try again in a moment.' });
});

const port = process.env.PORT || 3000;
(async () => {
  for (let attempt = 1; ; attempt++) {
    try { await migrate(); break; }
    catch (e) {
      if (attempt >= 10) throw e;
      console.log(`Database not ready (${e.message}). Retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  if (process.env.SEED_DEMO !== 'false') { await seedIfEmpty(); await seedV2(); }
  app.listen(port, () => console.log(`IWAT POS running on :${port}`));
})();
