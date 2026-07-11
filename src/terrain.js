// Terrain: real Taurene DEM -> carved, painted, walkable ground.
// The height field is shared by every era (the land itself is the constant);
// only the vertex colours (land use) change with time.
import * as THREE from 'three';
import { HM_GRID, HM_SPAN, HM_OFF_X, HM_OFF_Z, decodeHeightmap } from './heightmap.js';
import { RIVER_PTS, STREAMS, LAKES, CELL } from './geodata.js';
import { PADS, BUMPS, fieldAt, distToRoad, distToRoadEx, forestDensity, distToRiver, distToStreams, FIELD_COLORS, LOC } from './landuse.js';
import { RIVER, STREAM_CHANNELS, LAKE_SHORES, riverAt, streamAt, lakeAt, lakeShoreWavyAt, bankCharAt, confluenceAt, lakeShoreSignedDistAt } from './riverzone.js';
import { makeNoise, clamp, lerp, smoothstep, pointInPoly } from './util.js';
import { SAT_JPEG_B64 } from './sat2025.js';

const noise = makeNoise(1907);
const G = HM_GRID, SPAN = HM_SPAN, OX = HM_OFF_X, OZ = HM_OFF_Z;
const field = decodeHeightmap(); // Float32, row-major, north = row 0

const RIVER_ROW_BK = 32;
const riverRowBuckets = new Map();
const riverRows = RIVER.samples.map((p, i) => {
  const a = RIVER.samples[Math.max(0, i - 1)], b = RIVER.samples[Math.min(RIVER.samples.length - 1, i + 1)];
  let tx = b[0] - a[0], tz = b[1] - a[1];
  const len = Math.hypot(tx, tz) || 1;
  tx /= len; tz /= len;
  return { x: p[0], z: p[1], level: p[2], hw: p[3], tx, tz, nx: -tz, nz: tx };
});
for (const row of riverRows) {
  const k = Math.floor(row.x / RIVER_ROW_BK) * 8192 + Math.floor(row.z / RIVER_ROW_BK);
  if (!riverRowBuckets.has(k)) riverRowBuckets.set(k, []);
  riverRowBuckets.get(k).push(row);
}
function riverRowFloor(x, z, h) {
  // returns h lifted by the meander-pan floor. Per-row lifts FADE toward the
  // row's along-limit — a hard cutoff snapped the floor on/off across one
  // sample where reaches end (worst at confluences, ~1.8m walls).
  const bx = Math.floor(x / RIVER_ROW_BK), bz = Math.floor(z / RIVER_ROW_BK);
  let lifted = h;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const arr = riverRowBuckets.get((bx + dx) * 8192 + (bz + dz));
    if (!arr) continue;
    for (const row of arr) {
      const rx = x - row.x, rz = z - row.z;
      const along = Math.abs(rx * row.tx + rz * row.tz);
      if (along > 10) continue;              // lateral bank row, not along-channel distance
      const lateral = Math.abs(rx * row.nx + rz * row.nz);
      if (lateral <= row.hw + 4.2 || lateral > row.hw + 24) continue;
      const minH = row.level - 0.5 + 0.75 * smoothstep(row.hw + 4.2, row.hw + 15, Math.min(lateral, row.hw + 15));
      const target = Math.min(row.level - 0.55, minH);
      if (target <= h) continue;
      // fade at the row's along-limit AND at the lateral outer edge — hard
      // cutoffs snapped ~1.7m walls where compound mouth pans outran the window
      const w = (1 - smoothstep(7, 10, along)) * (1 - smoothstep(row.hw + 15, row.hw + 24, lateral));
      lifted = Math.max(lifted, h + w * (target - h));
    }
  }
  return lifted;
}

