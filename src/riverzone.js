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

// Distance to the nearest lake SHORELINE. The chamfer field remains the
// cheap far-field oracle, but its cell-sized steps are unacceptable where
// shelves, collars and reeds meet the rendered polygon. Shore segments are
// therefore bucketed and measured exactly throughout the near field.
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

const SHORE_BK = 24;
const shoreBK = new Map();
for (let k = 0; k < LAKE_SHORES.length; k++) {
  const poly = LAKE_SHORES[k].poly;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const bx0 = Math.floor(Math.min(a[0], b[0]) / SHORE_BK);
    const bx1 = Math.floor(Math.max(a[0], b[0]) / SHORE_BK);
    const bz0 = Math.floor(Math.min(a[1], b[1]) / SHORE_BK);
    const bz1 = Math.floor(Math.max(a[1], b[1]) / SHORE_BK);
    const seg = { a, b, lake: k };
    for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
      const key = bx * 8192 + bz;
      let bucket = shoreBK.get(key);
      if (!bucket) shoreBK.set(key, bucket = []);
      bucket.push(seg);
    }
  }
}

function coarseShoreDist(x, z) {
  const fx = (x - LG_X0) / LG_RES - 0.5, fz = (z - LG_Z0) / LG_RES - 0.5;
  const gx = Math.floor(fx), gz = Math.floor(fz);
  if (gx < 0 || gz < 0 || gx + 1 >= LG_N || gz + 1 >= LG_N) return 1e9;
  const u = fx - gx, v = fz - gz;
  const d00 = lgDist[gz * LG_N + gx], d10 = lgDist[gz * LG_N + gx + 1];
  const d01 = lgDist[(gz + 1) * LG_N + gx], d11 = lgDist[(gz + 1) * LG_N + gx + 1];
  return lerp(lerp(d00, d10, u), lerp(d01, d11, u), v) / 3 * LG_RES;
}

function segmentDist2(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const u = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  const qx = a[0] + dx * u, qz = a[1] + dz * u;
  return (x - qx) ** 2 + (z - qz) ** 2;
}

