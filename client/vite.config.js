import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Writes the list of built files into the service worker so the whole app
// is cached on first visit and opens with no connection afterwards.
function precacheManifest() {
  let files = [];
  return {
    name: 'iwat-precache',
    generateBundle(_, bundle) { files = Object.keys(bundle).filter((f) => !f.endsWith('.map')); },
    writeBundle(opts) {
      const sw = path.join(opts.dir, 'sw.js');
      const version = Date.now().toString(36);
      const list = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', ...files.map((f) => '/' + f)];
      const src = fs.readFileSync(sw, 'utf8')
        .replace('self.__PRECACHE__', JSON.stringify([...new Set(list)]))
        .replace('__VERSION__', version);
      fs.writeFileSync(sw, src);
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: { chunkSizeWarningLimit: 1500 },
});
