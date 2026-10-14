// Quick hero spot-check of many pages in one browser: node scripts/spot.mjs slug,slug [scroll]
import { chromium } from 'playwright';
const slugs = process.argv[2].split(','); const sc = +(process.argv[3] ?? 0);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
for (const s of slugs) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  try {
    await p.goto(`${process.env.BASE ?? 'http://127.0.0.1:5190'}/examples/${s}/`, { waitUntil: 'load', timeout: 60000 });
    await p.mouse.move(830, 380, { steps: 5 }); await p.waitForTimeout(9000);
    if (sc) { await p.evaluate(v => { const y = v * (document.documentElement.scrollHeight - innerHeight); window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, sc); await p.waitForTimeout(2000); }
    await p.screenshot({ path: `shots/spot/${process.env.TAG ?? ''}${s}-${sc}.png` });
    console.log(s, 'ok', await p.evaluate(() => window.__fps), errs.join(' | '));
  } catch (e) { console.log(s, 'fail', e.message.slice(0, 100)); }
  await ctx.close();
}
await b.close();
