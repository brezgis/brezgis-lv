// SHORE — the one cross-section law for every bank in the parish.
//
// Rivers, brooks and lakes all meet the land the same way: a bed that
// shelves down from the waterline, a bank that climbs out of it, and a
// floodplain that the water keeps near its own level. Each body contributes
// two envelopes, and heightAt applies them in a fixed order:
//
//   U  (carve)  — terrain may not rise above it: bed in the water, the bank
//                 face on land, then a steep wall so higher DEM valley sides
//                 come down to the bank top instead of burying the channel;
//   L  (fill)   — terrain may not sink below it: the same bed and bank, then
//                 a floodplain held a little above the water. The DEM is a
//                 27 m grid and happily dips below the river beside it.
//
// All carves (min) first, then the fills (max). A body's fill is switched
// off inside another body's water and bank face — otherwise a lake shore
// would dam the river flowing into it, or a brook's banks would wall off
// its own mouth. Everything is a function of the SIGNED distance to the
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
  let H, W, D, fadeA, fadeB, flood;
  if (river) {
    // Upper Gauja: grassy banks ~1 m above summer level, cut faces up to
    // ~2 m on the outer bends, long low sand/gravel point bars inside them
    H = clamp(0.62 + 1.05 * ch.outer + (n - 0.5) * 0.9 - 0.32 * ch.inner, 0.32, 2.0);
    W = lerp(2.8, 1.25, ch.outer) + ch.inner * 9.5 + ch.bar * 2.2 + n * 1.6;
    D = bedDropAt(q.curvature);
    fadeA = 28; fadeB = 38; flood = 34;
  } else {
    H = clamp(0.34 + 0.42 * ch.outer + (n - 0.5) * 0.4, 0.18, 0.95);
    W = 1.3 + ch.inner * 2.6 + n * 1.1;
    D = clamp(0.3 + q.hw * 0.17, 0.38, 0.9);
    fadeA = 16; fadeB = 24; flood = 12;
  }
  // Past the bank top the valley side climbs to whatever the DEM holds —
  // but over a floodplain bench first (wide inside a bend, where the river
  // builds land; nearly nothing on the cut side) and at a slope that runs
  // from a steep scarp on outer bends to a long grassy rise on inner ones.
  // (bench + bank capped so the wall always has room to climb before the
  // carve fades — else the DEM returned as a cliff at the fade)
  const bench = river ? Math.min(1.5 + ch.inner * 12 + n * 7, 15 - W) : Math.min(0.8 + ch.inner * 3 + n * 2, 7 - W);
  const wall = river ? lerp(0.32, 0.85, clamp(ch.outer * 0.8 + (1 - n) * 0.45, 0, 1))
    : lerp(0.35, 0.8, clamp(ch.outer + (1 - n) * 0.3, 0, 1));
  return { kind: river ? 'river' : 'stream', q, ch, e, level: q.level, H, W, D, hw: q.hw, fadeA, fadeB, flood, n, bench, wall };
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
  // low shores; reedy mud flats (wide, barely rising) alternate with firmer
  // sandy/till shores that climb within a couple of metres
  const H = clamp(0.3 + n * 0.75 + ch.bar * 0.2, 0.25, 1.2);
  const W = 1.4 + ch.mud * 7 + (1 - n) * 3;
  return { kind: 'lake', lake, ch, e, level: lake.level, H, W, D: 0, hw: 0, fadeA: 22, fadeB: 34, flood: 20, n,
    bench: Math.max(0, Math.min(2 + ch.mud * 8 + n * 4, 11 - W)), wall: lerp(0.3, 0.75, 1 - n) };
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
    return b.level - lerp(0.1, 1.25, smoothstep(0, 14, u)) - 3.55 * smoothstep(14, 95, u);
  }
  // inner (point-bar) side shelves gently, outer side drops to the scour
  const slopeW = b.hw * (0.28 + 0.62 * b.ch.inner);
  return b.level - lerp(0.1, b.D, smoothstep(0, slopeW, u));
}
function bankAt(b) {
  const t = clamp(b.e / b.W, 0, 1);
  return b.level - 0.1 + (b.H + 0.1) * ease(t);
}
// carve envelope (terrain ≤ this)
function carve(b) {
  if (b.e < 0) return bedAt(b);
  if (b.e <= b.W) return bankAt(b);
  const r = b.e - b.W - b.bench;
  // eased into the slope so the bench edge is a shoulder, not a crease
  // …and steepening with distance, as valley sides do toward the plateau
  return b.level + b.H + (r <= 0 ? 0 : (r < 3 ? r * r / 6 * b.wall : (r - 1.5) * b.wall) + 0.022 * r * r);
}
// fill envelope (terrain ≥ this)
function fill(b) {
  if (b.e < 0) return bedAt(b);
  if (b.e <= b.W) return bankAt(b);
  return b.level + lerp(b.H, 0.25, smoothstep(b.W + 4, b.W + b.flood, b.e));
}
// 0 inside body b's water + bank face, 1 clear of it
function clearOf(b) {
  return smoothstep(b.W, b.W + 4, b.e);
}

// Apply the law to a raw height. bodies may be passed in when the caller
// already queried them (the paint does).
export function shoreHeight(h, x, z, bodies = shoreBodies(x, z)) {
  if (!bodies.length) return h;
  for (const b of bodies) {
    const k = 1 - smoothstep(b.fadeA, b.fadeB, b.e);
    const u = carve(b);
    if (u < h) h += k * (u - h);
  }
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    let k = 1 - smoothstep(b.fadeA, b.fadeB, b.e);
    for (let j = 0; j < bodies.length; j++) if (j !== i) k *= clearOf(bodies[j]);
    const l = fill(b);
    if (l > h) h += k * (l - h);
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
