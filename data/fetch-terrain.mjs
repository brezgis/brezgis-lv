// Fetch real-world elevation for the Taurene–Brezgi country, Latvia, from the
// AWS Open Data terrain tiles (terrarium encoding), and bake a compact
// heightmap the Three.js scene can inline.
//
// Scene origin stays at TAURENE VILLAGE (57.15944 N, 25.66472 E); the DEM
// square is OFFSET south-east so it also covers the real Brezgis settlement,
// Brežģa krogs and Brežģa kalns (~6.4 km S of the village).
import { PNG } from 'pngjs';
import { writeFileSync } from 'fs';

const LAT0 = 57.15944, LON0 = 25.66472;   // village = scene origin
const OFF_X = 500, OFF_Z = 1700;          // DEM centre in scene metres
const SPAN_M = 8800;                      // DEM square size
const GRID = 320;                         // output grid (~27.5 m/cell)
const Z = 13;

const MLAT = 111360, MLON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const latC = LAT0 - OFF_Z / MLAT;
const lonC = LON0 + OFF_X / MLON;

const n = 2 ** Z;
const latRad = (latC * Math.PI) / 180;
const xf = ((lonC + 180) / 360) * n;
const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
const xt = Math.floor(xf), yt = Math.floor(yf);
const mpp = (156543.03392 * Math.cos(latRad)) / 2 ** Z;
console.log(`centre ${latC.toFixed(5)},${lonC.toFixed(5)} tile ${Z}/${xt}/${yt}, ~${mpp.toFixed(1)} m/px`);

async function fetchTile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

// mosaic 5x5 tiles around the centre tile (covers ~13 km)
const R = 2;
const tiles = {};
for (let dy = -R; dy <= R; dy++)
  for (let dx = -R; dx <= R; dx++)
    tiles[`${dx},${dy}`] = await fetchTile(xt + dx, yt + dy);
console.log('tiles fetched');

const T = 256;
function elevAtPixel(px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  const png = tiles[`${tx - R},${ty - R}`];
  const lx = px - tx * T, ly = py - ty * T;
  const i = (ly * T + lx) * 4;
  return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
}

const cx = (xf - (xt - R)) * T;
const cy = (yf - (yt - R)) * T;
const spanPx = SPAN_M / mpp;

const out = new Int16Array(GRID * GRID);
let min = Infinity, max = -Infinity;
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const u = gx / (GRID - 1) - 0.5, v = gy / (GRID - 1) - 0.5;
    const px = cx + u * spanPx, py = cy + v * spanPx;
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
  }
}
console.log(`elevation ${min.toFixed(1)}..${max.toFixed(1)} m`);

// sanity: Brežģa kalns should peak ~255 m in the SE quadrant
let peak = -1, at = null;
for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
  const x = (gx / (GRID - 1) - 0.5) * SPAN_M + OFF_X;
  const z = (gy / (GRID - 1) - 0.5) * SPAN_M + OFF_Z;
  if (z > 3600 && z < 6100 && x > 300 && x < 3400 && out[gy * GRID + gx] > peak) {
    peak = out[gy * GRID + gx];
    at = [x, z];
  }
}
console.log(`SE-quadrant peak (Brežģa kalns?): ${(peak / 10).toFixed(1)} m at scene (${at[0].toFixed(0)}, ${at[1].toFixed(0)})`);

const b64 = Buffer.from(out.buffer).toString('base64');
writeFileSync(new URL('../src/heightmap.js', import.meta.url), `// Real elevation, Taurene–Brezgi country, Latvia. ${SPAN_M / 1000} km square,
// ${GRID}x${GRID} grid, centre offset (${OFF_X}, ${OFF_Z}) from the village origin.
// Source: AWS Open Data terrain tiles (terrarium), z${Z}, fetched 2026-07-04.
export const HM_GRID = ${GRID};
export const HM_SPAN = ${SPAN_M};
export const HM_OFF_X = ${OFF_X};
export const HM_OFF_Z = ${OFF_Z};
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
`);
console.log('wrote src/heightmap.js');
