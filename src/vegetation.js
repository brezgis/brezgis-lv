// Vegetation: LAAS-pipeline trees (real branched bark tubes + captured
// twig-atlas cluster cards) in two tiers — FULL (bark+cards, casts shadow)
// near the points of interest, FAR (whole-tree impostors captured at boot
// from the finished meshes) — plus old-growth understory: ferns, mossy
// deadfall, standing snags, glacial erratic boulders, lake reeds.
// Species mix follows Vidzeme Upland ecology: spruce/pine on the high
// moraine, birch and alder along water, oaks on the terrace, manor lindens.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, riverLevelNear, fieldAt, farmSiteKept, LOC } from './landuse.js';
import { LAKES, RIVER_PTS } from './geodata.js';
import { DWELLINGS_OSM } from './geodata-osm.js';
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { makeNoise, clamp, pointInPoly, canvasTexture } from './util.js';
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

// species build order (also impostor atlas order)
const SP_KEYS = ['spruce', 'pine', 'birch', 'oak', 'alder', 'linden', 'apple', 'shrub', 'snag'];
// instance capacity per species: [full, far]. Two tiers only — real geometry
// close to the points of interest, captured impostors beyond.
const CAPS = {
  spruce: [1700, 92000], pine: [1150, 64000], birch: [1400, 78000],
  oak: [560, 22000], alder: [900, 32000], linden: [280, 7000],
  apple: [90, 1400], shrub: [6000, 30000], snag: [200, 0],
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
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    farMeshes[e.key] = makeInstanced(geo, impostorMat, CAPS[e.key][1], false);
    group.add(farMeshes[e.key]);
  });

  // ---- near-tier instanced meshes ------------------------------------------
  // meshes[key] = { full: [{bark, cards}] }
  const meshes = {};
  for (const key of SP_KEYS) {
    const S = species[key];
    const mk = (variant, cap, shadows) => {
      const bark = makeInstanced(variant.bark, S.bMat, cap, shadows);
      let cards = null;
      if (S.cMat) {
        cards = makeInstanced(variant.cards, S.cMat, cap, shadows);
        cards.customDepthMaterial = cardDepthMaterial(S.twigAtlas);
      }
      group.add(bark);
      if (cards) group.add(cards);
      return { bark, cards };
    };
    meshes[key] = {
      full: S.full.map((v) => mk(v, Math.ceil(CAPS[key][0] / S.full.length), true)),
      fullH: S.full.map((v) => v.skel.height),
    };
  }

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
  const ferns = makeInstanced(fernGeo, fernMat, 9000, false);
  ferns.customDepthMaterial = cardDepthMaterial(fernAtlas);
  group.add(ferns);

  const logMat = windifyVeg(new THREE.MeshLambertMaterial({ map: barkTexes.spruce, vertexColors: true }));
  const logGeos = [buildLog(311, 'mossy'), buildLog(313, 'rotten'), buildLog(317, 'fresh')];
  const logs = logGeos.map((l) => makeInstanced(l.geometry, logMat, 900, true));
  const stumpGeo = buildStump(331);
  const stumps = makeInstanced(stumpGeo.geometry, logMat, 500, true);
  logs.forEach((l) => group.add(l));
  group.add(stumps);

  const boulderMat = windifyVeg(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const boulders = [makeInstanced(buildBoulder(41), boulderMat, 600, true),
                    makeInstanced(buildBoulder(43), boulderMat, 600, true)];
  boulders.forEach((b) => group.add(b));

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
    lists.fern = []; lists.log = []; lists.stump = [];
    const S = LOC.STEAD;
    const step = 12;   // real hemiboreal forest runs hundreds of stems/ha
    const EXT = HM_SPAN - 120;
    const N = Math.floor(EXT / step);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (ix / (N - 1) - 0.5) * EXT + HM_OFF_X + (rng() - 0.5) * step * 1.4;
        const z = (iz / (N - 1) - 0.5) * EXT + HM_OFF_Z + (rng() - 0.5) * step * 1.4;
        const y = heightAt(x, z);
        let inLake = false;
        for (const lake of LAKES) {
          if (y < lake.level + 0.5 && pointInPoly(x, z, lake.poly)) { inLake = true; break; }
        }
        if (inLake) continue;
        if (distToRiver(x, z) < 42 && y < riverLevelNear(x, z) + 0.4) continue;
        const d = forestDensity(era, x, z, y);
        if (d <= 0.02) continue;
        const dp = dPOI(x, z);
        // impostors are cheap — keep the deep landscape forested: primeval
        // eras are near-closed canopy, and even the agrarian mosaic reads
        // starved if the falloff bites too hard
        const falloff = clamp(560 / Math.max(dp, 1), era <= 2 ? 0.9 : 0.7, 1);
        if (rng() > d * 0.97 * falloff) continue;
        const tier = dp < FULL_R ? 'full' : 'far';
        // the denser grid would melt the full-geometry tier — thin it back
        // to roughly the old stem count; the far impostors take the density
        if (tier === 'full' && rng() < 0.44) continue;
        if (era === 0) {
          // tundra: knee-high dwarf birch / juniper heath
          lists.shrub[tier].push([x, y, z, 0.8 + rng() * 1.1, rng() * 6.3, 0.9 + rng() * 0.25]);
          continue;
        }
        const wet = distToRiver(x, z) < 40;
        const high = y > 215;
        const r = rng();
        let kind;
        if (wet) kind = r < 0.55 ? 'alder' : r < 0.85 ? 'birch' : 'spruce';
        else if (high) kind = r < 0.5 ? 'spruce' : r < 0.85 ? 'pine' : 'birch';
        else kind = r < 0.34 ? 'birch' : r < 0.6 ? 'spruce' : r < 0.82 ? 'pine' : 'oak';
        // old-growth snags in the primeval eras (near only — no far impostor)
        if ((era === 1 || era === 2) && tier === 'full' && d > 0.5 && rng() < 0.045) kind = 'snag';
        const h = { spruce: 17, pine: 19, birch: 13, oak: 13, alder: 8, snag: 10 }[kind] * (0.75 + rng() * 0.55);
        lists[kind][tier].push([x, y, z, h, rng() * 6.3, 0.86 + rng() * 0.28]);

        // understory in closed forest, near tiers only
        if (tier !== 'far' && d > 0.42) {
          if (rng() < (era <= 2 ? 0.3 : 0.15)) {
            const fx = x + (rng() - 0.5) * 10, fz = z + (rng() - 0.5) * 10;
            lists.fern.push([fx, heightAt(fx, fz), fz, 0.7 + rng() * 0.9, rng() * 6.3]);
          }
          if ((era === 1 || era === 2) && rng() < 0.05) {
            const lx = x + (rng() - 0.5) * 12, lz = z + (rng() - 0.5) * 12;
            lists.log.push([lx, heightAt(lx, lz), lz, rng() * 6.3, 0.8 + rng() * 0.7, (rng() * 3) | 0]);
          } else if (era >= 3 && rng() < 0.03) {
            const sx = x + (rng() - 0.5) * 9, sz = z + (rng() - 0.5) * 9;
            lists.stump.push([sx, heightAt(sx, sz), sz, rng() * 6.3, 0.8 + rng() * 0.6]);
          }
        }
      }
    }
    // orchard + manor park (identical layout to the researched plans)
    if (era === 3 || era === 4) {
      // every viensēta keeps a few apple trees by the dwelling (the classic
      // Latvian farm orchard) — same site-keep rule as the buildings
      DWELLINGS_OSM.forEach(([dx, dz], si) => {
        if (!farmSiteKept(si, era)) return;
        const n = 2 + ((si * 7) % 3);
        for (let k = 0; k < n; k++) {
          const a = (k / n) * 6.28 + si;
          const ox = dx + Math.cos(a) * (14 + (si % 5)), oz = dz + Math.sin(a) * (13 + (k * 3) % 6);
          const tier = dPOI(ox, oz) < FULL_R ? 'full' : 'far';
          lists.apple[tier].push([ox, heightAt(ox, oz), oz, 3.4 + ((si + k) % 4) * 0.35, si + k, 1]);
        }
      });
      for (let i = 0; i < 12; i++) {
        const x = S.x - 26 + (i % 4) * 8 + rng() * 2;
        const z = S.z - 34 + Math.floor(i / 4) * 8 + rng() * 2;
        lists.apple.full.push([x, heightAt(x, z), z, 3.6 + rng(), rng() * 6.3, 1]);
      }
      const M = LOC.MANOR;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const ax = M.x - 60 + 54 * t, az = M.z + 60 - 48 * t;
        for (const off of [-7, 7]) {
          const ox = ax + off * 0.7, oz = az + off * 0.7 * (54 / -48);
          lists.linden.full.push([ox, heightAt(ox, oz), oz, 13 + rng() * 4, rng() * 6.3, 1]);
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = rng() * Math.PI * 2, rr = 34 + rng() * 38;
        const x = M.x - 10 + Math.cos(a) * rr, z = M.z - 50 + Math.sin(a) * rr * 0.8;
        if (Math.abs(x - M.x) < 24 && Math.abs(z - M.z) < 16) continue;
        if (z > M.z + 6 && Math.abs(x - M.x) < 40) continue;
        lists[rng() < 0.6 ? 'linden' : 'oak'].full.push([x, heightAt(x, z), z, 12 + rng() * 6, rng() * 6.3, 1]);
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

  function fillTier(meshArr, heights, arr) {
    // round-robin across variants
    const per = meshArr.map(() => []);
    for (let i = 0; i < arr.length; i++) per[i % meshArr.length].push(arr[i]);
    meshArr.forEach((pair, vi) => {
      const list = per[vi];
      const capacity = pair.bark.instanceMatrix.count;
      const n = Math.min(list.length, capacity);
      const hRef = heights[vi];
      for (let i = 0; i < n; i++) {
        const [x, y, z, h, rot, tint] = list[i];
        const s = h / hRef;
        dummy.position.set(x, y - 0.08 * s, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(s * (0.92 + 0.16 * ((i * 7919) % 13) / 13), s, s * (0.92 + 0.16 * ((i * 104729) % 17) / 17));
        dummy.updateMatrix();
        pair.bark.setMatrixAt(i, dummy.matrix);
        if (pair.cards) pair.cards.setMatrixAt(i, dummy.matrix);
        col.setScalar(tint);
        pair.bark.setColorAt(i, col);
        if (pair.cards) pair.cards.setColorAt(i, col);
      }
      pair.bark.count = n;
      pair.bark.instanceMatrix.needsUpdate = true;
      if (pair.bark.instanceColor) pair.bark.instanceColor.needsUpdate = true;
      if (pair.cards) {
        pair.cards.count = n;
        pair.cards.instanceMatrix.needsUpdate = true;
        if (pair.cards.instanceColor) pair.cards.instanceColor.needsUpdate = true;
      }
    });
  }

  function setEra(era) {
    const lists = placementsFor(era);
    for (const key of SP_KEYS) {
      fillTier(meshes[key].full, meshes[key].fullH, lists[key].full);
      const farM = farMeshes[key];
      if (farM) {
        const arr = lists[key].far;
        const n = Math.min(arr.length, farM.instanceMatrix.count);
        for (let i = 0; i < n; i++) {
          const [x, y, z, h, , tint] = arr[i];
          dummy.position.set(x, y - 0.4, z);
          dummy.rotation.set(0, (i * 2.399) % 6.283, 0);
          dummy.scale.set(h, h, h); // unit-height impostor quads
          dummy.updateMatrix();
          farM.setMatrixAt(i, dummy.matrix);
          col.setScalar(0.82 + 0.28 * tint * 0.5);
          farM.setColorAt(i, col);
        }
        farM.count = n;
        farM.instanceMatrix.needsUpdate = true;
        if (farM.instanceColor) farM.instanceColor.needsUpdate = true;
      }
    }
    // ferns
    {
      const arr = lists.fern;
      const n = Math.min(arr.length, ferns.instanceMatrix.count);
      for (let i = 0; i < n; i++) {
        const [x, y, z, s, rot] = arr[i];
        dummy.position.set(x, y - 0.02, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(s, s * (0.85 + ((i * 31) % 7) / 14), s);
        dummy.updateMatrix();
        ferns.setMatrixAt(i, dummy.matrix);
      }
      ferns.count = n;
      ferns.instanceMatrix.needsUpdate = true;
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
      let bad = false;
      for (const lake of LAKES) if (y < lake.level + 0.5 && pointInPoly(x, z, lake.poly)) { bad = true; break; }
      if (bad) continue;
      for (const e of [2, 3, 4]) if (fieldAt(e, x, z)) { bad = true; break; }
      if (bad) continue;
      const n0 = noiseB.fbm(x * 0.004, z * 0.004, 3);
      const nearRiver = distToRiver(x, z);
      if (rng() > (n0 > 0.62 ? 0.5 : 0.06) && !(nearRiver < 30 && rng() < 0.3)) continue;
      const which = rng() < 0.5 ? 0 : 1;
      if (bi[which] >= 600) continue;
      const s = 0.25 + Math.pow(rng(), 2.2) * 2.4;
      dummy.position.set(x, y - s * 0.3, z);
      dummy.rotation.set(rng() * 0.4, rng() * 6.3, rng() * 0.4);
      dummy.scale.set(s * (0.8 + rng() * 0.5), s * (0.7 + rng() * 0.5), s * (0.8 + rng() * 0.5));
      dummy.updateMatrix();
      boulders[which].setMatrixAt(bi[which]++, dummy.matrix);
      if (s > 0.55) boulderColliders.push([x, z, s * 0.95]);
    }
    boulders.forEach((b, i) => { b.count = bi[i]; b.instanceMatrix.needsUpdate = true; });
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
    const rng = makeNoise(2211).rng;
    let i = 0;
    for (const lake of LAKES) {
      const poly = lake.poly;
      for (let e = 0; e < poly.length; e++) {
        const [ax, az] = poly[e], [bx, bz] = poly[(e + 1) % poly.length];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / 6);
        for (let k = 0; k < n && i < 6000; k++) {
          const t = (k + rng()) / n;
          const px = ax + (bx - ax) * t + (rng() - 0.5) * 10;
          const pz = az + (bz - az) * t + (rng() - 0.5) * 10;
          dummy.position.set(px, lake.level - 0.35, pz);
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
          if (y > p[2] + 1.0) continue;
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
    group.add(reeds);

    // cobbled shores AND a stony bed (LAAS streambed rule): waterworn
    // pebbles on the bars, real rocks down IN the channel — the bigger ones
    // break the surface in the shallows
    const pebbles = makeInstanced(buildBoulder(47), boulderMat, 5600, false);
    let pi = 0;
    for (const p of RIVER_PTS) {
      for (let k = 0; k < 5 && pi < 5600; k++) {
        const side = rng() < 0.5 ? -1 : 1;
        const px = p[0] + side * (9.5 + rng() * 5.5), pz = p[1] + (rng() - 0.5) * 40;
        const y = heightAt(px, pz);
        if (y > p[2] + 1.4) continue;             // pebbles hug the waterline
        const s = 0.05 + Math.pow(rng(), 1.8) * 0.3;
        dummy.position.set(px, y - s * 0.35, pz);
        dummy.rotation.set(rng() * 0.6, rng() * 6.3, rng() * 0.6);
        dummy.scale.set(s * (0.9 + rng() * 0.5), s * (0.55 + rng() * 0.3), s * (0.9 + rng() * 0.5));
        dummy.updateMatrix();
        pebbles.setMatrixAt(pi++, dummy.matrix);
      }
      // channel bed stones: sit on the carved bottom; the largest shoulder
      // out of the water on the inside of bends
      for (let k = 0; k < 3 && pi < 5600; k++) {
        const px = p[0] + (rng() - 0.5) * 16, pz = p[1] + (rng() - 0.5) * 36;
        const y = heightAt(px, pz);
        if (y > p[2] + 0.4) continue;             // in or at the water only
        const s = 0.14 + Math.pow(rng(), 1.6) * 0.55;
        dummy.position.set(px, y - s * 0.25, pz);
        dummy.rotation.set(rng() * 0.6, rng() * 6.3, rng() * 0.6);
        dummy.scale.set(s * (0.9 + rng() * 0.6), s * (0.6 + rng() * 0.35), s * (0.9 + rng() * 0.6));
        dummy.updateMatrix();
        pebbles.setMatrixAt(pi++, dummy.matrix);
      }
    }
    pebbles.count = pi;
    pebbles.instanceMatrix.needsUpdate = true;
    group.add(pebbles);
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

  return { setEra, group, tick, getColliders };
}
