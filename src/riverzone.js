// RIVERZONE — the river as a *place*, not a line. Single owner of every
// "where is water?" question in the sim. Before this module, six files each
// did their own river math (fixed 10.2m half-width, ad-hoc lake loops,
// centerline thresholds) and every mismatch became a visible bug: sandy
// skirts crossing lakes, flowers standing in the channel, dead-straight
// shores. Now the channel geometry — arc-length-even samples, a RUGGED
// per-point half-width, water level, lake membership — is computed once,
// here, and everything else (terrain carve & paint, the water ribbon and
// its bank skirt, vegetation, grass, wading physics) asks riverzone.
//
// Design rules:
//  * The half-width law is a function of ARC LENGTH, so the ribbon (which
//    walks the spline by parameter), the carve stamps and the exclusion
//    queries (which walk by sample) all see the SAME rugged edge.
//  * Lake membership uses the Chaikin-smoothed shoreline (what the water
//    mesh renders) behind a scanline-rasterised prune grid — exact answers
//    at O(1) typical cost, cheap enough for per-vertex terrain paint.
//  * No imports from landuse.js (landuse imports us); geodata + util only.
import { RIVER_PTS, STREAMS, LAKES } from './geodata.js';
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { clamp, lerp, makeNoise, sampleSpline, sampleSplineEven, pointInPoly, chaikinPoly, smoothstep } from './util.js';

// ---------------------------------------------------------------- lakes ----
// Smoothed shores + bboxes. The prune grid marks each 8m cell as outside /
// fully inside / boundary-of-lake-k; only boundary cells pay for an exact
// point-in-polygon test.
export const LAKE_SHORES = LAKES.map((l) => {
  const poly = chaikinPoly(l.poly);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { name: l.name, level: l.level, poly, minX, maxX, minZ, maxZ };
});

const LG_RES = 8;
// bounds = heightmap extent ∪ every lake bbox — Šķesteru ezers pokes past
// the DEM's south edge, and a lake off the grid silently stopped existing
let lgMinX = HM_OFF_X - HM_SPAN / 2, lgMaxX = HM_OFF_X + HM_SPAN / 2;
let lgMinZ = HM_OFF_Z - HM_SPAN / 2, lgMaxZ = HM_OFF_Z + HM_SPAN / 2;
for (const l of LAKE_SHORES) {
  lgMinX = Math.min(lgMinX, l.minX); lgMaxX = Math.max(lgMaxX, l.maxX);
  lgMinZ = Math.min(lgMinZ, l.minZ); lgMaxZ = Math.max(lgMaxZ, l.maxZ);
}
const LG_X0 = lgMinX - 2 * LG_RES;
const LG_Z0 = lgMinZ - 2 * LG_RES;
const LG_N = Math.ceil((Math.max(lgMaxX - lgMinX, lgMaxZ - lgMinZ) + 4 * LG_RES) / LG_RES);
// 0 = open land, 1+k = interior of lake k, 101+k = shoreline cell of lake k
const lgIdx = new Uint8Array(LG_N * LG_N);
const lgEdge = new Uint8Array(LG_N * LG_N);
(function rasterise() {
  LAKE_SHORES.forEach((lake, k) => {
    const { poly } = lake;
    const gz0 = Math.max(0, Math.floor((lake.minZ - LG_Z0) / LG_RES));
    const gz1 = Math.min(LG_N - 1, Math.ceil((lake.maxZ - LG_Z0) / LG_RES));
    // scanline interior fill (even-odd) through each cell-row centre
    for (let gz = gz0; gz <= gz1; gz++) {
      const zc = LG_Z0 + (gz + 0.5) * LG_RES;
      const xs = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if ((zi > zc) !== (zj > zc)) xs.push(xi + ((xj - xi) * (zc - zi)) / (zj - zi));
      }
      xs.sort((a, b) => a - b);
      for (let p = 0; p + 1 < xs.length; p += 2) {
        const gx0 = Math.max(0, Math.ceil((xs[p] - LG_X0) / LG_RES - 0.5));
        const gx1 = Math.min(LG_N - 1, Math.floor((xs[p + 1] - LG_X0) / LG_RES - 0.5));
        for (let gx = gx0; gx <= gx1; gx++) lgIdx[gz * LG_N + gx] = 1 + k;
      }
    }
    // shoreline cells (edge supercover, dilated by 1) demand the exact test
    const mark = (gx, gz) => {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const ax = gx + dx, az = gz + dz;
        if (ax >= 0 && az >= 0 && ax < LG_N && az < LG_N) lgIdx[az * LG_N + ax] = 101 + k;
      }
    };
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      const steps = Math.max(1, Math.ceil(Math.hypot(xj - xi, zj - zi) / (LG_RES * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const x = xi + ((xj - xi) * s) / steps, z = zi + ((zj - zi) * s) / steps;
        const egx = Math.round((x - LG_X0) / LG_RES), egz = Math.round((z - LG_Z0) / LG_RES);
        if (egx >= 0 && egz >= 0 && egx < LG_N && egz < LG_N) lgEdge[egz * LG_N + egx] = 1;
        mark(Math.floor((x - LG_X0) / LG_RES), Math.floor((z - LG_Z0) / LG_RES));
      }
    }
  });
})();

