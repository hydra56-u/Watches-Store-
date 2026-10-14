// Shared fal client. Reads FAL_KEY from the environment or a .env file in the project root.
import { config } from 'dotenv';
import { fal } from '@fal-ai/client';
import fs from 'node:fs';
import path from 'node:path';

config({ quiet: true });
if (!process.env.FAL_KEY) throw new Error('FAL_KEY missing: copy .env.example to .env and add your fal key');
fal.config({ credentials: process.env.FAL_KEY });

export { fal };

export const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST = path.join(ROOT, 'assets', 'manifest.json');

export function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return { images: {}, meshes: {} }; }
}
// Serialize manifest writes so concurrent jobs never clobber each other.
let chain = Promise.resolve();
export function updateManifest(fn) {
  chain = chain.then(() => {
    const m = readManifest();
    fn(m);
    fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  });
  return chain;
}

export async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

export async function uploadFile(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  return fal.storage.upload(new Blob([buf], { type }));
}
