// Land-use composition for each era: where the farmstead, fields, roads and
// forests are. All modules (terrain painting, vegetation, era content) read
// from here so the world stays coherent across time.
//
// Eras: 0 = ~10,800 BC (Younger Dryas tundra, pre-human)
//       1 = ~AD 50   (Early Iron Age wilderness, aurochs)
//       2 = ~AD 950  (Latgalian farmstead)
//       3 = 1860     (Nēķens manor era)
//       4 = 1935     (Taurene, independent Latvia)
//       5 = 2025     (today — terrain draped in Sentinel-2 imagery)
import { RIVER_PTS, STREAMS, BREZGA } from './geodata.js';
import { ROADS_OSM, DWELLINGS_OSM } from './geodata-osm.js';
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { forestMaskAt } from './sat2025.js';
import { makeNoise, mulberry32, clamp, smoothstep, distToPolyline, sampleSpline } from './util.js';

const noise = makeNoise(4217);

// --- coarse water-distance field (30 m cells) — makes distToRiver/streams O(1)
const WD_RES = 30;
const WD_N = Math.ceil(HM_SPAN / WD_RES) + 1;
const wdRiver = new Float32Array(WD_N * WD_N).fill(1e9);
const wdLevel = new Float32Array(WD_N * WD_N);
const wdStream = new Float32Array(WD_N * WD_N).fill(1e9);
{
  const x0 = HM_OFF_X - HM_SPAN / 2, z0 = HM_OFF_Z - HM_SPAN / 2;
  for (let gz = 0; gz < WD_N; gz++) {
    const z = z0 + gz * WD_RES;
    for (let gx = 0; gx < WD_N; gx++) {
      const x = x0 + gx * WD_RES;
      const i = gz * WD_N + gx;
      for (const p of RIVER_PTS) {
        const d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
        if (d < wdRiver[i]) { wdRiver[i] = d; wdLevel[i] = p[2]; }
      }
      for (const s of STREAMS) for (const p of s.pts) {
        const d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
        if (d < wdStream[i]) wdStream[i] = d;
      }
    }
  }
  for (let i = 0; i < WD_N * WD_N; i++) {
    wdRiver[i] = Math.sqrt(wdRiver[i]);
    wdStream[i] = Math.sqrt(wdStream[i]);
  }
  // refine near the channels with the SMOOTHED course the water ribbon
  // actually follows — the raw 43m points overestimate by up to ~20m
  // mid-span and miss the spline bulges on bends entirely (grass stood in
  // the river on exactly those bends)
  const sx0 = HM_OFF_X - HM_SPAN / 2, sz0 = HM_OFF_Z - HM_SPAN / 2;
  const splat = (samples, arr, levelToo) => {
    const W = 8; // 240m accuracy window; the coarse field covers beyond
    for (const p of samples) {
      const cgx = Math.round((p[0] - sx0) / WD_RES), cgz = Math.round((p[1] - sz0) / WD_RES);
      for (let dz = -W; dz <= W; dz++) {
        for (let dx = -W; dx <= W; dx++) {
          const gx = cgx + dx, gz = cgz + dz;
          if (gx < 0 || gz < 0 || gx >= WD_N || gz >= WD_N) continue;
          const d = Math.hypot(sx0 + gx * WD_RES - p[0], sz0 + gz * WD_RES - p[1]);
          const i = gz * WD_N + gx;
          if (d < arr[i]) { arr[i] = d; if (levelToo) wdLevel[i] = p[2]; }
        }
      }
    }
  };
  const NR = Math.min(2200, RIVER_PTS.length * 5);
  const fineR = [];
  for (let i = 0; i <= NR; i++) fineR.push(sampleSpline(RIVER_PTS, i / NR));
  splat(fineR, wdRiver, true);
  for (const st of STREAMS) {
    const NS = st.pts.length * 5;
    const fineS = [];
    for (let i = 0; i <= NS; i++) fineS.push(sampleSpline(st.pts, i / NS));
    splat(fineS, wdStream, false);
  }
}
function wdSample(arr, x, z) {
  const fx = clamp((x - (HM_OFF_X - HM_SPAN / 2)) / WD_RES, 0, WD_N - 1.001);
  const fz = clamp((z - (HM_OFF_Z - HM_SPAN / 2)) / WD_RES, 0, WD_N - 1.001);
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const u = fx - x0, v = fz - z0;
  const at = (xx, zz) => arr[Math.min(zz, WD_N - 1) * WD_N + Math.min(xx, WD_N - 1)];
  return (at(x0, z0) * (1 - u) + at(x0 + 1, z0) * u) * (1 - v) +
         (at(x0, z0 + 1) * (1 - u) + at(x0 + 1, z0 + 1) * u) * v;
}