// distance to the nearest lake SHORELINE, metres, ~±8m accurate (chamfer
// 3-4 transform over the prune grid). Sign-free — pair with lakeAt(x,z) to
// know which side you are on. Powers the lake shore shelf carve, the
// graded shallow paint and the shore dressing without per-vertex polygon
// walks (262k paint verts × 500-segment polys was never going to fly).
const lgDist = new Float32Array(LG_N * LG_N).fill(1e9);
(function chamfer() {
  const N = LG_N;
  for (let i = 0; i < N * N; i++) { if (lgEdge[i]) lgDist[i] = 0; }
  // forward pass
  for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
    const i = gz * N + gx;
    let d = lgDist[i];
    if (gx > 0) d = Math.min(d, lgDist[i - 1] + 3);
    if (gz > 0) {
      d = Math.min(d, lgDist[i - N] + 3);
      if (gx > 0) d = Math.min(d, lgDist[i - N - 1] + 4);
      if (gx < N - 1) d = Math.min(d, lgDist[i - N + 1] + 4);
    }
    lgDist[i] = d;
  }
  // backward pass
  for (let gz = N - 1; gz >= 0; gz--) for (let gx = N - 1; gx >= 0; gx--) {
    const i = gz * N + gx;
    let d = lgDist[i];
    if (gx < N - 1) d = Math.min(d, lgDist[i + 1] + 3);
    if (gz < N - 1) {
      d = Math.min(d, lgDist[i + N] + 3);
      if (gx < N - 1) d = Math.min(d, lgDist[i + N + 1] + 4);
      if (gx > 0) d = Math.min(d, lgDist[i + N - 1] + 4);
    }
    lgDist[i] = d;
  }
})();
export function lakeShoreDistAt(x, z) {
  const gx = Math.floor((x - LG_X0) / LG_RES), gz = Math.floor((z - LG_Z0) / LG_RES);
  if (gx < 0 || gz < 0 || gx >= LG_N || gz >= LG_N) return 1e9;
  return (lgDist[gz * LG_N + gx] / 3) * LG_RES;
}
// the same distance with a ±3.5m wander — consumers that shape the VISIBLE
// waterline (shelf carve, heightAt guard, shore paint, grass feather) use
// this one so the water's edge meanders naturally instead of tracing the
// smoothed polygon like a drawn line. All from ONE function = all agree.
const shoreNoise = makeNoise(6021);
export function lakeShoreWavyAt(x, z) {
  const d = lakeShoreDistAt(x, z);
  if (d > 60) return d;
  return d + (shoreNoise.fbm(x * 0.021, z * 0.021, 2) - 0.5) * 7;
}

// The lake this point is in (by the RENDERED shoreline), else null.
export function lakeAt(x, z) {
  const gx = Math.floor((x - LG_X0) / LG_RES), gz = Math.floor((z - LG_Z0) / LG_RES);
  if (gx < 0 || gz < 0 || gx >= LG_N || gz >= LG_N) return null;
  const v = lgIdx[gz * LG_N + gx];
  if (v === 0) return null;
  if (v <= 100) return LAKE_SHORES[v - 1];
  const lake = LAKE_SHORES[v - 101];
  return pointInPoly(x, z, lake.poly) ? lake : null;
}
export function inAnyLake(x, z) { return lakeAt(x, z) !== null; }
export function lakeLevelAt(x, z) {
  const l = lakeAt(x, z);
  return l ? l.level : -Infinity;
}

// ------------------------------------------------------ rugged width law ----
// Two scales of shoreline character, both in ARC-LENGTH space so every
// consumer agrees where a bay bulges: a long swell (~110m) that widens
// pools and pinches runs, and a short nibble (~26m) that roughens the line
// the eye follows. Clamped so tight meanders can't fold the ribbon.
const wNoise = makeNoise(3121);
function widthLaw(s, chan) {
  const swell = (wNoise.fbm(s / chan.swellL, chan.seedY, 3) - 0.5) * 2 * chan.swellAmp;
  const nibble = (wNoise.noise2(s / chan.nibbleL, chan.seedY + 7.3) - 0.5) * 2 * chan.nibbleAmp;
  return clamp(chan.baseHW + swell + nibble, chan.minHW, chan.maxHW);
}

