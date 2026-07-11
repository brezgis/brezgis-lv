// Vegetation: LAAS-pipeline trees (real branched bark tubes + captured
// twig-atlas cluster cards) in two tiers — FULL (bark+cards, casts shadow)
// near the points of interest, FAR (whole-tree impostors captured at boot
// from the finished meshes) — plus old-growth understory: ferns, mossy
// deadfall, standing snags, glacial erratic boulders, lake reeds.
// Species mix follows Vidzeme Upland ecology: spruce/pine on the high
// moraine, birch and alder along water, oaks on the terrace, manor lindens.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, fieldAt, farmSiteKept, nearStagePOI, distToRoadEx, ROAD_HALF_W, LOC } from './landuse.js';
import { RIVER_PTS } from './geodata.js';
import { RIVER, STREAM_CHANNELS, LAKE_SHORES, vegExcluded, lakeAt, riverAt, bankCharAt, bankCharSideAt, lakeShoreDistAt, waterLevelAt } from './riverzone.js';
import { buildingAt } from './footprints.js';
import { BUILDINGS_OSM, DWELLINGS_OSM } from './geodata-osm.js';
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { makeNoise, clamp, smoothstep, canvasTexture, mulberry32 } from './util.js';
import { SPECIES, buildTree, buildFern, buildLog, buildStump, buildBoulder } from './treegen.js';
import { captureTwigAtlas, captureImpostorAtlas } from './capture.js';

// one shared wind clock for every plant in the world
export const WIND = {
  time: { value: 0 },
  dir: { value: new THREE.Vector2(0.76, 0.48).normalize() },
  strength: { value: 0.55 },
};

// Hierarchical wind (LAAS Wind.ts): per-branch flex/phase in the aWind
// attribute, gust fronts travelling along the wind direction drive amplitude,
// a second axis at ×1.31 draws Lissajous ellipses, cards get a fine flutter.
export function windifyVeg(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = WIND.time;
    sh.uniforms.uWindD = WIND.dir;
    sh.uniforms.uWindS = WIND.strength;
    sh.vertexShader =
      'uniform float uWindT; uniform vec2 uWindD; uniform float uWindS; attribute vec2 aWind;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      {
        vec3 iPos = vec3(0.0);
        #ifdef USE_INSTANCING
        iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #endif
        float phase = aWind.y + fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
        float gust = 0.6 + 0.4 * sin(dot(iPos.xz, uWindD) * 0.02 - uWindT * 1.35 + phase * 0.13);
        float f1 = 0.9 + fract(phase * 1.7) * 0.7;
        float hK = min(transformed.y * 0.09, 1.2);
        float lean = uWindS * uWindS * 0.35;
        float swayA = sin(uWindT * f1 + phase) * gust * uWindS;
        float swayB = sin(uWindT * f1 * 1.31 + phase * 1.7) * gust * uWindS;
        vec2 disp = uWindD * (lean + 0.32 * swayA) + vec2(-uWindD.y, uWindD.x) * 0.16 * swayB;
        transformed.xz += disp * aWind.x * hK;
        transformed += normal * (sin(uWindT * 4.7 + phase + transformed.x * 3.1)
          * 0.02 * aWind.x * uWindS);
      }
      `);
  };
  return material;
}

// legacy vertex-colour wind (still used by the reeds and small props)
export function windify(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = WIND.time;
    sh.uniforms.uWindD = WIND.dir;
    sh.uniforms.uWindS = WIND.strength;
    sh.vertexShader = 'uniform float uWindT; uniform vec2 uWindD; uniform float uWindS;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
      {
        vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float phase = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
        float flex = clamp((vColor.g - vColor.r) * 2.2, 0.0, 1.0) * transformed.y * transformed.y;
        float gust = 0.55 + 0.45 * sin(dot(iPos.xz, uWindD) * 0.018 - uWindT * 1.25 + phase * 0.31);
        float f = 1.0 + fract(phase * 2.7) * 1.6;
        float lean = uWindS * uWindS * 0.5;
        float swayA = sin(uWindT * f + phase) * gust * uWindS;
        float swayB = sin(uWindT * f * 1.31 + phase * 1.7) * gust * uWindS;
        vec2 disp = uWindD * (lean + 0.24 * swayA) + vec2(-uWindD.y, uWindD.x) * 0.12 * swayB;
        transformed.xz += disp * flex;
      }
      #endif
      `);
  };
  return material;
}

// ---------------------------------------------------------------------------
// Bark textures — procedural canvas per species
// ---------------------------------------------------------------------------
const bn = makeNoise(4242);
function barkTex(kind) {
  return canvasTexture(128, 512, (ctx, w, h) => {
    const vstreaks = (base, dark, count, lw = 2) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = dark;
      for (let i = 0; i < count; i++) {
        ctx.globalAlpha = 0.25 + bn.rng() * 0.45;
        ctx.lineWidth = lw * (0.5 + bn.rng());
        const x = bn.rng() * w;
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.bezierCurveTo(x + (bn.rng() - 0.5) * 26, h * 0.33, x + (bn.rng() - 0.5) * 26, h * 0.66, x + (bn.rng() - 0.5) * 18, h + 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    if (kind === 'birch') {
      ctx.fillStyle = '#e6e1d4'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 150; i++) { // horizontal lenticel dashes
        const y = bn.rng() * h, x = bn.rng() * w, len = 6 + bn.rng() * 26;
        ctx.fillStyle = `rgba(40,36,32,${0.25 + bn.rng() * 0.5})`;
        ctx.fillRect(x, y, len, 1.4 + bn.rng() * 1.8);
      }
      for (let i = 0; i < 22; i++) { // dark patches / branch-scar diamonds
        const x = bn.rng() * w, y = bn.rng() * h;
        ctx.fillStyle = `rgba(30,26,24,${0.5 + bn.rng() * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + bn.rng() * 14, 8 + bn.rng() * 30, 0, 0, 7);
        ctx.fill();
      }
      for (let i = 0; i < 40; i++) { // peeling curls
        ctx.fillStyle = `rgba(255,252,244,${0.2 + bn.rng() * 0.3})`;
        ctx.fillRect(bn.rng() * w, bn.rng() * h, 3 + bn.rng() * 10, 1 + bn.rng() * 2);
      }
    } else if (kind === 'pine') {
      ctx.fillStyle = '#6e553f'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { // jigsaw plates, muted grey-russet
        const x = bn.rng() * w, y = bn.rng() * h;
        const pw = 12 + bn.rng() * 26, ph = 18 + bn.rng() * 40;
        const g = 92 + bn.rng() * 52;
        ctx.fillStyle = `rgb(${g + 26},${(g * 0.74) | 0},${(g * 0.52) | 0})`;
        ctx.beginPath();
        ctx.ellipse(x, y, pw / 2, ph / 2, (bn.rng() - 0.5) * 0.4, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(28,16,10,0.75)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    } else if (kind === 'oak') {
      vstreaks('#5c5348', 'rgba(20,16,12,0.9)', 70, 3);
      for (let i = 0; i < 34; i++) {
        ctx.fillStyle = `rgba(126,116,100,${0.12 + bn.rng() * 0.2})`;
        ctx.fillRect(bn.rng() * w, bn.rng() * h, 2 + bn.rng() * 5, 14 + bn.rng() * 44);
      }
    } else if (kind === 'alder') {
      vstreaks('#4c443c', 'rgba(18,14,12,0.7)', 40, 2);
      for (let i = 0; i < 90; i++) { // pale lenticels
        ctx.fillStyle = `rgba(180,170,150,${0.2 + bn.rng() * 0.3})`;
        ctx.fillRect(bn.rng() * w, bn.rng() * h, 4 + bn.rng() * 8, 1.4);
      }
    } else if (kind === 'linden') {
      vstreaks('#77705f', 'rgba(40,36,28,0.7)', 55, 2.4);
    } else if (kind === 'snag') {
      vstreaks('#8d8a80', 'rgba(45,42,38,0.85)', 80, 2);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(60,55,48,${0.3 + bn.rng() * 0.3})`;
        ctx.fillRect(bn.rng() * w, bn.rng() * h, 1.6, 20 + bn.rng() * 70);
      }
    } else { // spruce: grey-brown flaky scales
      vstreaks('#61503f', 'rgba(24,18,12,0.8)', 46, 2.2);
      for (let i = 0; i < 240; i++) {
        const g = 76 + bn.rng() * 52;
        ctx.fillStyle = `rgba(${g + 18},${(g * 0.82) | 0},${(g * 0.62) | 0},0.5)`;
        ctx.fillRect(bn.rng() * w, bn.rng() * h, 3 + bn.rng() * 7, 2 + bn.rng() * 5);
      }
    }
  }, { repeat: [1, 1] });
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
function barkMaterial(tex) {
  return windifyVeg(new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
}
function cardMaterial(atlas) {
  // alpha-to-coverage rides the composer's 4x MSAA: soft dithered leaf edges
  // instead of the hard alpha-test fizz that reads as grit in the mips
  // alphaTest 0.24 trims the mushy dither zone that read as half-rendered
  // leaves up close while A2C still softens the silhouettes
  const m = new THREE.MeshLambertMaterial({
    map: atlas, vertexColors: true, alphaTest: 0.24, alphaToCoverage: true,
    side: THREE.DoubleSide,
  });
  windifyVeg(m);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    prev(sh);
    // sqrt-decode the atlas (captured sqrt-encoded for 8-bit precision)
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
       vec4 sampledDiffuseColor = texture2D(map, vMapUv);
       sampledDiffuseColor.rgb *= sampledDiffuseColor.rgb;
       diffuseColor *= sampledDiffuseColor;
       #endif`);
  };
  m.customDepthMaterial = null; // set on the mesh, not the material
  return m;
}
function cardDepthMaterial(atlas) {
  return new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.38,
  });
}

function makeInstanced(geo, mat, count, shadows) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = shadows;
  m.receiveShadow = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

function refreshBounds(m) {
  m.computeBoundingSphere();
  m.frustumCulled = true;
}

function strideSubsample(arr, cap) {
  const n = Math.min(arr.length, cap);
  const stride = n > 0 ? arr.length / n : 1;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[(i * stride) | 0];
  return out;
}

function sampleNormal(samples, i) {
  const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
  let dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  dx /= len; dz /= len;
  return [-dz, dx];
}

function poissonish(rng, mean) {
  const stop = Math.exp(-mean);
  let p = 1, n = 0;
  do { n++; p *= rng(); } while (p > stop);
  return n - 1;
}

