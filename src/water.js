// WATER — one surface for every river, brook and lake in the parish.
//
// The Gauja here flows THROUGH Brenkūzis, Dabaru ezers and Taurenes ezers,
// and its tributaries run into it and into Šķesteru ezers. Earlier builds
// drew each of those as its own sheet (ribbons for the channels, polygons
// for the lakes, collars and skirts for their banks) and every join was a
// visible overlap: a river ribbon running on through a lake, a brook sliding
// under the Gauja, tan strips riding on the meadow. Now:
//
//  * riverzone harmonises the levels (water runs downhill; a lake the river
//    crosses IS the river there) so every join is flush;
//  * the surface is ONE coverage mesh on a 2 m lattice, clipped by marching
//    triangles against the union of all water, overshooting the waterline
//    by 2 m so the shore itself is the bank rising through the sheet —
//    terrain.js builds those banks at 2 m resolution from the same law;
//  * deep lake interiors collapse to 64 m quads (flat water, no T-crack);
//  * the shader reads its optical depth from the rendered bed, so shallows
//    are clear and fade to nothing at the waterline, and deep water turns
//    the dark tea-brown of a humic Vidzeme river;
//  * reflections come from a planar mirror of the scene (the banks, trees
//    and sky as seen in the water — the main cue that water is water),
//    falling back to the sky cube where the mirror's level doesn't apply.
import * as THREE from 'three';
import { RIVER, STREAM_CHANNELS, LAKE_SHORES, riverAt, setPond, waterLevelAt, lakeAt as lakeAtFn } from './riverzone.js';
import { shoreBodies, waterSampleOf, LAKE_DRIFT } from './shore.js';
import { LOC } from './landuse.js';
import { canvasTexture, makeNoise, lerp, smoothstep, clamp } from './util.js';
import { meshHeightAt, shoreLatticeWater, releaseShoreLattice } from './terrain.js';