function evenSpline(pts, step, gap = step) {
  const raw = sampleSplineEven(pts, step), out = [raw[0]];
  let prev = raw[0], acc = gap * 0.5;
  for (let i = 1; i < raw.length; i++) {
    const p = raw[i];
    let dl = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    while (acc + dl >= gap) {
      const u = (gap - acc) / dl;
      prev = prev.map((v, k) => lerp(v, p[k], u));
      out.push(prev); dl = Math.hypot(p[0] - prev[0], p[1] - prev[1]); acc = 0;
    }
    acc += dl; prev = p;
  }
  const last = raw[raw.length - 1], tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 1e-6) out.push(last);
  return out;
}

// ------------------------------------------------------------- channels ----
// samples: arrays [x, z, level, halfWidth] every ~4m of arc — array-shaped
// on purpose so landuse's splat/bucket code digests them unchanged.
function buildChannel(pts, opts) {
  const chan = {
    pts,
    baseHW: opts.baseHW, swellAmp: opts.swellAmp, swellL: opts.swellL,
    nibbleAmp: opts.nibbleAmp, nibbleL: opts.nibbleL,
    minHW: opts.minHW, maxHW: opts.maxHW, seedY: opts.seedY,
    samples: [], length: 0,
  };
  // cumulative arc-length table over the spline parameter (for halfWidthAtT)
  const PN = 2048;
  const arc = new Float32Array(PN + 1);
  let prev = sampleSpline(pts, 0), cum = 0;
  const STEP = 4;
  for (let i = 1; i <= PN; i++) {
    const p = sampleSpline(pts, i / PN);
    const dl = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    cum += dl;
    arc[i] = cum;
    prev = p;
  }
  const even = evenSpline(pts, STEP, opts.sampleGap || STEP);
  cum = 0; prev = even[0];
  chan.samples.push([prev[0], prev[1], prev[2], widthLaw(0, chan)]);
  for (let i = 1; i < even.length; i++) {
    const p = even[i];
    cum += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    chan.samples.push([p[0], p[1], p[2], widthLaw(cum, chan)]);
    prev = p;
  }
  chan.arc = arc;
  chan.length = cum;
  return chan;
}

export const RIVER = buildChannel(RIVER_PTS, {
  baseHW: 10.2, swellAmp: 3.4, swellL: 110, nibbleAmp: 1.0, nibbleL: 26,
  minHW: 7.6, maxHW: 13.2, seedY: 3.7, sampleGap: 5.6,
});
export const STREAM_CHANNELS = STREAMS.map((s, i) => buildChannel(s.pts, {
  baseHW: 2.1, swellAmp: 0.55, swellL: 60, nibbleAmp: 0.25, nibbleL: 14,
  minHW: 1.5, maxHW: 3.0, seedY: 20 + i * 9.1,
}));

// half-width at spline parameter t — for the mesh builders that walk by t.
export function halfWidthAtT(chan, t) {
  const f = clamp(t, 0, 1) * 2048;
  const i = Math.floor(f), u = f - i;
  const s = i >= 2048 ? chan.arc[2048] : lerp(chan.arc[i], chan.arc[i + 1], u);
  return widthLaw(s, chan);
}

// ------------------------------------------------------- near-field query ----
// 16m buckets over every channel sample; exact within QUERY_R, null beyond
// (callers keep using landuse's coarse field for far distances).
const BK = 16;
export const QUERY_R = 40;
function bucketsFor(chans) {
  const m = new Map();
  for (const chan of chans) {
    for (const p of chan.samples) {
      const k = Math.floor(p[0] / BK) * 8192 + Math.floor(p[1] / BK);
      let a = m.get(k);
      if (!a) m.set(k, a = []);
      a.push(p);
    }
  }
  return m;
}
const rivBK = bucketsFor([RIVER]);
const strmBK = bucketsFor(STREAM_CHANNELS);
function nearest(m, x, z) {
  const bx = Math.floor(x / BK), bz = Math.floor(z / BK);
  let best = null, bd = QUERY_R * QUERY_R;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    const arr = m.get((bx + dx) * 8192 + (bz + dz));
    if (!arr) continue;
    for (const p of arr) {
      const d2 = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
      if (d2 < bd) { bd = d2; best = p; }
    }
  }
  if (!best) return null;
  return { d: Math.sqrt(bd), level: best[2], hw: best[3] };
}
// nearest river/stream sample within ~40m: {d, level, hw} — d is to the
// CENTERLINE; d - hw is the signed distance to the rugged water's edge.
export function riverAt(x, z) { return nearest(rivBK, x, z); }
export function streamAt(x, z) { return nearest(strmBK, x, z); }