// ---- one-time sculpt of the base field ----------------------------------
function cellToWorld(gx, gy) {
  return [((gx / (G - 1)) - 0.5) * SPAN + OX, ((gy / (G - 1)) - 0.5) * SPAN + OZ];
}
(function sculpt() {
  // channel carving by POINT STAMPING (exact + fast at any map size):
  // each water point lowers the cells inside its radius; candidates are
  // computed from the pristine field so overlapping stamps stay idempotent.
  const field0 = new Float32Array(field);
  const worldToCell = (x, z) => [
    (((x - OX) / SPAN) + 0.5) * (G - 1),
    (((z - OZ) / SPAN) + 0.5) * (G - 1),
  ];
  function stamp(px, pz, radius, inner, target) {
    const [cx, cy] = worldToCell(px, pz);
    const cr = Math.ceil(radius / CELL) + 1;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
      const gx = Math.round(cx) + dx, gy = Math.round(cy) + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(x - px, z - pz);
      if (d > radius) continue;
      const i = gy * G + gx;
      const cand = lerp(field0[i], Math.min(field0[i], target), smoothstep(radius, inner, d));
      if (cand < field[i]) field[i] = cand;
    }
  }
  function pin(px, pz, target) {
    const [cx, cy] = worldToCell(px, pz);
    const gx0 = Math.floor(cx), gy0 = Math.floor(cy);
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const gx = Math.min(G - 1, Math.max(0, gx0 + dx));
      const gy = Math.min(G - 1, Math.max(0, gy0 + dy));
      const i = gy * G + gx;
      if (target < field[i]) field[i] = target;
    }
  }
  function normalAt(samples, i) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    return [-dz, dx];
  }
  function pinWaterRows() {
    // final pins: the DEM grid is 27.6m, water rows are ~4m — without
    // four-corner anchors heightAt() can interpolate back above the bed
    for (let i = 0; i < RIVER.samples.length; i++) {
      const [x, z, y, hw] = RIVER.samples[i];
      const [nx, nz] = normalAt(RIVER.samples, i);
      pin(x, z, y - 2.45);
      pin(x + nx * hw * 0.6, z + nz * hw * 0.6, y - 0.55);
      pin(x - nx * hw * 0.6, z - nz * hw * 0.6, y - 0.55);
    }
    for (const chan of STREAM_CHANNELS) {
      for (const [x, z, y] of chan.samples) pin(x, z, y - 1.15);
    }
  }
  // soft valley profile — kept narrow: the old 50m radius carved whole
  // floodplains a metre below the waterline and the river read as an
  // elevated canal crossing a sunken pan
  for (const p of RIVER_PTS) stamp(p[0], p[1], 32, 13, p[2] - 1.7);
  // …and a tight channel stamped along the RIBBON SPLINE itself: the water
  // mesh follows the Catmull-Rom curve between the OSM points, which bulges
  // off the point-stamped corridor on bends and left the river beheaded by
  // untouched ground in places
  const waterSamples = [];   // [x, z, level, halfWidth] along every carved channel
  // riverzone owns the RUGGED water edge, so the carve follows the same
  // width the ribbon and skirt render instead of a fixed centerline collar
  for (const [x, z, y, hw] of RIVER.samples) {
    stamp(x, z, hw * 2.0, hw * 0.72, y - 2.45);
    // shallow SHELF beyond the rendered edge: guarantees no 17m-cell
    // terrain triangle can bulge up through the ribbon or skirt
    stamp(x, z, hw + 5.5, hw + 3.5, y - 0.55);
    waterSamples.push([x, z, y, hw]);
  }
  for (let si = 0; si < STREAMS.length; si++) {
    const s = STREAMS[si];
    for (const p of s.pts) stamp(p[0], p[1], 24, 6, p[2] - 0.8);
    for (const [x, z, y, hw] of STREAM_CHANNELS[si].samples) {
      stamp(x, z, hw * 3.2, hw * 0.85, y - 1.15);
      stamp(x, z, hw + 3.0, hw + 1.6, y - 0.4);
      waterSamples.push([x, z, y, hw]);
    }
  }
  pinWaterRows();
  // FLOOR CLAMP: land beyond the shore shelf can never sit below its local
  // waterline — a river keeps its floodplain flooded, not sunken. Overlapping
  // meander stamps compounded into pans carved ~1.9m below river level (the
  // Dzērbe confluence loop hung the water ribbon in mid-air over one).
  {
    const BK = 28, key = (bx, bz) => bx * 4096 + bz;
    const buckets = new Map();
    for (const s of waterSamples) {
      const k = key(Math.floor(s[0] / BK), Math.floor(s[1] / BK));
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    const R = 84;
    const P = LOC.POND;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      let dmin = 1e9, lvl = 0, hwN = 0;
      const bx = Math.floor(x / BK), bz = Math.floor(z / BK);
      // ±4 buckets: ±3 only guaranteed ~56m of the 84m clamp radius, leaving
      // unclamped sunken pans in the 56-84m ring
      for (let by = bz - 4; by <= bz + 4; by++) for (let bxx = bx - 4; bxx <= bx + 4; bxx++) {
        const arr = buckets.get(key(bxx, by));
        if (!arr) continue;
        for (const s of arr) {
          const d = Math.hypot(x - s[0], z - s[1]);
          if (d < dmin) { dmin = d; lvl = s[2]; hwN = s[3]; }
        }
      }
      if (dmin > R || dmin <= hwN + 4.2) continue;             // bed+shelf stay carved
      if (Math.hypot((x - (P.x + 4)) / 56, (z - P.z) / 38) < 1.25) continue; // pond basin
      if (lakeAt(x, z)) continue;
      const minH = lvl - 0.5 + 0.75 * smoothstep(hwN + 4.2, hwN + 15, dmin); // → lvl+0.25 past outer ring
      const i = gy * G + gx;
      if (field[i] < minH) field[i] = minH;
    }
  }
  // the mill-pond basin: a real dished bed at the Gauja bend so the pond
  // water body meets the mill and dam instead of hovering on the bank
  {
    const P = LOC.POND, lvl = LOC.POND_LEVEL;
    const RX = 56, RZ = 38;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      const nx = (x - (P.x + 4)) / RX, nz = (z - P.z) / RZ;
      const rr = Math.hypot(nx, nz);
      if (rr < 1.15) {
        const i = gy * G + gx;
        const bed = lvl - 1.2 + smoothstep(0.7, 1.15, rr) * 2.6;
        field[i] = Math.min(field[i], Math.max(bed, lvl - 1.2));
        // …and RAISE low rims to the same profile: the N/SW rims sat below
        // the waterline, so the flat pond sheet hung in the air past them
        field[i] = Math.max(field[i], Math.min(bed, lvl + 0.25) - 0.35);
      }
    }
  }

  // pads (farmyards) flatten
  for (const p of PADS) {
    const cgx = Math.round((((p.x - OX) / SPAN) + 0.5) * (G - 1));
    const cgy = Math.round((((p.z - OZ) / SPAN) + 0.5) * (G - 1));
    if (p.y === undefined) p.y = field[cgy * G + cgx];
    const cr = Math.ceil((p.r + 24) / CELL) + 1;
    for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
      const gx = cgx + dx, gy = cgy + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < p.r + 24) {
        const i = gy * G + gx;
        field[i] = lerp(field[i], p.y, smoothstep(p.r + 24, p.r * 0.55, d));
      }
    }
  }
  // lake beds: carve inside the SAME Chaikin-smoothed shoreline the water
  // mesh renders — carving the raw OSM polygon left a sunken bare strip
  // between the smoothed water edge and the coarse poly (the "pan" where
  // the Gauja meets Taurenes ezers)
  for (const lake of LAKE_SHORES) {
    const shore = lake.poly;
    const { minX, maxX, minZ, maxZ } = lake;
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const [x, z] = cellToWorld(gx, gy);
      if (x < minX - CELL || x > maxX + CELL || z < minZ - CELL || z > maxZ + CELL) continue;
      const i = gy * G + gx;
      const dSh = lakeShoreWavyAt(x, z);
      if (pointInPoly(x, z, shore)) {
        const bed = lake.level - lerp(0.18, 1.7, smoothstep(0, 30, dSh));
        field[i] = Math.min(field[i], bed);
      } else if (dSh < 9 && field[i] > lake.level && !lakeAt(x, z)) {
        const rv = riverAt(x, z);
        if (!(rv && rv.d < rv.hw + 4)) {
          field[i] = Math.min(field[i], lake.level + 0.12 + (dSh / 9) * 1.1);
        }
      }
    }
  }
  // burial barrows (low mounds — they stay in the land once raised)
  for (const b of BUMPS) {
    const gr = Math.ceil((b.r + 2) / CELL);
    const cgx = Math.round((((b.x - OX) / SPAN) + 0.5) * (G - 1));
    const cgy = Math.round((((b.z - OZ) / SPAN) + 0.5) * (G - 1));
    for (let dy = -gr; dy <= gr; dy++) for (let dx = -gr; dx <= gr; dx++) {
      const gx = cgx + dx, gy = cgy + dy;
      if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      const [x, z] = cellToWorld(gx, gy);
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < b.r) field[gy * G + gx] += b.h * (0.5 + 0.5 * Math.cos((d / b.r) * Math.PI));
    }
  }
})();