function waterNormalTex() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    // Blend translated noise fields across a torus: continuous values and
    // derivatives at both seams, without conspicuous parallel sine-wave bands.
    const noise = makeNoise(777).noise2;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const periodic = (u, v, scale) => {
      const x = u * scale, y = v * scale;
      return lerp(lerp(noise(x, y), noise(x - scale, y), fade(u)),
        lerp(noise(x, y - scale), noise(x - scale, y - scale), fade(u)), fade(v));
    };
    const hgt = (x, y) => {
      const u = ((x % w) + w) % w / w, v = ((y % h) + h) % h / h;
      return periodic(u, v, 7) * 0.62 + periodic(u, v, 19) * 0.26 + periodic(u, v, 41) * 0.12;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 3.2;
      const dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 3.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ------------------------------------------------------------ the surface ---
const SC = 2, CH = 32, CV = CH + 1, BLOCK = SC * CH;   // 2 m cells, 64 m blocks
const OVERSHOOT = 2.0;                                  // sheet runs 2 m under the bank
const SNAP = 0.15;                                      // min |f| at a lattice point (m)

function waterSample(x, z) {
  const ix = Math.round(x / SC), iz = Math.round(z / SC);
  if (ix * SC === x && iz * SC === z) {
    const w = shoreLatticeWater(ix, iz);
    if (w !== undefined) return w && { ...w };
  }
  return waterSampleOf(shoreBodies(x, z));
}

// Drop triangles that are degenerate or flipped once the positions are
// Float32 (kilometre coordinates round needle slivers to zero or worse).
function cleanTriangles(pos, idx) {
  const f = new Float32Array(pos), out = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const area = (f[b + 2] - f[a + 2]) * (f[c] - f[a]) - (f[b] - f[a]) * (f[c + 2] - f[a + 2]);
    if (area > 2e-3) out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  return out;
}

function buildSurface() {
  const t0 = performance.now();
  const want = new Set();
  const key = (bx, bz) => (bx + 4096) * 8192 + (bz + 4096);
  const touch = (x, z, r) => {
    for (let bx = Math.floor((x - r) / BLOCK); bx <= Math.floor((x + r) / BLOCK); bx++)
      for (let bz = Math.floor((z - r) / BLOCK); bz <= Math.floor((z + r) / BLOCK); bz++) want.add(key(bx, bz));
  };
  RIVER.samples.forEach(([x, z, , hw], i) => { if (i % 2 === 0) touch(x, z, hw + 6); });
  for (const chan of STREAM_CHANNELS) chan.samples.forEach(([x, z, , hw], i) => { if (i % 3 === 0) touch(x, z, hw + 5); });
  for (const l of LAKE_SHORES) {
    for (let x = l.minX - 8; x <= l.maxX + 8; x += BLOCK / 2)
      for (let z = l.minZ - 8; z <= l.maxZ + 8; z += BLOCK / 2) touch(x, z, 4);
  }
  const pos = [], depth = [], flow = [], idx = [];
  const vmap = new Map();
  const vkey = (x, z) => Math.round(x * 4) * 1e7 + Math.round(z * 4);
  const emitV = (x, z, s, minDepth = 0) => {
    const k = vkey(x, z);
    let i = vmap.get(k);
    if (i !== undefined) return i;
    i = pos.length / 3;
    pos.push(x, s.level, z);
    depth.push(Math.max(minDepth, s.level - meshHeightAt(x, z)));
    flow.push(s.fx, s.fz);
    vmap.set(k, i);
    return i;
  };
  let coarseQuads = 0;
  for (const bk of want) {
    const bx = Math.floor(bk / 8192) - 4096, bz = bk % 8192 - 4096;
    const x0 = bx * BLOCK, z0 = bz * BLOCK;
    // deep lake interior: one flat quad for the whole block
    {
      let deep = true, lake = null;
      for (let j = 0; j <= 4 && deep; j++) for (let i = 0; i <= 4 && deep; i++) {
        const s = waterSample(x0 + i * 16, z0 + j * 16);
        if (!s || !s.lake || s.f < 14 || (lake && s.lake !== lake)) deep = false;
        else lake = s.lake;
      }
      if (deep) {
        const s = { level: lake.level, fx: 0.6 * LAKE_DRIFT, fz: 0.8 * LAKE_DRIFT };
        // true corner depths: a forced minimum drew the block edges as
        // squares of darker water beside the finely-sampled shallows
        const a = emitV(x0, z0, s), b = emitV(x0 + BLOCK, z0, s), c = emitV(x0 + BLOCK, z0 + BLOCK, s), d = emitV(x0, z0 + BLOCK, s);
        idx.push(a, c, b, a, d, c);
        coarseQuads++;
        continue;
      }
    }
    // fine lattice + marching triangles on f = OVERSHOOT − e
    const S = new Array(CV * CV);
    let any = false;
    for (let j = 0; j < CV; j++) for (let i = 0; i < CV; i++) {
      const s = waterSample(x0 + i * SC, z0 + j * SC);
      if (s) {
        s.f += OVERSHOOT;
        // a lattice point almost ON the cut line spawns needle slivers:
        // push it just outside (the sheet runs under the bank there anyway)
        if (Math.abs(s.f) < SNAP) s.f = -SNAP;
        if (s.f > 0) any = true;
      }
      S[j * CV + i] = s;
    }
    if (!any) continue;
    const pt = (i, j) => { const s = S[j * CV + i]; return { x: x0 + i * SC, z: z0 + j * SC, f: s ? s.f : -9, s }; };
    const lerpS = (a, b, t) => {
      const sa = a.s || b.s, sb = b.s || a.s;
      return { level: lerp(sa.level, sb.level, t), fx: lerp(sa.fx, sb.fx, t), fz: lerp(sa.fz, sb.fz, t) };
    };
    const tri = (A, B, C) => {
      const poly = [];
      const P = [A, B, C];
      for (let k = 0; k < 3; k++) {
        const a = P[k], b = P[(k + 1) % 3];
        if (a.f >= 0) poly.push(a);
        if ((a.f >= 0) !== (b.f >= 0)) {
          const t = a.f / (a.f - b.f);
          poly.push({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), s: lerpS(a, b, t) });
        }
      }
      if (poly.length < 3) return;
      const vs = poly.map((p) => emitV(p.x, p.z, p.s));
      for (let k = 1; k + 1 < vs.length; k++) {
        const a = poly[0], b = poly[k], c = poly[k + 1];
        const area = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
        if (Math.abs(area) < 1e-4) continue;
        // CCW seen from above
        if (area > 0) idx.push(vs[0], vs[k], vs[k + 1]); else idx.push(vs[0], vs[k + 1], vs[k]);
      }
    };
    // 16 m sub-squares wholly out in a lake: one flat quad each
    const merged = new Uint8Array(16);
    for (let sj = 0; sj < 4; sj++) for (let si = 0; si < 4; si++) {
      let lake = null, ok = true;
      for (let j = sj * 8; j <= sj * 8 + 8 && ok; j++) for (let i = si * 8; i <= si * 8 + 8 && ok; i++) {
        const s = S[j * CV + i];
        if (!s || !s.lake || s.f < 12 + OVERSHOOT || (lake && s.lake !== lake)) ok = false; else lake = s.lake;
      }
      if (!ok) continue;
      merged[sj * 4 + si] = 1;
      const s = { level: lake.level, fx: 0.6 * LAKE_DRIFT, fz: 0.8 * LAKE_DRIFT };
      const X0 = x0 + si * 16, Z0 = z0 + sj * 16;
      const a = emitV(X0, Z0, s), b = emitV(X0 + 16, Z0, s), c = emitV(X0 + 16, Z0 + 16, s), d = emitV(X0, Z0 + 16, s);
      idx.push(a, c, b, a, d, c);
    }
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      if (merged[(j >> 3) * 4 + (i >> 3)]) continue;
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (a.f < 0 && b.f < 0 && c.f < 0 && d.f < 0) continue;
      tri(a, b, c); tri(a, c, d);
    }
  }
  releaseShoreLattice();
  const keep = cleanTriangles(pos, idx);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(keep, 1) : new THREE.Uint16BufferAttribute(keep, 1));
  geo.computeBoundingSphere();
  console.log(`[boot] water surface: ${pos.length / 3} verts, ${keep.length / 3} tris (${coarseQuads} deep-lake quads), ${(performance.now() - t0).toFixed(0)} ms`);
  return geo;
}