// copy a throwaway primitive geometry's position+normal into a shared
// wetland-plant vertex array, tinting every vertex one flat colour — lets
// cattail bake a stem cylinder + a head cylinder + two leaf boxes into ONE
// instanced mesh instead of juggling three
function mergeIn(pos, nrm, colArr, idx, geo, rgb) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const base = pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    pos.push(p.getX(i), p.getY(i), p.getZ(i));
    nrm.push(n.getX(i), n.getY(i), n.getZ(i));
    colArr.push(rgb[0], rgb[1], rgb[2]);
  }
  const gi = geo.index;
  for (let i = 0; i < gi.count; i++) idx.push(base + gi.getX(i));
}

// step off a lake-shore edge point along its normal, picking whichever sign
// actually lands on the side we want (inside the lake, or out on the bank) —
// the poly winding direction isn't guaranteed, so guessing one sign would
// silently plant half the margin flora on the wrong shore
function sideOf(x, z, nx, nz, dist, inside) {
  let ox = x + nx * dist, oz = z + nz * dist;
  if ((lakeAt(ox, oz) !== null) === inside) return [ox, oz];
  ox = x - nx * dist; oz = z - nz * dist;
  if ((lakeAt(ox, oz) !== null) === inside) return [ox, oz];
  return null;
}

// distToRoadEx is signed from the rendered road edge. Callers deliberately
// add the canonical class half-width again: that is the clipping audit's
// conservative verge/crown band, shared by every placement family below.
function roadClear(era, x, z, margin = 0) {
  const road = distToRoadEx(era, x, z);
  return road.d >= ROAD_HALF_W[road.c] + margin;
}
function unionRoadClear(x, z, margin = 0) {
  for (const era of [3, 4, 5]) if (!roadClear(era, x, z, margin)) return false;
  return true;
}

// Static vegetation is built before the era footprint registry is warm.
// Query the canonical modern rectangles directly for those passes.
function osmBuildingAt(x, z, margin = 0) {
  for (const [bx, bz, w, d, rot] of BUILDINGS_OSM) {
    if (Math.hypot(x - bx, z - bz) > Math.hypot(w, d) * 0.5 + margin) continue;
    const dx = x - bx, dz = z - bz;
    const c = Math.cos(-rot), s = Math.sin(-rot);
    const u = dx * c - dz * s, v = dx * s + dz * c;
    if (Math.abs(u) < w * 0.5 + margin && Math.abs(v) < d * 0.5 + margin) return true;
  }
  return false;
}

const CROWN_R = {
  alder: 4.2, birch: 6.4, spruce: 8.5, pine: 7.7, oak: 9.6,
  linden: 8.6, apple: 3.3, snag: 4.0, shrub: 1.2,
};
const CROWN_REF_H = {
  alder: 8.2, birch: 13.3, spruce: 17.4, pine: 19.5, oak: 13.3,
  linden: 15, apple: 4, snag: 10.3, shrub: 1.2,
};
function crownRadius(kind, h, tier = 'full') {
  const scale = clamp(h / CROWN_REF_H[kind], 0.72, 1.35);
  return CROWN_R[kind] * scale * (tier === 'far' ? 1.34 : 1);
}

function finalTreeGate(era, x, z, y, crownR, roadMargin = crownR) {
  if (vegExcluded(x, z, y, era, crownR)) return false;
  if (buildingAt(era, x, z, crownR)) return false;
  if (era === 5 && osmBuildingAt(x, z, crownR)) return false;
  return roadClear(era, x, z, roadMargin);
}

// Same Gaussian built-area signal as the land-use town suppression, sampled
// directly here only to identify where its ornamental complement belongs.
function settlementSignalAt(x, z) {
  let built = 0;
  for (const [bx, bz, w, d] of BUILDINGS_OSM) {
    const dx = x - bx, dz = z - bz, d2 = dx * dx + dz * dz;
    if (d2 > 150 * 150) continue;
    built += Math.max(20, w * d) * Math.exp(-d2 / (2 * 60 * 60));
  }
  return smoothstep(0.008, 0.022, built / 11300);
}

function cellRng(ix, iz, salt) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return mulberry32((h ^ (h >>> 16)) >>> 0);
}

// species build order (also impostor atlas order)
const SP_KEYS = ['spruce', 'pine', 'birch', 'oak', 'alder', 'linden', 'apple', 'shrub', 'snag'];
// instance capacity per species: [full, far]. Two tiers only — real geometry
// close to the points of interest, captured impostors beyond.
const CAPS = {
  spruce: [2100, 175000], pine: [1400, 125000], birch: [1700, 150000],
  oak: [700, 42000], alder: [1100, 61000], linden: [330, 13000],
  apple: [110, 1700], shrub: [8000, 55000], snag: [260, 0],
};
const FULL_R = 260; // full-detail radius around points of interest

