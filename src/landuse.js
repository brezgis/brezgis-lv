// Land-use composition for each era: where the farmstead, fields, roads and
// forests are. All modules (terrain painting, vegetation, era content) read
// from here so the world stays coherent across time.
//
// Eras: 0 = ~AD 50 (wilderness), 1 = ~AD 950 (Latgalian farmstead),
//       2 = 1860 (Nēķens manor era), 3 = 1935 (Taurene, independent Latvia)
import { RIVER_PTS, STREAMS } from './geodata.js';
import { makeNoise, clamp, smoothstep, distToPolyline } from './util.js';

const noise = makeNoise(4217);

// The Gauja enters from the south, bends east north of the village and leaves
// north-east. The south (upstream) leg is where the farmstead world lives, so
// anchor helpers use that leg only.
const SOUTH_LEG = RIVER_PTS.filter((p) => p[1] > -220);
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
  let bd = Infinity;
  for (const p of RIVER_PTS) {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bd) bd = d;
  }
  return bd;
}
export function distToStreams(x, z) {
  let bd = Infinity;
  for (const s of STREAMS) bd = Math.min(bd, distToPolyline(x, z, s.pts));
  return bd;
}
function riverPointNearest(x, z) {
  let best = RIVER_PTS[0], bd = Infinity;
  for (const p of RIVER_PTS) {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// --- Anchor locations (scene meters; origin = modern village center).
// The farmstead sits on the terrace east of the Gauja — the "same spot"
// the whole simulation revolves around. The manor sits at the historic
// village core (Taurene grew around Nēķena muiža), near the river bend.
const rvx = riverXAt(40);
const pondPt = riverPointNearest(-200, -380);
export const LOC = {
  STEAD: { x: rvx + 210, z: 40 },            // Brezgi farmstead anchor (all eras)
  CAMP: { x: rvx + 90, z: 130 },             // era-0 hunters' camp on the riverside terrace
  MANOR: { x: -40, z: -180 },                // Nēķena muiža ensemble (eras 2-3), village core
  POND: { x: pondPt[0], z: pondPt[1] },      // mill pond on the Gauja bend below the manor
  POND_LEVEL: pondPt[2] + 1.3,
  OAK: { x: rvx + 130, z: -90 },             // the old oak (sacred in era 1, still there in 3)
  BARROWS: { x: rvx + 330, z: 300 },         // Latgalian barrow cemetery (eras 1+, as mounds)
  STONE: { x: rvx + 245, z: -25 },           // 1935 poem stone by the road
  CHURCH: { x: -1450, z: -2050 },            // distant church silhouette NW (Dzērbene direction)
  LAKE_VIEW: { x: 1500, z: -350 },           // Taurenes ezers overlook
  HILLFORT: { x: -1080, z: 820 },            // Lejstupu (Briediņu) pilskalns, west of Dabaru ezers
  HILL: { x: -1500, z: -900 },               // the high hills west of the river
};

// Terrain pads to flatten (union across eras — the ground itself is continuous)
export const PADS = [
  { x: LOC.STEAD.x, z: LOC.STEAD.z, r: 55 },
  { x: LOC.MANOR.x, z: LOC.MANOR.z, r: 62 },
  { x: LOC.CAMP.x, z: LOC.CAMP.z, r: 18 },
  { x: LOC.OAK.x, z: LOC.OAK.z, r: 12 },
  { x: LOC.HILLFORT.x, z: LOC.HILLFORT.z, r: 22 },
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
const S = LOC.STEAD, M = LOC.MANOR, P = LOC.POND;
const bridgeZ = 120;
const bx = riverXAt(bridgeZ);
// second crossing: the parish road crosses the east-running Gauja north of the manor
const b2 = (() => {
  let best = RIVER_PTS[0], bd = Infinity;
  for (const p of RIVER_PTS) {
    const d = Math.hypot(p[0] - (M.x + 40), p[1] - (M.z - 220));
    if (d < bd) { bd = d; best = p; }
  }
  return best;
})();
export const BRIDGE = { x: bx, z: bridgeZ };
export const BRIDGE2 = { x: b2[0], z: b2[1], level: b2[2] };
export function roadsForEra(era) {
  if (era === 0) return [];
  if (era === 1) {
    // footpaths: stead->river (water), stead->fields, stead->barrows
    return [
      { pts: [[S.x, S.z], [S.x - 90, S.z + 40], [bx + 8, bridgeZ]], w: 2 },
      { pts: [[S.x, S.z], [S.x + 80, S.z + 120], [LOC.BARROWS.x, LOC.BARROWS.z]], w: 1.6 },
      { pts: [[S.x, S.z], [LOC.OAK.x + 6, LOC.OAK.z + 6]], w: 1.4 },
    ];
  }
  // 1860 / 1935: the parish road along the terrace, the manor drive, two bridges
  const roads = [
    { pts: [[S.x + 60, 1900], [S.x + 55, 800], [S.x + 40, 300], [S.x + 35, S.z + 60], [S.x + 45, -60], [M.x - 70, M.z + 70], [M.x + 10, M.z - 60], [BRIDGE2.x, BRIDGE2.z + 40], [BRIDGE2.x, BRIDGE2.z - 40], [BRIDGE2.x + 150, -1100], [350, -2350]], w: 5.5 },
    { pts: [[S.x + 38, S.z + 12], [S.x + 6, S.z + 4]], w: 3 },                    // farm lane
    { pts: [[M.x - 70, M.z + 70], [M.x - 8, M.z + 14]], w: 4 },                   // manor drive (linden alley)
    { pts: [[S.x + 42, S.z - 4], [bx + 30, bridgeZ - 30], [bx - 40, bridgeZ + 10], [-1500, 500]], w: 4.5 }, // west road over the bridge
    { pts: [[M.x - 40, M.z + 30], [P.x + 45, P.z + 20], [P.x + 20, P.z + 6]], w: 3 }, // mill lane
  ];
  return roads;
}

// --- Fields per era: soft-edged ellipses {cx,cz,rx,rz,rot,type}
export function fieldsForEra(era) {
  if (era === 0) return [];
  if (era === 1) return [
    { cx: S.x + 95, cz: S.z - 55, rx: 55, rz: 38, rot: 0.4, type: 'barley' },
    { cx: S.x + 40, cz: S.z + 115, rx: 45, rz: 30, rot: -0.3, type: 'rye' },
    { cx: S.x + 135, cz: S.z + 40, rx: 32, rz: 24, rot: 0.9, type: 'fallow' },
  ];
  if (era === 2) return [
    { cx: S.x + 130, cz: S.z - 80, rx: 95, rz: 60, rot: 0.35, type: 'rye' },
    { cx: S.x + 60, cz: S.z + 150, rx: 75, rz: 48, rot: -0.2, type: 'barley' },
    { cx: S.x + 200, cz: S.z + 90, rx: 55, rz: 40, rot: 0.7, type: 'flax' },
    { cx: S.x - 15, cz: S.z + 240, rx: 60, rz: 36, rot: 0.1, type: 'potato' },
    { cx: M.x + 150, cz: M.z + 160, rx: 130, rz: 80, rot: 0.5, type: 'rye' },       // manor field
    { cx: M.x - 40, cz: M.z + 260, rx: 90, rz: 60, rot: -0.4, type: 'fallow' },
  ];
  return [
    { cx: S.x + 130, cz: S.z - 80, rx: 100, rz: 65, rot: 0.35, type: 'rye' },
    { cx: S.x + 60, cz: S.z + 150, rx: 80, rz: 50, rot: -0.2, type: 'clover' },
    { cx: S.x + 205, cz: S.z + 95, rx: 60, rz: 42, rot: 0.7, type: 'flax' },
    { cx: S.x - 15, cz: S.z + 245, rx: 65, rz: 40, rot: 0.1, type: 'potato' },
    { cx: M.x + 150, cz: M.z + 160, rx: 130, rz: 80, rot: 0.5, type: 'barley' },   // new-farm land
    { cx: M.x + 40, cz: M.z + 300, rx: 80, rz: 55, rot: -0.3, type: 'rye' },
  ];
}
export function fieldAt(era, x, z) {
  for (const f of fieldsForEra(era)) {
    const dx = x - f.cx, dz = z - f.cz;
    const c = Math.cos(-f.rot), s = Math.sin(-f.rot);
    const u = (dx * c - dz * s) / f.rx, v = (dx * s + dz * c) / f.rz;
    const d = u * u + v * v;
    if (d < 1) return { field: f, edge: 1 - d };
  }
  return null;
}

export function distToRoad(era, x, z) {
  let bd = Infinity;
  for (const r of roadsForEra(era)) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx2, bz] = r.pts[i + 1];
      const vx = bx2 - ax, vz = bz - az;
      const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
      const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t)) - r.w;
      if (d < bd) bd = d;
    }
  }
  return bd;
}

