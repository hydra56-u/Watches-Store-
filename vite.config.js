import { defineConfig } from 'vite';
import fs from 'node:fs';

const examples = fs.readdirSync('examples').filter(d => fs.existsSync(`examples/${d}/index.html`));

export default defineConfig({
  appType: 'mpa',
  // HMR off: many examples are edited in parallel; each save would otherwise reload every open tab.
  server: { host: '127.0.0.1', port: 5190, strictPort: true, hmr: false },
  preview: { host: '127.0.0.1', port: 5191 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: { index: 'index.html', ...Object.fromEntries(examples.map(p => [p, `examples/${p}/index.html`])) },
    },
  },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
