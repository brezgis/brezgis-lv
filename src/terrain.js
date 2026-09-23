// Terrain: real Taurene DEM -> carved, painted, walkable ground.
// The height field is shared by every era (the land itself is the constant);
// only the vertex colours (land use) change with time.
import * as THREE from 'three';
import { HM_GRID, HM_SPAN, HM_OFF_X, HM_OFF_Z, decodeHeightmap } from './heightmap.js';
import { RIVER_PTS, STREAMS, LAKES, CELL } from './geodata.js';
import { PADS, fieldAt, distToRoad, distToRoadEx, forestDensity, distToRiver, distToStreams, FIELD_COLORS, LOC } from './landuse.js';
import { RIVER, STREAM_CHANNELS, LAKE_SHORES, riverAt, streamAt, lakeAt, lakeShoreWavyAt, bankCharAt, bankCharFromQuery, confluenceAt, lakeShoreSignedDistAt, bedDropAt } from './riverzone.js';
import { makeNoise, clamp, lerp, smoothstep, pointInPoly } from './util.js';
import { shoreBodies, shoreHeight, nearestShore, waterSampleOf } from './shore.js';
import { SAT_JPEG_B64 } from './sat2025.js';

const noise = makeNoise(1907);
const G = HM_GRID, SPAN = HM_SPAN, OX = HM_OFF_X, OZ = HM_OFF_Z;
const field = decodeHeightmap(); // Float32, row-major, north = row 0

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
  // The channels themselves are cut by the shore law at query time
  // (shore.js) — the 27 m field only needs the floodplain floor below.
  const waterSamples = [];   // [x, z, level, halfWidth] along every channel
  for (const chan of [RIVER, ...STREAM_CHANNELS]) {
    chan.samples.forEach((p, i) => { if (!chan.lakeRun[i]) waterSamples.push(p); });
  }
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
      if (lakeAt(x, z)) continue;
      const minH = lvl - 0.5 + 0.75 * smoothstep(hwN + 4.2, hwN + 15, dmin); // → lvl+0.25 past outer ring
      const i = gy * G + gx;
      if (field[i] < minH) field[i] = minH;
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
        // Inferred littoral shelf and basin, not surveyed bathymetry.
        const bed = lake.level - lerp(0.18, 4.8, smoothstep(0, 90, dSh));
        field[i] = Math.min(field[i], bed);
      } else if (dSh < 9 && field[i] > lake.level && !lakeAt(x, z)) {
        const rv = riverAt(x, z);
        if (!(rv && rv.d < rv.hw + 4)) {
          field[i] = Math.min(field[i], lake.level + 0.12 + (dSh / 9) * 1.1);
        }
      }
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
  // main-road corridors ride a draped ribbon: micro bumps bigger than its
  // crown swallowed the carriageway in stretches
  const ri = distToRoadEx(5, x, z);
  if (ri.c <= 1 && ri.d < 14) damp = Math.min(damp, smoothstep(4, 14, ri.d));
  return damp;
}
export function heightAt(x, z) { return heightAtWith(x, z, shoreBodies(x, z)); }
function heightAtWith(x, z, bodies) {
  let damp = microDamp(x, z);
  for (const b of bodies) damp = Math.min(damp, smoothstep(2, 12, b.e));
  const micro = (noise.fbm(x * 0.045, z * 0.045, 2) - 0.5) * 0.7 * damp;
  return shoreHeight(baseHeight(x, z) + micro, x, z, bodies);
}
export function slopeAt(x, z) {
  const e = 2;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

// ---- mesh -----------------------------------------------------------------
const RES = 512;
let terrainMesh = null;

// the coarse grid discards itself wherever the shore mesh covers the ground
const MASK_N = 2048;
const shoreMaskData = new Uint8Array(MASK_N * MASK_N);
const shoreMaskTex = new THREE.DataTexture(shoreMaskData, MASK_N, MASK_N, THREE.RedFormat, THREE.UnsignedByteType);
shoreMaskTex.magFilter = shoreMaskTex.minFilter = THREE.NearestFilter;
shoreMaskTex.generateMipmaps = false;

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
    sh.uniforms.uShoreMask = { value: shoreMaskTex };
    sh.fragmentShader = 'uniform sampler2D uDetail; uniform float uDetailK; uniform sampler2D uShoreMask; varying vec3 vWp; varying float vSlope;\n' +
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        #ifdef COARSE_TERRAIN
          // the 2 m shore mesh owns this ground — the 17 m grid steps aside
          if (texture2D(uShoreMask, vec2((vWp.x - ${OX.toFixed(1)}) / ${SPAN.toFixed(1)} + 0.5,
              (vWp.z - ${OZ.toFixed(1)}) / ${SPAN.toFixed(1)} + 0.5)).r > 0.5) discard;
        #endif
      `).replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef SATELLITE_ALBEDO
          // Satellite imagery already contains illumination and deep canopy
          // shadows. Recover a usable diffuse albedo before lighting it again;
          // multiplying the raw photo made the entire modern meadow black.
          diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.65)) * 0.9
            + vec3(0.025, 0.035, 0.016);
        #endif
      `).replace(
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
          float bare = smoothstep(0.3, 0.62, vSlope + (d1 - 0.5) * 0.14);
          diffuseColor.rgb = mix(diffuseColor.rgb,
            vec3(0.40, 0.345, 0.26) * (0.7 + 0.5 * d0), bare * 0.75 * uDetailK);
        }`
      );
  };
  return material;
}

// exact height of the RENDERED terrain surface. Inside the shore corridor
// that is the 2 m shore mesh; elsewhere the 17 m grid's own triangles.
// heightAt() is the smooth field; between the 17 m vertices the two can
// differ by up to ~1 m, which swallowed draped geometry like the roads.
let meshH = null;
function coarseMeshHeightAt(x, z) {
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
export function meshHeightAt(x, z) {
  const h = shoreMeshHeightAt(x, z);
  return h === null ? coarseMeshHeightAt(x, z) : h;
}

// ---- the shore mesh ---------------------------------------------------------
// A bank is a 1-3 m feature and the terrain grid is 17 m: no amount of paint
// or collar geometry made one out of it (every earlier attempt — skirts,
// aprons, collars, draped strips — showed as a strip lying ON the meadow).
// So the ground itself is rebuilt at 2 m wherever water meets land: every
// river and brook out to ~20 m past its waterline, every lake shore ±20 m.
// Its heights are heightAt() exactly (the shore law), feathered onto the
// coarse grid's own surface over the outer 6 m so the two meet without a
// seam; the coarse grid discards its fragments underneath via a mask.
const SC = 2, CH = 32, CV = CH + 1;          // cell m, cells per chunk, verts per chunk side
const chunks = new Map();
const ckey = (cx, cz) => (cx + 4096) * 8192 + (cz + 4096);
function corridorKeep(bodies) {
  let keep = 0;
  for (const b of bodies) {
    let k;
    if (b.kind === 'river') k = 1 - smoothstep(13, 19, b.e);
    else if (b.kind === 'stream') k = 1 - smoothstep(5, 10, b.e);
    else k = (1 - smoothstep(11, 17, b.e)) * smoothstep(-24, -17, b.e);
    if (k > keep) keep = k;
  }
  return keep;
}
function chunkAt(ix, iz) {
  return chunks.get(ckey(Math.floor(ix / CH), Math.floor(iz / CH)));
}
// height of the shore mesh at (x,z), or null outside it
function shoreMeshHeightAt(x, z) {
  const fx = x / SC, fz = z / SC;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const cx = Math.floor(ix / CH), cz = Math.floor(iz / CH);
  const ch = chunks.get(ckey(cx, cz));
  if (!ch) return null;
  const lx = ix - cx * CH, lz = iz - cz * CH;
  if (!ch.m[lz * CH + lx]) return null;
  const u = fx - ix, v = fz - iz, h = ch.h, i = lz * CV + lx;
  const h00 = h[i], h10 = h[i + 1], h01 = h[i + CV], h11 = h[i + CV + 1];
  // cells are split along the 00-11 diagonal
  if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
  return h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function vertexH(ix, iz) {
  const ch = chunkAt(ix, iz);
  if (ch) {
    const lx = ix - ch.cx * CH, lz = iz - ch.cz * CH;
    if (lx < CV && lz < CV && ch.k[lz * CV + lx] >= 0) return ch.h[lz * CV + lx];
  }
  return coarseMeshHeightAt(ix * SC, iz * SC);
}
// The water surface is built on this same 2 m lattice: hand it the water
// samples already computed here instead of re-running the shore law.
// Returns undefined where the lattice holds no chunk.
export function shoreLatticeWater(ix, iz) {
  const ch = chunkAt(ix, iz);
  if (!ch || !ch.ws) return undefined;
  return ch.ws[(iz - ch.cz * CH) * CV + (ix - ch.cx * CH)];
}
export function releaseShoreLattice() { for (const ch of chunks.values()) { ch.ws = null; ch.tr = null; } }
let shoreTiles = [];
function buildShoreMesh() {
  const t0 = performance.now();
  // 1 · candidate chunks: every chunk a water body's corridor can touch
  const want = new Set();
  const touch = (x, z, r) => {
    const r2 = r + CH * SC * 0.75;
    for (let cx = Math.floor((x - r2) / (CH * SC)); cx <= Math.floor((x + r2) / (CH * SC)); cx++)
      for (let cz = Math.floor((z - r2) / (CH * SC)); cz <= Math.floor((z + r2) / (CH * SC)); cz++) want.add(ckey(cx, cz));
  };
  RIVER.samples.forEach(([x, z, , hw], i) => { if (i % 3 === 0) touch(x, z, hw + 20); });
  for (const chan of STREAM_CHANNELS) chan.samples.forEach(([x, z, , hw], i) => { if (i % 4 === 0) touch(x, z, hw + 10); });
  for (const lake of LAKE_SHORES) {
    const P = lake.poly;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 24);
      for (let k = 0; k < n; k++) touch(lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n), 20);
    }
  }
  // 2 · vertices: shore-law height feathered to the coarse surface by keep
  for (const key of want) {
    const cx = Math.floor(key / 8192) - 4096, cz = key % 8192 - 4096;
    const h = new Float32Array(CV * CV), k = new Float32Array(CV * CV), ws = new Array(CV * CV), tr = new Float32Array(CV * CV * TREC), hcs = new Float32Array(CV * CV);
    let any = false;
    for (let lz = 0; lz < CV; lz++) for (let lx = 0; lx < CV; lx++) {
      const x = (cx * CH + lx) * SC, z = (cz * CH + lz) * SC;
      const bodies = shoreBodies(x, z);
      const keep = bodies.length ? corridorKeep(bodies) : 0;
      const i = lz * CV + lx;
      k[i] = keep;
      ws[i] = bodies.length ? waterSampleOf(bodies) : null;
      shoreRecord(bodies, tr, i * TREC);
      if (keep <= 0) { h[i] = coarseMeshHeightAt(x, z); continue; }
      any = true;
      // feathered onto the coarse surface over the outer 6 m
      const hc = coarseMeshHeightAt(x, z);
      hcs[i] = hc;
      h[i] = lerp(hc, heightAtWith(x, z, bodies), keep);
    }
    if (!any) continue;
    const m = new Uint8Array(CH * CH);
    for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
      const i = lz * CV + lx;
      if (k[i] > 0 || k[i + 1] > 0 || k[i + CV] > 0 || k[i + CV + 1] > 0) m[lz * CH + lx] = 1;
    }
    chunks.set(key, { cx, cz, h, k, m, ws, tr, hcs });
  }
  // 3 · coarse-grid discard mask: texels whose centre is fully shore-owned
  for (const ch of chunks.values()) {
    const x0 = ch.cx * CH * SC, z0 = ch.cz * CH * SC, span = CH * SC;
    const tx0 = Math.floor(((x0 - OX) / SPAN + 0.5) * MASK_N), tx1 = Math.ceil(((x0 + span - OX) / SPAN + 0.5) * MASK_N);
    const tz0 = Math.floor(((z0 - OZ) / SPAN + 0.5) * MASK_N), tz1 = Math.ceil(((z0 + span - OZ) / SPAN + 0.5) * MASK_N);
    for (let tz = Math.max(0, tz0); tz < Math.min(MASK_N, tz1); tz++) for (let tx = Math.max(0, tx0); tx < Math.min(MASK_N, tx1); tx++) {
      const x = ((tx + 0.5) / MASK_N - 0.5) * SPAN + OX, z = ((tz + 0.5) / MASK_N - 0.5) * SPAN + OZ;
      const lx = Math.floor(x / SC) - ch.cx * CH, lz = Math.floor(z / SC) - ch.cz * CH;
      if (lx < 0 || lz < 0 || lx >= CH || lz >= CH) continue;
      const i = lz * CV + lx;
      // keep ≥ 0.85 lies ≥ 3.7 m inside the mesh's outer edge — more than a
      // texel's half-diagonal, so a discarded texel never uncovers a hole
      if (Math.min(ch.k[i], ch.k[i + 1], ch.k[i + CV], ch.k[i + CV + 1]) >= 0.85) shoreMaskData[tz * MASK_N + tx] = 255;
    }
  }
  shoreMaskTex.needsUpdate = true;
  // Wherever the coarse grid is still drawn next to a shore vertex, that
  // vertex may not sit BELOW the coarse surface: across a concave shore
  // the 17 m chord rides above the true ground and won the depth test as
  // dark facets. The mask is stepped in 4.3 m texels, so ask the mask.
  const maskAt = (x, z) => {
    const tx = Math.floor(((x - OX) / SPAN + 0.5) * MASK_N), tz = Math.floor(((z - OZ) / SPAN + 0.5) * MASK_N);
    return tx < 0 || tz < 0 || tx >= MASK_N || tz >= MASK_N ? 0 : shoreMaskData[tz * MASK_N + tx];
  };
  for (const ch of chunks.values()) {
    for (let lz = 0; lz < CV; lz++) for (let lx = 0; lx < CV; lx++) {
      const i = lz * CV + lx;
      if (ch.h[i] >= ch.hcs[i]) continue;
      const x = (ch.cx * CH + lx) * SC, z = (ch.cz * CH + lz) * SC, r = 2.3;
      if (maskAt(x - r, z - r) && maskAt(x + r, z - r) && maskAt(x - r, z + r) && maskAt(x + r, z + r)) continue;
      ch.h[i] = ch.hcs[i];
    }
    ch.hcs = null;
  }
  // 4 · render tiles: 4×4 chunks (256 m) for frustum culling
  const tiles = new Map();
  for (const ch of chunks.values()) {
    const tk = ckey(Math.floor(ch.cx / 4), Math.floor(ch.cz / 4));
    if (!tiles.has(tk)) tiles.set(tk, []);
    tiles.get(tk).push(ch);
  }
  const meshes = [];
  for (const list of tiles.values()) {
    const pos = [], nrm = [], uv = [], idx = [], rec = [];
    for (const ch of list) {
      const vi = new Int32Array(CV * CV).fill(-1);
      const vert = (lx, lz) => {
        const i = lz * CV + lx;
        if (vi[i] >= 0) return vi[i];
        const ix = ch.cx * CH + lx, iz = ch.cz * CH + lz, x = ix * SC, z = iz * SC;
        vi[i] = pos.length / 3;
        pos.push(x, ch.h[i], z);
        // normals from the global lattice, so chunk and tile borders
        // light identically on both sides
        const hx = vertexH(ix + 1, iz) - vertexH(ix - 1, iz);
        const hz = vertexH(ix, iz + 1) - vertexH(ix, iz - 1);
        const nl = Math.hypot(hx, 2 * SC, hz);
        nrm.push(-hx / nl, 2 * SC / nl, -hz / nl);
        uv.push((x - OX) / SPAN + 0.5, 0.5 - (z - OZ) / SPAN);
        for (let t = 0; t < TREC; t++) rec.push(ch.tr[i * TREC + t]);
        return vi[i];
      };
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        if (!ch.m[lz * CH + lx]) continue;
        const a = vert(lx, lz), b = vert(lx + 1, lz), c = vert(lx + 1, lz + 1), d = vert(lx, lz + 1);
        // CCW seen from above (y up, z toward the viewer's south)
        idx.push(a, c, b, a, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.userData.rec = new Float32Array(rec);
    meshes.push(geo);
  }
  shoreTiles = meshes;
  let tris = 0, verts = 0;
  for (const g of meshes) { tris += g.index.count / 3; verts += g.attributes.position.count; }
  console.log(`[boot] shore mesh: ${chunks.size} chunks, ${meshes.length} tiles, ${verts} verts, ${tris} tris, ${(performance.now() - t0).toFixed(0)} ms`);
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
  buildShoreMesh();
  colorMaterial = makeGroundMaterial(true);
  colorMaterialFine = makeGroundMaterial(false);
  terrainMesh = new THREE.Mesh(geo, colorMaterial);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  shoreMeshes = shoreTiles.map((g) => {
    const m = new THREE.Mesh(g, colorMaterialFine);
    m.receiveShadow = true;
    m.name = 'terrain:shore';
    terrainMesh.add(m);
    return m;
  });
  return terrainMesh;
}
function makeGroundMaterial(coarse) {
  if (!detailTex) detailTex = makeDetailTex();
  const bump = detailTex.clone();
  // 12m tiles at moderate strength: finer/stronger shimmers at distance
  bump.repeat.set(700, 700);
  bump.needsUpdate = true;
  const mat = detailify(new THREE.MeshLambertMaterial({
    vertexColors: true, bumpMap: bump, bumpScale: 0.35,
    // the shore mesh wins the 6 m feather band where both grids coincide
    polygonOffset: !coarse, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }), 1.0);
  if (coarse) mat.defines = { COARSE_TERRAIN: 1 };
  return mat;
}
function makeSatMaterial(tex, coarse) {
  const m = detailify(new THREE.MeshLambertMaterial({ map: tex,
    polygonOffset: !coarse, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0.55);
  m.defines = coarse ? { SATELLITE_ALBEDO: 1, COARSE_TERRAIN: 1 } : { SATELLITE_ALBEDO: 1 };
  return m;
}

// ---- per-era painting ------------------------------------------------------
const c = new THREE.Color();
let satMaterial = null, satMaterialFine = null, colorMaterial = null, colorMaterialFine = null;
let shoreMeshes = [];
const eraColorCache = [];

// Ground colour where the shore law owns the land: bed under the water,
// a dark wet line at the waterline, sand and gravel on the point bars,
// bare earth on the cut faces, lusher grass on low banks, reedy mud on the
// lake flats. Returns null when no shore reaches this point.
// Bank record: what the paint needs to know about the nearest shore, as
// 10 floats — [kind(0 river,1 stream,2 lake), e, level, H, W, inner, outer,
// bar, mud, presence]. kind −1 = no shore reaches this point.
const TREC = 10;
function shoreRecord(bodies, out, o = 0) {
  const b = bodies.length ? nearestShore(bodies) : null;
  if (!b) { out[o] = -1; return; }
  const ch = b.ch;
  out[o] = b.kind === 'river' ? 0 : b.kind === 'stream' ? 1 : 2;
  out[o + 1] = b.e; out[o + 2] = b.level; out[o + 3] = b.H; out[o + 4] = b.W;
  out[o + 5] = ch.inner ?? 0; out[o + 6] = ch.outer ?? 0; out[o + 7] = ch.bar ?? 0;
  out[o + 8] = ch.mud ?? 0; out[o + 9] = ch.presence ?? 0.5;
}
const _rec = new Float32Array(TREC);
function shoreTint(era, x, y, z, rgb, n2) {
  shoreRecord(shoreBodies(x, z), _rec);
  shoreTintRec(era, y, rgb, n2, _rec, 0);
}
function shoreTintRec(era, y, rgb, n2, R, o) {
  if (R[o] < 0) return;
  const kind = R[o] === 0 ? 'river' : R[o] === 1 ? 'stream' : 'lake';
  const b = { kind, e: R[o + 1], level: R[o + 2], H: R[o + 3], W: R[o + 4] };
  const ch = { inner: R[o + 5], outer: R[o + 6], bar: R[o + 7], mud: R[o + 8], presence: R[o + 9] };
  const tundra = era === 0;
  const speck = (n2 - 0.5) * 0.07;
  const depth = b.level - y;
  const bar = ch.bar ?? 0, mud = ch.mud ?? 0;
  const sandR = tundra ? 0.50 : 0.56, sandG = tundra ? 0.47 : 0.50, sandB = tundra ? 0.41 : 0.37;
  if (depth > -0.04) {
    // underwater: shallows show their substrate, depth fades it to silt
    const dk = smoothstep(0.1, b.kind === 'stream' ? 0.9 : 2.6, depth);
    let r = lerp(0.42, 0.34, mud) + bar * 0.08, g = lerp(0.38, 0.31, mud) + bar * 0.07, bl = lerp(0.28, 0.2, mud) + bar * 0.06;
    if (b.kind === 'lake') { r -= 0.05; g -= 0.03; bl -= 0.03; }
    r = lerp(r, 0.17, dk) + speck; g = lerp(g, 0.16, dk) + speck; bl = lerp(bl, 0.11, dk) + speck * 0.7;
    // the first decimetres under the waterline wear the same dark wet
    // colour as the band just above it: the 2 m ground triangles cross
    // the flat water in little teeth, and a colour step would draw them
    const wl = smoothstep(0.32, 0.0, depth);
    r = lerp(r, 0.2, wl); g = lerp(g, 0.2, wl); bl = lerp(bl, 0.13, wl);
    rgb[0] = r; rgb[1] = g; rgb[2] = bl;
    return;
  }
  const up = -depth;                           // metres above the water
  const e = b.e;
  if (e > b.W + 14) return;
  // how much of this bank is exposed sediment rather than turf
  const inner = ch.inner ?? 0, outer = ch.outer ?? 0;
  const steep = b.W > 0 ? clamp((b.H / b.W - 0.35) * 1.6, 0, 1) : 0;
  let sed = 0, earth = 0, wet = 0, lush = 0;
  if (b.kind === 'lake') {
    sed = smoothstep(0.55, 0.15, up) * bar * 0.9 * (1 - smoothstep(b.W * 0.7, b.W + 1, e));
    wet = smoothstep(0.3, 0.02, up) * (0.55 + 0.4 * mud);
    lush = smoothstep(b.W + 8, b.W, e) * 0.4;
  } else {
    const pres = ch.presence ?? 0.5;
    // sediment only on the bar itself — the floodplain behind it is turf
    sed = smoothstep(b.H * 0.7 + 0.25, 0.1, up) * clamp(inner * 1.1 + bar * 0.6, 0, 1) * (0.35 + 0.65 * pres)
      * (1 - smoothstep(b.W * 0.7, b.W + 1, e));
    earth = (e < b.W + 0.5 ? 1 : 0) * steep * clamp(0.3 + outer, 0, 1) * smoothstep(0.1, 0.35, up);
    wet = smoothstep(0.28, 0.03, up);
    lush = smoothstep(b.W + 8, b.W, e) * 0.45;
  }
  let [r, g, bl] = rgb;
  // damp, richer grass along the water (tundra: sedge-green flush)
  r = lerp(r, r * 0.86, lush); g = lerp(g, g * 1.08 + 0.01, lush); bl = lerp(bl, bl * 0.9, lush);
  r = lerp(r, sandR + speck, sed); g = lerp(g, sandG + speck, sed); bl = lerp(bl, sandB + speck * 0.7, sed);
  r = lerp(r, 0.36 + speck, earth); g = lerp(g, 0.29 + speck, earth); bl = lerp(bl, 0.2 + speck * 0.6, earth);
  const wr = 0.2, wg = 0.2, wb = 0.13;
  r = lerp(r, wr, wet); g = lerp(g, wg, wet); bl = lerp(bl, wb, wet);
  rgb[0] = r; rgb[1] = g; rgb[2] = bl;
}

const _rgb = [0, 0, 0];
let _n2 = 0;
// land-use colour only (fields, forest floor, roads, meadow); the shore
// tint goes on top in paintGeometry
function paintVertex(era, x, y, z) {
  if (era === 0) {
    // Younger Dryas tundra: till, gravel, moss, dryas heath — no meadow green
    const n1 = noise.fbm(x * 0.006, z * 0.006, 3);
    const n2 = noise.noise2(x * 0.07, z * 0.07);
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
    _rgb[0] = r; _rgb[1] = g; _rgb[2] = b; _n2 = n2;
    return _rgb;
  }
  const n1 = noise.fbm(x * 0.008, z * 0.008, 3);
  const n2 = noise.noise2(x * 0.09, z * 0.09);
  const dRiv = distToRiver(x, z);

  // base meadow green, dryer on heights, lusher near water
  let r = 0.17 + n1 * 0.09 + smoothstep(200, 245, y) * 0.06;
  let g = 0.29 + n1 * 0.09 + smoothstep(60, 12, dRiv) * 0.035;
  let b = 0.085 + n2 * 0.035;

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
    r = lerp(r, 0.09, t); g = lerp(g, 0.14, t); b = lerp(b, 0.055, t);
  }

  // fields
  const fa = fieldAt(era, x, z);
  if (fa) {
    const [fr, fg, fb] = FIELD_COLORS[fa.field.type];
    // soft underpaint only: the draped parcel decals (eras.js) carry the
    // sharp edges and the rows
    const t = smoothstep(0.05, 0.3, fa.edge);
    r = lerp(r, fr, t); g = lerp(g, fg, t); b = lerp(b, fb, t);
  }

  // roads & yard earth — the real network: asphalt on today's P30 and
  // V-roads, gravel elsewhere, bare dirt on the farm tracks
  if (era >= 2) {
    const ri = distToRoadEx(era, x, z);
    // the ribbons carry the surface; paint only a NARROW dirt fringe and
    // a worn-green verge — the old 2.5m halo painted every road corridor
    // brown from the air (roads read as fat tan stripes)
    if (ri.d < 0.8) {
      const t = smoothstep(0.8, -1, ri.d);
      if (era === 5 && ri.c === 0) {   // P30 only — class-1 V-roads stay gravel like their ribbons
        const lane = 0.30 + n2 * 0.03;
        r = lerp(r, lane, t); g = lerp(g, lane + 0.008, t); b = lerp(b, lane + 0.02, t);
      } else if (ri.c === 3) {
        r = lerp(r, 0.42, t); g = lerp(g, 0.35, t); b = lerp(b, 0.25, t);
      } else {
        r = lerp(r, 0.44, t); g = lerp(g, 0.36, t); b = lerp(b, 0.26, t);
      }
    } else if (ri.d < 3.2) {
      const t = smoothstep(3.2, 0.8, ri.d) * 0.5;
      r = lerp(r, 0.36, t); g = lerp(g, 0.42, t); b = lerp(b, 0.20, t);   // trodden verge green
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

  _rgb[0] = r; _rgb[1] = g; _rgb[2] = b; _n2 = n2;
  return _rgb;
}

// The coarse grid is painted in full; its land colours are kept so the 2 m
// shore mesh can take its land-use colour from them and only compute the
// water-edge tint itself, from the bank record cached at build time.
let coarseLand = null;
function paintCoarse(geo, era) {
  const pos = geo.attributes.position, col = geo.attributes.color;
  if (!coarseLand) coarseLand = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rgb = paintVertex(era, x, y, z);
    coarseLand[i * 3] = rgb[0]; coarseLand[i * 3 + 1] = rgb[1]; coarseLand[i * 3 + 2] = rgb[2];
    shoreTint(era, x, y, z, rgb, _n2);
    col.setXYZ(i, c.set(rgb[0], rgb[1], rgb[2]).r, c.g, c.b);
  }
  col.needsUpdate = true;
}
function coarseLandAt(x, z, out) {
  const { x0, z0, sx, sz, n } = meshH;
  const fx = clamp((x - x0) / sx, 0, n - 1.001), fz = clamp((z - z0) / sz, 0, n - 1.001);
  const cc = Math.floor(fx), r = Math.floor(fz), u = fx - cc, v = fz - r;
  const A = (r * n + cc) * 3, B = A + 3, C = A + n * 3, D = C + 3;
  for (let k = 0; k < 3; k++) {
    out[k] = u + v <= 1
      ? coarseLand[A + k] + (coarseLand[B + k] - coarseLand[A + k]) * u + (coarseLand[C + k] - coarseLand[A + k]) * v
      : coarseLand[D + k] + (coarseLand[C + k] - coarseLand[D + k]) * (1 - u) + (coarseLand[B + k] - coarseLand[D + k]) * (1 - v);
  }
}
function paintShoreTile(geo, era) {
  const pos = geo.attributes.position, col = geo.attributes.color, R = geo.userData.rec;
  const f = era === 0 ? 0.07 : 0.09;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    coarseLandAt(x, z, _rgb);
    shoreTintRec(era, y, _rgb, noise.noise2(x * f, z * f), R, i * TREC);
    col.setXYZ(i, c.set(_rgb[0], _rgb[1], _rgb[2]).r, c.g, c.b);
  }
  col.needsUpdate = true;
}

export function paintEra(era) {
  // era 5: the real Sentinel-2 drape replaces painted colours entirely
  if (era === 5) {
    if (!satMaterial) {
      const tex = new THREE.TextureLoader().load(
        'data:image/jpeg;base64,' + SAT_JPEG_B64,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; }
      );
      satMaterial = makeSatMaterial(tex, true);
      satMaterialFine = makeSatMaterial(tex, false);
    }
    terrainMesh.material = satMaterial;
    for (const m of shoreMeshes) m.material = satMaterialFine;
    return;
  }
  terrainMesh.material = colorMaterial;
  for (const m of shoreMeshes) m.material = colorMaterialFine;
  const geos = [terrainMesh.geometry, ...shoreMeshes.map((m) => m.geometry)];
  let cached = eraColorCache[era];
  if (!cached) {
    const t0 = performance.now();
    cached = geos.map((g, i) => { if (i === 0) paintCoarse(g, era); else paintShoreTile(g, era); return new Float32Array(g.attributes.color.array); });
    eraColorCache[era] = cached;
    console.log(`[boot] painted era ${era} in ${(performance.now() - t0).toFixed(0)} ms`);
    return;
  }
  geos.forEach((g, i) => { g.attributes.color.array.set(cached[i]); g.attributes.color.needsUpdate = true; });
}