export function lakeShoreDistAt(x, z) {
  const coarse = coarseShoreDist(x, z);
  if (coarse >= 32) return coarse;
  const bx = Math.floor(x / SHORE_BK), bz = Math.floor(z / SHORE_BK);
  let bd = 48 * 48;
  const seen = new Set();
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const bucket = shoreBK.get((bx + dx) * 8192 + bz + dz);
    if (!bucket) continue;
    for (const seg of bucket) {
      if (seen.has(seg)) continue;
      seen.add(seg);
      bd = Math.min(bd, segmentDist2(x, z, seg.a, seg.b));
    }
  }
  return bd < 48 * 48 ? Math.sqrt(bd) : coarse;
}
// Signed companion for agents that need an explicit wet/dry side. Existing
// callers keep the historical unsigned lakeShoreDistAt contract.
export function lakeShoreSignedDistAt(x, z) {
  const d = lakeShoreDistAt(x, z);
  return lakeAt(x, z) ? -d : d;
}
// The shared shoreline polygon already carries the desired wander. Adding
// independent noise here made mesh, membership and shelf disagree.
export function lakeShoreWavyAt(x, z) {
  return lakeShoreDistAt(x, z);
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
function buildChannel(sourcePts, opts) {
  const pts = sourcePts.filter((p, i) => !i || Math.hypot(p[0] - sourcePts[i - 1][0], p[1] - sourcePts[i - 1][1]) > 1e-5);
  const chan = {
    pts,
    baseHW: opts.baseHW, swellAmp: opts.swellAmp, swellL: opts.swellL,
    nibbleAmp: opts.nibbleAmp, nibbleL: opts.nibbleL,
    minHW: opts.minHW, maxHW: opts.maxHW, seedY: opts.seedY,
    samples: [], sampleS: [], curvature: [], length: 0,
    name: opts.name || '', kind: opts.kind || 'stream', arcOffset: opts.arcOffset || 0,
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
  const sourceMinLevel = Math.min(...pts.map((p) => p[2]));
  let level = Math.max(prev[2], sourceMinLevel);
  chan.samples.push([prev[0], prev[1], level, widthLaw(chan.arcOffset, chan)]);
  chan.sampleS.push(0);
  for (let i = 1; i < even.length; i++) {
    const p = even[i];
    cum += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    level = Math.min(level, Math.max(p[2], sourceMinLevel));
    chan.samples.push([p[0], p[1], level, widthLaw(chan.arcOffset + cum, chan)]);
    chan.sampleS.push(cum);
    prev = p;
  }
  chan.arc = arc;
  chan.length = cum;
  chan.samples[chan.samples.length - 1][2] = Math.min(
    chan.samples[Math.max(0, chan.samples.length - 2)][2], pts[pts.length - 1][2]);
  // Smooth width noise once, then constrain its derivative. Samples,
  // segment queries and render rows all interpolate this same table.
  let widths = chan.samples.map((p) => p[3]);
  for (let pass = 0; pass < 3; pass++) {
    const next = widths.slice();
    for (let i = 1; i < widths.length - 1; i++) next[i] = (widths[i - 1] + widths[i] * 2 + widths[i + 1]) / 4;
    widths = next;
  }
  if (opts.startHW !== undefined) widths[0] = opts.startHW;
  const maxWidthSlope = 0.045;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < widths.length; i++) {
      const lim = maxWidthSlope * (chan.sampleS[i] - chan.sampleS[i - 1]);
      widths[i] = clamp(widths[i], widths[i - 1] - lim, widths[i - 1] + lim);
    }
    for (let i = widths.length - 2; i >= 0; i--) {
      const lim = maxWidthSlope * (chan.sampleS[i + 1] - chan.sampleS[i]);
      widths[i] = clamp(widths[i], widths[i + 1] - lim, widths[i + 1] + lim);
    }
  }
  for (let i = 0; i < widths.length; i++) chan.samples[i][3] = widths[i];
  // Signed curvature over a ~32m half-window. Positive bends turn left.
  const reach = Math.max(2, Math.round(32 / (opts.sampleGap || STEP)));
  for (let i = 0; i < chan.samples.length; i++) {
    if (i < reach || i >= chan.samples.length - reach) { chan.curvature.push(0); continue; }
    const a = chan.samples[Math.max(0, i - reach)], b = chan.samples[i];
    const c = chan.samples[Math.min(chan.samples.length - 1, i + reach)];
    let ax = b[0] - a[0], az = b[1] - a[1], bx = c[0] - b[0], bz = c[1] - b[1];
    const al = Math.hypot(ax, az) || 1, bl = Math.hypot(bx, bz) || 1;
    ax /= al; az /= al; bx /= bl; bz /= bl;
    const angle = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    chan.curvature.push(angle / Math.max(8, (al + bl) * 0.5));
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = chan.curvature.slice();
    for (let i = 1; i < next.length - 1; i++) next[i] = (chan.curvature[i - 1] + chan.curvature[i] * 2 + chan.curvature[i + 1]) / 4;
    chan.curvature = next;
  }
  return chan;
}

export const RIVER = buildChannel(RIVER_PTS, {
  baseHW: 10.2, swellAmp: 3.4, swellL: 110, nibbleAmp: 1.0, nibbleL: 26,
  minHW: 7.6, maxHW: 13.2, seedY: 3.7, sampleGap: 5.6, name: 'Gauja', kind: 'river',
});
export const STREAM_CHANNELS = [];
for (let i = 0; i < STREAMS.length; i++) {
  const continuation = i === 1 && STREAMS[0].name === STREAMS[1].name;
  const prior = continuation ? STREAM_CHANNELS[0] : null;
  STREAM_CHANNELS.push(buildChannel(STREAMS[i].pts, {
    baseHW: 2.1, swellAmp: 0.55, swellL: 60, nibbleAmp: 0.25, nibbleL: 14,
    minHW: 1.5, maxHW: 3.0, seedY: continuation ? 20 : 20 + i * 9.1,
    arcOffset: prior ? prior.length : 0,
    startHW: prior ? prior.samples[prior.samples.length - 1][3] : undefined,
    name: STREAMS[i].name || 'Unnamed brook', kind: 'stream',
  }));
}

