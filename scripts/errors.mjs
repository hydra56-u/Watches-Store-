// Print full console errors for a page: node scripts/errors.mjs <url> [waitMs]
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 3000)); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(process.argv[2], { waitUntil: 'load' });
await p.waitForTimeout(+(process.argv[3] ?? 4000));
await b.close();
