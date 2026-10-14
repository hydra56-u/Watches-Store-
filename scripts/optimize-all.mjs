// Optimise every finished raw mesh into public/models/<page>/<name>.glb (skips up-to-date outputs).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const PAGE = { reliq: 'reliquary', abyss: 'abyssal', ember: 'ember', terra: 'terrarium', koi: 'koi', flora: 'florae', velo: 'velocity',
  hangar: 'hangar', sucre: 'sucre', mono: 'monolith', lf: 'lowfreq', gambit: 'gambit', atlas: 'atlas', lithos: 'lithos', artemis: 'artemis',
  keeper: 'keeper', koen: 'koen', noct: 'nocturne', racer: 'racer', horo: 'horologie' };
const raw = fs.readdirSync('assets/raw').filter(f => f.endsWith('.glb') && !f.startsWith('pilot'));
const jobs = [];
for (const f of raw) {
  const id = f.replace('.glb', '');
  const [pre, ...rest] = id.split('-');
  const page = PAGE[pre]; if (!page) continue;
  const out = `public/models/${page}/${rest.join('-')}.glb`;
  const src = `assets/raw/${f}`;
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) continue;
  jobs.push([src, out]);
}
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < jobs.length) {
    const [src, out] = jobs[i++];
    try { const { stdout } = await run('node', ['scripts/optimize.mjs', src, out, ...process.argv.slice(2)]); console.log(stdout.trim().split('\n').pop()); }
    catch (e) { console.log('FAIL', src, e.message.slice(0, 200)); }
  }
}));
