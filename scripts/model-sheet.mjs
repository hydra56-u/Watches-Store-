// Render every optimised model in the viewer (one browser) -> shots/models/<page>-<name>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
const files = [];
for (const d of fs.readdirSync('public/models')) for (const f of fs.readdirSync(`public/models/${d}`)) if (f.endsWith('.glb') && !f.includes('-lo')) files.push(`models/${d}/${f}`);
const only = process.argv[2];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 900, height: 900 } });
fs.mkdirSync('shots/models', { recursive: true });
for (const f of files) {
  const out = `shots/models/${f.split('/').slice(1).join('-').replace('.glb', '')}.png`;
  if (only ? !f.includes(only) : fs.existsSync(out)) continue;
  await p.goto(`http://127.0.0.1:5190/examples/_viewer/?m=${f}&rot=-25&d=4.4&h=1.6&env=1.3`, { waitUntil: 'load' });
  await p.waitForFunction(() => document.getElementById('i').textContent.length > 0, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out });
  console.log(out);
}
await b.close();
