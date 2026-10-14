// Lead review battery: node scripts/review.mjs <slug> [stops=0,0.12,0.25,0.4,0.55,0.7,0.85,1]
// Desktop shots at each stop + a mobile hero, stitched into shots/review/<slug>.jpg, plus console errors and fps.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const slug = process.argv[2];
const stops = (process.argv[3] ?? '0,0.12,0.25,0.4,0.55,0.7,0.85,1').split(',').map(Number);
const url = `http://127.0.0.1:5190/examples/${slug}/`;
fs.mkdirSync(`shots/review/${slug}`, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errors = [];
async function run(opts, fn) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
  await p.goto(url, { waitUntil: 'load', timeout: 90000 });
  await p.mouse.move(opts.viewport.width * 0.58, opts.viewport.height * 0.42, { steps: 6 });
  await p.waitForTimeout(8000);
  const r = await fn(p);
  await ctx.close();
  return r;
}
const shots = [];
const fps = await run({ viewport: { width: 1440, height: 900 } }, async p => {
  let f = [];
  for (const [i, s] of stops.entries()) {
    await p.evaluate(v => { const y = v * (document.documentElement.scrollHeight - innerHeight); window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); }, s);
    await p.mouse.move(1440 * (0.4 + (i % 3) * 0.1), 900 * 0.45, { steps: 4 });
    await p.waitForTimeout(2200);
    const path = `shots/review/${slug}/d${i}.png`;
    await p.screenshot({ path }); shots.push(path);
    f.push(await p.evaluate(() => window.__fps ?? null));
  }
  return f;
});
await run({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async p => {
  const path = `shots/review/${slug}/m0.png`; await p.screenshot({ path }); shots.push(path);
  await p.evaluate(() => { const y = 0.35 * (document.documentElement.scrollHeight - innerHeight); window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y); });
  await p.waitForTimeout(2200);
  const p2 = `shots/review/${slug}/m1.png`; await p.screenshot({ path: p2 }); shots.push(p2);
});
await b.close();

// Sheet: desktop 2 columns at 720 wide, mobile pair appended as a row.
const cw = 720, ch = 450;
const desk = shots.filter(s => /\/d\d/.test(s)), mob = shots.filter(s => /\/m\d/.test(s));
const rows = Math.ceil(desk.length / 2);
const comps = [];
for (const [i, s] of desk.entries()) comps.push({ input: await sharp(s).resize(cw, ch).toBuffer(), left: (i % 2) * cw, top: Math.floor(i / 2) * ch });
const mh = 640, mw = Math.round(390 / 844 * mh);
for (const [i, s] of mob.entries()) comps.push({ input: await sharp(s).resize(mw, mh).toBuffer(), left: i * (mw + 10), top: rows * ch });
await sharp({ create: { width: cw * 2, height: rows * ch + mh, channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 80 }).toFile(`shots/review/${slug}.jpg`);
console.log(JSON.stringify({ slug, fps, errors: [...new Set(errors)].slice(0, 8) }));
