// Bake scene hydrography + landmarks from REAL data:
//  - river/stream courses + lake outlines: OpenStreetMap (data/osm-water.json)
//  - water levels, lake beds, Brežģa kalns summit: the real DEM (src/heightmap.js)
// Scene metres, origin = Taurene village centre (57.15944N 25.66472E); x east, z south.
import { readFileSync, writeFileSync } from 'fs';

const LAT = 57.15944, LON = 25.66472;
const MLAT = 111360, MLON = 111320 * Math.cos((LAT * Math.PI) / 180);
const toScene = (lat, lon) => [(lon - LON) * MLON, -(lat - LAT) * MLAT];

const src = readFileSync(new URL('../src/heightmap.js', import.meta.url), 'utf8');
const num = (k) => +src.match(new RegExp(`${k} = (-?\\d+)`))[1];
const G = num('HM_GRID'), SPAN = num('HM_SPAN'), OX = num('HM_OFF_X'), OZ = num('HM_OFF_Z');
const b64 = src.match(/HM_B64 = "([^"]+)"/)[1];
const buf = Buffer.from(b64, 'base64');
const dm = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
const CELL = SPAN / (G - 1);
const elevAt = (x, z) => {
  const gx = Math.max(0, Math.min(G - 1, Math.round((((x - OX) / SPAN) + 0.5) * (G - 1))));
  const gy = Math.max(0, Math.min(G - 1, Math.round((((z - OZ) / SPAN) + 0.5) * (G - 1))));
  return dm[gy * G + gx] / 10;
};
const valleyElev = (x, z) => {
  let m = Infinity;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    m = Math.min(m, elevAt(x + dx * CELL, z + dz * CELL));
  return m;
};
const XMIN = OX - SPAN / 2, XMAX = OX + SPAN / 2, ZMIN = OZ - SPAN / 2, ZMAX = OZ + SPAN / 2;
const inRect = ([x, z]) => x > XMIN && x < XMAX && z > ZMIN && z < ZMAX;

const osm = JSON.parse(readFileSync(new URL('./osm-water.json', import.meta.url), 'utf8'));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- the Gauja: greedy nearest-endpoint chaining of all segments -----------
const segs = osm.filter((e) => e.kind === 'waterway:river' && e.name === 'Gauja' && e.n > 3)
  .map((e) => e.geom.map((p) => toScene(p.lat, p.lon)));
let chain = segs.shift();
while (segs.length) {
  let best = -1, bestD = Infinity, mode = 0;
  for (let i = 0; i < segs.length; i++) {
    const w = segs[i];
    const cands = [
      [dist(chain[chain.length - 1], w[0]), 1],
      [dist(chain[chain.length - 1], w[w.length - 1]), 2],
      [dist(chain[0], w[w.length - 1]), 3],
      [dist(chain[0], w[0]), 4],
    ];
    for (const [d, m] of cands) if (d < bestD) { bestD = d; best = i; mode = m; }
  }
  const w = segs.splice(best, 1)[0];
  if (mode === 1) chain = chain.concat(w);
  else if (mode === 2) chain = chain.concat(w.slice().reverse());
  else if (mode === 3) chain = w.concat(chain);
  else chain = w.slice().reverse().concat(chain);
}
chain = chain.filter(inRect);
if (chain[0][1] < chain[chain.length - 1][1]) chain.reverse(); // upstream (south) first

function resample(pts, step) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += dist(pts[i - 1], pts[i]);
    if (acc >= step) { out.push(pts[i]); acc = 0; }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const rpts = resample(chain, 34);
let levels = rpts.map(([x, z]) => valleyElev(x, z));
for (let pass = 0; pass < 6; pass++)
  for (let i = 1; i < levels.length - 1; i++)
    levels[i] = (levels[i - 1] + levels[i] * 2 + levels[i + 1]) / 4;
let lvl = Infinity;
levels = levels.map((e) => (lvl = Math.min(lvl, e - 0.35)));
const RIVER_PTS = rpts.map(([x, z], i) => [Math.round(x), Math.round(z), Math.round(levels[i] * 10) / 10]);
console.log(`Gauja: ${RIVER_PTS.length} pts, ${levels[0].toFixed(1)}m (S) -> ${levels[levels.length - 1].toFixed(1)}m (NE)`);

// ---- streams (incl. Gaujiņa, Pīsla, Dzērbe) --------------------------------
const STREAMS = [];
const streamGroups = {};
for (const e of osm) {
  if (!e.kind.includes('stream') && !(e.kind.includes('river') && e.name !== 'Gauja')) continue;
  if (!e.geom || e.n < 4) continue;
  (streamGroups[e.name] ||= []).push(e.geom.map((p) => toScene(p.lat, p.lon)));
}
for (const [name, group] of Object.entries(streamGroups)) {
  for (const seg of group) {
    let pts = seg.filter(inRect);
    if (pts.length < 5) continue;
    pts = resample(pts, 28);
    if (valleyElev(...pts[0]) < valleyElev(...pts[pts.length - 1])) pts.reverse();
    let sl = Infinity;
    const withY = pts.map(([x, z]) => {
      sl = Math.min(sl, valleyElev(x, z) - 0.15);
      return [Math.round(x), Math.round(z), Math.round(sl * 10) / 10];
    });
    const displayName = name === 'stream' || name === 'river' ? '' : name;
    if (!displayName && withY.length < 20) continue; // skip tiny nameless ditches
    STREAMS.push({ name: displayName, pts: withY });
  }
}
console.log(`streams: ${STREAMS.map((s) => s.name || '(unnamed)').join(', ')}`);