export function buildVegetation(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'vegetation';
  scene.add(group);

  // ---- per-species assets: geometry variants, atlases, materials ----------
  const barkTexes = {};
  const species = {};
  const impostorEntries = [];
  for (const key of SP_KEYS) {
    const sp = SPECIES[key];
    if (!barkTexes[sp.bark]) barkTexes[sp.bark] = barkTex(sp.bark);
    const twigAtlas = sp.foliage ? captureTwigAtlas(renderer, sp, 900 + SP_KEYS.indexOf(key) * 17) : null;
    const bMat = barkMaterial(barkTexes[sp.bark]);
    const cMat = twigAtlas ? cardMaterial(twigAtlas) : null;
    const full = [];
    for (let v = 0; v < 2; v++) full.push(buildTree(sp, 3100 + SP_KEYS.indexOf(key) * 31 + v * 7));
    species[key] = { sp, bMat, cMat, twigAtlas, full };
    // impostor capture entry from full variant 0
    if (CAPS[key][1] > 0) {
      const t = full[0];
      const bm = new THREE.Mesh(t.bark, bMat);
      const meshes = [bm];
      if (cMat) meshes.push(new THREE.Mesh(t.cards, cMat));
      impostorEntries.push({
        key, meshes,
        halfW: t.skel.crownRadius * 1.25,
        height: t.skel.height * 1.04,
      });
    }
  }

  // ---- far-tier impostors ---------------------------------------------------
  const impostor = captureImpostorAtlas(renderer, impostorEntries);
  // NO alpha-to-coverage here: on distant subpixel quads the 4-sample dither
  // reads as fragmented, crawling silhouettes — a plain mid alpha test keeps
  // far crowns solid
  const impostorMat = new THREE.MeshBasicMaterial({
    map: impostor.texture, alphaTest: 0.22, side: THREE.DoubleSide, fog: true,
  });
  const farMeshes = {};
  impostorEntries.forEach((e, i) => {
    const tile = impostor.tiles[i];
    // unit-height cross-quads, uv from the atlas tile
    const w = tile.halfW / tile.height;
    const pos = [], uv = [], idx = [], nrm = [];
    // three planes at 60°: two-plane crosses read as flat cutouts from the
    // diagonals — exactly where a walking player usually approaches them
    for (const ang of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
      const c = Math.cos(ang), s = Math.sin(ang);
      const b = pos.length / 3;
      pos.push(-w * c, 0, -w * s, w * c, 0, w * s, w * c, 1, w * s, -w * c, 1, -w * s);
      uv.push(tile.u0, 0, tile.u1, 0, tile.u1, 1, tile.u0, 1);
      for (let k = 0; k < 4; k++) nrm.push(-s, 0.25, c);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    // horizontal canopy lid at crown height: from the bird's-eye view the
    // vertical planes vanish into stroke marks — the lid samples the crown
    // half of the same tile and reads as foliage mass from above
    {
      const b = pos.length / 3;
      const yl = 0.66;
      pos.push(-w, yl, -w, w, yl, -w, w, yl, w, -w, yl, w);
      // sample the CROWN CORE of the tile, not the whole crown half: the
      // wispy crown edges are mostly alpha and the lid discarded to specks —
      // the dense core reads as closed canopy from the air
      const uw = tile.u1 - tile.u0;
      uv.push(tile.u0 + uw * 0.24, 0.56, tile.u1 - uw * 0.24, 0.56,
              tile.u1 - uw * 0.24, 0.92, tile.u0 + uw * 0.24, 0.92);
      for (let k = 0; k < 4; k++) nrm.push(0, 1, 0);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    farMeshes[e.key] = makeInstanced(geo, impostorMat, CAPS[e.key][1], false);
    group.add(farMeshes[e.key]);
  });

  // ---- near-tier instanced meshes ------------------------------------------
  // meshes[key] = { full: [{cells: Map<gridCell, {bark, cards}>}] }
  const NEAR_CELL = 256;
  const meshes = {};
  for (const key of SP_KEYS) {
    const S = species[key];
    const depthMat = S.cMat ? cardDepthMaterial(S.twigAtlas) : null;
    const mk = (variant, cap, vi, cell) => {
      const bark = makeInstanced(variant.bark, S.bMat, cap, true);
      let cards = null;
      if (S.cMat) {
        cards = makeInstanced(variant.cards, S.cMat, cap, true);
        cards.customDepthMaterial = depthMat;
      }
      bark.name = `near:${key}:${vi}:${cell}:bark`;
      if (cards) cards.name = `near:${key}:${vi}:${cell}:cards`;
      group.add(bark);
      if (cards) group.add(cards);
      return { bark, cards };
    };
    meshes[key] = {
      full: S.full.map((variant, vi) => ({
        capacity: Math.ceil(CAPS[key][0] / S.full.length), cells: new Map(),
        make: (cell, cap) => mk(variant, cap, vi, cell),
      })),
      fullH: S.full.map((v) => v.skel.height),
    };
  }

  // ---- impostor promotion pool ---------------------------------------------
  // The two LOD tiers are keyed to POI distance, so a walker OUTSIDE the six
  // full-detail discs met flat billboard impostors at arm's length. A small
  // pool of real trees follows the camera instead: the nearest impostors
  // collapse to zero scale and a full-geometry stand-in takes each one's
  // place until the camera moves on.
  const PROM_CAP = 56, PROM_R = 78, PROM_CELL = 64;
  const promPool = {};
  for (const key of SP_KEYS) {
    if (!CAPS[key][1]) continue;
    const S = species[key];
    const bark = makeInstanced(S.full[0].bark, S.bMat, PROM_CAP, true);
    let cards = null;
    if (S.cMat) {
      cards = makeInstanced(S.full[0].cards, S.cMat, PROM_CAP, true);
      cards.customDepthMaterial = cardDepthMaterial(S.twigAtlas);
    }
    group.add(bark);
    if (cards) group.add(cards);
    promPool[key] = { bark, cards, hRef: S.full[0].skel.height, active: new Map(), free: [] };
  }
  const farPlaced = {};   // per species: { entries, byCell, widen } for the ACTIVE era

  // ---- understory assets -----------------------------------------------------
  const fernAtlas = captureTwigAtlas(renderer, {
    // pinnate frond reads through the needle-spray comb builder
    foliage: {
      kind: 'needleSpray', scale: [0.3, 0.42],
      leaf: { len: 0.4, width: 0.05, shapePow: 1, fold: 0, curl: 0, needleCount: 40, brush: 0 },
    },
    foliageColor: { r: 0.10, g: 0.30, b: 0.09, hueVar: 0.3 },
  }, 777);
  const fernMat = cardMaterial(fernAtlas);
  const fernGeo = buildFern(801);
  const ferns = makeInstanced(fernGeo, fernMat, 14000, false);
  ferns.customDepthMaterial = cardDepthMaterial(fernAtlas);
  group.add(ferns);

  const logMat = windifyVeg(new THREE.MeshLambertMaterial({ map: barkTexes.spruce, vertexColors: true }));
  const logGeos = [buildLog(311, 'mossy'), buildLog(313, 'rotten'), buildLog(317, 'fresh')];
  const logs = logGeos.map((l) => makeInstanced(l.geometry, logMat, 1400, true));
  const stumpGeo = buildStump(331);
  const stumps = makeInstanced(stumpGeo.geometry, logMat, 800, true);
  logs.forEach((l) => group.add(l));
  group.add(stumps);

  const boulderMat = windifyVeg(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const boulders = [makeInstanced(buildBoulder(41), boulderMat, 600, true),
                    makeInstanced(buildBoulder(43), boulderMat, 600, true)];
  boulders.forEach((b, i) => { b.name = `boulders:${i}`; });
  // small mossy forest-floor rocks, refreshed per era
  const rocks = makeInstanced(buildBoulder(53), boulderMat, 6000, false);
  group.add(rocks);
  boulders.forEach((b) => group.add(b));

  // ---- forest-floor still life: era-refreshed micro props --------------------
  const plainM = (c) => new THREE.MeshLambertMaterial({ color: c });
  const anthillGeo = new THREE.SphereGeometry(1, 9, 6);
  anthillGeo.scale(0.75, 0.6, 0.75);
  const anthills = makeInstanced(anthillGeo, plainM(0x4a3826), 600, false);
  const molehillGeo = new THREE.SphereGeometry(1, 7, 5);
  molehillGeo.scale(0.24, 0.13, 0.24);
  const molehills = makeInstanced(molehillGeo, plainM(0x41321f), 1400, false);
  const shroomCGeo = new THREE.ConeGeometry(0.05, 0.055, 6);
  shroomCGeo.translate(0, 0.025, 0);
  const shroomsC = makeInstanced(shroomCGeo, plainM(0xd89828), 1400, false);
  const shroomBGeo = new THREE.SphereGeometry(0.06, 7, 5);
  shroomBGeo.scale(1, 0.62, 1);
  shroomBGeo.translate(0, 0.028, 0);   // cap bottom meets the soil (it hovered 1.3cm)
  const shroomsB = makeInstanced(shroomBGeo, plainM(0x6a4526), 900, false);
  const coneGeo = new THREE.SphereGeometry(0.04, 6, 5);
  coneGeo.scale(1, 1.7, 1);
  const conesM = makeInstanced(coneGeo, plainM(0x54402c), 2200, false);
  const twigGeo = new THREE.CylinderGeometry(0.014, 0.02, 1, 4);
  twigGeo.rotateZ(Math.PI / 2);
  const twigs = makeInstanced(twigGeo, plainM(0x594836), 2000, false);
  // leaf drift: an IRREGULAR 12-gon — the old 7-segment circle read as an
  // angular plate with straight edges from any walking distance
  const litterGeo = (() => {
    const lr = makeNoise(4242).rng;
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.68 + lr() * 0.46;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const litterMat = new THREE.MeshLambertMaterial({
    color: 0x6a5638, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const litter = makeInstanced(litterGeo, litterMat, 1000, false);
  const microProps = [
    ['anthill', anthills, (d, e) => { d.position.set(e[0], e[1] + e[3] * 0.12, e[2]); d.scale.setScalar(e[3]); d.rotation.set(0, e[4], 0); }],
    ['molehill', molehills, (d, e) => { d.position.set(e[0], e[1] + 0.02, e[2]); d.scale.setScalar(e[3]); d.rotation.set(0, e[4], 0); }],
    ['shroomC', shroomsC, (d, e) => { d.position.set(e[0], e[1], e[2]); d.scale.setScalar(e[3]); d.rotation.set(0, e[4], 0); }],
    ['shroomB', shroomsB, (d, e) => { d.position.set(e[0], e[1], e[2]); d.scale.setScalar(e[3]); d.rotation.set(0, e[4], 0); }],
    ['cone', conesM, (d, e) => { d.position.set(e[0], e[1] + 0.03, e[2]); d.scale.setScalar(e[3]); d.rotation.set(0.4, e[4], 0); }],
    ['twig', twigs, (d, e) => { d.position.set(e[0], e[1] + 0.03, e[2]); d.scale.set(e[3], 1, 1); d.rotation.set((e[4] % 0.2) - 0.1, e[4], 0); }],
    ['litter', litter, (d, e) => {
      // tilt to the local slope and stay small — flat metre discs sliced
      // into sloped ground on one side while hovering on the other
      const gx = (heightAt(e[0] + 0.8, e[2]) - heightAt(e[0] - 0.8, e[2])) / 1.6;
      const gz = (heightAt(e[0], e[2] + 0.8) - heightAt(e[0], e[2] - 0.8)) / 1.6;
      d.position.set(e[0], e[1] + 0.05, e[2]);
      d.scale.setScalar(e[3] * 0.65);
      d.rotation.set(Math.atan(gz), e[4], -Math.atan(gx));
    }],
  ];
  microProps.forEach(([, m]) => group.add(m));

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const eraCache = new Map();
  const noiseB = makeNoise(6161);

  const POIS = [LOC.STEAD, LOC.MANOR, LOC.BREZGA, LOC.KROGS, LOC.CAMP, LOC.OAK];
  const dPOI = (x, z) => {
    let d = Infinity;
    for (const p of POIS) d = Math.min(d, Math.hypot(x - p.x, z - p.z));
    return d;
  };

  // ---- placements per era ------------------------------------------------
  function placementsFor(era) {
    if (eraCache.has(era)) return eraCache.get(era);
    const rng = makeNoise(1000 + era * 7).rng;
    const lists = {};
    for (const k of SP_KEYS) lists[k] = { full: [], far: [] };
    lists.fern = []; lists.log = []; lists.stump = []; lists.rock = [];
    lists.anthill = []; lists.molehill = []; lists.shroomC = []; lists.shroomB = [];
    lists.cone = []; lists.twig = []; lists.litter = [];
    // final-position gate for micro props: parent-sample gating alone let
    // 5-10m offsets stray into fields, banks and open meadow
    const okMicro = (px, pz) => {
      const py = heightAt(px, pz);
      if (forestDensity(era, px, pz, py) < 0.35) return false;
      if (era >= 2 && fieldAt(era, px, pz)) return false;
      if (vegExcluded(px, pz, py, era, 3)) return false;
      if (buildingAt(era, px, pz, 0.8)) return false;
      return true;
    };
    const S = LOC.STEAD;
    const step = 9;    // real hemiboreal forest runs hundreds of stems/ha
    const EXT = HM_SPAN - 120;
    const N = Math.floor(EXT / step);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (ix / (N - 1) - 0.5) * EXT + HM_OFF_X + (rng() - 0.5) * step * 1.4;
        const z = (iz / (N - 1) - 0.5) * EXT + HM_OFF_Z + (rng() - 0.5) * step * 1.4;
        const y = heightAt(x, z);
        if (vegExcluded(x, z, y, era, 1.5)) continue;
        // no spruce through a roof: every validated footprint says no
        if (buildingAt(era, x, z, 2)) continue;
        const d = forestDensity(era, x, z, y);
        if (d <= 0.02) continue;
        const dp = dPOI(x, z);
        // impostors are cheap — keep the deep landscape forested: primeval
        // eras are near-closed canopy, and even the agrarian mosaic reads
        // starved if the falloff bites too hard
        const falloff = clamp(560 / Math.max(dp, 1), era <= 2 ? 0.9 : 0.85, 1);
        if (rng() > d * 0.97 * falloff) continue;
        const tier = dp < FULL_R ? 'full' : 'far';
        // the denser grid would melt the full-geometry tier — thin it back;
        // the far ring just outside blends DOWN to the same density so the
        // FULL_R boundary is not a visible 2x stem-density step
        if (tier === 'full' && rng() < 0.38) continue;
        if (tier === 'far' && dp < FULL_R + 70 && rng() < 0.38 * (1 - (dp - FULL_R) / 70)) continue;
        if (era === 0) {
          // tundra: knee-high dwarf birch / juniper heath
          lists.shrub[tier].push([x, y, z, 0.8 + rng() * 1.1, rng() * 6.3, 0.9 + rng() * 0.25]);
          continue;
        }
        // alder carr reaches well past the immediate bank — a 40m band left
        // ~100 alders on the whole map once the waterline exclusion ate it
        const wet = distToRiver(x, z) < 70;
        const high = y > 215;
        const r = rng();
        let kind;
        if (wet) kind = r < 0.55 ? 'alder' : r < 0.85 ? 'birch' : 'spruce';
        else if (high) kind = r < 0.5 ? 'spruce' : r < 0.85 ? 'pine' : 'birch';
        else kind = r < 0.34 ? 'birch' : r < 0.6 ? 'spruce' : r < 0.82 ? 'pine' : 'oak';
        // old-growth snags in the primeval eras (near only — no far impostor)
        if ((era === 1 || era === 2) && tier === 'full' && d > 0.5 && rng() < 0.045) kind = 'snag';
        const h = { spruce: 17, pine: 19, birch: 13, oak: 13, alder: 8, snag: 10 }[kind] * (0.75 + rng() * 0.55);
        const rot = rng() * 6.3, tint = 0.86 + rng() * 0.28;
        let leanX = 0, leanZ = 0;
        if (kind === 'alder') {
          const rv = riverAt(x, z);
          if (rv && rv.d < rv.hw + 18) {
            const dx = rv.x - x, dz = rv.z - z, dl = Math.hypot(dx, dz) || 1;
            const lean = 0.035 + cellRng(Math.floor(x / 9), Math.floor(z / 9), 0xa1de)() * 0.045;
            // A slight deterministic Euler tilt toward the water makes the
            // bank alders follow the light/open-channel direction.
            leanX = dz / dl * lean;
            leanZ = -dx / dl * lean;
          }
        }
        const crownR = crownRadius(kind, h, tier);
        // 0.6 crown clearance prevents visible canopy clipping without
        // cutting unnaturally broad treeless corridors through the forest.
        // All placement draws above still happen when this final gate rejects.
        const treeOK = roadClear(era, x, z, 0.6 * crownR);
        if (treeOK) lists[kind][tier].push([x, y, z, h, rot, tint, leanX, leanZ]);

        // understory in closed forest, near tiers only: ferns, hazel-like
        // underbrush and bramble tangles — an old-growth floor is BUSY
        if (tier !== 'far' && d > 0.42) {
          if (era >= 1 && rng() < 0.28) {
            const ux = x + (rng() - 0.5) * 9, uz = z + (rng() - 0.5) * 9;
            const uy = heightAt(ux, uz);
            if (!vegExcluded(ux, uz, uy, era, 2.5) && !buildingAt(era, ux, uz, 1.2)) {
              // low dark tangle (bramble) or a taller hazel-ish bush.
              // hazel capped at ~1.9m and WIDENED: the shrub species is
              // grown for 0.7-1.3m — stretched to 2.8m it was all trunk
              // tube with a wisp of cards, "a thick green stick"
              const bramble = rng() < 0.45;
              lists.shrub.full.push([
                ux, uy, uz,
                bramble ? 0.9 + rng() * 0.7 : 1.3 + rng() * 0.6,
                rng() * 6.3, bramble ? 0.68 + rng() * 0.18 : 1.1 + rng() * 0.35,
              ]);
            }
          }
          if (rng() < (era <= 2 ? 0.55 : 0.3)) {
            const fx = x + (rng() - 0.5) * 10, fz = z + (rng() - 0.5) * 10;
            const fy = heightAt(fx, fz);
            if (!vegExcluded(fx, fz, fy, era, 3) && !buildingAt(era, fx, fz, 1)) {
              lists.fern.push([fx, fy, fz, 0.7 + rng() * 0.9, rng() * 6.3]);
            }
          }
          if (rng() < 0.08) {
            const rx = x + (rng() - 0.5) * 10, rz = z + (rng() - 0.5) * 10;
            const ry = heightAt(rx, rz);
            if (!vegExcluded(rx, rz, ry, era, 1) && !buildingAt(era, rx, rz, 0.8)) {
              lists.rock.push([rx, ry, rz, 0.12 + Math.pow(rng(), 1.7) * 0.55, rng() * 6.3]);
            }
          }
          if ((era === 1 || era === 2) && rng() < 0.12) {
            const lx = x + (rng() - 0.5) * 12, lz = z + (rng() - 0.5) * 12;
            const ly = heightAt(lx, lz);
            if (!vegExcluded(lx, lz, ly, era, 1) && !buildingAt(era, lx, lz, 0.8)) {
              lists.log.push([lx, ly, lz, rng() * 6.3, 0.8 + rng() * 0.7, (rng() * 3) | 0]);
            }
          } else if (era >= 3 && rng() < 0.05) {
            const sx = x + (rng() - 0.5) * 9, sz = z + (rng() - 0.5) * 9;
            const sy = heightAt(sx, sz);
            if (!vegExcluded(sx, sz, sy, era, 1) && !buildingAt(era, sx, sz, 0.8)) {
              lists.stump.push([sx, sy, sz, rng() * 6.3, 0.8 + rng() * 0.6]);
            }
          }
          // the forest-floor still life: ant mounds under conifers, mushroom
          // troops, cone fall, wind-thrown twigs, leaf drifts under broadleaves
          const conifer = kind === 'spruce' || kind === 'pine';
          if (conifer && rng() < 0.014) {
            const ax = x + (rng() - 0.5) * 8, az = z + (rng() - 0.5) * 8;
            if (okMicro(ax, az)) lists.anthill.push([ax, heightAt(ax, az), az, 0.55 + rng() * 0.75, rng() * 6.3]);
          }
          if (rng() < 0.05) {
            const mx = x + (rng() - 0.5) * 9, mz = z + (rng() - 0.5) * 9;
            const n2 = 3 + (rng() * 5) | 0;
            for (let k = 0; k < n2; k++) {
              const ox = mx + (rng() - 0.5) * 1.2, oz = mz + (rng() - 0.5) * 1.2;
              if (okMicro(ox, oz)) lists.shroomC.push([ox, heightAt(ox, oz), oz, 0.75 + rng() * 0.6, rng() * 6.3]);
            }
          }
          if (rng() < 0.035) {
            const bx2 = x + (rng() - 0.5) * 9, bz2 = z + (rng() - 0.5) * 9;
            if (okMicro(bx2, bz2)) lists.shroomB.push([bx2, heightAt(bx2, bz2), bz2, 0.8 + rng() * 0.7, rng() * 6.3]);
          }
          if (conifer && rng() < 0.3) {
            const cx2 = x + (rng() - 0.5) * 5, cz2 = z + (rng() - 0.5) * 5;
            if (okMicro(cx2, cz2)) lists.cone.push([cx2, heightAt(cx2, cz2), cz2, 0.8 + rng() * 0.5, rng() * 6.3]);
          }
          if (rng() < 0.2) {
            const tx2 = x + (rng() - 0.5) * 10, tz2 = z + (rng() - 0.5) * 10;
            if (okMicro(tx2, tz2)) lists.twig.push([tx2, heightAt(tx2, tz2), tz2, 0.5 + rng() * 0.9, rng() * 6.3]);
          }
          if (!conifer && kind !== 'snag' && rng() < 0.12) {
            const lx2 = x + (rng() - 0.5) * 7, lz2 = z + (rng() - 0.5) * 7;
            if (okMicro(lx2, lz2)) lists.litter.push([lx2, heightAt(lx2, lz2), lz2, 0.6 + rng() * 1.0, rng() * 6.3]);
          }
        }
      }
    }
    // molehills: fresh dark casts on open meadow (any era with soil life)
    if (era >= 1) {
      const stepM = 34, NM = Math.floor(EXT / stepM);
      for (let iz = 0; iz < NM; iz++) for (let ix = 0; ix < NM; ix++) {
        if (rng() > 0.045) continue;
        const x = (ix / (NM - 1) - 0.5) * EXT + HM_OFF_X + (rng() - 0.5) * stepM;
        const z = (iz / (NM - 1) - 0.5) * EXT + HM_OFF_Z + (rng() - 0.5) * stepM;
        const y = heightAt(x, z);
        if (forestDensity(era, x, z, y) > 0.12) continue;      // meadow only
        if (vegExcluded(x, z, y, era, 4)) continue;
        if (era >= 2 && fieldAt(era, x, z)) continue;          // ploughing destroys them
        const n2 = 2 + (rng() * 4) | 0;
        for (let k = 0; k < n2; k++) {
          const ox = x + (rng() - 0.5) * 6, oz = z + (rng() - 0.5) * 6;
          const oy = heightAt(ox, oz);
          // each child mound revalidates — a 3m offset crossed into fields,
          // lake shores and the river bank from a valid seed
          if (forestDensity(era, ox, oz, oy) > 0.12) continue;
          if (vegExcluded(ox, oz, oy, era, 4) || buildingAt(era, ox, oz, 0.8)) continue;
          if (era >= 2 && fieldAt(era, ox, oz)) continue;
          const sc = 0.7 + rng() * 0.6, rot = rng() * 6.3;
          if (!roadClear(era, ox, oz, 0.3)) continue;
          lists.molehill.push([ox, oy, oz, sc, rot]);
        }
      }
    }
    // orchard + manor park (identical layout to the researched plans)
    if (era === 3 || era === 4) {
      // every viensēta keeps a few apple trees by the dwelling (the classic
      // Latvian farm orchard) — same site-keep rule as the buildings
      DWELLINGS_OSM.forEach(([dx, dz], si) => {
        if (!farmSiteKept(si, era) || nearStagePOI(dx, dz)) return;   // no orchard without a house
        const n = 2 + ((si * 7) % 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 6.28 + si;
          const ox = dx + Math.cos(a) * (14 + (si % 5)), oz = dz + Math.sin(a) * (13 + (k * 3) % 6);
          const oy = heightAt(ox, oz);
          const tier = dPOI(ox, oz) < FULL_R ? 'full' : 'far';
          const h = 3.4 + ((si + k) % 4) * 0.35;
          const crownR = crownRadius('apple', h, tier);
          if (!finalTreeGate(era, ox, oz, oy, crownR)) continue;
          lists.apple[tier].push([ox, oy, oz, h, si + k, 1]);
        }
      });
      for (let i = 0; i < 12; i++) {
        const x = S.x - 26 + (i % 4) * 8 + rng() * 2;
        const z = S.z - 34 + Math.floor(i / 4) * 8 + rng() * 2;
        const y = heightAt(x, z);
        const h = 3.6 + rng(), rot = rng() * 6.3;
        const crownR = crownRadius('apple', h);
        if (finalTreeGate(era, x, z, y, crownR)) lists.apple.full.push([x, y, z, h, rot, 1]);
      }
      const M = LOC.MANOR;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const ax = M.x - 60 + 54 * t, az = M.z + 60 - 48 * t;
        for (const off of [-7, 7]) {
          const ox = ax + off * 0.7, oz = az + off * 0.7 * (54 / -48);
          const oy = heightAt(ox, oz), h = 13 + rng() * 4, rot = rng() * 6.3;
          const crownR = crownRadius('linden', h);
          // The paired manor avenue is intentional roadside planting: crowns
          // may overhang, but trunks still clear the carriageway by 1.2m.
          if (finalTreeGate(era, ox, oz, oy, crownR, 1.2)) {
            lists.linden.full.push([ox, oy, oz, h, rot, 1]);
          }
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = rng() * Math.PI * 2, rr = 34 + rng() * 38;
        const x = M.x - 10 + Math.cos(a) * rr, z = M.z - 50 + Math.sin(a) * rr * 0.8;
        if (Math.abs(x - M.x) < 24 && Math.abs(z - M.z) < 16) continue;
        if (z > M.z + 6 && Math.abs(x - M.x) < 40) continue;
        const kind = rng() < 0.6 ? 'linden' : 'oak';
        const h = 12 + rng() * 6, rot = rng() * 6.3, y = heightAt(x, z);
        const crownR = crownRadius(kind, h);
        if (finalTreeGate(era, x, z, y, crownR)) lists[kind].full.push([x, y, z, h, rot, 1]);
      }
    }
    // Modern town yards: a separate, world-cell-stable ornamental layer in
    // the built-density zone suppressed by land use. A 42m lattice is 5.67
    // candidates/ha before crown/road/building gates, landing in the requested
    // sparse 2-6/ha range without turning yards back into forest.
    if (era === 5) {
      const CELL = 42, half = EXT * 0.5;
      const ix0 = Math.floor((HM_OFF_X - half) / CELL), ix1 = Math.ceil((HM_OFF_X + half) / CELL);
      const iz0 = Math.floor((HM_OFF_Z - half) / CELL), iz1 = Math.ceil((HM_OFF_Z + half) / CELL);
      const yardCands = [];
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const rngY = cellRng(ix, iz, 0x79a2d);
          const x = (ix + 0.5) * CELL + (rngY() - 0.5) * CELL * 0.64;
          const z = (iz + 0.5) * CELL + (rngY() - 0.5) * CELL * 0.64;
          const pick = rngY(), hJ = rngY(), rot = rngY() * 6.3, priority = rngY();
          // The saturated core is where land use applies its strongest
          // suppression; weaker fringes remain ordinary woodland/farm edge.
          if (settlementSignalAt(x, z) < 0.995) continue;
          const kind = pick < 0.5 ? 'birch' : pick < 0.75 ? 'linden' : 'apple';
          const h = kind === 'birch' ? 9 + hJ * 4 : kind === 'linden' ? 10 + hJ * 4 : 3.2 + hJ * 1.1;
          const y = heightAt(x, z), tier = dPOI(x, z) < FULL_R ? 'full' : 'far';
          const crownR = crownRadius(kind, h, tier);
          if (fieldAt(era, x, z) || !finalTreeGate(era, x, z, y, crownR)) continue;
          yardCands.push([priority, kind, tier, x, y, z, h, rot]);
        }
      }
      yardCands.sort((a, b) => a[0] - b[0]);
      for (const [, kind, tier, x, y, z, h, rot] of yardCands.slice(0, 600)) {
        lists[kind][tier].push([x, y, z, h, rot, 1]);
      }
    }
    // the sacred oak by the stead, and the attested summit oak on Brežģa kalns
    if (era >= 1) {
      lists.oak.full.push([LOC.OAK.x, heightAt(LOC.OAK.x, LOC.OAK.z), LOC.OAK.z, era <= 1 ? 14 : 15 + era, 1.2, 1.2]);
    }
    if (era >= 3) {
      const B = LOC.BREZGA;
      lists.oak.full.push([B.x + 9, heightAt(B.x + 9, B.z + 11), B.z + 11, 15 + (era - 3) * 1.5, 0.8, 1.15]);
    }
    eraCache.set(era, lists);
    return lists;
  }

  function fillTier(tiers, heights, arr) {
    // round-robin across variants
    const per = tiers.map(() => []);
    for (let i = 0; i < arr.length; i++) per[i % tiers.length].push(arr[i]);
    tiers.forEach((tier, vi) => {
      const list = per[vi];
      const n = Math.min(list.length, tier.capacity);
      // over cap: stride-subsample — first-n would drop everything north of
      // some grid row (the lists come from a south-to-north scan)
      const stride = n > 0 ? list.length / n : 1;
      const hRef = heights[vi];
      const byCell = new Map();
      for (let i = 0; i < n; i++) {
        const e = list[(i * stride) | 0];
        const cell = Math.floor(e[0] / NEAR_CELL) + ':' + Math.floor(e[2] / NEAR_CELL);
        let cellList = byCell.get(cell);
        if (!cellList) byCell.set(cell, cellList = []);
        cellList.push([e, i]);
      }
      for (const pair of tier.cells.values()) {
        group.remove(pair.bark);
        pair.bark.dispose(); // frees instance attributes only — geometry/material are shared per variant
        if (pair.cards) { group.remove(pair.cards); pair.cards.dispose(); }
      }
      tier.cells.clear();
      for (const [cell, cellList] of byCell) {
        const pair = tier.make(cell, cellList.length);
        tier.cells.set(cell, pair);
        for (let j = 0; j < cellList.length; j++) {
          const [[x, y, z, h, rot, tint, leanX = 0, leanZ = 0], i] = cellList[j];
          const s = h / hRef;
          dummy.position.set(x, y - 0.08 * s, z);
          dummy.rotation.set(leanX, rot, leanZ);
          dummy.scale.set(s * (0.92 + 0.16 * ((i * 7919) % 13) / 13), s, s * (0.92 + 0.16 * ((i * 104729) % 17) / 17));
          dummy.updateMatrix();
          pair.bark.setMatrixAt(j, dummy.matrix);
          if (pair.cards) pair.cards.setMatrixAt(j, dummy.matrix);
          col.setScalar(tint);
          pair.bark.setColorAt(j, col);
          if (pair.cards) pair.cards.setColorAt(j, col);
        }
        pair.bark.count = cellList.length;
        pair.bark.instanceMatrix.needsUpdate = true;
        if (pair.bark.instanceColor) pair.bark.instanceColor.needsUpdate = true;
        refreshBounds(pair.bark);
        if (pair.cards) {
          pair.cards.count = cellList.length;
          pair.cards.instanceMatrix.needsUpdate = true;
          if (pair.cards.instanceColor) pair.cards.instanceColor.needsUpdate = true;
          refreshBounds(pair.cards);
        }
      }
    });
  }

  function setEra(era) {
    const lists = placementsFor(era);
    // reset the promotion pool — far buffers are about to be refilled
    for (const key of SP_KEYS) {
      const pool = promPool[key];
      if (!pool) continue;
      pool.active.clear();
      pool.free.length = 0;
      for (let s = 0; s < PROM_CAP; s++) {
        pool.free.push(s);
        dummy.position.set(0, -500, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
        dummy.updateMatrix();
        pool.bark.setMatrixAt(s, dummy.matrix);
        if (pool.cards) pool.cards.setMatrixAt(s, dummy.matrix);
      }
      pool.bark.count = PROM_CAP;
      pool.bark.instanceMatrix.needsUpdate = true;
      if (pool.cards) { pool.cards.count = PROM_CAP; pool.cards.instanceMatrix.needsUpdate = true; }
    }
    promLast.x = NaN;
    for (const key of SP_KEYS) {
      fillTier(meshes[key].full, meshes[key].fullH, lists[key].full);
      const farM = farMeshes[key];
      if (farM) {
        const arr = lists[key].far;
        const n = Math.min(arr.length, farM.instanceMatrix.count);
        // over cap: stride-subsample (unbiased thin — first-n deforested the
        // whole north incl. Brežģa kalns) and widen crowns to conserve the
        // canopy coverage the dropped stems carried
        const stride = n > 0 ? arr.length / n : 1;
        // primeval eras are near-closed canopy: crowns overlap harder so the
        // aerial read is a green roof, not scattered specks
        const widen = Math.min(1.3, Math.sqrt(stride)) * (era <= 2 ? 1.18 : 1);
        const fp = { entries: new Array(n), byCell: new Map(), widen };
        for (let i = 0; i < n; i++) {
          const [x, y, z, h, , tint, leanX = 0, leanZ = 0] = arr[(i * stride) | 0];
          dummy.position.set(x, y - 0.4, z);
          dummy.rotation.set(leanX, (i * 2.399) % 6.283, leanZ);
          dummy.scale.set(h * 1.12 * widen, h, h * 1.12 * widen); // crowns overlap -> closed canopy
          dummy.updateMatrix();
          farM.setMatrixAt(i, dummy.matrix);
          // darker, slightly green-biased: the atlas is captured under a
          // bright rig and the field read pale against the full-detail discs
          const fv = 0.7 + 0.14 * tint;
          col.setRGB(fv * 0.94, fv, fv * 0.9);
          farM.setColorAt(i, col);
          fp.entries[i] = [x, y, z, h, tint, leanX, leanZ];
          const ck = Math.floor(x / PROM_CELL) + ':' + Math.floor(z / PROM_CELL);
          let ca = fp.byCell.get(ck);
          if (!ca) fp.byCell.set(ck, ca = []);
          ca.push(i);
        }
        farPlaced[key] = fp;
        farM.count = n;
        farM.instanceMatrix.clearUpdateRanges();  // stale promote ranges would mask this full refill
        farM.instanceMatrix.needsUpdate = true;
        if (farM.instanceColor) farM.instanceColor.needsUpdate = true;
      }
    }
    // forest-floor rocks
    {
      const arr = lists.rock;
      const n = Math.min(arr.length, rocks.instanceMatrix.count);
      const stride = n > 0 ? arr.length / n : 1;
      for (let i = 0; i < n; i++) {
        const [x, y, z, sc, rot] = arr[(i * stride) | 0];
        dummy.position.set(x, y - sc * 0.3, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(sc, sc * 0.7, sc);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      }
      rocks.count = n;
      rocks.instanceMatrix.needsUpdate = true;
      refreshBounds(rocks);
    }
    // forest-floor still life
    for (const [key, mesh, place] of microProps) {
      const arr = lists[key];
      const n = Math.min(arr.length, mesh.instanceMatrix.count);
      const stride = n > 0 ? arr.length / n : 1;
      for (let i = 0; i < n; i++) {
        place(dummy, arr[(i * stride) | 0]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (key !== 'molehill' && key !== 'litter') refreshBounds(mesh);
    }
    // ferns
    {
      const arr = lists.fern;
      const n = Math.min(arr.length, ferns.instanceMatrix.count);
      const stride = n > 0 ? arr.length / n : 1;
      for (let i = 0; i < n; i++) {
        const [x, y, z, s, rot] = arr[(i * stride) | 0];
        dummy.position.set(x, y - 0.02, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(s, s * (0.85 + ((i * 31) % 7) / 14), s);
        dummy.updateMatrix();
        ferns.setMatrixAt(i, dummy.matrix);
      }
      ferns.count = n;
      ferns.instanceMatrix.needsUpdate = true;
      refreshBounds(ferns);
    }
    // deadfall
    logs.forEach((mesh, mi) => {
      let n = 0;
      for (const [x, y, z, rot, s, which] of lists.log) {
        if (which !== mi || n >= mesh.instanceMatrix.count) continue;
        dummy.position.set(x, y + 0.02, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      refreshBounds(mesh);
    });
    {
      let n = 0;
      for (const [x, y, z, rot, s] of lists.stump) {
        if (n >= stumps.instanceMatrix.count) break;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        stumps.setMatrixAt(n++, dummy.matrix);
      }
      stumps.count = n;
      stumps.instanceMatrix.needsUpdate = true;
      refreshBounds(stumps);
    }
  }

  // ---- static across eras: glacial erratics, reeds -------------------------
  const boulderColliders = [];
  {
    // boulders: the ice left them; the farmers cleared them from the fields.
    // Excluded from every era's field polygons so they can persist unmoved.
    const rng = makeNoise(9010).rng;
    let bi = [0, 0];
    for (let k = 0; k < 30000 && (bi[0] < 600 || bi[1] < 600); k++) {
      const x = (rng() - 0.5) * (HM_SPAN - 200) + HM_OFF_X;
      const z = (rng() - 0.5) * (HM_SPAN - 200) + HM_OFF_Z;
      if (dPOI(x, z) > 700) continue;
      const y = heightAt(x, z);
      const lake = lakeAt(x, z);
      if (lake && y < lake.level + 0.5) continue;
      let bad = false;
      for (const e of [2, 3, 4]) if (fieldAt(e, x, z)) { bad = true; break; }
      if (bad) continue;
      const n0 = noiseB.fbm(x * 0.004, z * 0.004, 3);
      const rv = riverAt(x, z);
      if (rv && rv.d < rv.hw + 0.5) continue;
      const nearRiver = rv && rv.d < rv.hw + 8;
      if (rng() > (n0 > 0.62 ? 0.5 : 0.06) && !(nearRiver && rng() < 0.3)) continue;
      const which = rng() < 0.5 ? 0 : 1;
      if (bi[which] >= 600) continue;
      const s = 0.25 + Math.pow(rng(), 2.2) * 2.4;
      const rx = rng() * 0.4, ry = rng() * 6.3, rz = rng() * 0.4;
      const sx = s * (0.8 + rng() * 0.5), sy = s * (0.7 + rng() * 0.5), sz = s * (0.8 + rng() * 0.5);
      const margin = Math.max(sx, sy, sz);
      // Static erratics must survive every late road layout, but not occupy
      // any of them (or a modern OSM footprint). Keep every legacy draw above
      // the new final gate so the unchanged candidates retain their transforms.
      if (!unionRoadClear(x, z, margin) || osmBuildingAt(x, z, margin)) continue;
      if ([3, 4, 5].some((era) => vegExcluded(x, z, y, era, margin))) continue;
      dummy.position.set(x, y - s * 0.3, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      boulders[which].setMatrixAt(bi[which]++, dummy.matrix);
      if (s > 0.55) boulderColliders.push([x, z, s * 0.95]);
    }
    boulders.forEach((b, i) => { b.count = bi[i]; b.instanceMatrix.needsUpdate = true; refreshBounds(b); });
  }
  {
    // reed clumps along the real lake shorelines and slack river reaches
    const reedG = (() => {
      const pos = [], colArr = [], idx = [];
      const rr = makeNoise(2213).rng;
      for (let b = 0; b < 7; b++) {
        const a = rr() * Math.PI * 2, dist = rr() * 0.3;
        const bx = Math.cos(a) * dist, bz = Math.sin(a) * dist;
        const h = 1.6 + rr() * 1.2, lean = (rr() - 0.5) * 0.35;
        const w = 0.035;
        const base = pos.length / 3;
        const tx = bx + lean * h, tz = bz + lean * h * 0.6;
        pos.push(bx - w, 0, bz, bx + w, 0, bz, tx + w * 0.4, h, tz, tx - w * 0.4, h, tz);
        // dark base → pale tip; the windify flex keys on greenness
        colArr.push(0.2, 0.28, 0.13, 0.2, 0.28, 0.13, 0.55, 0.6, 0.32, 0.55, 0.6, 0.32);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        if (rr() < 0.5) { // seed head
          const b2 = pos.length / 3;
          pos.push(tx - 0.03, h - 0.02, tz, tx + 0.03, h - 0.02, tz, tx + 0.02, h + 0.24, tz, tx - 0.02, h + 0.24, tz);
          colArr.push(0.4, 0.3, 0.2, 0.4, 0.3, 0.2, 0.45, 0.34, 0.22, 0.45, 0.34, 0.22);
          idx.push(b2, b2 + 1, b2 + 2, b2, b2 + 2, b2 + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const reedMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const reeds = makeInstanced(reedG, reedMat, 6000, false);
    reeds.name = 'reeds';
    const rng = makeNoise(2211).rng;
    let i = 0;
    for (const lake of LAKE_SHORES) {
      const poly = lake.poly;   // canonical rendered shoreline + side oracle
      for (let e = 0; e < poly.length; e++) {
        const [ax, az] = poly[e], [bx, bz] = poly[(e + 1) % poly.length];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / 6);
        const nx = -(bz - az) / (len || 1), nz = (bx - ax) / (len || 1);
        for (let k = 0; k < n && i < 6000; k++) {
          const t = (k + rng()) / n;
          const mx = ax + (bx - ax) * t, mz = az + (bz - az) * t;
          const wet = sideOf(mx, mz, nx, nz, 0.25 + rng() * 3.25, true);
          if (!wet) continue;
          const [px, pz] = wet;
          if (lakeAt(px, pz) !== lake || lakeShoreDistAt(px, pz) > 4) continue;
          if (!unionRoadClear(px, pz, 0.3) || osmBuildingAt(px, pz, 0.3)) continue;
          const y = heightAt(px, pz);
          dummy.position.set(px, y, pz); // roots follow carved terrain: no floating clumps
          dummy.rotation.y = rng() * 6.3;
          const s = 0.7 + rng() * 0.8;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          reeds.setMatrixAt(i++, dummy.matrix);
        }
      }
    }
    for (const p of RIVER_PTS) {
      if (rng() < 0.4) continue;
      for (const side of [-1, 1]) {
        for (let rep = 0; rep < 2 && i < 6000; rep++) {
          // reeds hug the waterline — spread across the floodplain they read
          // as dark shadowy clumps littering the meadow
          const px = p[0] + side * (11 + rng() * 4), pz = p[1] + (rng() - 0.5) * 22;
          const y = heightAt(px, pz);
          const rv = riverAt(px, pz);
          if (!rv || rv.d < rv.hw - 0.6 || rv.d > rv.hw + 1.8) continue;
          if (y > rv.level + 1.0 || y < rv.level - 0.45) continue;
          if (!unionRoadClear(px, pz, 0.3) || osmBuildingAt(px, pz, 0.3)) continue;
          // raw OSM points sit off the smoothed spline on bends; verify
          // against the rugged edge so reeds keep wet feet, not deep water
          dummy.position.set(px, y - 0.1, pz);
          dummy.rotation.y = rng() * 6.3;
          const s = 0.45 + rng() * 0.6;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          reeds.setMatrixAt(i++, dummy.matrix);
        }
      }
    }
    reeds.count = i;
    reeds.instanceMatrix.needsUpdate = true;
    refreshBounds(reeds);
    group.add(reeds);

    // washed gravel bars: the stones follow the SAME rugged riverzone rows as
    // the water skirt, so a bar reach reads stony in the paint, the collar
    // and the actual cobbles instead of drifting between three systems.
    const pebbleGeo = new THREE.IcosahedronGeometry(1, 0);
    pebbleGeo.scale(1, 0.55, 1);
    const cobbleGeo = new THREE.IcosahedronGeometry(1, 1);
    cobbleGeo.scale(1, 0.6, 1);
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pebbles = makeInstanced(pebbleGeo, stoneMat, 32000, false);
    const cobbles = makeInstanced(cobbleGeo, stoneMat, 32000, false);
    pebbles.receiveShadow = true;
    cobbles.receiveShadow = true;
    pebbles.name = 'pebbles';
    cobbles.name = 'cobbles';

    const RIVER_STONE_CAP = 26000, STREAM_STONE_CAP = 6000;
    const riverPebbles = [], riverCobbles = [], streamPebbles = [], streamCobbles = [];
    const addStones = (chan, density, seedBase, pebbleArr, cobbleArr) => {
      const samples = chan.samples;
      for (let si = 0; si < samples.length; si++) {
        const [x, z, level, hw] = samples[si];
        const [nx, nz] = sampleNormal(samples, si);
        for (const side of [-1, 1]) {
          const ch = bankCharSideAt(x, z, side, chan);
          const nExp = 1.4 * (0.35 + 2.4 * ch.bar) * (1 - 0.85 * ch.mud) * density;
          const rngS = mulberry32(seedBase + si * 2 + (side > 0 ? 1 : 0));
          const n = poissonish(rngS, nExp);
          for (let k = 0; k < n; k++) {
            const u = -1.3 + 3.9 * Math.pow(rngS(), 1.4);
            const off = hw + u;
            const px = x + nx * side * off, pz = z + nz * side * off;
            const py = heightAt(px, pz);
            if (lakeAt(px, pz) || py < level - 0.7 || py > level + 1.1) continue;
            const cobble = ch.bar > 0.3 && rngS() < 0.22 + 0.42 * ch.bar;
            const s = cobble ? 0.28 + rngS() * 0.22 : 0.07 + rngS() * 0.19;
            const jitter = (rngS() - 0.5) * 0.18;
            const warm = rngS() < 0.333;
            const wet = py < level + 0.12;
            const tiltX = (rngS() - 0.5) * 0.5;
            const tiltZ = (rngS() - 0.5) * 0.5;
            const e = [px, py, pz, s, rngS() * 6.283, tiltX, tiltZ, jitter, warm ? 1 : 0, wet ? 1 : 0];
            (cobble ? cobbleArr : pebbleArr).push(e);
          }
        }
      }
    };
    addStones(RIVER, 1, 0x71710000, riverPebbles, riverCobbles);
    STREAM_CHANNELS.forEach((chan, si) => {
      addStones(chan, 0.5, 0x57130000 + si * 100000, streamPebbles, streamCobbles);
    });

    const placeStones = (mesh, arr, ySquash) => {
      let i = 0;
      for (const e of arr) {
        const [x, y, z, s, yaw, tiltX, tiltZ, jitter, warm, wet] = e;
        const h = s * ySquash * 2;
        dummy.position.set(x, y - h * 0.3, z);
        dummy.rotation.set(tiltX, yaw, tiltZ);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        let cr = 0.48 + jitter, cg = 0.46 + jitter, cb = 0.43 + jitter;
        if (warm) { cr += 0.06; cg += 0.02; }
        if (wet) { cr *= 0.68 * 0.94; cg *= 0.68 * 0.98; cb *= 0.68 * 1.06; }
        col.setRGB(clamp(cr, 0.02, 1), clamp(cg, 0.02, 1), clamp(cb, 0.02, 1));
        mesh.setColorAt(i++, col);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      refreshBounds(mesh);
    };
    // Preserve the established stone budgets while side-aware bend character
    // redistributes them between inner bars and outer muddy toes.
    const pebbleList = strideSubsample([
      ...strideSubsample(riverPebbles, RIVER_STONE_CAP),
      ...strideSubsample(streamPebbles, STREAM_STONE_CAP),
    ], 3860);
    const cobbleList = strideSubsample([
      ...strideSubsample(riverCobbles, RIVER_STONE_CAP),
      ...strideSubsample(streamCobbles, STREAM_STONE_CAP),
    ], 1878);
    placeStones(pebbles, pebbleList, 0.55);
    placeStones(cobbles, cobbleList, 0.6);
    group.add(pebbles);
    group.add(cobbles);

    // Sparse flood debris at eroding outer-bend toes. Reuse the existing log
    // assets and cap the whole static dressing at 150 instances.
    const driftMeshes = logGeos.map((l) => makeInstanced(l.geometry, logMat, 50, true));
    driftMeshes.forEach((mesh, mi) => { mesh.name = `driftwood:${mi}`; });
    const driftCounts = [0, 0, 0];
    const samples = RIVER.samples;
    for (let si = 0; si < samples.length && driftCounts.reduce((a, b) => a + b, 0) < 150; si++) {
      const [x, z, , hw] = samples[si];
      const [nx, nz] = sampleNormal(samples, si), tx = -nz, tz = nx;
      for (const side of [-1, 1]) {
        const ch = bankCharSideAt(x, z, side, RIVER);
        if (ch.outer < 0.35 || ch.erosion < 0.45) continue;
        const rngD = mulberry32(0x64726966 + si * 2 + (side > 0 ? 1 : 0));
        if (rngD() > 0.035 * ch.outer) continue;
        const off = hw + 0.55 + rngD() * 1.8;
        const px = x + nx * side * off, pz = z + nz * side * off;
        const py = heightAt(px, pz), which = (rngD() * 3) | 0;
        const sc = 0.65 + rngD() * 0.55;
        if (driftCounts[which] >= 50 || lakeAt(px, pz) || waterLevelAt(px, pz, 5) > py + 0.08) continue;
        if (!unionRoadClear(px, pz, sc) || osmBuildingAt(px, pz, sc)) continue;
        dummy.position.set(px, py + 0.02, pz);
        dummy.rotation.set(0, -Math.atan2(tz, tx) + (rngD() - 0.5) * 0.8, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        driftMeshes[which].setMatrixAt(driftCounts[which]++, dummy.matrix);
      }
    }
    driftMeshes.forEach((mesh, mi) => {
      mesh.count = driftCounts[mi];
      mesh.instanceMatrix.needsUpdate = true;
      refreshBounds(mesh);
      group.add(mesh);
    });
  }

  // ---- wet-margin colonies: sedge, cattail, yellow flag iris ---------------
  // The mud reaches Phragmites doesn't bother with. Same channel-sample walk
  // as the stone scatter above (bankCharAt's mud/bar split); a colony-patch
  // fbm keeps sedge and iris clumped instead of a uniform sprinkle, and
  // cattail seeds discrete stands of 5-14 stalks rather than one per point.
  // Static across every era, same as the reeds above — use the modern OSM
  // footprints directly because this pass runs before the registry is warm.
  {
    const wetPatch = makeNoise(8181);
    const patchAt = (x, z) => smoothstep(0.26, 0.46, wetPatch.fbm(x * 0.028, z * 0.028, 2));
    const blocked = (x, z) => osmBuildingAt(x, z, 2) || !roadClear(5, x, z, 2);

    // -- geometry: 12-blade arcing clump, darker/stiffer than a reed --------
    const sedgeGeom = (() => {
      const pos = [], colArr = [], idx = [];
      const rr = makeNoise(5301).rng;
      for (let b = 0; b < 12; b++) {
        const yaw = rr() * Math.PI * 2;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const h = 0.55 + rr() * 0.45;     // fraction of the H=1 reference blade
        const arc = 0.1 + rr() * 0.16;    // slight outward arc, stiffer than a reed's droop
        const w = 0.014 + rr() * 0.006;
        const SEGS = 3;
        const base = pos.length / 3;
        for (let i = 0; i <= SEGS; i++) {
          const t = i / SEGS, y = t * h, out = arc * t * t, ww = w * (1 - t * 0.7);
          for (const side of [-1, 1]) {
            const lx = side * ww;
            pos.push(lx * c - out * s, y, lx * s + out * c);
            colArr.push(0.16 + t * 0.07, 0.24 + t * 0.09, 0.10 + t * 0.05);
          }
        }
        for (let i = 0; i < SEGS; i++) {
          const b0 = base + i * 2;
          idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();

    // -- geometry: thin stem + dark-brown sausage head + two strap leaves ---
    const cattailGeom = (() => {
      const pos = [], nrm = [], colArr = [], idx = [];
      const stem = new THREE.CylinderGeometry(0.014, 0.02, 1, 6, 1, true);
      stem.translate(0, 0.5, 0);
      mergeIn(pos, nrm, colArr, idx, stem, [0.20, 0.30, 0.13]);
      const head = new THREE.CylinderGeometry(0.045, 0.05, 0.3, 6);
      head.translate(0, 0.83, 0);
      mergeIn(pos, nrm, colArr, idx, head, [0.22, 0.14, 0.08]);
      for (const rot of [0.2, -0.2]) {
        const leaf = new THREE.BoxGeometry(0.02, 1.02, 0.01);
        leaf.translate(0, 0.51, 0);
        leaf.translate(0.03, 0, 0);
        leaf.rotateY(rot);
        mergeIn(pos, nrm, colArr, idx, leaf, [0.22, 0.34, 0.14]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      g.setIndex(idx);
      return g;
    })();

    // -- geometry: 3-4 broad blades fanned from one base + a 3-quad flower --
    const irisGeom = (() => {
      const pos = [], colArr = [], idx = [];
      const rr = makeNoise(9911).rng;
      const BLADES = 3 + ((rr() * 2) | 0);
      for (let b = 0; b < BLADES; b++) {
        const yaw = (b / BLADES) * Math.PI * 2 + (rr() - 0.5) * 0.5;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const h = 0.75 + rr() * 0.25, lean = 0.12 + rr() * 0.12, w = 0.028 + rr() * 0.01;
        const base = pos.length / 3;
        const tipX = lean * h;
        const quad = [[-w, 0, 0], [w, 0, 0], [tipX + w * 0.35, h, 0], [tipX - w * 0.35, h, 0]];
        for (const [lx, ly, lz] of quad) pos.push(lx * c - lz * s, ly, lx * s + lz * c);
        const base0 = [0.20, 0.34, 0.10], tip0 = [0.30, 0.46, 0.14];
        colArr.push(...base0, ...base0, ...tip0, ...tip0);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      // one small yellow flower — three quads splayed like the far-tree
      // impostor crosses, perched just off-centre in the fan
      const fx = 0.05, fz = 0.02, fy = 0.72, fw = 0.07, fh = 0.09;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a);
        const base = pos.length / 3;
        const quad = [[-fw, 0, 0], [fw, 0, 0], [fw * 0.5, fh, 0], [-fw * 0.5, fh, 0]];
        for (const [lx, ly, lz] of quad) pos.push(fx + lx * c - lz * s, fy + ly, fz + lx * s + lz * c);
        const yellow = [0.95, 0.8, 0.15];
        colArr.push(...yellow, ...yellow, ...yellow, ...yellow);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();

    const wetMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    // Side-aware bank character can move colonies between banks, but must not
    // inflate the established static flora budget.
    const SEDGE_CAP = 8172, CATTAIL_CAP = 9000, IRIS_CAP = 374;
    const sedges = makeInstanced(sedgeGeom, wetMat, SEDGE_CAP, false);
    const cattails = makeInstanced(cattailGeom, wetMat, CATTAIL_CAP, false);
    const irises = makeInstanced(irisGeom, wetMat, IRIS_CAP, false);
    sedges.name = 'sedges';
    cattails.name = 'cattails';
    irises.name = 'irises';

    const placeWet = (mesh, arr, cap) => {
      const list = strideSubsample(arr, cap);
      for (let i = 0; i < list.length; i++) {
        const [x, y, z, h, rot] = list[i];
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.setScalar(h);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      refreshBounds(mesh);
    };

    const sedgeCands = [], cattailCands = [], irisCands = [];

    // -- river + stream banks: sedge & iris on the bank, cattail wading in --
    const addChannelSedge = (chan, seedBase) => {
      const samples = chan.samples;
      for (let si = 0; si < samples.length; si++) {
        const [x, z, , hw] = samples[si];
        const [nx, nz] = sampleNormal(samples, si);
        const tx = -nz, tz = nx;
        const patch = patchAt(x, z);
        if (patch <= 0) continue;
        for (const side of [-1, 1]) {
          const ch = bankCharSideAt(x, z, side, chan);
          const density = 0.5 * (0.4 + 1.6 * ch.mud) * patch; // ~1/2m, side-aware mud weighting
          const rng = mulberry32(seedBase + si * 2 + (side > 0 ? 1 : 0));
          const n = poissonish(rng, density * 4);            // ~4m of arc per sample
          for (let k = 0; k < n; k++) {
            const along = (rng() - 0.5) * 3.6;
            const u = 0.2 + rng() * 4.3;                     // rv.d - rv.hw in [0.2, 4.5]
            const off = hw + u;
            const px = x + tx * along + nx * side * off, pz = z + tz * along + nz * side * off;
            const py = heightAt(px, pz);
            // the shelf just past the rendered edge sinks well below the
            // channel's nominal level BY DESIGN (a graded underwater bench,
            // see riverzone's shelf carve) — that's not open water once
            // you're past waterLevelAt's own wet radius, so judge "dry
            // enough" against the canonical wading oracle, not the raw level
            if (waterLevelAt(px, pz, 4) - 0.05 > py) continue;
            if (blocked(px, pz)) continue;
            sedgeCands.push([px, py, pz, 0.35 + rng() * 0.35, rng() * 6.283]);
          }
        }
      }
    };
    const addChannelCattail = (chan, seedBase) => {
      const samples = chan.samples;
      for (let si = 0; si < samples.length; si++) {
        const [x, z, level, hw] = samples[si];
        const [nx, nz] = sampleNormal(samples, si);
        const tx = -nz, tz = nx;
        for (const side of [-1, 1]) {
          const ch = bankCharSideAt(x, z, side, chan);
          if (ch.mud < 0.25) continue;                      // mud reaches only
          const rng = mulberry32(seedBase + si * 2 + (side > 0 ? 1 : 0));
          if (rng() > 0.22) continue;                        // sparse colony seeding
          const n = 5 + ((rng() * 10) | 0);                   // colonies of 5-14
          const u0 = -1.4 + rng() * 1.7;
          for (let m = 0; m < n; m++) {
            const along = (rng() - 0.5) * 3;
            const u = clamp(u0 + (rng() - 0.5) * 1.3, -1.4, 0.3); // rv.d - rv.hw in [-1.4, 0.3]
            const off = hw + u;
            const px = x + tx * along + nx * side * off, pz = z + tz * along + nz * side * off;
            const py = heightAt(px, pz);
            if (py > level + 0.35) continue;
            if (blocked(px, pz)) continue;
            cattailCands.push([px, py, pz, 1.1 + rng() * 0.6, rng() * 6.283]);
          }
        }
      }
    };
    const addChannelIris = (chan, seedBase) => {
      const samples = chan.samples;
      for (let si = 0; si < samples.length; si++) {
        const [x, z, , hw] = samples[si];
        const [nx, nz] = sampleNormal(samples, si);
        const tx = -nz, tz = nx;
        if (patchAt(x, z) <= 0) continue;
        for (const side of [-1, 1]) {
          const ch = bankCharSideAt(x, z, side, chan);
          if (ch.mud < 0.3) continue;                        // muddy, in the sedge zone
          const rng = mulberry32(seedBase + si * 2 + (side > 0 ? 1 : 0));
          const n = poissonish(rng, 4 / 25);                  // 1 clump per ~25m
          for (let k = 0; k < n; k++) {
            const along = (rng() - 0.5) * 3.6;
            const u = 0.2 + rng() * 4.3;
            const off = hw + u;
            const px = x + tx * along + nx * side * off, pz = z + tz * along + nz * side * off;
            const py = heightAt(px, pz);
            // the shelf just past the rendered edge sinks well below the
            // channel's nominal level BY DESIGN (a graded underwater bench,
            // see riverzone's shelf carve) — that's not open water once
            // you're past waterLevelAt's own wet radius, so judge "dry
            // enough" against the canonical wading oracle, not the raw level
            if (waterLevelAt(px, pz, 4) - 0.05 > py) continue;
            if (blocked(px, pz)) continue;
            irisCands.push([px, py, pz, 0.5 + rng() * 0.3, rng() * 6.283]);
          }
        }
      }
    };
    addChannelSedge(RIVER, 0x53440001);
    addChannelCattail(RIVER, 0x43540001);
    addChannelIris(RIVER, 0x49520001);
    STREAM_CHANNELS.forEach((chan, si) => {
      addChannelSedge(chan, 0x53440100 + si * 0x1000);
      addChannelCattail(chan, 0x43540100 + si * 0x1000);
      addChannelIris(chan, 0x49520100 + si * 0x1000);
    });

    // -- lake shores: sedge/iris on the bank, cattail wading just inside ----
    LAKE_SHORES.forEach((lake, li) => {
      const poly = lake.poly;
      for (let e = 0; e < poly.length; e++) {
        const [ax, az] = poly[e], [bx, bz] = poly[(e + 1) % poly.length];
        const len = Math.hypot(bx - ax, bz - az);
        const segs = Math.max(1, Math.round(len / 4));
        const [enx, enz] = sampleNormal(poly, e);
        for (let s = 0; s < segs; s++) {
          const t = (s + 0.5) / segs;
          const mx = ax + (bx - ax) * t, mz = az + (bz - az) * t;
          const ch = bankCharAt(mx, mz);
          const patch = patchAt(mx, mz);

          if (patch > 0) {
            // sedge — land side, within 6m of the rendered shoreline
            const rng = mulberry32(0x53449000 + li * 100000 + e * 977 + s);
            const density = 0.5 * (0.4 + 1.6 * ch.mud) * patch;
            const n = poissonish(rng, density * (len / segs));
            for (let k = 0; k < n; k++) {
              const dist = 0.3 + rng() * 5.5;
              const land = sideOf(mx, mz, enx, enz, dist, false);
              if (!land) continue;
              const [px, pz] = land;
              if (lakeShoreDistAt(px, pz) >= 6) continue;
              const py = heightAt(px, pz);
              if (py < lake.level - 0.05 || py > lake.level + 0.6) continue;
              if (blocked(px, pz)) continue;
              sedgeCands.push([px, py, pz, 0.35 + rng() * 0.35, rng() * 6.283]);
            }
          }

          if (patch > 0 && ch.mud > 0.3) {
            // iris — same band as sedge, sparser, muddy reaches only
            const rng = mulberry32(0x49529000 + li * 100000 + e * 977 + s);
            const n = poissonish(rng, (len / segs) / 25);
            for (let k = 0; k < n; k++) {
              const dist = 0.3 + rng() * 5.5;
              const land = sideOf(mx, mz, enx, enz, dist, false);
              if (!land) continue;
              const [px, pz] = land;
              if (lakeShoreDistAt(px, pz) >= 6) continue;
              const py = heightAt(px, pz);
              if (py < lake.level - 0.05 || py > lake.level + 0.6) continue;
              if (blocked(px, pz)) continue;
              irisCands.push([px, py, pz, 0.5 + rng() * 0.3, rng() * 6.283]);
            }
          }

          if (ch.mud >= 0.25) {
            // cattail — wading INSIDE the shoreline, mud reaches only
            const rng = mulberry32(0x43549000 + li * 100000 + e * 977 + s);
            if (rng() <= 0.22) {
              const n = 5 + ((rng() * 10) | 0);
              for (let m = 0; m < n; m++) {
                const dist = rng() * 6.5;
                const water = sideOf(mx, mz, enx, enz, dist, true);
                if (!water) continue;
                const [px, pz] = water;
                if (lakeShoreDistAt(px, pz) >= 7) continue;
                const py = heightAt(px, pz);
                if (py > lake.level + 0.35) continue;
                if (blocked(px, pz)) continue;
                cattailCands.push([px, py, pz, 1.1 + rng() * 0.6, rng() * 6.283]);
              }
            }
          }
        }
      }
    });

    placeWet(sedges, sedgeCands, SEDGE_CAP);
    placeWet(cattails, cattailCands, CATTAIL_CAP);
    placeWet(irises, irisCands, IRIS_CAP);
    group.add(sedges);
    group.add(cattails);
    group.add(irises);
  }

  // day-night tint for the unlit far impostors (sun colour × ambient level)
  function tick(sunColor, ambient) {
    impostorMat.color.setRGB(
      (0.45 + 0.55 * sunColor.r) * ambient,
      (0.45 + 0.55 * sunColor.g) * ambient,
      (0.45 + 0.55 * sunColor.b) * ambient);
  }

  // trunk circles for the walking player (full-detail tier + big erratics)
  function getColliders(era) {
    const lists = placementsFor(era);
    const out = boulderColliders.slice();
    for (const key of SP_KEYS) {
      if (key === 'shrub') continue;
      for (const e of lists[key].full) {
        out.push([e[0], e[2], Math.max(0.22, e[3] * 0.022)]);
      }
    }
    return out;
  }

  // ---- impostor promotion driver -------------------------------------------
  const promLast = { x: NaN, z: NaN };
  const _pm = new THREE.Matrix4();
  function promote(camX, camZ) {
    if (Math.hypot(camX - promLast.x, camZ - promLast.z) < 14) return;
    promLast.x = camX; promLast.z = camZ;
    for (const key of SP_KEYS) {
      const pool = promPool[key], fp = farPlaced[key], farM = farMeshes[key];
      if (!pool || !fp || !farM) continue;
      // nearest far-impostors around the camera
      const cand = [];
      const cx = Math.floor(camX / PROM_CELL), cz = Math.floor(camZ / PROM_CELL);
      for (let iz = cz - 2; iz <= cz + 2; iz++) for (let ix = cx - 2; ix <= cx + 2; ix++) {
        const arr = fp.byCell.get(ix + ':' + iz);
        if (!arr) continue;
        for (const idx of arr) {
          const e = fp.entries[idx];
          const d = Math.hypot(e[0] - camX, e[2] - camZ);
          if (d < PROM_R) cand.push([d, idx]);
        }
      }
      cand.sort((a, b) => a[0] - b[0]);
      const want = new Set();
      for (let i = 0; i < cand.length && want.size < PROM_CAP; i++) want.add(cand[i][1]);
      let farDirty = false;
      // demote: restore the impostor's real matrix, free the pool slot
      for (const [idx, slot] of [...pool.active]) {
        if (want.has(idx)) continue;
        const [x, y, z, h, , leanX = 0, leanZ = 0] = fp.entries[idx];
        dummy.position.set(x, y - 0.4, z);
        dummy.rotation.set(leanX, (idx * 2.399) % 6.283, leanZ);
        dummy.scale.set(h * 1.12 * fp.widen, h, h * 1.12 * fp.widen);
        dummy.updateMatrix();
        farM.setMatrixAt(idx, dummy.matrix);
        farM.instanceMatrix.addUpdateRange(idx * 16, 16);
        farDirty = true;
        pool.active.delete(idx);
        pool.free.push(slot);
      }
      // promote: hide the impostor, stand a real tree in its place
      for (const idx of want) {
        if (pool.active.has(idx) || !pool.free.length) continue;
        const slot = pool.free.pop();
        _pm.makeScale(0.0001, 0.0001, 0.0001);
        farM.setMatrixAt(idx, _pm);
        farM.instanceMatrix.addUpdateRange(idx * 16, 16);
        farDirty = true;
        const [x, y, z, h, tint, leanX = 0, leanZ = 0] = fp.entries[idx];
        const s = h / pool.hRef;
        dummy.position.set(x, y - 0.08 * s, z);
        dummy.rotation.set(leanX, (idx * 2.399) % 6.283, leanZ);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        pool.bark.setMatrixAt(slot, dummy.matrix);
        if (pool.cards) pool.cards.setMatrixAt(slot, dummy.matrix);
        col.setScalar(tint);
        pool.bark.setColorAt(slot, col);
        if (pool.cards) pool.cards.setColorAt(slot, col);
        pool.active.set(idx, slot);
      }
      if (farDirty) farM.instanceMatrix.needsUpdate = true;
      pool.bark.instanceMatrix.needsUpdate = true;
      if (pool.bark.instanceColor) pool.bark.instanceColor.needsUpdate = true;
      if (pool.cards) {
        pool.cards.instanceMatrix.needsUpdate = true;
        if (pool.cards.instanceColor) pool.cards.instanceColor.needsUpdate = true;
      }
    }
  }

  return { setEra, group, tick, getColliders, promote };
}
