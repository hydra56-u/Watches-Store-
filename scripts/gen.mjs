// Asset generation pipeline: Nano Banana 2 (clean reference images) -> Meshy 7.1 (image to 3D).
//
//   node scripts/gen.mjs images assets/jobs/foo.json [--force id,id]
//   node scripts/gen.mjs meshes assets/jobs/foo.json [--force id,id]
//   node scripts/gen.mjs all    assets/jobs/foo.json
//
// Every request id is written to assets/manifest.json before polling, so a crashed run resumes
// instead of paying for the same model twice.
import fs from 'node:fs';
import path from 'node:path';
import { fal, ROOT, readManifest, updateManifest, download, uploadFile } from './fal.mjs';

const NB2 = 'fal-ai/nano-banana-2';
const NB2_EDIT = 'fal-ai/nano-banana-2/edit';
const MESHY = 'meshy/v7.1/image-to-3d';
const MESHY_MULTI = 'meshy/v7.1/multi-image-to-3d';

const [, , mode, jobFile, ...rest] = process.argv;
const forceIdx = rest.indexOf('--force');
const force = new Set(forceIdx >= 0 ? rest[forceIdx + 1].split(',') : []);
const onlyIdx = rest.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(rest[onlyIdx + 1].split(',')) : null;
const jobs = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { log('FAIL', items[idx].id, e.message, JSON.stringify(e.body ?? '').slice(0, 400)); }
    }
  }));
  return out;
}

const STYLE_SUFFIX = ' Single isolated object, centered, full object visible with generous margin, three-quarter view from slightly above, ' +
  'plain pure white seamless studio background, soft even diffuse lighting, no cast shadows on background, no text, no watermark, ' +
  'ultra detailed, sharp focus, product-render clarity, physically plausible materials.';

async function genImage(job) {
  const m = readManifest();
  const dest = path.join(ROOT, 'assets', 'src', `${job.id}.png`);
  if (m.images[job.id] && fs.existsSync(dest) && !force.has(job.id)) { log('skip image', job.id); return; }
  const prompt = job.raw ? job.prompt : job.prompt + STYLE_SUFFIX;
  const input = {
    prompt,
    aspect_ratio: job.aspect_ratio ?? '1:1',
    resolution: job.resolution ?? '2K',
    output_format: 'png',
    num_images: 1,
    safety_tolerance: '5',
  };
  if (job.thinking) input.thinking_level = job.thinking;
  let endpoint = NB2;
  if (job.edit_from) {
    endpoint = NB2_EDIT;
    input.image_urls = job.edit_from.map(id => readManifest().images[id].url);
  }
  log('image ->', job.id);
  const r = await fal.subscribe(endpoint, { input });
  const url = r.data.images[0].url;
  await download(url, dest);
  await updateManifest(mm => { mm.images[job.id] = { url, prompt: job.prompt, endpoint, at: new Date().toISOString() }; });
  log('image OK', job.id);
}

async function genMesh(job) {
  const dest = path.join(ROOT, 'assets', 'raw', `${job.id}.glb`);
  let m = readManifest();
  if (fs.existsSync(dest) && !force.has(job.id)) { log('skip mesh', job.id); return; }
  const entry = m.meshes[job.id];
  const multi = Array.isArray(job.images) && job.images.length > 1;
  const endpoint = multi ? MESHY_MULTI : MESHY;
  let requestId = entry?.request_id && !force.has(job.id) && entry.status !== 'failed' ? entry.request_id : null;

  if (!requestId) {
    const imgIds = multi ? job.images : [job.image ?? job.id];
    const urls = [];
    for (const id of imgIds) {
      const local = path.join(ROOT, 'assets', 'src', `${id}.png`);
      // Prefer a locally edited reference (e.g. background-cleaned) when it has been re-saved.
      const known = readManifest().images[id]?.url;
      urls.push(job.upload || !known ? await uploadFile(local) : known);
    }
    const input = {
      topology: 'triangle',
      target_polycount: job.polycount ?? 150000,
      symmetry_mode: job.symmetry ?? 'auto',
      should_remesh: job.remesh ?? true,
      should_texture: true,
      enable_pbr: job.pbr ?? true,
      enable_safety_checker: false,
      ...(job.opts ?? {}),
    };
    if (!multi) { input.geometry_resolution = job.geometry ?? '4k'; input.model_type = job.model_type ?? 'standard'; }
    if (multi) input.image_urls = urls; else input.image_url = urls[0];
    if (job.texture_prompt) input.texture_prompt = job.texture_prompt;
    const sub = await fal.queue.submit(endpoint, { input });
    requestId = sub.request_id;
    await updateManifest(mm => { mm.meshes[job.id] = { request_id: requestId, endpoint, input, status: 'queued', at: new Date().toISOString() }; });
    log('mesh submitted', job.id, requestId);
  }

  const t0 = Date.now();
  for (;;) {
    const st = await fal.queue.status(endpoint, { requestId, logs: false });
    if (st.status === 'COMPLETED') break;
    if (Date.now() - t0 > 40 * 60e3) throw new Error('timeout');
    await new Promise(r => setTimeout(r, 10000));
  }
  let res;
  try {
    res = await fal.queue.result(endpoint, { requestId });
  } catch (e) {
    await updateManifest(mm => { mm.meshes[job.id].status = 'failed'; mm.meshes[job.id].error = String(e.message); });
    throw e;
  }
  const d = res.data;
  await download(d.model_glb.url, dest);
  if (d.thumbnail?.url) await download(d.thumbnail.url, path.join(ROOT, 'assets', 'raw', `${job.id}.thumb.png`));
  await updateManifest(mm => { Object.assign(mm.meshes[job.id], { status: 'done', glb: d.model_glb.url, size: d.model_glb.file_size, done: new Date().toISOString() }); });
  log('mesh OK', job.id, `${(d.model_glb.file_size / 1e6).toFixed(1)}MB`, `${((Date.now() - t0) / 60e3).toFixed(1)}min`);
}

const filt = arr => (arr ?? []).filter(j => !only || only.has(j.id));
if (mode === 'images' || mode === 'all') await pool(filt(jobs.images), 6, genImage);
if (mode === 'meshes' || mode === 'all') await pool(filt(jobs.meshes), 20, genMesh);
log('done');
