// SHORE — the one cross-section law for every bank in the parish.
//
// The ground is a laser survey, which measures the banks but cannot see
// under water. So each body only does three things: it keeps the land beside
// it a hand above the waterline, it cuts a bed below the waterline, and it
// leads the first couple of metres of wet lip up onto the surveyed bank.
//
// Everything is a function of the SIGNED distance to the
// rugged waterline (e < 0 in the water), so the terrain, the ground paint,
// the high-resolution shore mesh and the water surface all agree on the
// line where land stops.
import { reachesAt, lakeAt, lakeShoreDistAt, bankCharFromQuery, bankCharAt, bedDropAt, LAKE_SHORES } from './riverzone.js';
import { clamp, lerp, smoothstep, makeNoise } from './util.js';
import { LOC } from './landuse.js';

const bn = makeNoise(9091);
const ease = (t) => t * (2 - t);

function channelBody(q, x, z, river) {
  const ch = bankCharFromQuery(q, x, z);
  const n = bn.fbm(x * 0.021, z * 0.021, 2);
  const e = q.d - q.hw;
  let H, W, D, fadeA, fadeB;
  if (river) {
    // H and W only describe the wet lip for the paint and the bank props.
    // The bank itself is the surveyed ground (see shoreHeight).
    H = clamp(0.5 + 0.5 * ch.outer + (n - 0.5) * 0.5 - 0.25 * ch.inner, 0.3, 1.2);
    W = lerp(2.4, 1.3, ch.outer) + n * 0.9;
    D = bedDropAt(q.curvature, q.hw);
    fadeA = 28; fadeB = 38;
  } else {
    H = clamp(0.3 + 0.3 * ch.outer + (n - 0.5) * 0.3, 0.18, 0.7);
    W = 1.0 + n * 0.7;
    D = clamp(0.22 + q.hw * 0.14, 0.25, 0.7);
    fadeA = 16; fadeB = 24;
  }
  return { kind: river ? 'river' : 'stream', q, ch, e, level: q.level, H, W, D, hw: q.hw, fadeA, fadeB, n };
}

function lakeBody(x, z) {
  const inside = lakeAt(x, z);
  const dist = lakeShoreDistAt(x, z);
  if (inside) return mkLake(inside, x, z, -dist);
  if (dist > 34) return null;
  // outside: the shore is the nearest lake's (lake shores never touch)
  let best = null, bd = 1e9;
  for (const l of LAKE_SHORES) {
    const d = Math.hypot(Math.max(l.minX - x, 0, x - l.maxX), Math.max(l.minZ - z, 0, z - l.maxZ));
    if (d < bd) { bd = d; best = l; }
  }
  return best && bd < 40 ? mkLake(best, x, z, dist) : null;
}
function mkLake(lake, x, z, e) {
  const ch = bankCharAt(x, z);
  const n = bn.fbm(x * 0.017 + 40, z * 0.017, 2);
  const H = clamp(0.3 + n * 0.5 + ch.bar * 0.2, 0.25, 0.9);
  const W = 1.6 + ch.mud * 2.5;
  return { kind: 'lake', lake, ch, e, level: lake.level, H, W, D: 0, hw: 0, fadeA: 22, fadeB: 34, n };
}

// every water body whose shore law reaches (x, z)
export function shoreBodies(x, z) {
  const out = [];
  for (const rv of reachesAt('river', x, z)) if (rv.d - rv.hw < 38) out.push(channelBody(rv, x, z, true));
  for (const st of reachesAt('stream', x, z)) if (st.d - st.hw < 24) out.push(channelBody(st, x, z, false));
  const lb = lakeBody(x, z);
  if (lb) out.push(lb);
  return out;
}

function bedAt(b) {
  const u = -b.e;                       // metres in from the waterline
  if (b.kind === 'lake') {
    // inferred littoral shelf then basin — not surveyed bathymetry
    return b.level - lerp(0.1, 1.25, smoothstep(0, 14, u)) - (b.lake.depth - 1.25) * smoothstep(14, 95, u);
  }
  // inner (point-bar) side shelves gently, outer side drops to the scour
  const slopeW = b.hw * (0.28 + 0.62 * b.ch.inner);
  return b.level - lerp(0.1, b.D, smoothstep(0, slopeW, u));
}
// freeboard: the least height land may have beside this water
function freeboard(b) {
  return b.level + lerp(0.1, 0.25, smoothstep(0, b.W + 3, b.e));
}
// 0 inside body b's water + bank face, 1 clear of it
function clearOf(b) {
  return smoothstep(b.W, b.W + 4, b.e);
}

// Apply the law to a surveyed height. The laser sees the banks but not the
// bed, so the law is short: land beside water keeps a hand of freeboard,
// the bed is cut below the waterline, and over the first W metres the wet
// lip climbs from the waterline onto the surveyed ground. Everything above
// that is the ground as it was measured. bodies may be passed in when the
// caller already queried them (the paint does).
export function shoreHeight(h, x, z, bodies = shoreBodies(x, z)) {
  if (!bodies.length) return h;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.e <= 0) continue;
    let k = 1 - smoothstep(b.fadeA, b.fadeB, b.e);
    for (let j = 0; j < bodies.length; j++) if (j !== i) k *= clearOf(bodies[j]);
    const l = freeboard(b);
    if (l > h) h += k * (l - h);
  }
  const land = h;
  for (const b of bodies) {
    if (b.e < 0) h = Math.min(h, bedAt(b));
    else if (b.e < b.W) h = Math.min(h, lerp(b.level - 0.1, land, ease(b.e / b.W)));
  }
  // the mill terrace: the bank cut back to a level yard beside the dam
  const M = LOC.MILL;
  if (M) {
    const w = smoothstep(13, 7, Math.hypot(x - M.x, z - M.z));
    if (w > 0) h = lerp(h, Math.max(M.terrace, Math.min(h, M.terrace + 0.4)), w);
  }
  return h;
}

// Signed distance to the nearest waterline among the bodies (negative in
// water) and the body that owns it — for paint, reeds and bank props.
export function nearestShore(bodies) {
  let best = null;
  for (const b of bodies) if (!best || b.e < best.e) best = b;
  return best;
}

// What the open water is doing at a point, from its shore bodies: the body
// the point is deepest inside sets the level; flow is the channel tangent
// (slower in the shallows and inside bends), a slow wind drift on lakes.
export const RIVER_FLOW = 0.42, STREAM_FLOW = 0.65, LAKE_DRIFT = 0.03;
export function waterSampleOf(bodies) {
  let best = null;
  for (const b of bodies) if (!best || b.e < best.e) best = b;
  if (!best) return null;
  let fx, fz;
  if (best.kind === 'lake') { fx = 0.6 * LAKE_DRIFT; fz = 0.8 * LAKE_DRIFT; }
  else {
    const sp = best.kind === 'river' ? RIVER_FLOW : STREAM_FLOW;
    const k = smoothstep(0, best.hw * 0.6, -best.e) * (1 - 0.4 * (best.ch.inner || 0));
    fx = best.q.dx * sp * (0.25 + 0.75 * k); fz = best.q.dz * sp * (0.25 + 0.75 * k);
  }
  return { f: -best.e, level: best.level, fx, fz, lake: best.kind === 'lake' ? best.lake : null };
}