// ---- lakes ------------------------------------------------------------------
const LAKES = [];
function addLakePoly(name, poly) {
  const shore = poly.map(([x, z]) => elevAt(x, z)).sort((a, b) => a - b);
  const level = shore[Math.floor(shore.length * 0.2)] + 0.4;
  LAKES.push({ name, level: Math.round(level * 10) / 10, poly: poly.map(([x, z]) => [Math.round(x), Math.round(z)]) });
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  console.log(`lake "${name}" level ${level.toFixed(1)}m, ${poly.length} pts, centroid (${cx.toFixed(0)}, ${cz.toFixed(0)})`);
}
for (const e of osm) {
  if (e.kind !== 'water' || !e.geom || e.geom.length < 12) continue;
  if (e.name === 'water') continue;
  const poly = e.geom.map((p) => toScene(p.lat, p.lon));
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  if (!inRect([cx, cz])) { console.log(`(skip ${e.name}: outside)`); continue; }
  addLakePoly(e.name, poly);
}
// Dabaru ezers: try an unnamed OSM polygon near its true coordinates, else DEM flood
{
  const TRUE = [-737, 862];
  let found = null;
  for (const e of osm) {
    if (e.kind !== 'water' || e.name !== 'water' || !e.geom || e.geom.length < 16) continue;
    const poly = e.geom.map((p) => toScene(p.lat, p.lon));
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    if (Math.hypot(cx - TRUE[0], cz - TRUE[1]) < 450) { found = poly; break; }
  }
  if (found) {
    addLakePoly('Dabaru ezers', found);
  } else {
    const LEVEL = 185.45;
    const seen = new Set(), cells = [], stack = [TRUE];
    while (stack.length) {
      const [x, z] = stack.pop();
      const key = `${Math.round(x / CELL)},${Math.round(z / CELL)}`;
      if (seen.has(key) || Math.abs(x - TRUE[0]) > 320 || Math.abs(z - TRUE[1]) > 330 || elevAt(x, z) > LEVEL + 0.35) continue;
      seen.add(key);
      cells.push([x, z]);
      stack.push([x + CELL, z], [x - CELL, z], [x, z + CELL], [x, z - CELL]);
    }
    const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
    const cz = cells.reduce((s, c) => s + c[1], 0) / cells.length;
    const byAngle = cells.map(([x, z]) => ({ a: Math.atan2(z - cz, x - cx), r: Math.hypot(x - cx, z - cz), x, z })).sort((p, q) => p.a - q.a);
    const poly = [];
    const BINS = 26;
    for (let b = 0; b < BINS; b++) {
      const lo = -Math.PI + (b / BINS) * 2 * Math.PI, hi = lo + (2 * Math.PI) / BINS;
      let best = null;
      for (const p of byAngle) if (p.a >= lo && p.a < hi && (!best || p.r > best.r)) best = p;
      if (best) poly.push([Math.round(best.x), Math.round(best.z)]);
    }
    LAKES.push({ name: 'Dabaru ezers', level: LEVEL - 0.55, poly });
    console.log(`lake "Dabaru ezers" (DEM-derived) ${cells.length} cells`);
  }
}

// ---- Brežģa kalns summit -----------------------------------------------------
let peak = -Infinity, at = [0, 0];
for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
  const x = (gx / (G - 1) - 0.5) * SPAN + OX;
  const z = (gy / (G - 1) - 0.5) * SPAN + OZ;
  if (z > 3600 && z < 6100 && x > 300 && x < 3400 && dm[gy * G + gx] / 10 > peak) {
    peak = dm[gy * G + gx] / 10;
    at = [Math.round(x), Math.round(z)];
  }
}
const BREZGA = { x: at[0], z: at[1], y: Math.round(peak * 10) / 10 };
console.log(`Brežģa kalns summit: ${BREZGA.y}m at (${BREZGA.x}, ${BREZGA.z})`);

writeFileSync(new URL('../src/geodata.js', import.meta.url), `// Baked from OpenStreetMap water geometry + the real DEM
// (see data/bake-geodata.mjs). Scene metres, y = m ASL. River pts ordered downstream.
export const RIVER_PTS = ${JSON.stringify(RIVER_PTS)};
export const STREAMS = ${JSON.stringify(STREAMS)};
export const LAKES = ${JSON.stringify(LAKES)};
export const BREZGA = ${JSON.stringify(BREZGA)};
export const CELL = ${CELL};
`);
console.log('wrote src/geodata.js');
