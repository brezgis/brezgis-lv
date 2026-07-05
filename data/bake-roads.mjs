// Bake the real road network, building footprints and farmstead sites from
// OpenStreetMap (data/osm-roads.json, © OpenStreetMap contributors, ODbL)
// into src/geodata-osm.js. Latvian viensēta names persist for centuries, so
// today's isolated-dwelling points double as the historical settlement
// pattern for the 1860/1935 eras.
// Scene metres, origin = Taurene village centre; x east, z south.
import { readFileSync, writeFileSync } from 'fs';

const LAT = 57.15944, LON = 25.66472;
const MLAT = 111360, MLON = 111320 * Math.cos((LAT * Math.PI) / 180);
const toScene = (lat, lon) => [(lon - LON) * MLON, -(lat - LAT) * MLAT];
// clip to the REAL heightmap tile — it is offset (OX 500, OZ 1700) to
// include Brežģa kalns; an origin-centred rect silently dropped the whole
// southern strip with the Brežģi family farm cluster
const hm = readFileSync(new URL('../src/heightmap.js', import.meta.url), 'utf8');
const hnum = (k) => +hm.match(new RegExp(`${k} = (-?\\d+)`))[1];
const OX = hnum('HM_OFF_X'), OZ = hnum('HM_OFF_Z'), HSPAN = hnum('HM_SPAN');
const M = 60;
const inRect = ([x, z]) =>
  x > OX - HSPAN / 2 + M && x < OX + HSPAN / 2 - M &&
  z > OZ - HSPAN / 2 + M && z < OZ + HSPAN / 2 - M;

const osm = JSON.parse(readFileSync(new URL('./osm-roads.json', import.meta.url), 'utf8'));
const els = osm.elements || [];

// ---- roads: class 0 = regional highway, 1 = V-road, 2 = local, 3 = track --
const CLS = {
  trunk: 0, primary: 0, secondary: 1, tertiary: 1,
  unclassified: 2, residential: 2, living_street: 2, track: 3,
};
function simplify(pts, tol) {
  // radial-distance simplification is plenty for paint-width roads
  const out = [pts[0]];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > tol) out.push(p);
  }
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}
const roads = [];
for (const e of els) {
  if (e.type !== 'way' || !e.tags || !e.tags.highway) continue;
  const cls = CLS[e.tags.highway];
  if (cls === undefined) continue;
  let pts = e.geometry.map((p) => toScene(p.lat, p.lon));
  // clip to rect by splitting runs of inside points
  let run = [];
  const runs = [];
  for (const p of pts) {
    if (inRect(p)) run.push(p);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  for (const r of runs) {
    if (r.length < 2) continue;
    const s = simplify(r, cls <= 1 ? 12 : 18).map(([x, z]) => [Math.round(x), Math.round(z)]);
    if (s.length >= 2) roads.push({ c: cls, ref: e.tags.ref || null, pts: s });
  }
}

// ---- buildings: oriented-rectangle fit of each footprint -------------------
const buildings = [];
for (const e of els) {
  if (e.type !== 'way' || !e.tags || !e.tags.building) continue;
  const pts = e.geometry.map((p) => toScene(p.lat, p.lon));
  if (!pts.every(inRect)) continue;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  // dominant edge angle (longest edge, folded to [0, PI/2))
  let ang = 0, bestL = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    const l = dx * dx + dz * dz;
    if (l > bestL) { bestL = l; ang = Math.atan2(dz, dx); }
  }
  const ca = Math.cos(-ang), sa = Math.sin(-ang);
  let minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
  for (const [x, z] of pts) {
    const u = (x - cx) * ca - (z - cz) * sa;
    const v = (x - cx) * sa + (z - cz) * ca;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  const w = maxU - minU, d = maxV - minV;
  if (w * d < 18) continue;                       // sheds below ~18m² skipped
  buildings.push([
    Math.round(cx), Math.round(cz),
    Math.round(Math.min(w, 40) * 10) / 10, Math.round(Math.min(d, 40) * 10) / 10,
    Math.round(ang * 100) / 100,
  ]);
}

// ---- farmstead sites (the settlement pattern) ------------------------------
const dwellings = [];
for (const e of els) {
  if (e.type !== 'node' || !e.tags || !e.tags.place) continue;
  if (!['isolated_dwelling', 'hamlet'].includes(e.tags.place)) continue;
  const p = toScene(e.lat, e.lon);
  if (!inRect(p)) continue;
  dwellings.push([Math.round(p[0]), Math.round(p[1]), e.tags.name || '']);
}

const out = `// Real roads, building footprints and farmstead sites around Taurene.
// Data © OpenStreetMap contributors (ODbL), baked by data/bake-roads.mjs.
// Roads: { c: class (0 P30 highway, 1 V-road, 2 local lane, 3 track), ref, pts [[x,z],..] }
// Buildings: [x, z, w, d, rotation] oriented-rectangle footprint fits.
// Dwellings: [x, z, name] — viensēta names persist for centuries, so these
// double as the 1860/1935 settlement pattern.
export const ROADS_OSM = ${JSON.stringify(roads)};
export const BUILDINGS_OSM = ${JSON.stringify(buildings)};
export const DWELLINGS_OSM = ${JSON.stringify(dwellings)};
`;
writeFileSync(new URL('../src/geodata-osm.js', import.meta.url), out);
console.log(`roads ${roads.length} (P30 ${roads.filter((r) => r.c === 0).length} pieces), buildings ${buildings.length}, dwellings ${dwellings.length}`);
console.log(`bytes ${out.length}`);
