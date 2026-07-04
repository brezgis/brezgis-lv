// Near-field grass — LAAS GroundRing, WebGL edition. Three camera-following
// bands: BLADE CLUMPS near (N real blades merged per instance — per-pixel
// blade overlap is what reads as "lush"), lighter clumps mid, crossed wide
// tufts far. Wind is a cantilever tip² bend riding the same travelling gust
// field as the trees, plus a fine per-blade shimmer; blade normals are pulled
// toward 'up' so the sward lights like the hillside it grows on.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, distToRoad, fieldAt, riverLevelNear, PADS } from './landuse.js';
import { LAKES } from './geodata.js';
import { makeNoise, pointInPoly, smoothstep as smoothstepJ } from './util.js';
import { WIND } from './vegetation.js';

// band setup: [count, radius, regenerate-threshold]
const BANDS = [
  { count: 18000, r0: 0, r1: 46, thresh: 13 },
  { count: 32000, r0: 40, r1: 135, thresh: 42 },
  { count: 20000, r0: 125, r1: 300, thresh: 95 },
];

function bladeGeometry(segs, mini) {
  const pos = [], nrm = [], col = [], idx = [];
  const W = 0.023, H = 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = W * (1 - t * 0.8);
    const bendZ = t * t * 0.16; // gentle forward arc
    const c0 = [0.115 + t * 0.21, 0.185 + t * 0.27, 0.06 + t * 0.1];
    for (const s of [-1, 1]) {
      pos.push(s * w, t * H, bendZ);
      // rounded cross-section: edge normals tilt outward (LAAS ±38°)
      nrm.push(s * 0.62, 0.25, -0.75);
      col.push(c0[0] * (1 - 0.08 * s), c0[1], c0[2]);
    }
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  // tip
  pos.push(0, H + 0.045, 0.19);
  nrm.push(0, 0.35, -0.9);
  col.push(0.36, 0.5, 0.18);
  const tipI = pos.length / 3 - 1;
  idx.push(segs * 2, segs * 2 + 1, tipI);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  void mini;
  return g;
}

// N-blade clump merged into one instance
function bladeClump(blades, segs) {
  let s = 1234567 + blades * 77 + segs * 13;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = [], nrm = [], col = [], idx = [];
  const base = bladeGeometry(segs);
  const p = base.attributes.position, nA = base.attributes.normal, cA = base.attributes.color;
  const ix = base.index;
  for (let b = 0; b < blades; b++) {
    const yaw = rnd() * Math.PI * 2;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const ox = (rnd() - 0.5) * 0.2, oz = (rnd() - 0.5) * 0.2;
    const hk = 0.62 + rnd() * 0.65;
    const lean = (rnd() - 0.5) * 0.42;
    const vJ = 0.85 + rnd() * 0.3; // per-blade value jitter
    const v0 = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * 1.25, y = p.getY(i) * hk, z = p.getZ(i);
      pos.push(x * c + z * sn + ox + lean * y * c, y, z * c - x * sn + oz + lean * y * sn);
      nrm.push(nA.getX(i) * c + nA.getZ(i) * sn, nA.getY(i), nA.getZ(i) * c - nA.getX(i) * sn);
      col.push(cA.getX(i) * vJ, cA.getY(i) * vJ, cA.getZ(i) * vJ);
    }
    for (let i = 0; i < ix.count; i++) idx.push(v0 + ix.getX(i));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// three crossed wide blades — far-band tuft
function tuftGeometry(W = 0.06) {
  const pos = [], nrm = [], col = [], idx = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 1.92 + 0.4;
    const c = Math.cos(a), s = Math.sin(a);
    const base = pos.length / 3;
    for (const [u, v] of [[-W, 0], [W, 0], [W * 0.55, 1], [-W * 0.55, 1]]) {
      pos.push(u * c, v, u * s);
      const sgn = u < 0 ? -1 : 1;
      nrm.push(-s * 0.76 + sgn * 0.62 * c, 0.25, c * 0.76 + sgn * 0.62 * s);
      col.push(0.17 + v * 0.25, 0.25 + v * 0.3, 0.1 + v * 0.12);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function grassMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = WIND.time;
    sh.uniforms.uWindD = WIND.dir;
    sh.uniforms.uWindS = WIND.strength;
    sh.vertexShader = 'uniform float uWindT; uniform vec2 uWindD; uniform float uWindS;\n' +
      sh.vertexShader
        .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        // sward lights like the hillside: pull blade normals toward up
        objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.62));
        `)
        .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        {
          vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float hash = fract(sin(dot(wp, vec2(12.9898, 78.233))) * 43758.5453);
          float tN = clamp(position.y, 0.0, 1.5);
          float gust = 0.5 + 0.5 * sin(dot(wp, uWindD) * 0.045 - uWindT * 2.1 + hash * 2.4);
          float amp = uWindS * (0.3 + 0.9 * gust);
          float bend = amp * (0.6 + uWindS * 0.55) * tN * tN * 0.42;
          float flut = sin(uWindT * 5.2 + hash * 6.2832 + (wp.x + wp.y) * 0.9) * tN * amp * 0.05;
          transformed.x += uWindD.x * bend - uWindD.y * flut;
          transformed.z += uWindD.y * bend + uWindD.x * flut;
          transformed.y -= bend * tN * 0.4;
        }
        #endif
        `);
  };
  return m;
}