// -------------------------------------------------------------- material ---
const WATER_PARS = /* glsl */`
uniform sampler2D uRipple;
uniform samplerCube uSkyCube;
uniform sampler2D uRefl;
uniform mat4 uReflMatrix;
uniform float uReflOn;
uniform float uReflLevel;
uniform float uTime;
uniform vec3 uBody;        // scattering colour of the water column (linear)
uniform vec3 uSilt;        // what very shallow water tints toward
uniform float uExtinct;    // 1/m — how fast the bed disappears with depth
uniform float uPondMask;
uniform sampler2D uPondTex;
uniform vec4 uPondBounds;   // x0, z0, width, depth of the flood mask
uniform float uIsPond;
varying float vWDepth;
varying vec2 vWFlow;
varying vec3 vWPos;
`;

function makeWaterMaterial(ripple, pondBounds, pondTex) {
  const m = new THREE.MeshPhongMaterial({
    color: 0xffffff, specular: 0xffffff, shininess: 320,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  const u = {
    uRipple: { value: ripple },
    uSkyCube: { value: null },
    uRefl: { value: null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflOn: { value: 0 },
    uReflLevel: { value: -1e4 },
    uTime: { value: 0 },
    uBody: { value: new THREE.Color(0.052, 0.043, 0.025) },
    uSilt: { value: new THREE.Color(0.20, 0.18, 0.12) },
    uExtinct: { value: 1.35 },
    uPondMask: { value: 0 },
    uPondBounds: { value: pondBounds },
    uPondTex: { value: pondTex },
    uIsPond: { value: 0 },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute float aDepth;
attribute vec2 aFlow;
varying float vWDepth;
varying vec2 vWFlow;
varying vec3 vWPos;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vWDepth = aDepth;
  vWFlow = aFlow;
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = WATER_PARS + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uPondMask > 0.5 && uIsPond < 0.5) {
    vec2 pu = (vWPos.xz - uPondBounds.xy) / uPondBounds.zw;
    if (pu.x > 0.0 && pu.y > 0.0 && pu.x < 1.0 && pu.y < 1.0 && texture2D(uPondTex, pu).r > 0.5) discard;
  }
  if (vWDepth < -0.05) discard;`)
      // Ripples: a flow map. Two copies of the ripple field advect down the
      // local current on staggered clocks and cross-fade, so the pattern
      // travels with the river round every bend without ever smearing.
      .replace('#include <normal_fragment_maps>', `
  vec2 wp = vWPos.xz;
  float spd = length(vWFlow);
  float ph0 = fract(uTime * 0.11), ph1 = fract(uTime * 0.11 + 0.5);
  float wBlend = abs(ph0 - 0.5) * 2.0;
  vec2 fl = vWFlow * 6.0;
  vec2 dA = texture2D(uRipple, wp / 3.1 - fl * ph0 / 3.1).xy * 2.0 - 1.0;
  vec2 dB = texture2D(uRipple, wp / 3.1 - fl * ph1 / 3.1 + 0.37).xy * 2.0 - 1.0;
  vec2 d1 = mix(dA, dB, wBlend);
  // a slow, broad swell and a fine cat's-paw octave that no current carries
  vec2 d2 = texture2D(uRipple, wp / 11.0 + vec2(uTime * 0.006, -uTime * 0.004)).xy * 2.0 - 1.0;
  vec2 d3 = texture2D(uRipple, wp / 0.9 + vec2(-uTime * 0.03, uTime * 0.024)).xy * 2.0 - 1.0;
  float viewD = length(vViewPosition);
  // ripples are sub-pixel far away: flatten them with distance or the
  // specular lobe aliases into drifting blotches
  float lod = 1.0 - smoothstep(40.0, 300.0, viewD);
  // a lowland river is nearly glassy: the current shows as a gentle crawl
  // of ripples, not chop
  float chop = 0.035 + 0.07 * smoothstep(0.05, 0.6, spd);
  vec2 slope = (d1 * chop + d2 * 0.022 + d3 * 0.018 * lod) * mix(0.4, 1.0, lod);
  vec3 nW = normalize(vec3(-slope.x, 1.0, -slope.y));
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
`)
      .replace('#include <opaque_fragment>', `
  {
    vec3 V = normalize(cameraPosition - vWPos);
    float ndv = clamp(dot(nW, V), 0.0, 1.0);
    // Schlick with water's F0 = 0.02
    float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 R = reflect(-V, nW);
    R.y = abs(R.y);
    vec3 sky = textureCube(uSkyCube, R).rgb;
    vec3 refl = sky;
    // planar mirror of the world, valid for water near its level
    float mk = uReflOn * (1.0 - smoothstep(0.5, 1.8, abs(vWPos.y - uReflLevel)));
    if (mk > 0.001) {
      vec4 ru = uReflMatrix * vec4(vWPos, 1.0);
      vec2 rUv = ru.xy / ru.w + (d1 * chop + d2 * 0.022) * 0.35;
      vec4 mir = texture2D(uRefl, clamp(rUv, vec2(0.001), vec2(0.999)));
      refl = mix(sky, mir.rgb, mk * mir.a);
    }
    // optical depth → how much of the bed shows through
    float d = max(vWDepth, 0.0);
    float T = exp(-d * uExtinct);
    // the water column's own colour, lit like any diffuse thing
    vec3 lit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 column = mix(uBody, uSilt, T * 0.5) * lit / max(diffuseColor.rgb, vec3(1e-3));
    float a = (1.0 - T) * (1.0 - fres) + fres;
    refl *= 0.86;
    vec3 col = (column * (1.0 - T) * (1.0 - fres) + refl * fres) / max(a, 1e-3);
    col += reflectedLight.directSpecular * 0.9;
    // the waterline itself: no hard sheet edge where depth → 0
    a *= smoothstep(0.0, 0.12, d);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`);
  };
  m.customProgramCacheKey = () => 'water-v3';
  return m;
}

// ------------------------------------------------------------- mill pond ---
// The manor weir backs the Gauja up by 0.8 m. The pond is whatever that
// floods: every lattice cell upstream of the dam line, connected to it,
// whose rendered ground lies below the pond level — until the river's own
// level climbs to meet the pond (the head of the backwater). Its shores are
// wherever the real terrain rises out of it; only the dam line and the
// backwater head are cut straight, and the dam covers the first.
function floodPond() {
  const D = LOC.DAM, L = LOC.POND_LEVEL, S = 2, R = 1200, N = Math.ceil((2 * R) / S);
  const gx0 = Math.round((D.x - R) / S), gz0 = Math.round((D.z - R) / S);
  const cell = new Uint8Array(N * N);             // 0 unseen, 1 flooded, 2 dry/cut
  const stack = [[Math.round((D.x - D.dx * 5) / S) - gx0, Math.round((D.z - D.dz * 5) / S) - gz0]];
  let minI = N, maxI = 0, minJ = N, maxJ = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    if (i < 0 || j < 0 || i >= N || j >= N || cell[j * N + i]) continue;
    const x = (gx0 + i) * S, z = (gz0 + j) * S;
    let wet = (x - D.x) * D.dx + (z - D.z) * D.dz < -0.5 && meshHeightAt(x, z) < L;
    if (wet) {
      const rv = riverAt(x, z);
      if (rv && rv.d < rv.hw + 2 && rv.level >= L - 0.02) wet = false;   // the backwater's head
    }
    cell[j * N + i] = wet ? 1 : 2;
    if (!wet) continue;
    if (i < minI) minI = i; if (i > maxI) maxI = i; if (j < minJ) minJ = j; if (j > maxJ) maxJ = j;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const nx = maxI - minI + 3, nz = maxJ - minJ + 3;
  const data = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const si = minI - 1 + i, sj = minJ - 1 + j;
    if (si >= 0 && sj >= 0 && si < N && sj < N && cell[sj * N + si] === 1) data[j * nx + i] = 1;
  }
  // mask cells are CENTRED on lattice points
  return { level: L, x0: (gx0 + minI - 1) * S - S / 2, z0: (gz0 + minJ - 1) * S - S / 2, S, nx, nz, data,
    lx0: gx0 + minI - 1, lz0: gz0 + minJ - 1 };
}

function pondGeometry(P) {
  const S = P.S, L = P.level;
  const inRegion = (i, j) => i >= 0 && j >= 0 && i < P.nx && j < P.nz && P.data[j * P.nx + i] === 1;
  const pos = [], depth = [], flow = [], idx = [];
  const vmap = new Map();
  const V = (x, z) => {
    const k = Math.round(x * 4) * 1e7 + Math.round(z * 4);
    if (vmap.has(k)) return vmap.get(k);
    const i = pos.length / 3;
    pos.push(x, L, z);
    depth.push(L - meshHeightAt(x, z));
    const rv = riverAt(x, z);
    flow.push(rv ? rv.dx * 0.06 : 0.01, rv ? rv.dz * 0.06 : 0.01);
    vmap.set(k, i);
    return i;
  };
  const F = (i, j) => {
    const x = (P.lx0 + i) * S, z = (P.lz0 + j) * S, g = meshHeightAt(x, z);
    let f = inRegion(i, j) ? L - g + 0.15 : g < L ? -0.5 : L - g + 0.15;
    if (Math.abs(f) < 0.04) f = -0.04;          // no needle slivers (see SNAP)
    return { x, z, f };
  };
  const cache = new Map();
  const at = (i, j) => { const k = j * 100000 + i; let v = cache.get(k); if (!v) cache.set(k, v = F(i, j)); return v; };
  const tri = (A, B, C) => {
    const poly = [], P3 = [A, B, C];
    for (let k = 0; k < 3; k++) {
      const a = P3[k], b = P3[(k + 1) % 3];
      if (a.f >= 0) poly.push(a);
      if ((a.f >= 0) !== (b.f >= 0)) {
        const t = a.f / (a.f - b.f);
        poly.push({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) });
      }
    }
    for (let k = 1; k + 1 < poly.length; k++) {
      const a = poly[0], b = poly[k], c = poly[k + 1];
      const area = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      if (Math.abs(area) < 1e-4) continue;
      const va = V(a.x, a.z), vb = V(b.x, b.z), vc = V(c.x, c.z);
      if (area > 0) idx.push(va, vb, vc); else idx.push(va, vc, vb);
    }
  };
  for (let j = -1; j < P.nz; j++) for (let i = -1; i < P.nx; i++) {
    if (!inRegion(i, j) && !inRegion(i + 1, j) && !inRegion(i, j + 1) && !inRegion(i + 1, j + 1)) continue;
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    tri(a, b, c); tri(a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geo.setIndex(cleanTriangles(pos, idx));
  geo.computeBoundingSphere();
  return geo;
}

// ----------------------------------------------------------------- lilies ---
function lilyPadGeometry() {
  // a round leaf with the deep basal notch, lying flat
  const sh = new THREE.Shape();
  const N = 14, notch = 0.32;
  sh.moveTo(0, 0);
  for (let i = 0; i <= N; i++) {
    const a = notch + (i / N) * (Math.PI * 2 - 2 * notch);
    sh.lineTo(Math.cos(a), Math.sin(a));
  }
  sh.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
  return g;
}
function buildLilies() {
  const group = new THREE.Group();
  group.name = 'water:lilies';
  const rng = makeNoise(6161).rng, patchN = makeNoise(6162);
  const pads = [], flowers = [];
  const tryBed = (x, z, level, pondOnly) => {
    if (patchN.fbm(x * 0.02, z * 0.02, 2) < 0.52) return;
    const n = 40 + (rng() * 90) | 0, R = 2.5 + rng() * 5;
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * R;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const d = level - meshHeightAt(px, pz);
      if (d < 0.4 || d > 2.1) continue;
      const rv = riverAt(px, pz);
      if (!pondOnly && rv && rv.d < rv.hw && !lakeAtFn(px, pz)) continue;   // not in the current
      const yellow = rng() < 0.55;
      pads.push([px, level + 0.012 + rng() * 0.004, pz, rng() * 6.28, (yellow ? 0.16 : 0.13) + rng() * 0.1, rng(), pondOnly]);
      if (rng() < 0.07) flowers.push([px + 0.05, level + 0.05, pz, yellow, pondOnly]);
    }
  };
  for (const l of LAKE_SHORES) {
    const P = l.poly;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < L; t += 9) {
        const x = a[0] + (b[0] - a[0]) * t / L, z = a[1] + (b[1] - a[1]) * t / L;
        // step inward (the side lakeAt calls water)
        let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
        if (!lakeAtFn(x + nx * 4, z + nz * 4)) { nx = -nx; nz = -nz; }
        const off = 6 + rng() * 16;
        tryBed(x + nx * off, z + nz * off, l.level, false);
      }
    }
  }
  const P = LOC.DAM;   // the still mill reach, eras 3-4
  if (P) for (let k = 0; k < 40; k++) {
    const s = -30 - rng() * 400, q = riverAt(P.x - P.dx * -s, P.z - P.dz * -s);
    if (!q) continue;
    const side = rng() < 0.5 ? -1 : 1, off = q.hw - 1 - rng() * 3;
    tryBed(q.x - q.dz * side * off, q.z + q.dx * side * off, LOC.POND_LEVEL, true);
  }
  const padMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mk = (list) => {
    const m = new THREE.InstancedMesh(lilyPadGeometry(), padMat, Math.max(1, list.length));
    const d = new THREE.Object3D(), c = new THREE.Color();
    list.forEach(([x, y, z, rot, sc, tint], i) => {
      d.position.set(x, y, z); d.rotation.set(0, rot, 0); d.scale.setScalar(sc); d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      // glossy mid-dark green; some white-lily leaves still bronzed young
      if (tint > 0.95) c.setRGB(0.19, 0.14, 0.07);
      else c.setRGB(0.07 + tint * 0.05, 0.17 + tint * 0.07, 0.05 + tint * 0.02);
      m.setColorAt(i, c);
    });
    m.count = list.length;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    return m;
  };
  const padsLake = mk(pads.filter((p) => !p[6])), padsPond = mk(pads.filter((p) => p[6]));
  padsLake.name = 'lily-pads'; padsPond.name = 'lily-pads-pond';
  // flowers: a yellow cup (Nuphar) or a white star (Nymphaea)
  const fGeo = new THREE.SphereGeometry(0.045, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const fMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const fl = new THREE.InstancedMesh(fGeo, fMat, Math.max(1, flowers.length));
  { const d = new THREE.Object3D(), c = new THREE.Color();
    flowers.forEach(([x, y, z, yellow], i) => {
      d.position.set(x, y - 0.03, z); d.rotation.set(0, 0, 0);
      d.scale.set(yellow ? 0.8 : 1.5, yellow ? 0.9 : 0.5, yellow ? 0.8 : 1.5); d.updateMatrix();
      fl.setMatrixAt(i, d.matrix);
      fl.setColorAt(i, yellow ? c.setRGB(0.95, 0.8, 0.15) : c.setRGB(0.95, 0.95, 0.9));
    });
    fl.count = flowers.length; fl.computeBoundingSphere(); fl.name = 'lily-flowers'; }
  group.add(padsLake, padsPond, fl);
  console.log(`[boot] water-lilies: ${pads.length} pads, ${flowers.length} flowers`);
  return {
    group,
    setEra(era) {
      group.visible = era !== 0;
      padsPond.visible = era === 3 || era === 4;
    },
  };
}

// ------------------------------------------------------------ reflection ---
// Planar mirror at the level of the water nearest the camera. Rendered at
// half resolution, only while water that level is close enough to matter.
function makeReflector() {
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
  rt.texture.generateMipmaps = false;
  const cam = new THREE.PerspectiveCamera();
  const tm = new THREE.Matrix4();
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const view = new THREE.Vector3(), target = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const rot = new THREE.Matrix4(), N = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3();
  const size = new THREE.Vector2();
  let scale = 0.5;
  function render(renderer, scene, camera, level, hide) {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(16, Math.round(size.x * scale)), h = Math.max(16, Math.round(size.y * scale));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    P.set(0, level, 0);
    const camPos = camera.getWorldPosition(view.clone());
    if (camPos.y < level) return false;
    // mirror across the horizontal plane through the water level
    view.set(camPos.x, 2 * level - camPos.y, camPos.z);
    rot.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.set(lookAt.x, 2 * level - lookAt.y, lookAt.z);
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
    cam.lookAt(target);
    cam.far = camera.far; cam.near = camera.near; cam.fov = camera.fov; cam.aspect = camera.aspect;
    cam.layers.mask = camera.layers.mask | 2;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique near plane at the water (Lengyel), a little below it so the
    // waterline itself doesn't fringe
    plane.setFromNormalAndCoplanarPoint(N, P.set(0, level - 0.05, 0)).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
    q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
    q.z = -1; q.w = (1 + pm[10]) / pm[14];
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1; pm[14] = clip.w;
    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.needsUpdate = prevShadow;
    hide.forEach((o, i) => { o.visible = vis[i]; });
    return true;
  }
  return { rt, tm, render, setScale: (k) => { scale = k; } };
}

// nearest open water to a point: its level and horizontal distance
const probe = [];
for (const chan of [RIVER, ...STREAM_CHANNELS]) {
  chan.samples.forEach((p, i) => { if (i % 2 === 0 && !chan.lakeRun[i]) probe.push([p[0], p[1], p[2], p[3]]); });
}
for (const l of LAKE_SHORES) for (const [x, z] of l.poly) probe.push([x, z, l.level, 0]);
function nearestWater(x, z) {
  let bd = Infinity, lvl = null;
  for (const p of probe) {
    const d = Math.hypot(p[0] - x, p[1] - z) - p[3];
    if (d < bd) { bd = d; lvl = p[2]; }
  }
  return { d: Math.max(0, bd), level: lvl };
}

export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  const ripple = waterNormalTex();
  const P = floodPond();
  setPond(P);                                   // vegetation, wading, ducks ask riverzone
  const pondTex = new THREE.DataTexture(P.data.map((v) => v * 255), P.nx, P.nz, THREE.RedFormat, THREE.UnsignedByteType);
  pondTex.magFilter = pondTex.minFilter = THREE.NearestFilter;
  pondTex.needsUpdate = true;
  const pondBounds = new THREE.Vector4(P.x0, P.z0, P.nx * P.S, P.nz * P.S);

  const mat = makeWaterMaterial(ripple, pondBounds, pondTex);
  const surface = new THREE.Mesh(buildSurface(), mat);
  surface.name = 'water:surface';
  surface.renderOrder = 1;
  group.add(surface);

  const pondLevel = P.level;
  const pondMat = makeWaterMaterial(ripple, pondBounds, pondTex);
  pondMat.userData.u.uIsPond.value = 1;
  const pond = new THREE.Mesh(pondGeometry(P), pondMat);
  pond.name = 'pond';
  pond.visible = false;
  pond.renderOrder = 1;
  group.add(pond);
  console.log(`[boot] mill pond: ${(P.data.reduce((a, v) => a + v, 0) * 4 / 1e4).toFixed(1)} ha backwater at ${pondLevel.toFixed(2)} m`);

  // Water-lilies: yellow (Nuphar lutea, dzeltenā lēpe) and white (Nymphaea
  // alba, baltā ūdensroze) — patchy beds in sheltered lake shallows 0.4-2 m
  // deep, and on the still mill reach when it exists. Holocene plants: none
  // on the tundra lakes.
  const lilies = buildLilies();
  group.add(lilies.group);

  const mats = [mat, pondMat];
  const reflector = makeReflector();
  for (const m of mats) m.userData.u.uRefl.value = reflector.rt.texture;

  // Rises: a fish takes a fly and a ring spreads and fades. A few at a time,
  // only on open water deep enough to hold fish, within sight of the camera.
  const RISES = 10;
  const riseGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
  const riseMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.3, depthWrite: false });
  const rises = [];
  for (let i = 0; i < RISES; i++) {
    const m = new THREE.Mesh(riseGeo, riseMat.clone());
    m.visible = false; m.renderOrder = 2; m.name = 'water:rise';
    group.add(m);
    rises.push({ m, t0: -1, dur: 1 });
  }
  const rrng = makeNoise(4242).rng;
  let riseEra = 4;
  function tick(t, cam = null, dt = 0) {
    for (const m of mats) m.userData.u.uTime.value = t;
    if (!cam || riseEra === 0) return;
    for (const r of rises) {
      if (r.t0 < 0) {
        // try a spot: a real, deep, open patch of water near the camera
        if (rrng() > dt * 0.6) continue;
        const a = rrng() * Math.PI * 2, d = 6 + rrng() * 55;
        const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
        const L = waterLevelAt(x, z, riseEra);
        if (!(L > -1e9) || cam.y - L > 60 || L - meshHeightAt(x, z) < 0.5) continue;
        r.t0 = t; r.dur = 2.2 + rrng() * 1.6;
        r.m.position.set(x, L + 0.015, z);
        r.m.visible = true;
        continue;
      }
      const k = (t - r.t0) / r.dur;
      if (k >= 1 || k < 0) { r.t0 = -1; r.m.visible = false; continue; }
      const rad = 0.08 + k * 1.3;
      r.m.scale.set(rad, 1, rad);
      r.m.material.opacity = 0.32 * (1 - k) * (1 - k);
    }
  }
  // era palettes: glacial meltwater is milky with rock flour; later rivers
  // carry the humic tea of the bogs and spruce forests upstream
  function setEra(era) {
    riseEra = era;
    lilies.setEra(era);
    const pondOn = era === 3 || era === 4;
    for (const m of mats) {
      const u = m.userData.u;
      u.uPondMask.value = pondOn ? 1 : 0;
      if (era === 0) {
        u.uBody.value.setRGB(0.055, 0.085, 0.088); u.uSilt.value.setRGB(0.2, 0.24, 0.22); u.uExtinct.value = 2.2;
      } else {
        u.uBody.value.setRGB(0.052, 0.043, 0.025); u.uSilt.value.setRGB(0.20, 0.18, 0.12); u.uExtinct.value = 1.35;
      }
    }
  }
  function applyEnvMap(tex) {
    for (const m of mats) m.userData.u.uSkyCube.value = tex;
  }
  // called by main before the frame: mirror the world at the nearest water
  let reflK = 0;
  function updateReflection(renderer, scene, camera, hide, dt = 1 / 60) {
    const c = camera.position;
    const nw = nearestWater(c.x, c.z);
    const above = nw.level === null ? 1e9 : c.y - nw.level;
    const want = nw.level !== null && above > 0.05 && above < 260 && nw.d < 700 ? 1 : 0;
    reflK += (want - reflK) * Math.min(1, dt * 3);
    const on = reflK > 0.02 && reflector.render(renderer, scene, camera, nw.level, [group, ...hide]);
    for (const m of mats) {
      const u = m.userData.u;
      u.uReflOn.value = on ? reflK * (1 - smoothstep(350, 700, nw.d)) : 0;
      u.uReflLevel.value = nw.level ?? -1e4;
      u.uReflMatrix.value.copy(reflector.tm);
    }
  }
  return { group, pond, pondLevel, tick, setEra, applyEnvMap, updateReflection, surface,
    setReflectionScale: (k) => reflector.setScale(k) };
}
