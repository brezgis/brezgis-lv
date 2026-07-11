// Bake a 1935 forest mask from the Latvian Army 1:75k sheet
// (research/maps/topo75_1930s.png, georef in the .txt alongside).
// Classification: green fill = forest, cream = open, blue = water/marsh,
// dark = linework/text (excluded from voting). Output: 220x220 cells at 40m
// over the sim square (same u,v convention as sat2025.js), one byte per cell
// = green-vote fraction 0..255, plus a QA preview PNG.
import fs from 'fs';
import { PNG } from 'pngjs';

const png = PNG.sync.read(fs.readFileSync(new URL('../research/maps/topo75_1930s.png', import.meta.url)));
const LAT = 57.15944, LON = 25.66472;
const MLAT = 111360, MLON = 111320 * Math.cos((LAT * Math.PI) / 180);
const latN = 57.18390, lonW = 25.57617, latS = 57.08852, lonE = 25.75195;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const yN = merc(latN), yS = merc(latS);
const pxOf = (x, z) => {
  const lat = LAT - z / MLAT, lon = LON + x / MLON;
  return [((lon - lonW) / (lonE - lonW)) * png.width, ((yN - merc(lat)) / (yN - yS)) * png.height];
};

// per-pixel vote: 0 open, 1 forest, 2 wet, 3 invalid (linework/text/contour clutter)
function classify(px, py) {
  if (px < 0 || py < 0 || px >= png.width || py >= png.height) return 3;
  const i = ((py | 0) * png.width + (px | 0)) * 4;
  const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
  if ((r + g + b) / 3 < 140) return 3;              // black/brown linework, symbols, text
  if (b > 140 && b >= r * 0.98) return 2;           // lake blue / marsh hatch base
  if (g >= r + 6 && b < 160) return 1;              // the green forest fill
  if (r >= g + 8) return 0;                          // cream open land (contour tint tolerated)
  return 3;                                          // ambiguous (contour-dense cream ~ G≈R)
}

const N = 220, SPAN = 8800, OX = 500, OZ = 1700, CELL = SPAN / N;
const frac = new Float32Array(N * N);
const wet = new Uint8Array(N * N);
for (let cz = 0; cz < N; cz++) {
  for (let cx = 0; cx < N; cx++) {
    const wx = (cx + 0.5) / N * SPAN - SPAN / 2 + OX;
    const wz = (cz + 0.5) / N * SPAN - SPAN / 2 + OZ;
    const [pcx, pcy] = pxOf(wx, wz);
    let counts = [0, 0, 0, 0];
    const tally = (reach) => {
      counts = [0, 0, 0, 0];
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) counts[classify(pcx + dx, pcy + dy)]++;
    };
    tally(2);                                            // 5x5 ≈ the 40m cell
    if (counts[0] + counts[1] + counts[2] < 8) tally(4); // clutter: widen to 9x9
    const land = counts[0] + counts[1];
    const idx = cz * N + cx;
    if (counts[2] > land) { frac[idx] = 0; wet[idx] = 1; }
    else frac[idx] = land ? counts[1] / land : 0;
  }
}
// 3x3 median to knock out text blocks and road casings
const med = new Float32Array(N * N);
for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
  const vals = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const az = Math.min(N - 1, Math.max(0, cz + dz)), ax = Math.min(N - 1, Math.max(0, cx + dx));
    vals.push(frac[az * N + ax]);
  }
  vals.sort((a, b) => a - b);
  med[cz * N + cx] = vals[4];
}

const bytes = new Uint8Array(N * N);
let forestCells = 0;
for (let i = 0; i < N * N; i++) { bytes[i] = Math.round(med[i] * 255); if (med[i] > 0.5) forestCells++; }
console.log(`forest>0.5 share: ${(100 * forestCells / (N * N)).toFixed(1)}%  wet cells: ${(100 * wet.reduce((a, b) => a + b, 0) / (N * N)).toFixed(1)}%`);

// QA preview: green = forest fraction, blue = wet, upscaled 4x
const prev = new PNG({ width: N * 4, height: N * 4 });
for (let y = 0; y < N * 4; y++) for (let x = 0; x < N * 4; x++) {
  const i = ((y >> 2) * N + (x >> 2)), o = (y * N * 4 + x) * 4;
  prev.data[o] = 235 - bytes[i] * 0.55; prev.data[o + 1] = 225 - bytes[i] * 0.35; prev.data[o + 2] = wet[i] ? 255 : 170 - bytes[i] * 0.35; prev.data[o + 3] = 255;
}
fs.writeFileSync('/tmp/forest1935-preview.png', PNG.sync.write(prev));
console.log('preview: /tmp/forest1935-preview.png');

const b64 = Buffer.from(bytes).toString('base64');
const out = `// 1935 forest mask baked from the Latvian Army 1:75k sheet by data/bake-forest1935.mjs.
// ${N}x${N} cells (40m) over the sim square; byte = forest fraction 0..255 from
// green-fill voting with linework excluded and a 3x3 median cleanup.
export const F35_N = ${N};
const F35_B64 = "${b64}";
let _m = null;
export function forest1935At(x, z) {
  if (!_m) {
    const bin = atob(F35_B64);
    _m = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) _m[i] = bin.charCodeAt(i);
  }
  const u = ((x - ${OX}) / ${SPAN}) + 0.5, v = ((z - ${OZ}) / ${SPAN}) + 0.5;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
  return _m[Math.floor(v * ${N}) * ${N} + Math.floor(u * ${N})] / 255;
}
`;
fs.writeFileSync(new URL('../src/forest1935.js', import.meta.url), out);
console.log('wrote src/forest1935.js', (out.length / 1024).toFixed(0) + 'KB');