// --- Forest density 0..1 at a point, per era. y = ground elevation (m ASL).
export function forestDensity(era, x, z, y) {
  const n = noise.fbm(x * 0.0016, z * 0.0016, 4);
  const dRiver = distToRiver(x, z);
  const dStead = Math.hypot(x - S.x, z - S.z);
  const dManor = Math.hypot(x - M.x, z - M.z);
  const dCamp = Math.hypot(x - LOC.CAMP.x, z - LOC.CAMP.z);
  let d;
  if (era === 0) {
    d = 0.55 + n * 0.5;                                     // primeval forest
    d *= smoothstep(35, 120, dRiver) * 0.92 + 0.08;         // open floodplain meadows
    d *= smoothstep(55, 135, dStead) * 0.94 + 0.06;         // the terrace opening where the aurochs graze
    d *= smoothstep(12, 40, dCamp);                         // small camp clearing
  } else if (era === 1) {
    d = 0.45 + n * 0.5;
    d *= smoothstep(15, 70, dRiver) * 0.9 + 0.1;
    d *= smoothstep(42, 145, dStead);                       // farmstead clearing
    d *= smoothstep(25, 80, Math.hypot(x - LOC.BARROWS.x, z - LOC.BARROWS.z));
  } else {
    // agrarian mosaic: forest survives on high/steep west hills and in patches
    const high = smoothstep(208, 224, y);
    const patch = smoothstep(0.56, 0.7, n);
    d = Math.max(high * (0.35 + n * 0.6), patch * 0.85);
    d *= smoothstep(70, 200, dStead) * 0.92 + 0.08;
    d *= smoothstep(80, 220, dManor) * 0.92 + 0.08;
    if (era === 3) d *= 0.9;
    // alder/willow fringe along the river stays
    if (dRiver < 26 && dRiver > 12) d = Math.max(d, 0.35);
  }
  // universal exclusions
  if (fieldAt(era, x, z)) return 0;
  if (era > 0 && distToRoad(era, x, z) < 3.5) return 0;
  for (const p of PADS) if (Math.hypot(x - p.x, z - p.z) < p.r + 6) return 0;
  if (dRiver < 11) return 0;
  if (distToStreams(x, z) < 3.5) return 0;
  return clamp(d, 0, 1);
}

// Field palette (midsummer — Jāņi season, late June: rye green-gold, flax
// in pale blue flower, fallow bare)
export const FIELD_COLORS = {
  rye: [0.5, 0.52, 0.26],
  barley: [0.46, 0.53, 0.27],
  flax: [0.44, 0.57, 0.52],
  fallow: [0.46, 0.38, 0.26],
  potato: [0.3, 0.44, 0.23],
  clover: [0.34, 0.52, 0.25],
};