// cached lake bounds for cheap margin tests during painting
for (const lake of LAKES) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of lake.poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  lake.cx = (minX + maxX) / 2; lake.cz = (minZ + maxZ) / 2;
  lake.hx = (maxX - minX) / 2 + 40; lake.hz = (maxZ - minZ) / 2 + 40;
}

// ---- height queries -------------------------------------------------------
function baseHeight(x, z) {
  const fx = clamp((((x - OX) / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const fz = clamp((((z - OZ) / SPAN) + 0.5) * (G - 1), 0, G - 1.001);
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const u = fx - x0, v = fz - z0;
  const h = (xx, zz) => field[Math.min(zz, G - 1) * G + Math.min(xx, G - 1)];
  return lerp(lerp(h(x0, z0), h(x0 + 1, z0), u), lerp(h(x0, z0 + 1), h(x0 + 1, z0 + 1), u), v);
}
function microDamp(x, z) {
  let damp = 1;
  for (const p of PADS) damp = Math.min(damp, smoothstep(p.r * 0.6, p.r + 10, Math.hypot(x - p.x, z - p.z)));
  const rv = riverAt(x, z);
  if (rv) damp = Math.min(damp, smoothstep(3, 12, rv.d - rv.hw)); // micro noise must not breach the shore
  // main-road corridors ride a draped ribbon: micro bumps bigger than its
  // crown swallowed the carriageway in stretches
  const ri = distToRoadEx(5, x, z);
  if (ri.c <= 1 && ri.d < 14) damp = Math.min(damp, smoothstep(4, 14, ri.d));
  return damp;
}
export function heightAt(x, z) {
  const micro = (noise.fbm(x * 0.045, z * 0.045, 2) - 0.5) * 0.7 * microDamp(x, z);
  let h = baseHeight(x, z) + micro;
  const lk = lakeAt(x, z);
  if (lk) {
    const dSh = lakeShoreWavyAt(x, z);
    const bed = lk.level - lerp(0.18, 1.7, smoothstep(0, 30, dSh));
    h = Math.min(h, bed);
    const rv = riverAt(x, z);
    if (!(rv && rv.d < Math.max(rv.hw * 2.0, 34))) h = Math.max(h, bed - 0.18);
  } else {
    const inPond = Math.hypot((x - (LOC.POND.x + 4)) / 56, (z - LOC.POND.z) / 38) < 1.25;
    const rv = riverAt(x, z);
    const st = streamAt(x, z);
    // inside a mouth zone the bank LIPS would dam the receiving channel —
    // feather them out instead of a hard cut (confluenceAt is non-null only
    // for stream points near their receiver, so the cost stays off hot land)
    const conf = st ? confluenceAt(x, z, 6) : null;
    if (rv) {
      if (rv.d <= rv.hw + 4.2) {
        // bed → shelf used to be a hard cut at 0.72×hw (≈1.9m one-sample jumps)
        const k = smoothstep(rv.hw * 0.65, rv.hw * 0.79, rv.d);
        h = Math.min(h, rv.level - lerp(2.45, 0.55, k));
        // the bench outer edge was a bare wall: shelf only CEILINGS terrain
        // while the ramp beyond hw+4.2 floors it at level−0.5 — floor the
        // bench too, fading inward, and open the floor where a tributary
        // legitimately cuts through the bench on its way in
        const rfl = smoothstep(rv.hw + 1.2, rv.hw + 4.2, rv.d) * (st ? smoothstep(0.4, 2.4, st.d - st.hw) : 1);
        if (rfl > 0 && h < rv.level - 0.55) h += rfl * (rv.level - 0.55 - h);
      } else if (rv.d <= rv.hw + 15 && !inPond) {
        h = Math.max(h, rv.level - 0.5 + 0.75 * smoothstep(rv.hw + 4.2, rv.hw + 15, rv.d));
      }
      if (rv.d >= rv.hw - 1.35 && rv.d <= rv.hw + 2.7) {
        // river lip, suppressed across a tributary throat
        const lipK = conf ? smoothstep(0.6, 3.6, conf.stream.d - conf.stream.hw) : 1;
        if (h < rv.level - 0.68) h += lipK * (rv.level - 0.68 - h);
      }
    }
    if (st) {
      // mouth factor: 1 on an ordinary reach, →0 inside the receiving body
      let lipK = 1;
      if (conf) {
        if (conf.type === 'lake') lipK = smoothstep(0, 4, lakeShoreSignedDistAt(x, z));
        else lipK = rv ? smoothstep(1.5, 7.5, rv.d - rv.hw) : 1;
      }
      if (st.d <= st.hw + 1.6) {
        const k = smoothstep(st.hw * 0.79, st.hw * 0.91, st.d);
        h = Math.min(h, st.level - lerp(1.15, 0.4, k));
        // bench floor as for the river, suppressed inside the mouth so the
        // trench can hand over to the receiver's deeper bed
        const sfl = smoothstep(st.hw + 0.3, st.hw + 1.6, st.d) * lipK;
        if (sfl > 0 && h < st.level - 0.4) h += sfl * (st.level - 0.4 - h);
      }
      if (st.d >= st.hw - 1.35 && st.d <= st.hw + 2.7) {
        // stream lip, suppressed inside the receiving river/lake mouth
        if (h < st.level - 0.68) h += lipK * (st.level - 0.68 - h);
      }
    }
    if (!inPond && !(rv && rv.d <= rv.hw + 4.2) && !(st && st.d <= st.hw + 1.6)) {
      // the meander-pan floor is a LAND fix — the old rv.d<0.35 guard let
      // cross-bend and tributary rows floor the bed itself at mouths/necks
      h = riverRowFloor(x, z, h);
    }
    const dSh = lakeShoreWavyAt(x, z);
    if (dSh < 14 && !(rv && rv.d < rv.hw + 4)) {
      for (const lake of LAKE_SHORES) {
        if (x < lake.minX - CELL || x > lake.maxX + CELL || z < lake.minZ - CELL || z > lake.maxZ + CELL) continue;
        const cap = lake.level + 0.12 + (dSh / 9) * 1.1;
        // the shelf clamp used to vanish at a hard dSh=9 (a step wherever the
        // hinterland sits above the cap) — fade its strength out over 9-14m
        const k = 1 - smoothstep(9, 14, dSh);
        if (h > cap) h -= k * (h - cap);
        break;
      }
    }
  }
  return h;
}
export function slopeAt(x, z) {
  const e = 2;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

// ---- mesh -----------------------------------------------------------------
const RES = 512;
let terrainMesh = null;

// high-frequency detail so the ground doesn't read as flat vertex paint —
// multi-octave albedo modulation + a bump channel for micro-relief
// (tussocks, soil crumb), and a slope rule that bares the glacial till on
// steep river banks. All in world space so it survives the vertex paint.
let detailTex = null;
function makeDetailTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  const n = makeNoise(515);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = (n.fbm(x / 34, y / 34, 4) * 0.7 + n.noise2(x / 6.5, y / 6.5) * 0.3) * 255;
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping; // seamless tiling
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
function detailify(material, strength) {
  if (!detailTex) detailTex = makeDetailTex();
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detailTex };
    sh.uniforms.uDetailK = { value: strength };
    sh.vertexShader = 'varying vec3 vWp; varying float vSlope;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vSlope = 1.0 - normalize(normal).y;`
    );
    sh.fragmentShader = 'uniform sampler2D uDetail; uniform float uDetailK; varying vec3 vWp; varying float vSlope;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float d0 = texture2D(uDetail, vWp.xz * 0.31).r;   // soil crumb
          float d1 = texture2D(uDetail, vWp.xz * 0.09).r;   // tussocks
          float d2 = texture2D(uDetail, vWp.xz * 0.011).r;  // field-scale patchiness
          diffuseColor.rgb *= mix(1.0, (0.84 + 0.3 * d0) * (0.74 + 0.5 * d1) * (0.8 + 0.4 * d2), uDetailK);
          // sward speckle: on green ground a ~1m turf grain carries the
          // grass illusion far beyond the instanced blade rings
          float sward = texture2D(uDetail, vWp.xz * 0.9).r;
          float greenK = clamp((diffuseColor.g - diffuseColor.r) * 5.0, 0.0, 1.0);
          diffuseColor.rgb *= mix(1.0, 0.8 + 0.38 * sward, greenK * uDetailK);
          // steep ground bares mineral soil / till between the grass
          float bare = smoothstep(0.16, 0.45, vSlope + (d1 - 0.5) * 0.14);
          diffuseColor.rgb = mix(diffuseColor.rgb,
            vec3(0.40, 0.345, 0.26) * (0.7 + 0.5 * d0), bare * 0.75 * uDetailK);
        }`
      );
  };
  return material;
}

// exact height of the RENDERED terrain surface (the mesh's own triangles).
// heightAt() is the smooth field; between the 17m mesh vertices the two can
// differ by up to ~1m, which swallowed draped geometry like the roads.
let meshH = null;
export function meshHeightAt(x, z) {
  if (!meshH) return heightAt(x, z);
  const { arr, x0, z0, sx, sz, n } = meshH;
  // signed steps: after rotateX(-PI/2) the vertex rows run in DECREASING z
  const fx = clamp((x - x0) / sx, 0, n - 1.001);
  const fz = clamp((z - z0) / sz, 0, n - 1.001);
  const c = Math.floor(fx), r = Math.floor(fz);
  const u = fx - c, v = fz - r;
  const hA = arr[r * n + c], hB = arr[r * n + c + 1];
  const hC = arr[(r + 1) * n + c], hD = arr[(r + 1) * n + c + 1];
  // PlaneGeometry splits each cell A-B / C-D along the B-C diagonal
  if (u + v <= 1) return hA + (hB - hA) * u + (hC - hA) * v;
  return hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
}

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(SPAN, SPAN, RES - 1, RES - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(OX, 0, OZ);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  // record the rendered grid for meshHeightAt
  {
    const n = RES;
    const arr = new Float32Array(n * n);
    for (let i = 0; i < pos.count; i++) arr[i] = pos.getY(i);
    meshH = {
      arr, n,
      x0: pos.getX(0), z0: pos.getZ(0),
      sx: pos.getX(1) - pos.getX(0),
      sz: pos.getZ(n) - pos.getZ(0),
    };
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  if (!detailTex) detailTex = makeDetailTex();
  const bump = detailTex.clone();
  // 12m tiles at moderate strength: finer/stronger shimmers at distance
  bump.repeat.set(700, 700);
  bump.needsUpdate = true;
  const mat = detailify(new THREE.MeshLambertMaterial({
    vertexColors: true, bumpMap: bump, bumpScale: 0.35,
  }), 1.0);
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  return terrainMesh;
}

// ---- per-era painting ------------------------------------------------------
const c = new THREE.Color();
let satMaterial = null, colorMaterial = null;
const eraColorCache = [];
export function paintEra(era) {
  if (!colorMaterial) colorMaterial = terrainMesh.material;
  // era 5: the real Sentinel-2 drape replaces painted colours entirely
  if (era === 5) {
    if (!satMaterial) {
      const tex = new THREE.TextureLoader().load(
        'data:image/jpeg;base64,' + SAT_JPEG_B64,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; }
      );
      // the raw Sentinel composite reads darker than the painted eras under
      // the same Lambert rig — lift it so era-5 noon matches their noon
      satMaterial = detailify(new THREE.MeshLambertMaterial({ map: tex }), 0.55);
      satMaterial.color.setScalar(1.35);
    }
    terrainMesh.material = satMaterial;
    return;
  }
  terrainMesh.material = colorMaterial;
  const pos = terrainMesh.geometry.attributes.position;
  const col = terrainMesh.geometry.attributes.color;
  const cached = eraColorCache[era];
  if (cached) {
    col.array.set(cached);
    col.needsUpdate = true;
    return;
  }

  if (era === 0) {
    // Younger Dryas tundra: till, gravel, moss, dryas heath — no meadow green
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n1 = noise.fbm(x * 0.006, z * 0.006, 3);
      const n2 = noise.noise2(x * 0.07, z * 0.07);
      const lk = lakeAt(x, z);
      if (lk && y < lk.level + 0.15) {
        const depth = clamp((lk.level - y) / 2.2, 0, 1);
        const dSh = lakeShoreWavyAt(x, z);
        const shallowK = 1 - smoothstep(2, 22, dSh);
        const ch = bankCharAt(x, z);
        const speck = (n2 - 0.5) * 0.06;
        let r = lerp(0.34, 0.18, depth) + speck;
        let g = lerp(0.33, 0.19, depth) + speck;
        let b = lerp(0.27, 0.16, depth) + speck;
        const sand = shallowK * (0.55 + 0.35 * ch.bar);
        r = lerp(r, 0.52, sand); g = lerp(g, 0.47, sand); b = lerp(b, 0.36, sand);
        col.setXYZ(i, r, g, b);
        continue;
      }
      const dRiv = distToRiver(x, z);
      const rv = riverAt(x, z);
      let r = 0.36 + n1 * 0.13;
      let g = 0.33 + n1 * 0.10 + n2 * 0.04;
      let b = 0.23 + n2 * 0.04;
      // moss carpets (green-dark) and dryas/rust heath patches
      if (n2 > 0.62) { r += 0.05; g -= 0.015; b -= 0.05; }       // rust heath
      else if (n2 < 0.32) { r -= 0.09; g -= 0.015; b -= 0.05; }  // dark moss
      const n3 = noise.noise2(x * 0.02 + 9, z * 0.02);
      if (n3 > 0.72) { r -= 0.05; g += 0.03; b -= 0.02; }        // sedge green flushes
      // gravel outwash near water
      if (dRiv < 26) {
        const ch = rv ? bankCharAt(x, z) : { mud: 0, bar: 0 };
        const t = smoothstep(26, 7, dRiv);
        const speck = (n2 - 0.5) * 0.05 * (1 + 0.8 * ch.bar);
        const light = 0.04 * ch.bar;
        let br = 0.47 + light + speck, bg = 0.43 + light + speck * 0.8, bb = 0.37 + light + speck * 0.6;
        const mudK = ch.mud * 0.45;
        br = lerp(br, 0.26, mudK); bg = lerp(bg, 0.235, mudK); bb = lerp(bb, 0.16, mudK);
        r = lerp(r, br, t); g = lerp(g, bg, t); b = lerp(b, bb, t);
      }
      // high till ridges paler
      const high = smoothstep(210, 250, y);
      r += high * 0.08; g += high * 0.07; b += high * 0.07;
      col.setXYZ(i, r, g, b);
    }
    eraColorCache[era] = new Float32Array(col.array);
    col.needsUpdate = true;
    return;
  }

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = noise.fbm(x * 0.008, z * 0.008, 3);
    const n2 = noise.noise2(x * 0.09, z * 0.09);
    const lk = lakeAt(x, z);
    if (lk && y < lk.level + 0.15) {
      const depth = clamp((lk.level - y) / 2.2, 0, 1);
      const dSh = lakeShoreWavyAt(x, z);
      const shallowK = 1 - smoothstep(2, 22, dSh);
      const ch = bankCharAt(x, z);
      const speck = (n2 - 0.5) * 0.06;
      let r = lerp(0.30, 0.15, depth) + speck;
      let g = lerp(0.29, 0.16, depth) + speck;
      let b = lerp(0.185, 0.105, depth) + speck;
      const sand = shallowK * (0.55 + 0.35 * ch.bar);
      r = lerp(r, 0.52, sand); g = lerp(g, 0.47, sand); b = lerp(b, 0.36, sand);
      col.setXYZ(i, r, g, b);
      continue;
    }
    const dRiv = distToRiver(x, z);
    const rv = riverAt(x, z);
    const riverCh = rv ? bankCharAt(x, z) : null;

    // base meadow green, dryer on heights, lusher near water
    let r = 0.275 + n1 * 0.14 + smoothstep(200, 245, y) * 0.10;
    let g = 0.44 + n1 * 0.12 + smoothstep(60, 12, dRiv) * 0.05;
    let b = 0.155 + n2 * 0.05;

    // wildflower sparkle on open meadow (midsummer)
    if (n2 > 0.82 && dRiv < 120 && era < 3) { r += 0.16; g += 0.1; b += 0.12; }

    // forest floor — matched to where trees actually stand. The old 0.22
    // falloff floor mirrored a vegetation thinning that no longer exists;
    // it left bright meadow paint between far impostors, so from the air
    // the deep forest read as green speckle instead of closed canopy.
    const fd = forestDensity(era, x, z, y);
    if (fd > 0.4) {
      const dStage = Math.hypot(x - LOC.STEAD.x, z - LOC.STEAD.z);
      const falloff = clamp(560 / Math.max(dStage, 1), 0.85, 1);
      const t = smoothstep(0.4, 0.75, fd) * (0.35 + 0.65 * falloff);
      r = lerp(r, 0.16, t); g = lerp(g, 0.2, t); b = lerp(b, 0.09, t);
    }

    // fields
    const fa = fieldAt(era, x, z);
    if (fa) {
      const [fr, fg, fb] = FIELD_COLORS[fa.field.type];
      const t = smoothstep(0.05, 0.3, fa.edge);
      // plough-row striping
      const s = Math.sin((x * Math.cos(fa.field.rot) + z * Math.sin(fa.field.rot)) * 1.8) * 0.045;
      r = lerp(r, fr + s, t); g = lerp(g, fg + s, t); b = lerp(b, fb + s * 0.6, t);
    }

    // roads & yard earth — the real network: asphalt on today's P30 and
    // V-roads, gravel elsewhere, bare dirt on the farm tracks
    if (era >= 2) {
      const ri = distToRoadEx(era, x, z);
      if (ri.d < 2.5) {
        const t = smoothstep(2.5, -1, ri.d);
        if (era === 5 && ri.c === 0) {   // P30 only — class-1 V-roads stay gravel like their ribbons
          const lane = 0.30 + n2 * 0.03;
          r = lerp(r, lane, t); g = lerp(g, lane + 0.008, t); b = lerp(b, lane + 0.02, t);
        } else if (ri.c === 3) {
          r = lerp(r, 0.42, t); g = lerp(g, 0.35, t); b = lerp(b, 0.25, t);
        } else {
          r = lerp(r, 0.44, t); g = lerp(g, 0.36, t); b = lerp(b, 0.26, t);
        }
      }
    }
    for (const p of PADS) {
      if (era === 1 && p !== PADS[2]) continue;             // only the camp pad reads as trodden in AD 50
      if (era === 2 && Math.hypot(x - LOC.MANOR.x, z - LOC.MANOR.z) < 80) continue;
      if (era <= 2 && Math.hypot(x - LOC.KROGS.x, z - LOC.KROGS.z) < 40) continue;
      if (era <= 2 && Math.hypot(x - LOC.BREZGA.x, z - LOC.BREZGA.z) < 30) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r * 0.75) {
        const t = smoothstep(p.r * 0.75, p.r * 0.3, d) * 0.7;
        r = lerp(r, 0.42 + n2 * 0.06, t); g = lerp(g, 0.35, t); b = lerp(b, 0.24, t);
      }
    }

    // water margins, edge-relative: bed -> wet edge -> bank -> damp grass
    let wet = 0, riverBed = false;
    if (rv) {
      const hw = rv.hw;
      if (rv.d < hw - 0.5) {
        riverBed = true;
        const t = clamp((rv.level - y) / 2.4, 0, 1);
        r = lerp(0.40, 0.13, t);
        g = lerp(0.36, 0.14, t);
        b = lerp(0.26, 0.10, t);
        if (rv.d > hw - 3) {
          const grit = smoothstep(hw - 3, hw - 0.5, rv.d) * 0.45;
          const gravel = 0.36 + n2 * 0.14 * (1 + 0.8 * riverCh.bar);
          r = lerp(r, gravel + 0.05, grit); g = lerp(g, gravel, grit); b = lerp(b, gravel * 0.8, grit);
        }
      } else if (rv.d < hw + 1.5) {
        wet = Math.max(wet, smoothstep(hw + 1.5, hw - 0.5, rv.d));
      } else if (rv.d < hw + 6) {
        // the bank itself: bare sandy earth, distinct from the meadow
        const bank = smoothstep(hw + 6, hw + 2.5, rv.d);
        const light = 0.04 * riverCh.bar;
        r = lerp(r, 0.42 + light + n2 * 0.08, bank);
        g = lerp(g, 0.36 + light + n2 * 0.05, bank);
        b = lerp(b, 0.25 + light, bank);
      } else if (rv.d < hw + 20) {
        const moist = smoothstep(hw + 20, hw + 5, rv.d);
        g += moist * 0.05; r -= moist * 0.03;                   // damp grass greens up
      }
    }
    const dStr = distToStreams(x, z);
    if (dStr < 5) wet = Math.max(wet, smoothstep(5, 1.5, dStr));
    let lakeCh = null, lakeSand = 0, lakeWet = 0;
    for (const lake of LAKES) {
      if (y < lake.level + 0.22 && Math.abs(x - lake.cx) < lake.hx && Math.abs(z - lake.cz) < lake.hz) {
        // NARROW marshy waterline band — the old +0.5m onset painted a wide
        // tan beach around the whole lake
        const w = smoothstep(lake.level + 0.22, lake.level - 0.45, y) * 0.8;
        wet = Math.max(wet, w);
        if (w > lakeWet) {
          lakeWet = w;
          lakeCh = bankCharAt(x, z);
        }
        const dSh = lakeShoreWavyAt(x, z);
        lakeSand = Math.max(lakeSand, smoothstep(1.5, 0, dSh)
          * smoothstep(lake.level + 0.22, lake.level + 0.02, y) * bankCharAt(x, z).bar);
      }
    }
    if (!riverBed && wet > 0) {
      // wet ground reads marsh-green-brown, not bare mud
      let wr = 0.24, wg = 0.26, wb = 0.13;
      if (riverCh && rv.d < rv.hw + 1.5) {
        const mudK = riverCh.mud * 0.8;
        wr = lerp(wr, 0.26, mudK); wg = lerp(wg, 0.235, mudK); wb = lerp(wb, 0.16, mudK);
      }
      if (lakeCh) {
        const mudK = lakeCh.mud * 0.45;
        wr = lerp(wr, 0.20, mudK); wg = lerp(wg, 0.22, mudK); wb = lerp(wb, 0.11, mudK);
        wr = lerp(wr, 0.56 + n2 * 0.03, lakeSand);
        wg = lerp(wg, 0.50 + n2 * 0.02, lakeSand);
        wb = lerp(wb, 0.38, lakeSand);
      }
      r = lerp(r, wr, wet); g = lerp(g, wg, wet); b = lerp(b, wb, wet);
    }
    if (rv && rv.d >= rv.hw - 1 && rv.d <= rv.hw + 1) {
      // sand & pebble bars right at the rugged waterline (speckled by n2)
      const bar = smoothstep(1, 0, Math.abs(rv.d - rv.hw));
      const gravel = 0.36 + n2 * 0.14 * (1 + 0.8 * riverCh.bar);
      r = lerp(r, gravel + 0.05, bar); g = lerp(g, gravel, bar); b = lerp(b, gravel * 0.8, bar);
    }

    col.setXYZ(i, c.set(r, g, b).r, c.g, c.b);
  }
  eraColorCache[era] = new Float32Array(col.array);
  col.needsUpdate = true;
}