// ------------------------------------------------------------- the pond ----
// The mill pond exists only in eras 3-4; landuse registers it (it owns LOC).
let POND = null;
export function setPond(p) { POND = p; }        // {x, z, rx, rz, level}
export function pondAt(x, z) {
  if (!POND) return null;
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) < 1.05 ? POND : null;
}

// ------------------------------------------------------------ the rules ----
// Open-water level here, else -Infinity. Wading, fish, ducks, droplets.
export function waterLevelAt(x, z, era = 4) {
  let w = -Infinity;
  const lk = lakeAt(x, z);
  if (lk) w = lk.level;
  const rv = riverAt(x, z);
  if (rv && rv.d < rv.hw + 1.5) w = Math.max(w, rv.level);
  const st = streamAt(x, z);
  if (st && st.d < st.hw + 0.8) w = Math.max(w, st.level);
  if ((era === 3 || era === 4) && pondAt(x, z)) w = Math.max(w, POND.level);
  return w;
}

// THE vegetation rule. One question, one answer, every plant: is this spot
// river/stream channel, drowned bank, lake or pond? margin (m) widens the
// keep-out ring — grass uses ~2, flowers ~3.5, trees add their own in
// landuse. era gates the pond (a dry basin may bloom in other centuries).
export function vegExcluded(x, z, y, era = 4, m = 0) {
  const lk = lakeAt(x, z);
  if (lk && y < lk.level + 0.5) return true;
  const rv = riverAt(x, z);
  if (rv && (rv.d < rv.hw + 2.5 + m || (rv.d < rv.hw + 10 && y < rv.level + 0.45))) return true;
  const st = streamAt(x, z);
  if (st && (st.d < st.hw + 1.2 + m * 0.6 || (st.d < st.hw + 5 && y < st.level + 0.4))) return true;
  if ((era === 3 || era === 4 || era === undefined) && POND) {
    if (y < POND.level + 0.25 && pondAt(x, z)) return true;
  }
  return false;
}

// ------------------------------------------------------ bank character ----
// What kind of shore is this? Real banks alternate: soft mud pools, plain
// sand, washed gravel bars (LAAS margin rule: wet darkening + water-rounded
// cobbles). WORLD-SPACE noise (~90m patches) so the bank skirt colours, the
// pebble scatter and the terrain paint all agree where a bar begins.
const bankNoise = makeNoise(4711);
export function bankCharAt(x, z) {
  const n = bankNoise.fbm(x * 0.0115, z * 0.0115, 3);
  return {
    mud: smoothstep(0.46, 0.34, n),   // 1 = soft dark mud reach
    bar: smoothstep(0.56, 0.68, n),   // 1 = gravel/pebble bar reach
  };
}

// ------------------------------------------------- shared mesh geometry ----
// THE row list for a channel's water ribbon AND its bank skirt. Both meshes
// must be built from the SAME rows or their shared edge opens black slivers
// — putting the sampler here makes the weld structural, not a convention.
// Each row: { x, z, y, dx, dz, hw, lake } — (dx,dz) is the unit tangent,
// lake is the lake object when the row centre lies inside one (the caller
// collapses skirts / sinks the ribbon below the lake sheet there).
export function channelRows(chan, SEG) {
  const rows = [];
  const isStream = chan !== RIVER;
  const step = Math.min(chan.length / SEG, 10);
  const samples = evenSpline(chan.pts, step);
  let s = 0;
  for (let i = 0; i < samples.length; i++) {
    const [x, z, y] = samples[i];
    const [xa, za] = samples[Math.max(0, i - 1)];
    const [x2, z2] = samples[Math.min(samples.length - 1, i + 1)];
    if (i) s += Math.hypot(x - samples[i - 1][0], z - samples[i - 1][1]);
    let dx = x2 - xa, dz = z2 - za;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const lake = lakeAt(x, z);
    // inside a lake the channel surface ducks under the lake sheet — the
    // lake plane renders on top and the "canal crossing the lake" vanishes
    let yRow = lake ? Math.min(y, lake.level - 0.35) : y;
    // …and a STREAM ducks under the RIVER the same way at its confluence,
    // instead of shelving over the big water at its own level
    if (isStream && !lake) {
      const rv = riverAt(x, z);
      if (rv && rv.d < rv.hw + 1.5) yRow = Math.min(yRow, rv.level - 0.3);
    }
    rows.push({ x, z, y: yRow, dx, dz, hw: widthLaw(s, chan), lake });
  }
  return rows;
}
