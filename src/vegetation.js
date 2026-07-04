// Vegetation: instanced trees, riverside alders, lake reeds, meadow grass.
// Species mix follows Vidzeme Upland ecology: spruce/pine on the high
// moraine, birch and alder along water, oaks scattered on the terrace.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, riverLevelNear, LOC } from './landuse.js';
import { LAKES, RIVER_PTS } from './geodata.js';
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { makeNoise, clamp, pointInPoly } from './util.js';

function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const T = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };

// --- tree archetype geometries (unit height ~1, scaled per instance) -------
function spruceGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.02, 0.035, 0.25, 5), 0, 0.12, 0), 0x5a4630),
    colored(T(new THREE.ConeGeometry(0.34, 0.5, 7), 0, 0.42, 0), 0x24402a),
    colored(T(new THREE.ConeGeometry(0.26, 0.45, 7), 0, 0.66, 0), 0x2a4a2e),
    colored(T(new THREE.ConeGeometry(0.16, 0.38, 6), 0, 0.86, 0), 0x2e5030),
  ]);
}
function pineGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.028, 0.05, 0.62, 5), 0, 0.31, 0), 0x9a6a3d),
    colored(T(new THREE.SphereGeometry(0.24, 6, 5), -0.06, 0.72, 0.03), 0x3a5c33),
    colored(T(new THREE.SphereGeometry(0.19, 6, 5), 0.12, 0.85, -0.05), 0x40643a),
    colored(T(new THREE.SphereGeometry(0.15, 5, 4), -0.02, 0.94, 0.08), 0x466c3e),
  ]);
}
function birchGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.016, 0.03, 0.55, 5), 0, 0.27, 0), 0xdcd8cc),
    colored(T(new THREE.SphereGeometry(0.21, 6, 5), 0, 0.68, 0), 0x6d8f3c),
    colored(T(new THREE.SphereGeometry(0.15, 5, 4), 0.08, 0.85, 0.04), 0x789a42),
  ]);
}
function oakGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.045, 0.07, 0.42, 6), 0, 0.21, 0), 0x6a5138),
    colored(T(new THREE.SphereGeometry(0.3, 7, 6), 0, 0.62, 0), 0x3f5c2b),
    colored(T(new THREE.SphereGeometry(0.22, 6, 5), 0.2, 0.52, 0.1), 0x456331),
    colored(T(new THREE.SphereGeometry(0.2, 6, 5), -0.2, 0.55, -0.08), 0x3a5628),
  ]);
}
function alderGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 5), 0.04, 0.15, 0), 0x4d3d2c),
    colored(T(new THREE.CylinderGeometry(0.016, 0.028, 0.26, 5), -0.06, 0.13, 0.03), 0x4d3d2c),
    colored(T(new THREE.SphereGeometry(0.26, 6, 5), 0, 0.5, 0), 0x37542e),
    colored(T(new THREE.SphereGeometry(0.18, 5, 4), 0.14, 0.4, 0.06), 0x3d5a33),
  ]);
}
function appleGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.03, 0.045, 0.3, 5), 0, 0.15, 0), 0x5f4a34),
    colored(T(new THREE.SphereGeometry(0.32, 7, 6), 0, 0.52, 0), 0x4a6b33),
  ]);
}
function lindenGeo() {
  return mergeGeometries([
    colored(T(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6), 0, 0.2, 0), 0x5c4936),
    colored(T(new THREE.SphereGeometry(0.26, 7, 6), 0, 0.58, 0).scale(1, 1.35, 1), 0x44622f),
  ]);
}
function shrubGeo() {
  // dwarf birch / juniper clump for the tundra era
  return mergeGeometries([
    colored(T(new THREE.SphereGeometry(0.4, 5, 4), 0, 0.3, 0).scale(1, 0.6, 1), 0x5d5c38),
    colored(T(new THREE.SphereGeometry(0.28, 5, 4), 0.3, 0.24, 0.15).scale(1, 0.6, 1), 0x6a6540),
    colored(T(new THREE.SphereGeometry(0.24, 4, 3), -0.28, 0.2, -0.1).scale(1, 0.55, 1), 0x4f5434),
  ]);
}
// far/backdrop simplified
const farConifer = () => mergeGeometries([
  colored(T(new THREE.ConeGeometry(0.3, 0.85, 5), 0, 0.55, 0), 0x263f28),
  colored(T(new THREE.CylinderGeometry(0.02, 0.03, 0.15, 4), 0, 0.07, 0), 0x54432e),
]);
const farLeafy = () => mergeGeometries([
  colored(T(new THREE.SphereGeometry(0.3, 5, 4), 0, 0.62, 0), 0x3c5a2d),
  colored(T(new THREE.CylinderGeometry(0.02, 0.035, 0.4, 4), 0, 0.2, 0), 0x6b5540),
]);

// one shared wind clock for every plant in the world
export const WIND = {
  time: { value: 0 },
  dir: { value: new THREE.Vector2(0.76, 0.48).normalize() },
  strength: { value: 0.55 },
};