function profileAtS(chan, s) {
  s = clamp(s, 0, chan.length);
  let lo = 0, hi = chan.sampleS.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (chan.sampleS[mid] <= s) lo = mid; else hi = mid;
  }
  const a = chan.samples[lo], b = chan.samples[Math.min(lo + 1, chan.samples.length - 1)];
  const ds = chan.sampleS[Math.min(lo + 1, chan.sampleS.length - 1)] - chan.sampleS[lo];
  const u = ds > 1e-6 ? (s - chan.sampleS[lo]) / ds : 0;
  return {
    level: lerp(a[2], b[2], u), hw: lerp(a[3], b[3], u),
    curvature: lerp(chan.curvature[lo], chan.curvature[Math.min(lo + 1, chan.curvature.length - 1)], u),
  };
}

// half-width at spline parameter t — for the mesh builders that walk by t.
export function halfWidthAtT(chan, t) {
  const f = clamp(t, 0, 1) * 2048;
  const i = Math.floor(f), u = f - i;
  const s = i >= 2048 ? chan.arc[2048] : lerp(chan.arc[i], chan.arc[i + 1], u);
  return profileAtS(chan, s).hw;
}

function projectChannel(chan, x, z) {
  let best = null, bd = Infinity;
  for (let i = 0; i < chan.samples.length - 1; i++) {
    const a = chan.samples[i], b = chan.samples[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], dl2 = dx * dx + dz * dz;
    const u = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dl2 || 1), 0, 1);
    const qx = a[0] + dx * u, qz = a[1] + dz * u;
    const d2 = (x - qx) ** 2 + (z - qz) ** 2;
    if (d2 >= bd) continue;
    const dl = Math.sqrt(dl2) || 1;
    const s = lerp(chan.sampleS[i], chan.sampleS[i + 1], u);
    const p = profileAtS(chan, s);
    const left = (x - qx) * (-dz / dl) + (z - qz) * (dx / dl);
    bd = d2;
    best = { d: Math.sqrt(d2), level: p.level, hw: p.hw, curvature: p.curvature,
      x: qx, z: qz, dx: dx / dl, dz: dz / dl, side: Math.sign(left) || 1, s, chan };
  }
  return best;
}

// Canonical receiver records. Continuations share state without a submerged
// mouth; true mouths carry the blend and bank-side data used by both query
// and geometry code.
export const CONFLUENCES = [];
for (let i = 0; i < STREAM_CHANNELS.length; i++) {
  const chan = STREAM_CHANNELS[i], end = chan.samples[chan.samples.length - 1];
  let receiver = null;
  for (let j = 0; j < STREAM_CHANNELS.length; j++) {
    if (i === j) continue;
    const start = STREAM_CHANNELS[j].samples[0];
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 2) {
      receiver = { type: 'continuation', channel: STREAM_CHANNELS[j], projection: projectChannel(STREAM_CHANNELS[j], end[0], end[1]) };
      break;
    }
  }
  const rv = projectChannel(RIVER, end[0], end[1]);
  if (!receiver && rv && rv.d < rv.hw + 8) receiver = { type: 'river', channel: RIVER, projection: rv };
  const lake = lakeAt(end[0], end[1]);
  if (!receiver && lake) receiver = { type: 'lake', lake };
  if (!receiver) receiver = { type: 'wetHollow' };
  const approachDistance = receiver.type === 'wetHollow' ? 32 : 28;
  const receivingLevel = receiver.projection ? receiver.projection.level : receiver.lake ? receiver.lake.level : end[2] - 0.85;
  const mouth = {
    channel: chan, streamIndex: i, type: receiver.type, receiver: receiver.channel || receiver.lake || null,
    x: end[0], z: end[1], receivingLevel, approachDistance,
    receiverS: receiver.projection ? receiver.projection.s : null,
    bankSide: receiver.projection ? receiver.projection.side : 0,
    submergedOffset: receiver.type === 'continuation' ? 0 : 0.3,
    blendEndOffset: receiver.type === 'river' ? 12 : 0,
  };
  chan.confluence = mouth;
  CONFLUENCES.push(mouth);
}

