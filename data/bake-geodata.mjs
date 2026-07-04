// Bake scene hydrography from REAL data:
//  - river course + lake outlines: OpenStreetMap (data/osm-water.json, fetched 2026-07-04)
//  - water levels + lake bed: the real DEM (src/heightmap.js)
// Scene meters, origin = Taurene village center (57.15944N 25.66472E); x east, z south.
import { readFileSync, writeFileSync } from 'fs';

const LAT = 57.15944, LON = 25.66472;
const MLAT = 111360, MLON = 111320 * Math.cos((LAT * Math.PI) / 180);
const toScene = (lat, lon) => [(lon - LON) * MLON, -(lat - LAT) * MLAT];

const src = readFileSync(new URL('../src/heightmap.js', import.meta.url), 'utf8');
const b64 = src.match(/HM_B64 = "([^"]+)"/)[1];
const buf = Buffer.from(b64, 'base64');
const dm = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
const G = 192, SPAN = 4800, CELL = SPAN / (G - 1);
const elevAt = (x, z) => {
  const gx = Math.max(0, Math.min(G - 1, Math.round(((x / SPAN) + 0.5) * (G - 1))));
  const gy = Math.max(0, Math.min(G - 1, Math.round(((z / SPAN) + 0.5) * (G - 1))));
  return dm[gy * G + gx] / 10;
};
const valleyElev = (x, z) => {
  // min elevation within ~2 cells: the river hugs the lowest ground nearby
  let m = Infinity;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    m = Math.min(m, elevAt(x + dx * CELL, z + dz * CELL));
  return m;
};

const osm = JSON.parse(readFileSync(new URL('./osm-water.json', import.meta.url), 'utf8'));

// ---- the Gauja: join the two river ways, orient downstream (S -> NE) ------
const ways = osm.filter((e) => e.kind === 'waterway:river' && e.name === 'Gauja')
  .map((e) => e.geom.map((p) => toScene(p.lat, p.lon)));
// join: order ways so endpoints chain
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
let chain = ways[0];
for (let k = 1; k < ways.length; k++) {
  const w = ways[k];
  const d1 = dist(chain[chain.length - 1], w[0]);
  const d2 = dist(chain[chain.length - 1], w[w.length - 1]);
  const d3 = dist(chain[0], w[w.length - 1]);
  const d4 = dist(chain[0], w[0]);
  const m = Math.min(d1, d2, d3, d4);
  if (m === d1) chain = chain.concat(w);
  else if (m === d2) chain = chain.concat(w.slice().reverse());
  else if (m === d3) chain = w.concat(chain);
  else chain = w.slice().reverse().concat(chain);
}
// clip to scene bounds (keep a margin so the river runs off the edge)
const B = 2500;
chain = chain.filter(([x, z]) => Math.abs(x) < B && Math.abs(z) < B);
// orient downstream: upstream (south entry) first. The Gauja flows S -> NE here.
if (chain[0][1] < chain[chain.length - 1][1]) chain.reverse(); // start = max z (south)
// resample every ~30 m
function resample(pts, step) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    acc += d;
    if (acc >= step) { out.push(pts[i]); acc = 0; }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const rpts = resample(chain, 32);
// water levels: valley-floor DEM, smoothed, forced monotonic downstream
let levels = rpts.map(([x, z]) => valleyElev(x, z));
for (let pass = 0; pass < 6; pass++)
  for (let i = 1; i < levels.length - 1; i++)
    levels[i] = (levels[i - 1] + levels[i] * 2 + levels[i + 1]) / 4;
let lvl = Infinity;
levels = levels.map((e) => (lvl = Math.min(lvl, e - 0.35)));
const RIVER_PTS = rpts.map(([x, z], i) => [Math.round(x), Math.round(z), Math.round(levels[i] * 10) / 10]);
console.log(`Gauja: ${RIVER_PTS.length} pts, ${levels[0].toFixed(1)}m (S) -> ${levels[levels.length - 1].toFixed(1)}m (NE)`);

// ---- streams ----------------------------------------------------------------
const STREAMS = [];
for (const e of osm) {
  if (!e.kind.includes('stream') || !e.geom) continue;
  let pts = e.geom.map((p) => toScene(p.lat, p.lon)).filter(([x, z]) => Math.abs(x) < B && Math.abs(z) < B);
  if (pts.length < 4) continue;
  pts = resample(pts, 26);
  // orient downstream: descending DEM
  if (valleyElev(...pts[0]) < valleyElev(...pts[pts.length - 1])) pts.reverse();
  let sl = Infinity;
  const withY = pts.map(([x, z]) => {
    sl = Math.min(sl, valleyElev(x, z) - 0.15);
    return [Math.round(x), Math.round(z), Math.round(sl * 10) / 10];
  });
  STREAMS.push({ name: e.name === 'stream' ? '' : e.name, pts: withY });
  console.log(`stream "${e.name}": ${withY.length} pts`);
}

// ---- lakes: named water polygons in-scene ------------------------------------
const LAKES = [];
for (const e of osm) {
  if (e.kind !== 'water' || !e.geom || e.geom.length < 12) continue;
  const poly = e.geom.map((p) => toScene(p.lat, p.lon));
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  if (Math.abs(cx) > 2300 || Math.abs(cz) > 2300) continue;
  if (e.name === 'water') continue; // unnamed farm ponds: mostly modern, skip
  // level: low shoreline percentile
  const shore = poly.map(([x, z]) => elevAt(x, z)).sort((a, b) => a - b);
  const level = shore[Math.floor(shore.length * 0.2)] + 0.4;
  LAKES.push({ name: e.name, level: Math.round(level * 10) / 10, poly: poly.map(([x, z]) => [Math.round(x), Math.round(z)]) });
  console.log(`lake "${e.name}" level ${level.toFixed(1)}m, ${poly.length} pts, centroid (${cx.toFixed(0)}, ${cz.toFixed(0)})`);
}

writeFileSync(new URL('../src/geodata.js', import.meta.url), `// Baked from OpenStreetMap water geometry + the real Taurene DEM
// (see data/bake-geodata.mjs). Scene meters, y = m ASL. River pts ordered downstream.
export const RIVER_PTS = ${JSON.stringify(RIVER_PTS)};
export const STREAMS = ${JSON.stringify(STREAMS)};
export const LAKES = ${JSON.stringify(LAKES)};
export const CELL = ${CELL};
`);
console.log('wrote src/geodata.js');
