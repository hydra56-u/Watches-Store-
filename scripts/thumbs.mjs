// Capture each world's hero as the gallery thumbnail: node scripts/thumbs.mjs [slug,slug]
// A page can steer its own capture by defining window.__thumb = { mouse:[x,y], scroll: 0..1, wait: ms, js: 'code' } before load finishes.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const WORLDS = (await import('../src/core/worlds.js')).WORLDS;
const only = process.argv[2]?.split(',');
// Worlds whose best still is not the untouched hero.
const OVERRIDE = { hangar: { scroll: 0.12, wait: 4000 }, lithos: { scroll: 0.25, wait: 4500 } };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
fs.mkdirSync('shots/thumbs', { recursive: true });
for (const w of WORLDS) {
  if (only && !only.includes(w.slug)) continue;
  if (!fs.existsSync(`examples/${w.slug}/index.html`)) { console.log('missing', w.slug); continue; }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  try {
    await p.goto(`http://127.0.0.1:5190/examples/${w.slug}/`, { waitUntil: 'load', timeout: 90000 });
    await p.mouse.move(820, 400, { steps: 5 });
    await p.waitForTimeout(8000);
    const cfg = OVERRIDE[w.slug] ?? await p.evaluate(() => window.__thumb ?? null);
    if (cfg?.mouse) await p.mouse.move(cfg.mouse[0] * 1440, cfg.mouse[1] * 900, { steps: 10 });
    if (cfg?.scroll) await p.evaluate(f => { const y = f * (document.documentElement.scrollHeight - innerHeight); window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, cfg.scroll);
    if (cfg?.js) await p.evaluate(cfg.js);
    await p.waitForTimeout(cfg?.wait ?? 2500);
    await p.evaluate(() => document.querySelectorAll('.tw-nav,.tw-cursor').forEach(e => e.style.display = 'none'));
    const png = `shots/thumbs/${w.slug}.png`;
    await p.screenshot({ path: png });
    await sharp(png).resize(1280, 800).webp({ quality: 86 }).toFile(`public/img/index/${w.slug}.webp`);
    console.log('ok', w.slug);
  } catch (e) { console.log('fail', w.slug, e.message.slice(0, 120)); }
  await ctx.close();
}
await b.close();
