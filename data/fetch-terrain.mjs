// Fetch real-world elevation for Taurene, Latvia (57.15944 N, 25.66472 E)
// from the AWS Open Data terrain tiles (terrarium encoding), and bake a
// compact heightmap the Three.js scene can inline.
import { PNG } from 'pngjs';
import { writeFileSync } from 'fs';

const LAT = 57.15944, LON = 25.66472;
const Z = 13;                 // ~10 m/px at this latitude (source: SRTM/EU-DEM ~25-30 m)
const GRID = 192;             // output grid (192x192)
const SPAN_M = 4800;          // scene covers 4.8 km x 4.8 km centered on the village

const n = 2 ** Z;
const latRad = (LAT * Math.PI) / 180;
const xf = ((LON + 180) / 360) * n;
const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
const xt = Math.floor(xf), yt = Math.floor(yf);

// meters per pixel at this latitude/zoom
const mpp = (156543.03392 * Math.cos(latRad)) / 2 ** Z;
console.log(`center tile ${Z}/${xt}/${yt}, ~${mpp.toFixed(1)} m/px`);

async function fetchTile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return PNG.sync.read(buf);
}

// Mosaic 3x3 tiles around the center tile
const tiles = {};
for (let dy = -1; dy <= 1; dy++)
  for (let dx = -1; dx <= 1; dx++)
    tiles[`${dx},${dy}`] = await fetchTile(xt + dx, yt + dy);

const T = 256; // tile size px
function elevAtPixel(px, py) {
  // global pixel coords within the 3x3 mosaic, origin at top-left of tile (xt-1, yt-1)
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  const png = tiles[`${tx - 1},${ty - 1}`];
  const lx = px - tx * T, ly = py - ty * T;
  const i = (ly * T + lx) * 4;
  const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
  return r * 256 + g + b / 256 - 32768;
}

// Center of the mosaic in mosaic-pixel coords
const cx = (xf - (xt - 1)) * T;
const cy = (yf - (yt - 1)) * T;
const spanPx = SPAN_M / mpp;

const out = new Int16Array(GRID * GRID); // decimeters
let min = Infinity, max = -Infinity, centerElev = 0;
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const u = gx / (GRID - 1) - 0.5, v = gy / (GRID - 1) - 0.5;
    const px = cx + u * spanPx, py = cy + v * spanPx;
    // bilinear sample
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const fx = px - x0, fy = py - y0;
    const e =
      elevAtPixel(x0, y0) * (1 - fx) * (1 - fy) +
      elevAtPixel(x0 + 1, y0) * fx * (1 - fy) +
      elevAtPixel(x0, y0 + 1) * (1 - fx) * fy +
      elevAtPixel(x0 + 1, y0 + 1) * fx * fy;
    out[gy * GRID + gx] = Math.round(e * 10);
    if (e < min) min = e;
    if (e > max) max = e;
    if (gx === GRID >> 1 && gy === GRID >> 1) centerElev = e;
  }
}
console.log(`elevation range ${min.toFixed(1)}..${max.toFixed(1)} m, center ${centerElev.toFixed(1)} m`);

const b64 = Buffer.from(out.buffer).toString('base64');
const js = `// Real elevation of Taurene, Latvia (57.15944N 25.66472E), 4.8x4.8 km, 192x192 grid.
// Source: AWS Open Data terrain tiles (Mapzen terrarium, SRTM/EU-DEM derived), z13, fetched 2026-07-04.
// Int16 decimeters, row-major, north at row 0.
export const HM_GRID = ${GRID};
export const HM_SPAN = ${SPAN_M};
export const HM_MIN = ${min.toFixed(1)};
export const HM_MAX = ${max.toFixed(1)};
export const HM_B64 = "${b64}";
export function decodeHeightmap() {
  const bin = atob(HM_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dm = new Int16Array(bytes.buffer);
  const m = new Float32Array(dm.length);
  for (let i = 0; i < dm.length; i++) m[i] = dm[i] / 10;
  return m;
}
`;
writeFileSync(new URL('../src/heightmap.js', import.meta.url), js);
console.log('wrote src/heightmap.js', (js.length / 1024).toFixed(0) + 'KB');
