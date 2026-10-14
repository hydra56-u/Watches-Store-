// Headless GPU screenshots for QA.
//   node scripts/shot.mjs <url> <outPrefix> [--w 1440] [--h 900] [--wait 5000] [--scrolls 0,0.25,0.5,1] [--mouse 0.3,0.4] [--mobile]
// Writes <outPrefix>-<i>.png per scroll stop and prints console errors + a WebGL renderer string.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const mobile = flag('mobile');
const W = +opt('w', mobile ? 390 : 1440), H = +opt('h', mobile ? 844 : 900);
const wait = +opt('wait', 5000);
const scrolls = opt('scrolls', '0').split(',').map(Number);
const mouse = opt('mouse', null)?.split(',').map(Number);
const actions = opt('actions', null);
const click = opt('click', null)?.split(',').map(Number); // click at this NDC-ish (0..1) spot at every stop
const clickWait = +opt('clickwait', 2600); // JS snippet run after load, e.g. "window.__demo?.()"

fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`.slice(0, 300)); });
page.on('pageerror', e => errors.push('[pageerror] ' + String(e.message).slice(0, 300)));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
if (mouse) await page.mouse.move(mouse[0] * W, mouse[1] * H, { steps: 8 });
await page.waitForTimeout(wait);
if (actions) await page.evaluate(actions);
const info = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const ext = c?.getExtension('WEBGL_debug_renderer_info');
  return { gl: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'none', docH: document.documentElement.scrollHeight, fps: window.__fps ?? null };
});
let i = 0;
for (const s of scrolls) {
  if (s > 0 || scrolls.length > 1) {
    await page.evaluate(f => {
      const y = f * (document.documentElement.scrollHeight - innerHeight);
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    }, s);
    await page.waitForTimeout(+opt('settle', 1800));
  }
  if (mouse) await page.mouse.move(mouse[0] * W + 20, mouse[1] * H + 10, { steps: 4 });
  if (click) { await page.mouse.move(click[0] * W, click[1] * H, { steps: 6 }); await page.waitForTimeout(400); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(clickWait); }
  await page.screenshot({ path: `${out}-${i}.png` });
  i++;
}
const fps = await page.evaluate(() => window.__fps ?? null);
console.log(JSON.stringify({ ...info, fps, loadMs: Date.now() - t0 }));
if (errors.length) console.log(errors.slice(0, 15).join('\n'));
await browser.close();
