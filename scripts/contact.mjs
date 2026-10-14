// Contact sheet: node scripts/contact.mjs <outPrefix> <cols> <cell> file...
import sharp from 'sharp';
import path from 'node:path';
const [, , out, colsS, cellS, ...files] = process.argv;
const cols = +colsS, cell = +cellS, per = cols * Math.ceil(12 / cols);
const meta0 = await sharp(files[0]).metadata();
const cellH = Math.round(cell * meta0.height / meta0.width);
for (let s = 0; s * per < files.length; s++) {
  const chunk = files.slice(s * per, (s + 1) * per);
  const rows = Math.ceil(chunk.length / cols);
  const comps = [];
  for (let i = 0; i < chunk.length; i++) {
    const f = chunk[i];
    const img = await sharp(f).resize(cell, cellH, { fit: 'contain', background: '#ffffff' }).toBuffer();
    const x = (i % cols) * cell, y = Math.floor(i / cols) * (cellH + 22);
    comps.push({ input: img, left: x, top: y + 22 });
    const label = Buffer.from(`<svg width="${cell}" height="22"><rect width="100%" height="100%" fill="#111"/><text x="6" y="16" font-family="monospace" font-size="14" fill="#fff">${path.basename(f)}</text></svg>`);
    comps.push({ input: label, left: x, top: y });
  }
  await sharp({ create: { width: cols * cell, height: rows * (cellH + 22), channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 82 }).toFile(`${out}-${s}.jpg`);
  console.log(`${out}-${s}.jpg`);
}