// Apply terminal profiles after receivers are known. This mutates the one
// canonical sample table before buckets or render rows are built.
for (const mouth of CONFLUENCES) {
  const chan = mouth.channel;
  if (mouth.type === 'continuation') continue;
  const blendEnd = chan.length - mouth.blendEndOffset;
  const start = blendEnd - mouth.approachDistance;
  const endLevel = chan.samples[chan.samples.length - 1][2];
  const target = mouth.type === 'wetHollow'
    ? mouth.receivingLevel
    : Math.min(endLevel, mouth.receivingLevel - mouth.submergedOffset);
  const startWidth = profileAtS(chan, Math.max(0, start)).hw;
  for (let i = 0; i < chan.samples.length; i++) {
    if (chan.sampleS[i] < start) continue;
    const u = clamp((chan.sampleS[i] - start) / mouth.approachDistance, 0, 1);
    const ease = u * u * (2 - u);
    chan.samples[i][2] = Math.min(chan.samples[i][2], lerp(chan.samples[i][2], target, ease));
    // Terrain's existing cohesive-bank lip reaches 1.35m inward; retain a
    // hair more half-width so the damp-pan centre remains in the bed branch.
    if (mouth.type === 'wetHollow') chan.samples[i][3] = lerp(startWidth, Math.max(1.36, startWidth * 0.4), ease);
  }
  for (let i = 1; i < chan.samples.length; i++) chan.samples[i][2] = Math.min(chan.samples[i][2], chan.samples[i - 1][2]);
  // Spread sourced drops and terminal blends upstream just enough to keep
  // every untagged reach at or below a 3.8% longitudinal grade.
  for (let i = chan.samples.length - 2; i >= 0; i--) {
    const lim = 0.038 * (chan.sampleS[i + 1] - chan.sampleS[i]);
    chan.samples[i][2] = Math.min(chan.samples[i][2], chan.samples[i + 1][2] + lim);
  }
  for (let i = 1; i < chan.samples.length; i++) chan.samples[i][2] = Math.min(chan.samples[i][2], chan.samples[i - 1][2]);
}

