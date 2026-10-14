// Compress a Meshy GLB for the web: weld, optional simplify, meshopt geometry, WebP textures.
//   node scripts/optimize.mjs <in.glb> <out.glb> [--ratio 0.5] [--tex 2048] [--q 88]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, meshopt, textureCompress, prune, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [, , input, output, ...rest] = process.argv;
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const ratio = +opt('ratio', 1);
const tex = +opt('tex', 2048);
const q = +opt('q', 88);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const ops = [dedup(), weld()];
if (ratio < 1) ops.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008, lockBorder: false }));
ops.push(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: q }),
  prune(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 14 }),
);
await doc.transform(...ops);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
fs.mkdirSync(path.dirname(output), { recursive: true });
await io.write(output, doc);
const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
console.log(`${path.basename(output)}: ${(fs.statSync(input).size / 1e6).toFixed(1)}MB -> ${(fs.statSync(output).size / 1e6).toFixed(2)}MB, ${Math.round(tris)} tris`);
