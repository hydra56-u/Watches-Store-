import { fal, readManifest, download } from './fal.mjs';
const id = process.argv[2];
const m = readManifest().meshes[id];
const r = await fal.queue.result(m.endpoint, { requestId: m.request_id });
const d = r.data;
const out = {};
for (const k of ['rigged_character_glb', 'animation_glb']) if (d[k]?.url) { await download(d[k].url, `assets/raw/${id}.${k}.glb`); out[k] = d[k].file_size; }
if (d.basic_animations) {
  console.log('basic_animations keys', Object.keys(d.basic_animations));
  for (const [k, v] of Object.entries(d.basic_animations)) if (v?.url && /glb/i.test(k + v.url)) { await download(v.url, `assets/raw/${id}.${k}.glb`); out[k] = v.file_size; }
}
console.log(out);