// ------------------------------------------------------- near-field query ----
// 16m buckets over every channel sample; exact within QUERY_R, null beyond
// (callers keep using landuse's coarse field for far distances).
const BK = 16;
export const QUERY_R = 40;
function bucketsFor(chans) {
  const m = new Map();
  for (const chan of chans) {
    for (let i = 0; i < chan.samples.length - 1; i++) {
      const a = chan.samples[i], b = chan.samples[i + 1];
      const bx0 = Math.floor(Math.min(a[0], b[0]) / BK), bx1 = Math.floor(Math.max(a[0], b[0]) / BK);
      const bz0 = Math.floor(Math.min(a[1], b[1]) / BK), bz1 = Math.floor(Math.max(a[1], b[1]) / BK);
      for (let bz = bz0; bz <= bz1; bz++) for (let bx = bx0; bx <= bx1; bx++) {
        const k = bx * 8192 + bz;
        let bucket = m.get(k);
        if (!bucket) m.set(k, bucket = []);
        bucket.push({ chan, i });
      }
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
    for (const seg of arr) {
      const a = seg.chan.samples[seg.i], b = seg.chan.samples[seg.i + 1];
      const sx = b[0] - a[0], sz = b[1] - a[1], sl2 = sx * sx + sz * sz;
      const u = clamp(((x - a[0]) * sx + (z - a[1]) * sz) / (sl2 || 1), 0, 1);
      const qx = a[0] + sx * u, qz = a[1] + sz * u;
      const d2 = (qx - x) ** 2 + (qz - z) ** 2;
      if (d2 < bd) {
        const sl = Math.sqrt(sl2) || 1;
        const s = lerp(seg.chan.sampleS[seg.i], seg.chan.sampleS[seg.i + 1], u);
        const p = profileAtS(seg.chan, s);
        const left = (x - qx) * (-sz / sl) + (z - qz) * (sx / sl);
        bd = d2;
        best = { d: Math.sqrt(d2), level: p.level, hw: p.hw, curvature: p.curvature,
          x: qx, z: qz, dx: sx / sl, dz: sz / sl, side: Math.sign(left) || 1, s, chan: seg.chan };
      }
    }
  }
  return best;
}
// nearest river/stream sample within ~40m: {d, level, hw} — d is to the
// CENTERLINE; d - hw is the signed distance to the rugged water's edge.
export function riverAt(x, z) { return nearest(rivBK, x, z); }
export function streamAt(x, z) { return nearest(strmBK, x, z); }

// True only where a tributary throat is physically inside its receiver.
// Terrain uses this to suppress its stream-bank lip; vegetation can use the
// detailed companion to keep mouth reeds and driftwood out of open water.
export function confluenceAt(x, z, margin = 0) {
  const st = streamAt(x, z);
  const mouth = st?.chan.confluence;
  if (!mouth || mouth.type === 'continuation' || mouth.type === 'wetHollow') return null;
  if (st.s < mouth.channel.length - mouth.approachDistance || st.d > st.hw + 2.9 + margin) return null;
  let inside = false;
  if (mouth.type === 'river') {
    const rv = riverAt(x, z);
    inside = !!rv && rv.d < rv.hw + 1.5 + margin;
  } else if (mouth.type === 'lake') inside = !!lakeAt(x, z);
  if (inside) return { ...mouth, stream: st };
  return null;
}
export function inConfluenceMask(x, z, margin = 0) { return confluenceAt(x, z, margin) !== null; }

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

// side: +1/'left' is left looking downstream; -1/'right' is right.
// Curvature drives the opposing geomorphic roles, with the old FBM retained
// as secondary reach-scale variation and as the straight-reach fallback.
export function bankCharSideAt(x, z, side = 1, chan = null) {
  const sideSign = side === 'right' || side === -1 ? -1 : 1;
  let q = chan ? projectChannel(chan, x, z) : riverAt(x, z);
  if (!q) q = streamAt(x, z);
  const base = bankCharAt(x, z);
  const signedBend = q ? clamp(q.curvature * 55, -1, 1) : 0;
  const inner = Math.max(0, signedBend * sideSign);
  const outer = Math.max(0, -signedBend * sideSign);
  return {
    mud: clamp(base.mud + outer * 0.18 - inner * 0.12, 0, 1),
    bar: clamp(base.bar * (1 - 0.35 * outer) + inner * 0.82, 0, 1),
    erosion: clamp(outer * 0.9 + (1 - base.bar) * 0.12, 0, 1),
    bare: clamp(outer * 0.78 + base.mud * 0.18, 0, 1),
    apron: clamp(1 + inner * 0.65 - outer * 0.35, 0.55, 1.7),
    inner, outer, curvature: q ? q.curvature : 0, side: sideSign,
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
  const rowS = new Float64Array(samples.length);
  for (let i = 1; i < samples.length; i++) rowS[i] = rowS[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
  const sScale = chan.length / (rowS[rowS.length - 1] || 1);
  for (let i = 0; i < samples.length; i++) {
    const s = rowS[i] * sScale;
    const [x, z] = samples[i];
    const [xa, za] = samples[Math.max(0, i - 1)];
    const [x2, z2] = samples[Math.min(samples.length - 1, i + 1)];
    let dx = x2 - xa, dz = z2 - za;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const lake = lakeAt(x, z);
    const profile = profileAtS(chan, s);
    // inside a lake the channel surface ducks under the lake sheet — the
    // lake plane renders on top and the "canal crossing the lake" vanishes
    let yRow = lake ? Math.min(profile.level, lake.level - 0.35) : profile.level;
    const mouth = isStream ? chan.confluence : null;
    const mouthFactor = mouth && mouth.type !== 'continuation'
      ? clamp((s - (chan.length - mouth.approachDistance)) / mouth.approachDistance, 0, 1)
      : 0;
    // The canonical profile already performs the approach blend. Only the
    // final geometric overlap is submerged, and the segment query sees the
    // same profile rather than an unducked source spline.
    if (isStream && mouth && mouth.type === 'river' && !lake) {
      const rv = riverAt(x, z);
      if (rv && rv.d < rv.hw + 1.5) yRow = Math.min(yRow, rv.level - mouth.submergedOffset);
    }
    rows.push({ x, z, y: yRow, dx, dz, hw: profile.hw, lake, chan, s,
      curvature: profile.curvature, mouthFactor, confluence: mouthFactor > 0 ? mouth : null });
  }
  return rows;
}