const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
// Hierarchical wind, adapted from LAAS (MIT): green (foliage/grass) flexes,
// brown (trunks) stays stiff; per-instance constant frequency; gust fronts
// drive amplitude only; a second axis at x1.31 draws Lissajous ellipses.
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
windify(mat);

function makeInstanced(geo, count, shadows) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = shadows;
  m.receiveShadow = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  return m;
}

export function buildVegetation(scene) {
  const near = {
    spruce: makeInstanced(spruceGeo(), 5200, true),
    pine: makeInstanced(pineGeo(), 3800, true),
    birch: makeInstanced(birchGeo(), 3800, true),
    oak: makeInstanced(oakGeo(), 1400, true),
    alder: makeInstanced(alderGeo(), 2200, true),
    apple: makeInstanced(appleGeo(), 80, true),
    linden: makeInstanced(lindenGeo(), 160, true),
    shrub: makeInstanced(shrubGeo(), 9000, false),
  };
  const far = {
    conifer: makeInstanced(farConifer(), 48000, false),
    leafy: makeInstanced(farLeafy(), 30000, false),
  };
  const group = new THREE.Group();
  group.name = 'vegetation';
  for (const k in near) group.add(near[k]);
  for (const k in far) group.add(far[k]);
  scene.add(group);

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const eraCache = new Map();

  function placementsFor(era) {
    if (eraCache.has(era)) return eraCache.get(era);
    const rng = makeNoise(1000 + era * 7).rng;
    const lists = {};
    for (const k in near) lists[k] = [];
    for (const k in far) lists[k] = [];
    const S = LOC.STEAD;
    const step = 17;
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
        if (distToRiver(x, z) < 42 && y < riverLevelNear(x, z) + 0.4) continue; // in the channel
        const d = forestDensity(era, x, z, y);
        if (d <= 0.02) continue;
        const dStage = Math.hypot(x - S.x, z - S.z);
        const falloff = clamp(480 / Math.max(dStage, 1), 0.22, 1);
        if (rng() > d * 0.82 * falloff) continue;
        if (era === 0) {
          // tundra: everything is a knee-high shrub
          lists.shrub.push([x, y, z, 0.8 + rng() * 1.3, rng() * Math.PI * 2, 0.9 + rng() * 0.2]);
          continue;
        }
        const nearStage = dStage < 520;
        const wet = distToRiver(x, z) < 40;
        const high = y > 215;
        const r = rng();
        let kind;
        if (wet) kind = r < 0.55 ? 'alder' : r < 0.85 ? 'birch' : 'spruce';
        else if (high) kind = r < 0.5 ? 'spruce' : r < 0.85 ? 'pine' : 'birch';
        else kind = r < 0.34 ? 'birch' : r < 0.6 ? 'spruce' : r < 0.82 ? 'pine' : 'oak';
        const h = { spruce: 15, pine: 19, birch: 12, oak: 13, alder: 7 }[kind] * (0.75 + rng() * 0.55);
        if (nearStage) lists[kind].push([x, y, z, h, rng() * Math.PI * 2, 0.9 + rng() * 0.2]);
        else lists[kind === 'spruce' || kind === 'pine' ? 'conifer' : 'leafy'].push([x, y, z, h, rng() * Math.PI * 2, 0.9 + rng() * 0.2]);
      }
    }
    // orchard (manor-era farms): apple trees north of the dwelling
    if (era === 3 || era === 4) {
      for (let i = 0; i < 12; i++) {
        const x = S.x - 26 + (i % 4) * 8 + rng() * 2;
        const z = S.z - 34 + Math.floor(i / 4) * 8 + rng() * 2;
        lists.apple.push([x, heightAt(x, z), z, 3.6 + rng(), rng() * 6.3, 1]);
      }
      // linden alley along the manor drive
      const M = LOC.MANOR;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const ax = M.x - 60 + (M.x - 6 - (M.x - 60)) * t, az = M.z + 60 + (M.z + 12 - (M.z + 60)) * t;
        const px = (az - M.z - 36) / -48, dummyv = px; void dummyv;
        for (const off of [-7, 7]) {
          const ox = ax + off * 0.7, oz = az + off * 0.7 * ((M.x - 6 - (M.x - 60)) / -48);
          lists.linden.push([ox, heightAt(ox, oz), oz, 13 + rng() * 4, rng() * 6.3, 1]);
        }
      }
      // manor park cluster — behind and beside the house, clear of the facade
      for (let i = 0; i < 18; i++) {
        const a = rng() * Math.PI * 2, rr = 34 + rng() * 38;
        const x = M.x - 10 + Math.cos(a) * rr, z = M.z - 50 + Math.sin(a) * rr * 0.8;
        if (Math.abs(x - M.x) < 24 && Math.abs(z - M.z) < 16) continue;
        if (z > M.z + 6 && Math.abs(x - M.x) < 40) continue;   // keep the forecourt open
        lists[rng() < 0.6 ? 'linden' : 'oak'].push([x, heightAt(x, z), z, 12 + rng() * 6, rng() * 6.3, 1]);
      }
    }
    // the great oak by the stead — sacred grove tree in the Latgalian era,
    // still standing today; and the attested summit oak on Brežģa kalns
    if (era >= 1) {
      lists.oak.push([LOC.OAK.x, heightAt(LOC.OAK.x, LOC.OAK.z), LOC.OAK.z, era <= 1 ? 14 : 15 + era, 1.2, 1.35]);
    }
    if (era >= 3) {
      const B = LOC.BREZGA;
      lists.oak.push([B.x + 9, heightAt(B.x + 9, B.z + 11), B.z + 11, 15 + (era - 3) * 1.5, 0.8, 1.3]);
    }
    eraCache.set(era, lists);
    return lists;
  }

  function setEra(era) {
    const lists = placementsFor(era);
    const all = { ...near, ...far };
    for (const k in all) {
      const mesh = all[k], arr = lists[k] || [];
      const n = Math.min(arr.length, mesh.instanceMatrix.count);
      for (let i = 0; i < n; i++) {
        const [x, y, z, h, rot, tint] = arr[i];
        dummy.position.set(x, y - 0.15, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(h * 0.95, h, h * 0.95);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (mesh.instanceColor !== null || i === 0) {
          col.setScalar(tint);
          mesh.setColorAt(i, col);
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // --- static across eras: reeds + meadow grass ---------------------------
  {
    const reedGeo = colored(new THREE.ConeGeometry(0.35, 2.2, 4), 0x7a7f46);
    reedGeo.translate(0, 1.1, 0);
    const reeds = makeInstanced(reedGeo, 11000, false);
    const rng = makeNoise(2211).rng;
    let i = 0;
    // reed belts along the real lake shorelines
    for (const lake of LAKES) {
      const poly = lake.poly;
      for (let e = 0; e < poly.length; e++) {
        const [ax, az] = poly[e], [bx, bz] = poly[(e + 1) % poly.length];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / 4);
        for (let k = 0; k < n && i < 11000; k++) {
          const t = (k + rng()) / n;
          const px = ax + (bx - ax) * t + (rng() - 0.5) * 10;
          const pz = az + (bz - az) * t + (rng() - 0.5) * 10;
          dummy.position.set(px, lake.level - 0.4, pz);
          dummy.rotation.y = rng() * 6.3;
          const s = 0.7 + rng() * 0.9;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          reeds.setMatrixAt(i++, dummy.matrix);
        }
      }
    }
    for (const p of RIVER_PTS) {
      if (rng() < 0.5) continue;
      for (const side of [-1, 1]) {
        if (i >= 11000) break;
        const px = p[0] + side * (12 + rng() * 4), pz = p[1] + (rng() - 0.5) * 20;
        const y = heightAt(px, pz);
        if (y > p[2] + 2.5) continue;
        dummy.position.set(px, y - 0.1, pz);
        dummy.rotation.y = rng() * 6.3;
        const s = 0.5 + rng() * 0.7;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        reeds.setMatrixAt(i++, dummy.matrix);
      }
    }
    reeds.count = i;
    reeds.instanceMatrix.needsUpdate = true;
    group.add(reeds);

    // meadow grass + flowers near the stage
    const bladeGeo = colored(new THREE.ConeGeometry(0.3, 0.5, 4), 0x6d7f42);
    bladeGeo.scale(1, 1, 0.55);
    bladeGeo.translate(0, 0.25, 0);
    const grass = makeInstanced(bladeGeo, 5000, false);
    const flowerGeo = colored(new THREE.SphereGeometry(0.07, 4, 3), 0xe8e2c8);
    flowerGeo.translate(0, 0.32, 0);
    const flowers = makeInstanced(flowerGeo, 1200, false);
    let gi = 0, fi = 0;
    const S = LOC.STEAD;
    for (let k = 0; k < 26000 && gi < 5000; k++) {
      const a = rng() * Math.PI * 2, rr = 10 + Math.pow(rng(), 0.7) * 150;
      const x = S.x + Math.cos(a) * rr, z = S.z + Math.sin(a) * rr;
      const y = heightAt(x, z);
      if (forestDensity(2, x, z, y) > 0.3) continue;
      if (distToRiver(x, z) < 12) continue;
      dummy.position.set(x, y - 0.05, z);
      dummy.rotation.y = rng() * 6.3;
      const s = 0.4 + rng() * 0.55;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grass.setMatrixAt(gi++, dummy.matrix);
      if (fi < 1200 && rng() < 0.22) {
        dummy.position.y += 0.25;
        dummy.updateMatrix();
        flowers.setMatrixAt(fi++, dummy.matrix);
      }
    }
    grass.count = gi; flowers.count = fi;
    grass.instanceMatrix.needsUpdate = true;
    flowers.instanceMatrix.needsUpdate = true;
    group.add(grass, flowers);
  }

  return { setEra, group };
}