// midsummer flowers: thin stem + head of crossed quads. kind 0 = white umbel
// (meadowsweet / cow parsley, the Jāņi flower), 1 = ox-eye daisy, 2 = buttercup
function flowerGeometry(kind) {
  const pos = [], nrm = [], col = [], idx = [];
  const H = kind === 0 ? 1 : 0.55;
  const quad = (cxx, cy, cz, r, cr, cg, cb) => {
    const b = pos.length / 3;
    pos.push(cxx - r, cy, cz - r, cxx + r, cy, cz - r, cxx + r, cy, cz + r, cxx - r, cy, cz + r);
    for (let k = 0; k < 4; k++) { nrm.push(0, 1, 0); col.push(cr, cg, cb); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  // stem (green so the legacy wind rule flexes it)
  const b0 = pos.length / 3;
  pos.push(-0.012, 0, 0, 0.012, 0, 0, 0.008, H, 0.05, -0.008, H, 0.05);
  for (let k = 0; k < 4; k++) { nrm.push(0, 0, 1); col.push(0.2, 0.34, 0.12); }
  idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  if (kind === 0) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      quad(Math.cos(a) * 0.07, H + 0.02 + Math.sin(i * 2.4) * 0.015, 0.05 + Math.sin(a) * 0.07, 0.055, 0.95, 0.95, 0.88);
    }
  } else if (kind === 1) {
    quad(0, H + 0.02, 0.05, 0.05, 0.95, 0.95, 0.9);
    quad(0, H + 0.028, 0.05, 0.018, 0.95, 0.8, 0.2);
  } else {
    quad(0, H + 0.02, 0.05, 0.03, 0.95, 0.78, 0.12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function buildGrass(scene) {
  const geos = [bladeClump(5, 3), bladeClump(3, 2), tuftGeometry()];
  const mat = grassMaterial();
  const bands = BANDS.map((b, i) => {
    const mesh = new THREE.InstancedMesh(geos[i], mat, b.count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return { ...b, mesh, lastX: 1e9, lastZ: 1e9, lastEra: -1, on: true };
  });
  const flowerMeshes = [flowerGeometry(0), flowerGeometry(1), flowerGeometry(2)].map((g) => {
    const mesh = new THREE.InstancedMesh(g, mat, 1400);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  });

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const rng = makeNoise(7134).rng;

  function regenFlowers(cx, cz, era) {
    const counts = [0, 0, 0];
    if (era >= 1) {
      const budget = era === 5 ? 350 : era >= 3 ? 700 : 1400; // mown/grazed carry fewer
      for (let k = 0; k < budget * 3; k++) {
        const a = rng() * Math.PI * 2;
        const r = 4 + Math.sqrt(rng()) * 120;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const y = heightAt(x, z);
        if (forestDensity(era, x, z, y) > 0.3) continue;
        if (era >= 2 && (fieldAt(era, x, z) || distToRoad(era, x, z) < 2)) continue;
        const dRiv = distToRiver(x, z);
        if (dRiv < 4) continue;
        // meadowsweet crowds the damp riverside; daisies & buttercups the dry
        const kind = dRiv < 45 ? (rng() < 0.7 ? 0 : 2) : (rng() < 0.55 ? 1 : 2);
        if (counts[kind] >= 1400) continue;
        dummy.position.set(x, y - 0.02, z);
        dummy.rotation.y = rng() * 6.3;
        const s = 0.7 + rng() * 0.7;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        flowerMeshes[kind].setMatrixAt(counts[kind]++, dummy.matrix);
      }
    }
    flowerMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  }

  // coverage conservation (LAAS): sparser bands get wider blades so the
  // sward reads continuous instead of a dense disc around the camera
  const BAND_WIDE = [1, 1.8, 2.4];

  function regenerate(band, cx, cz, era, bandIndex) {
    const { mesh, count, r1 } = band;
    const r0 = band.r0Dyn !== undefined ? band.r0Dyn : band.r0;
    const wideK = BAND_WIDE[bandIndex];
    let i = 0, attempts = 0;
    const areaK = (r1 * r1 - r0 * r0);
    void areaK;
    while (i < count && attempts < count * 2.2) {
      attempts++;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(r0 * r0 + rng() * (r1 * r1 - r0 * r0));
      // feather the band edges so rings never read as hard circles: this
      // band ramps up exactly where the denser inner band ramps down
      const innerKeep = r0 > 0 ? 0.3 + smoothstepJ(r0, r0 * 1.25, r) * 0.7 : 1;
      const outerDrop = smoothstepJ(r1 * 0.8, r1, r) * 0.85;
      if (rng() < outerDrop || rng() > innerKeep) continue;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = heightAt(x, z);
      if (distToRiver(x, z) < 10 && y < riverLevelNear(x, z) + 0.5) continue;
      let inLake = false;
      for (const lake of LAKES) {
        if (y < lake.level + 0.5 && pointInPoly(x, z, lake.poly)) { inLake = true; break; }
      }
      if (inLake) continue;
      const fd = forestDensity(era, x, z, y);
      if (fd > 0.62) continue;                       // deep forest: moss floor
      if (fd > 0.35 && rng() < 0.6) continue;        // forest edge thinning
      if (era >= 2 && distToRoad(era, x, z) < 1.2) continue;
      // trodden farmyards: bare earth, only stray blades survive
      let trodden = false;
      for (const p of PADS) {
        if (era === 1 && p !== PADS[2]) continue;
        if (Math.hypot(x - p.x, z - p.z) < p.r * 0.8) { trodden = true; break; }
      }
      if (trodden && rng() < 0.93) continue;
      const fa = era >= 2 ? fieldAt(era, x, z) : null;
      dummy.position.set(x, y - 0.02, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const tall = fa ? 1.0 + rng() * 0.25 : (trodden ? 0.2 : 0.42) + rng() * 0.5;
      const wide = (0.8 + rng() * 0.5) * wideK;
      dummy.scale.set(wide, tall * (era === 0 ? 0.5 : 1), wide);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // era & land-use tinting via instanceColor (multiplies vertex colours)
      if (era === 0) col.setRGB(1.35, 1.12, 0.8);              // straw tundra sedge
      else if (fa) {
        const t = fa.field.type;
        if (t === 'rye' || t === 'barley') col.setRGB(1.5, 1.35, 0.8);
        else if (t === 'flax') col.setRGB(1.0, 1.15, 1.5);
        else col.setRGB(1.0, 1.05, 0.9);
      } else {
        const wetK = Math.max(0, 1 - distToRiver(x, z) / 60) * 0.25;
        col.setRGB(0.88 + rng() * 0.3 - wetK * 0.3, 0.95 + rng() * 0.28, 0.8 + rng() * 0.24);
      }
      if (era === 5) col.multiplyScalar(0.72); // blend into the darker satellite drape
      mesh.setColorAt(i, col);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function update(focus, era, camPos) {
    // from high above, blades are subpixel and the dense near band reads as
    // a dark disc — drop it and let the mid band cover from r=0
    const camDist = camPos ? Math.hypot(camPos.x - focus.x, camPos.y - focus.y, camPos.z - focus.z) : 0;
    const nearOn = camDist < 220;
    if (nearOn !== bands[0].on) {
      bands[0].on = nearOn;
      bands[0].lastEra = -1;
      bands[1].r0Dyn = nearOn ? bands[1].r0 : 0;
      bands[1].lastEra = -1;
    }
    bands.forEach((band, bi) => {
      const dx = focus.x - band.lastX, dz = focus.z - band.lastZ;
      if (era !== band.lastEra || dx * dx + dz * dz > band.thresh * band.thresh) {
        band.lastX = focus.x; band.lastZ = focus.z; band.lastEra = era;
        if (bi === 0 && !band.on) {
          band.mesh.count = 0;
        } else {
          regenerate(band, focus.x, focus.z, era, bi);
        }
        if (bi === 0) regenFlowers(focus.x, focus.z, era);
      }
    });
  }
  // budget hook for the FPS governor: k in (0,1] scales instance counts
  function setBudget(k) {
    for (const band of bands) {
      band.count = Math.floor(BANDS[bands.indexOf(band)].count * k);
      band.lastEra = -1; // force regen
    }
  }
  return { update, setBudget, meshes: bands.map((b) => b.mesh) };
}