// The Gauja enters from the south, bends east north of the village and leaves
// north-east. The south (upstream) leg is where the farmstead world lives.
const SOUTH_LEG = RIVER_PTS.filter((p) => p[1] > -220 && p[1] < 2200);
export function riverXAt(z) {
  let best = SOUTH_LEG[0], bd = Infinity;
  for (const p of SOUTH_LEG) {
    const d = Math.abs(p[1] - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best[0];
}
export function riverLevelAt(z) {
  let best = SOUTH_LEG[0], bd = Infinity;
  for (const p of SOUTH_LEG) {
    const d = Math.abs(p[1] - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best[2];
}
export function distToRiver(x, z) {
  return wdSample(wdRiver, x, z);
}
export function riverLevelNear(x, z) {
  const gx = Math.round(clamp((x - (HM_OFF_X - HM_SPAN / 2)) / WD_RES, 0, WD_N - 1));
  const gz = Math.round(clamp((z - (HM_OFF_Z - HM_SPAN / 2)) / WD_RES, 0, WD_N - 1));
  return wdLevel[gz * WD_N + gx];
}
export function distToStreams(x, z) {
  return wdSample(wdStream, x, z);
}
export { distToPolyline };
function riverPointNearest(x, z) {
  let best = RIVER_PTS[0], bd = Infinity;
  for (const p of RIVER_PTS) {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// --- Anchor locations (scene metres; origin = modern village centre).
const rvx = riverXAt(40);
const pondPt = riverPointNearest(-200, -380);
export const LOC = {
  STEAD: { x: rvx + 210, z: 40 },            // Brezgi farmstead anchor (all eras)
  CAMP: { x: rvx + 90, z: 130 },             // era-1 hunters' camp on the riverside terrace
  MANOR: { x: -40, z: -180 },                // Nēķena muiža ensemble (eras 3-5), village core
  POND: { x: pondPt[0], z: pondPt[1] },      // mill pond on the Gauja bend below the manor
  POND_LEVEL: pondPt[2] + 1.3,
  OAK: { x: rvx + 130, z: -90 },             // the old oak (sacred in era 2, still there in 4)
  BARROWS: { x: rvx + 330, z: 300 },         // Latgalian barrow cemetery (eras 2+, as mounds)
  STONE: { x: rvx + 245, z: -25 },           // poem stone by the road (eras 4-5)
  CHURCH: { x: -1450, z: -2050 },            // distant church silhouette NW (Dzērbene direction)
  LAKE_VIEW: { x: 1500, z: -350 },           // Taurenes ezers overlook
  HILLFORT: { x: -1080, z: 820 },            // Lejstupu (Briediņu) pilskalns, west of Dabaru ezers
  BREZGA: { x: BREZGA.x, z: BREZGA.z },      // Brežģa kalns summit (255 m) — the family hill
  KROGS: { x: 2320, z: 5270 },               // Brežģa krogs / Brezgis settlement, on the old road
};

// Terrain pads to flatten (union across eras — the ground itself is continuous)
// Late Iron Age dispersal: Latgalian settlement was scattered single
// farmsteads loosely gathered on a hillfort district, not lone outposts.
// 7 outliers + the main stead = 8 settlement units on the 77 km² tile —
// mid-range of the 8-15 that cemetery-density and population estimates give
// for 10th-c NE Vidzeme (research/iron-age-settlement.md)
export const ERA2_FARMS = [
  { x: LOC.STEAD.x + 420, z: LOC.STEAD.z + 460 },
  { x: LOC.STEAD.x + 640, z: LOC.STEAD.z - 180 },
  { x: LOC.STEAD.x + 130, z: LOC.STEAD.z + 890 },
  { x: LOC.STEAD.x + 520, z: LOC.STEAD.z - 420 },
  { x: LOC.STEAD.x - 60,  z: LOC.STEAD.z - 700 },
  { x: LOC.STEAD.x + 980, z: LOC.STEAD.z + 240 },
  { x: LOC.STEAD.x + 420, z: LOC.STEAD.z + 1240 },
];

export const PADS = [
  { x: LOC.STEAD.x, z: LOC.STEAD.z, r: 55 },
  { x: LOC.MANOR.x, z: LOC.MANOR.z, r: 62 },
  { x: LOC.CAMP.x, z: LOC.CAMP.z, r: 18 },
  { x: LOC.OAK.x, z: LOC.OAK.z, r: 12 },
  { x: LOC.HILLFORT.x, z: LOC.HILLFORT.z, r: 22 },
  { x: LOC.BREZGA.x, z: LOC.BREZGA.z, r: 15 },
  { x: LOC.KROGS.x, z: LOC.KROGS.z, r: 26 },
];
// Terrain bumps to add (burial barrows: hemispherical, 4-7 m across per
// Latgalian practice — they persist as landscape once raised)
export const BUMPS = [];
{
  const r = makeNoise(99).rng;
  for (let i = 0; i < 7; i++) {
    BUMPS.push({
      x: LOC.BARROWS.x + (r() - 0.5) * 70,
      z: LOC.BARROWS.z + (r() - 0.5) * 55,
      r: 2.1 + r() * 1.4,
      h: 0.75 + r() * 0.45,
    });
  }
}

// --- Roads / paths, per era: array of {pts:[[x,z]...], w}
const S = LOC.STEAD, M = LOC.MANOR, P = LOC.POND, B = LOC.BREZGA, K = LOC.KROGS;
const bridgeZ = 120;
const bx = riverXAt(bridgeZ);
const b2 = riverPointNearest(M.x + 40, M.z - 220);
export const BRIDGE = { x: bx, z: bridgeZ };
export const BRIDGE2 = { x: b2[0], z: b2[1], level: b2[2] };

// the old Cēsis–Vecpiebalga road: village -> south over Brežģa kalns' flank ->
// Brežģa krogs (Brezgis) -> off the map south
const SOUTH_ROAD = [
  [S.x + 58, 1200], [700, 2300], [1150, 3300], [1480, 4180],
  [B.x + 110, B.z - 150], [1960, 5180], [K.x + 20, K.z + 8], [2460, 6060],
];

export function roadsForEra(era) {
  if (era <= 1) return [];
  if (era === 2) {
    // footpaths: stead->river, stead->barrows, stead->oak
    return [
      { pts: [[S.x, S.z], [S.x - 90, S.z + 40], [bx + 8, bridgeZ]], w: 2 },
      { pts: [[S.x, S.z], [S.x + 80, S.z + 120], [LOC.BARROWS.x, LOC.BARROWS.z]], w: 1.6 },
      { pts: [[S.x, S.z], [LOC.OAK.x + 6, LOC.OAK.z + 6]], w: 1.4 },
    ];
  }
  // 1860 / 1935 / 2025: the parish road, manor drive, bridges, the south road
  const main = { pts: [[S.x + 45, -60], [M.x - 70, M.z + 70], [M.x + 10, M.z - 60], [BRIDGE2.x, BRIDGE2.z + 40], [BRIDGE2.x, BRIDGE2.z - 40], [BRIDGE2.x + 150, -1100], [350, -2350]], w: era === 5 ? 7 : 5.5 };
  const south = { pts: [[S.x + 35, S.z + 60], [S.x + 45, -60]], w: era === 5 ? 7 : 5.5 };
  const roads = [
    main,
    south,
    { pts: [[S.x + 60, 1900], [S.x + 58, 1200]].concat(SOUTH_ROAD.slice(1)), w: era === 5 ? 7 : 5 },
    { pts: [[S.x + 35, S.z + 60], [S.x + 60, 1900]], w: era === 5 ? 7 : 5.5 },
    { pts: [[S.x + 38, S.z + 12], [S.x + 6, S.z + 4]], w: 3 },                    // farm lane
    { pts: [[M.x - 70, M.z + 70], [M.x - 8, M.z + 14]], w: 4 },                   // manor drive
    { pts: [[S.x + 42, S.z - 4], [bx + 30, bridgeZ - 30], [bx - 40, bridgeZ + 10], [-1500, 500]], w: 4.5 },
  ];
  if (era < 5) roads.push({ pts: [[M.x - 40, M.z + 30], [P.x + 45, P.z + 20], [P.x + 20, P.z + 6]], w: 3 }); // mill lane
  return roads;
}

// --- Fields per era: soft-edged ellipses {cx,cz,rx,rz,rot,type}
// every farm feeds itself: 1-2 small fields per background viensēta,
// deterministic per site, era 3/4 only (2025 satellite carries its own)
function bgFieldsFor(era) {
  const out = [];
  const TYPES = ['rye', 'barley', 'flax', 'potato', 'clover', 'fallow'];
  DWELLINGS_OSM.forEach(([x, z], si) => {
    if (!farmSiteKept(si, era)) return;
    const r = mulberry32(si * 449 + era * 61);
    const n = 1 + (r() < 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = r() * 6.28, dist = 60 + r() * 60;
      out.push({
        cx: x + Math.cos(a) * dist, cz: z + Math.sin(a) * dist,
        rx: 42 + r() * 42, rz: 28 + r() * 26, rot: r() * 3.1,
        type: TYPES[(r() * 6) | 0],
      });
    }
  });
  return out;
}

const fieldsCache = new Map();
const FIELD_CELL = 128;
function fieldsIndexed(era) {
  let f = fieldsCache.get(era);
  if (f) return f;
  const fields = rawFieldsForEra(era).concat(era === 3 || era === 4 ? bgFieldsFor(era) : []);
  const map = new Map();
  fields.forEach((fl, i) => {
    const R = Math.max(fl.rx, fl.rz);
    for (let ix = Math.floor((fl.cx - R) / FIELD_CELL); ix <= Math.floor((fl.cx + R) / FIELD_CELL); ix++) {
      for (let iz = Math.floor((fl.cz - R) / FIELD_CELL); iz <= Math.floor((fl.cz + R) / FIELD_CELL); iz++) {
        const k = ix + ':' + iz;
        let arr = map.get(k);
        if (!arr) map.set(k, arr = []);
        arr.push(i);
      }
    }
  });
  f = { fields, map };
  fieldsCache.set(era, f);
  return f;
}
export function fieldsForEra(era) {
  return fieldsIndexed(era).fields;
}

function rawFieldsForEra(era) {
  if (era <= 1 || era === 5) return [];
  if (era === 2) {
    const out = [
      { cx: S.x + 95, cz: S.z - 55, rx: 55, rz: 38, rot: 0.4, type: 'barley' },
      { cx: S.x + 40, cz: S.z + 115, rx: 45, rz: 30, rot: -0.3, type: 'rye' },
      { cx: S.x + 135, cz: S.z + 40, rx: 32, rz: 24, rot: 0.9, type: 'fallow' },
    ];
    const T2 = ['barley', 'rye', 'flax', 'barley', 'rye', 'fallow', 'barley'];
    ERA2_FARMS.forEach((f, i) => {
      out.push({ cx: f.x + 45, cz: f.z + 25 - i * 12, rx: 30 + i * 3, rz: 22, rot: i * 0.8, type: T2[i] });
    });
    return out;
  }
  if (era === 3) return [
    { cx: S.x + 130, cz: S.z - 80, rx: 95, rz: 60, rot: 0.35, type: 'rye' },
    { cx: S.x + 60, cz: S.z + 150, rx: 75, rz: 48, rot: -0.2, type: 'barley' },
    { cx: S.x + 200, cz: S.z + 90, rx: 55, rz: 40, rot: 0.7, type: 'flax' },
    { cx: S.x - 15, cz: S.z + 240, rx: 60, rz: 36, rot: 0.1, type: 'potato' },
    { cx: M.x + 150, cz: M.z + 160, rx: 130, rz: 80, rot: 0.5, type: 'rye' },
    { cx: M.x - 40, cz: M.z + 260, rx: 90, rz: 60, rot: -0.4, type: 'fallow' },
    { cx: K.x - 160, cz: K.z - 60, rx: 80, rz: 50, rot: 0.3, type: 'rye' },       // krogs field
  ];
  return [
    { cx: S.x + 130, cz: S.z - 80, rx: 100, rz: 65, rot: 0.35, type: 'rye' },
    { cx: S.x + 60, cz: S.z + 150, rx: 80, rz: 50, rot: -0.2, type: 'clover' },
    { cx: S.x + 205, cz: S.z + 95, rx: 60, rz: 42, rot: 0.7, type: 'flax' },
    { cx: S.x - 15, cz: S.z + 245, rx: 65, rz: 40, rot: 0.1, type: 'potato' },
    { cx: M.x + 150, cz: M.z + 160, rx: 130, rz: 80, rot: 0.5, type: 'barley' },
    { cx: M.x + 40, cz: M.z + 300, rx: 80, rz: 55, rot: -0.3, type: 'rye' },
    { cx: K.x - 160, cz: K.z - 60, rx: 85, rz: 52, rot: 0.3, type: 'clover' },
  ];
}
export function fieldAt(era, x, z) {
  const { fields, map } = fieldsIndexed(era);
  const arr = map.get(Math.floor(x / FIELD_CELL) + ':' + Math.floor(z / FIELD_CELL));
  if (!arr) return null;
  for (const i of arr) {
    const f = fields[i];
    const dx = x - f.cx, dz = z - f.cz;
    const c = Math.cos(-f.rot), s = Math.sin(-f.rot);
    const u = (dx * c - dz * s) / f.rx, v = (dx * s + dz * c) / f.rz;
    const d = u * u + v * v;
    if (d < 1) return { field: f, edge: 1 - d };
  }
  return null;
}

// ---- the REAL road network (OSM) joins the hand-laid diorama roads --------
// class 0 = the P30 highway (its alignment follows the old Cēsis–Vecpiebalga
// road), 1 = V-roads, 2 = local lanes, 3 = farm/forest tracks. Farm lanes
// multiply after the 1920 agrarian reform, so 1860 carries only the main
// roads and the old tracks.
const OSM_W = [5.2, 3.8, 2.9, 1.9];
function osmRoadsFor(era) {
  if (era < 3) return [];
  const out = [];
  for (const r of ROADS_OSM) {
    if (era === 3 && r.c === 2) continue;
    out.push({ pts: r.pts, w: OSM_W[r.c] - (era === 5 ? 0 : 0.6), c: r.c });
  }
  return out;
}

// spatial grid over road segments — distToRoad runs in the hot placement
// loops and the real network is ~1400 segments
const ROAD_CELL = 48;
const roadGrids = new Map();
function roadGridFor(era) {
  let g = roadGrids.get(era);
  if (g) return g;
  const segs = [];
  const map = new Map();
  const all = roadsForEra(era).map((r) => ({ pts: r.pts, w: r.w, c: r.c === undefined ? 2 : r.c }))
    .concat(osmRoadsFor(era));
  for (const r of all) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx2, bz] = r.pts[i + 1];
      const idx = segs.length;
      segs.push([ax, az, bx2, bz, r.w, r.c]);
      const pad = r.w + 10;
      const x0 = Math.floor((Math.min(ax, bx2) - pad) / ROAD_CELL), x1 = Math.floor((Math.max(ax, bx2) + pad) / ROAD_CELL);
      const z0 = Math.floor((Math.min(az, bz) - pad) / ROAD_CELL), z1 = Math.floor((Math.max(az, bz) + pad) / ROAD_CELL);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = ix + ':' + iz;
          let a = map.get(k);
          if (!a) map.set(k, a = []);
          a.push(idx);
        }
      }
    }
  }
  g = { segs, map };
  roadGrids.set(era, g);
  return g;
}

// distance (minus road half-width) and road class of the nearest road.
// Only exact within ~ROAD_CELL — every caller thresholds far below that.
// which OSM farmstead sites exist in a given era — shared by the buildings
// (eras.js), the orchards (vegetation.js) and the yard props so one farm
// never gets an orchard without a house
export function farmSiteKept(i, era) {
  return mulberry32(i * 977 + era * 131)() < (era === 4 ? 0.96 : 0.6);
}

export function distToRoadEx(era, x, z) {
  if (era <= 1) return { d: Infinity, c: 2 };
  const { segs, map } = roadGridFor(era);
  const cix = Math.floor(x / ROAD_CELL), ciz = Math.floor(z / ROAD_CELL);
  let bd = Infinity, bc = 2;
  for (let ix = cix - 1; ix <= cix + 1; ix++) {
    for (let iz = ciz - 1; iz <= ciz + 1; iz++) {
      const arr = map.get(ix + ':' + iz);
      if (!arr) continue;
      for (const si of arr) {
        const s = segs[si];
        const vx = s[2] - s[0], vz = s[3] - s[1];
        const L = vx * vx + vz * vz;
        const t = L ? clamp(((x - s[0]) * vx + (z - s[1]) * vz) / L, 0, 1) : 0;
        const d = Math.hypot(x - (s[0] + vx * t), z - (s[1] + vz * t)) - s[4];
        if (d < bd) { bd = d; bc = s[5]; }
      }
    }
  }
  return { d: bd, c: bc };
}
export function distToRoad(era, x, z) {
  return distToRoadEx(era, x, z).d;
}

// --- Forest density 0..1 at a point, per era. y = ground elevation (m ASL).
export function forestDensity(era, x, z, y) {
  if (era === 0) {
    // Younger Dryas tundra: no forest — dwarf-birch / juniper shrub heath
    const n0 = noise.fbm(x * 0.003, z * 0.003, 3);
    let d = smoothstep(0.38, 0.7, n0) * 0.34;
    d *= smoothstep(8, 40, distToRiver(x, z)) * 0.85 + 0.15;
    return clamp(d, 0, 0.36);
  }
  const n = noise.fbm(x * 0.0016, z * 0.0016, 4);
  const dRiver = distToRiver(x, z);
  const dStead = Math.hypot(x - S.x, z - S.z);
  const dManor = Math.hypot(x - M.x, z - M.z);
  const dCamp = Math.hypot(x - LOC.CAMP.x, z - LOC.CAMP.z);
  let d;
  if (era === 1) {
    d = 0.68 + n * 0.4;                                     // primeval forest
    d *= smoothstep(35, 120, dRiver) * 0.92 + 0.08;         // open floodplain meadows
    d *= smoothstep(55, 135, dStead) * 0.94 + 0.06;         // the terrace opening where the aurochs graze
    d *= smoothstep(12, 40, dCamp);                         // small camp clearing
  } else if (era === 2) {
    d = 0.56 + n * 0.46;
    d *= smoothstep(15, 70, dRiver) * 0.9 + 0.1;
    d *= smoothstep(42, 145, dStead);                       // farmstead clearing
    d *= smoothstep(25, 80, Math.hypot(x - LOC.BARROWS.x, z - LOC.BARROWS.z));
    for (const f of ERA2_FARMS) d *= smoothstep(18, 60, Math.hypot(x - f.x, z - f.z));
  } else if (era === 5) {
    // today: the real forest pattern from Sentinel-2
    d = forestMaskAt(x, z) ? 0.85 + n * 0.15 : 0;
    d *= smoothstep(55, 140, dStead) * 0.94 + 0.06;
    d *= smoothstep(60, 150, dManor) * 0.94 + 0.06;
  } else {
    // agrarian mosaic: forest survives on high/steep hills and in patches
    const high = smoothstep(208, 224, y);
    const patch = smoothstep(0.56, 0.7, n);
    d = Math.max(high * (0.5 + n * 0.55), patch * 0.95);
    d *= smoothstep(70, 200, dStead) * 0.92 + 0.08;
    d *= smoothstep(80, 220, dManor) * 0.92 + 0.08;
    if (era === 4) d *= 0.9;
    if (dRiver < 26 && dRiver > 12) d = Math.max(d, 0.35);
    d *= smoothstep(20, 60, Math.hypot(x - K.x, z - K.z)) * 0.9 + 0.1; // krogs clearing
  }
  // universal exclusions
  if (fieldAt(era, x, z)) return 0;
  if (era >= 2 && distToRoad(era, x, z) < 3.5) return 0;
  for (const p of PADS) if (Math.hypot(x - p.x, z - p.z) < p.r + 6) return 0;
  if (dRiver < 11) return 0;
  if (distToStreams(x, z) < 3.5) return 0;
  return clamp(d, 0, 1);
}

// Field palette (midsummer — Jāņi season, late June)
export const FIELD_COLORS = {
  rye: [0.5, 0.52, 0.26],
  barley: [0.46, 0.53, 0.27],
  flax: [0.44, 0.57, 0.52],
  fallow: [0.46, 0.38, 0.26],
  potato: [0.3, 0.44, 0.23],
  clover: [0.34, 0.52, 0.25],
};
