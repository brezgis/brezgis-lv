// Near-field grass — LAAS GroundRing, WebGL edition, stable-world variant.
// Four camera-following bands: a SHORT DENSE CARPET everywhere the ground is
// green, tall blade CLUMPS near (per-pixel blade overlap is what reads as
// "lush"), lighter clumps mid, crossed wide tufts far out to ~430m; beyond
// that the terrain shader's sward speckle carries the look. Placement is
// DETERMINISTIC PER WORLD CELL (hashed grid): as the rings move with the
// camera the same world positions yield the same blades, so walking never
// reshuffles the sward — new growth only fades in at the feathered rim.
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { forestDensity, distToRiver, distToRoad, fieldAt, riverLevelNear, PADS } from './landuse.js';
import { LAKES } from './geodata.js';
import { mulberry32, makeNoise, pointInPoly, smoothstep as smoothstepJ } from './util.js';
import { WIND } from './vegetation.js';

// world-cell hash → deterministic rng stream per cell
function cellSeed(ix, iz, salt) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// bands: cell size (m), expected instances per cell, regen threshold, widen
const BANDS = [
  { key: 'carpet', r0: 0, r1: 36, cell: 1.6, perCell: 15.4, thresh: 12, wide: 0.8, carpet: true, hiOff: true },
  { key: 'near', r0: 0, r1: 32, cell: 1.6, perCell: 12.8, thresh: 10, wide: 1.05, hiOff: true },
  { key: 'mid', r0: 27, r1: 100, cell: 3.2, perCell: 13.3, thresh: 34, wide: 1.75 },
  { key: 'far', r0: 90, r1: 430, cell: 8, perCell: 6.4, thresh: 120, wide: 2.7 },
];

function bladeGeometry(segs) {
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
  pos.push(0, H + 0.045, 0.19);
  nrm.push(0, 0.35, -0.9);
  col.push(0.36, 0.5, 0.18);
  idx.push(segs * 2, segs * 2 + 1, pos.length / 3 - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
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
    const ox = (rnd() - 0.5) * 0.22, oz = (rnd() - 0.5) * 0.22;
    const hk = 0.62 + rnd() * 0.65;
    const lean = (rnd() - 0.5) * 0.42;
    const vJ = 0.85 + rnd() * 0.3;
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
      col.push((0.17 + v * 0.25) * 1.15, (0.25 + v * 0.3) * 1.15, (0.1 + v * 0.12) * 1.15);
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
          // gentle meadow breeze: shallow gust contrast, slow tempo, and the
          // tip ARCS DOWN as it deflects (constant blade length) — the old
          // curve stretched blades diagonally so gusts read as leaping flames
          float gust = 0.68 + 0.32 * sin(dot(wp, uWindD) * 0.035 - uWindT * 1.5 + hash * 2.4);
          float amp = uWindS * gust;
          float bend = amp * (0.5 + uWindS * 0.4) * tN * tN * 0.24;
          float flut = sin(uWindT * 3.8 + hash * 6.2832 + (wp.x + wp.y) * 0.9) * tN * amp * 0.03;
          transformed.x += uWindD.x * bend - uWindD.y * flut;
          transformed.z += uWindD.y * bend + uWindD.x * flut;
          transformed.y -= bend * bend * (0.5 / max(tN, 0.05));
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
  const b0 = pos.length / 3;
  pos.push(-0.012, 0, 0, 0.012, 0, 0, 0.008, H, 0.05, -0.008, H, 0.05);
  for (let k = 0; k < 4; k++) { nrm.push(0, 0, 1); col.push(0.2, 0.34, 0.12); }
  idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  // a tilted petal: quad rising outward from (cx,cy,cz) at azimuth a
  const petal = (cx, cy, cz, a, len, wid, tilt, cr, cg, cb) => {
    const b = pos.length / 3;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ux = -sa * wid, uz = ca * wid;             // width axis
    const ox = ca * len * Math.cos(tilt), oz = sa * len * Math.cos(tilt);
    const oy = len * Math.sin(tilt);
    pos.push(
      cx - ux, cy, cz - uz, cx + ux, cy, cz + uz,
      cx + ox + ux * 0.4, cy + oy, cz + oz + uz * 0.4,
      cx + ox - ux * 0.4, cy + oy, cz + oz - uz * 0.4);
    const nx = -ca * Math.sin(tilt), ny = Math.cos(tilt), nz = -sa * Math.sin(tilt);
    for (let k = 0; k < 4; k++) { nrm.push(nx, ny, nz); col.push(cr, cg, cb); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  if (kind === 0) {
    // meadowsweet: frothy cream dome — petals all over a hemisphere
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const up = i % 2 === 0 ? 0.85 : 0.35;
      petal(Math.cos(a) * 0.03, H + 0.02 + (i % 2) * 0.025, 0.05 + Math.sin(a) * 0.03,
        a, 0.075, 0.045, up, 0.93, 0.92, 0.84);
    }
    quad(0, H + 0.075, 0.05, 0.03, 0.96, 0.94, 0.86); // crown
  } else if (kind === 1) {
    // ox-eye daisy: 8 white petals radiating nearly flat + gold heart
    for (let i = 0; i < 8; i++) {
      petal(0, H + 0.02, 0.05, (i / 8) * Math.PI * 2, 0.062, 0.02, 0.22, 0.95, 0.95, 0.9);
    }
    quad(0, H + 0.034, 0.05, 0.018, 0.95, 0.78, 0.16);
  } else {
    // buttercup: 5 glossy cupped petals
    for (let i = 0; i < 5; i++) {
      petal(0, H + 0.02, 0.05, (i / 5) * Math.PI * 2, 0.034, 0.017, 0.65, 0.96, 0.78, 0.1);
    }
    quad(0, H + 0.028, 0.05, 0.01, 0.85, 0.62, 0.1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function buildGrass(scene) {
  const geos = [bladeClump(6, 2), bladeClump(8, 3), bladeClump(4, 2), tuftGeometry()];
  const mat = grassMaterial();
  const bands = BANDS.map((b, i) => {
    const cells = Math.PI * b.r1 * b.r1 / (b.cell * b.cell);
    const cap = Math.ceil(cells * b.perCell * 0.75); // rules thin ~40%+; headroom
    const mesh = new THREE.InstancedMesh(geos[i], mat, cap);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return { ...b, mesh, cap, lastX: 1e9, lastZ: 1e9, lastEra: -1, on: true, budget: 1 };
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

  // flowers on the same stable world grid (cell 6m, deterministic kinds)
  function regenFlowers(cx, cz, era) {
    const counts = [0, 0, 0];
    if (era >= 1) {
      const perCell = (era === 5 ? 0.28 : era >= 3 ? 0.56 : 1.12);
      const R = 125, CELL = 6;
      const ix0 = Math.floor((cx - R) / CELL), ix1 = Math.ceil((cx + R) / CELL);
      const iz0 = Math.floor((cz - R) / CELL), iz1 = Math.ceil((cz + R) / CELL);
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const rng = mulberry32(cellSeed(ix, iz, 51 + era));
        const n = (perCell | 0) + (rng() < perCell % 1 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const x = (ix + rng()) * CELL, z = (iz + rng()) * CELL;
          const rot = rng() * 6.3, sc = 0.7 + rng() * 0.7, pick = rng();
          const d = Math.hypot(x - cx, z - cz);
          if (d > R || d < 3) continue;
          if (rng() < smoothstepJ(R * 0.75, R, d)) continue;   // feathered rim
          const y = heightAt(x, z);
          if (forestDensity(era, x, z, y) > 0.3) continue;
          if (era >= 2 && (fieldAt(era, x, z) || distToRoad(era, x, z) < 2)) continue;
          const dRiv = distToRiver(x, z);
          if (dRiv < 4) continue;
          const kind = dRiv < 45 ? (pick < 0.7 ? 0 : 2) : (pick < 0.55 ? 1 : 2);
          if (counts[kind] >= 1400) continue;
          dummy.position.set(x, y - 0.02, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          flowerMeshes[kind].setMatrixAt(counts[kind]++, dummy.matrix);
        }
      }
    }
    flowerMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  }

  function regenerate(band, cx, cz, era) {
    const { mesh, cell, carpet, wide } = band;
    const r0 = band.r0Dyn !== undefined ? band.r0Dyn : band.r0;
    const r1 = band.r1;
    const perCell = band.perCell * band.budget;
    const cap = mesh.instanceMatrix.count;
    const salt = 7 * era + BANDS.indexOf(BANDS.find((b) => b.key === band.key)) * 131 + 17;
    // gather ring cells sorted centre-out so a full buffer drops the rim,
    // never one side
    const ix0 = Math.floor((cx - r1) / cell), ix1 = Math.ceil((cx + r1) / cell);
    const iz0 = Math.floor((cz - r1) / cell), iz1 = Math.ceil((cz + r1) / cell);
    const cellsArr = [];
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const ccx = (ix + 0.5) * cell, ccz = (iz + 0.5) * cell;
      const d2 = (ccx - cx) * (ccx - cx) + (ccz - cz) * (ccz - cz);
      if (d2 > (r1 + cell) * (r1 + cell)) continue;
      if (r0 > 0 && d2 < (r0 - cell) * (r0 - cell) * 0.6) continue;
      cellsArr.push([d2, ix, iz]);
    }
    cellsArr.sort((a, b) => a[0] - b[0]);
    let i = 0;
    for (const [, ix, iz] of cellsArr) {
      if (i >= cap) break;
      const rng = mulberry32(cellSeed(ix, iz, salt));
      const n = (perCell | 0) + (rng() < perCell % 1 ? 1 : 0);
      for (let k = 0; k < n && i < cap; k++) {
        // every draw below comes from the CELL stream — consume in fixed
        // order so a blade's look never depends on its neighbours' fate
        const x = (ix + rng()) * cell, z = (iz + rng()) * cell;
        const rot = rng() * Math.PI * 2;
        const hJ = rng(), wJ = rng(), gate = rng(), cJ1 = rng(), cJ2 = rng(), cJ3 = rng();
        const r = Math.hypot(x - cx, z - cz);
        if (r > r1 || r < r0 * 0.8) continue;
        // feathered rims: this band ramps up where the denser one ramps down
        if (r0 > 0 && gate > 0.3 + smoothstepJ(r0 * 0.8, r0 * 1.15, r) * 0.7) continue;
        if (gate < smoothstepJ(r1 * 0.82, r1, r) * 0.9) continue;
        const y = heightAt(x, z);
        // the channel is up to ~12m half-width plus bank overshoot: never
        // let blades stand in open water
        const dRiv = distToRiver(x, z);
        if (dRiv < 13) continue;                 // ribbon reaches ~12.6m half-width
        if (dRiv < 18 && y < riverLevelNear(x, z) + 0.6) continue;
        let inLake = false;
        for (const lake of LAKES) {
          if (y < lake.level + 0.5 && pointInPoly(x, z, lake.poly)) { inLake = true; break; }
        }
        if (inLake) continue;
        const fd = forestDensity(era, x, z, y);
        // the carpet creeps into the forest as a thin moss-grass floor
        if (fd > 0.62 && (!carpet || cJ1 < 0.5)) continue;
        if (!carpet && fd > 0.35 && cJ1 < 0.6) continue;
        if (era >= 2 && distToRoad(era, x, z) < 1.2) continue;
        let trodden = false;
        for (const p of PADS) {
          if (era === 1 && p !== PADS[2]) continue;
          if (Math.hypot(x - p.x, z - p.z) < p.r * 0.8) { trodden = true; break; }
        }
        // yards: tall clumps die, the short carpet merely thins
        if (trodden && cJ2 < (carpet ? 0.6 : 0.93)) continue;
        const fa = era >= 2 ? fieldAt(era, x, z) : null;
        dummy.position.set(x, y - 0.02, z);
        dummy.rotation.set(0, rot, 0);
        const tall = carpet
          ? 0.13 + hJ * 0.14
          : fa ? 1.0 + hJ * 0.25 : (trodden ? 0.2 : 0.42) + hJ * 0.5;
        const w = (0.8 + wJ * 0.5) * wide;
        dummy.scale.set(w, tall * (era === 0 ? 0.5 : 1), w);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // era & land-use tinting via instanceColor (multiplies vertex colours)
        if (era === 0) col.setRGB(1.35, 1.12, 0.8);            // straw tundra sedge
        else if (fa) {
          const t = fa.field.type;
          if (t === 'rye' || t === 'barley') col.setRGB(1.5, 1.35, 0.8);
          else if (t === 'flax') col.setRGB(1.0, 1.15, 1.5);
          else col.setRGB(1.0, 1.05, 0.9);
        } else {
          const wetK = Math.max(0, 1 - dRiv / 60) * 0.25;
          col.setRGB(0.84 + cJ3 * 0.26 - wetK * 0.3, 0.95 + cJ2 * 0.28, 0.76 + cJ1 * 0.22);
        }
        if (carpet) col.multiplyScalar(0.92);                  // carpet sits darker
        if (band.key === 'far') col.multiplyScalar(1.24);      // sun-bleached at range
        if (era === 5) col.multiplyScalar(0.72);               // satellite drape is dark
        mesh.setColorAt(i, col);
        i++;
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function update(focus, era, camPos) {
    // from high above blades are subpixel and dense rings read as discs —
    // drop the close bands and let the mid band cover from r=0
    const camDist = camPos ? Math.hypot(camPos.x - focus.x, camPos.y - focus.y, camPos.z - focus.z) : 0;
    const nearOn = camDist < 220;
    if (nearOn !== bands[0].on) {
      for (const b of bands) {
        if (b.hiOff) { b.on = nearOn; b.lastEra = -1; }
      }
      bands[2].r0Dyn = nearOn ? bands[2].r0 : 0;
      bands[2].lastEra = -1;
    }
    bands.forEach((band) => {
      const dx = focus.x - band.lastX, dz = focus.z - band.lastZ;
      if (era !== band.lastEra || dx * dx + dz * dz > band.thresh * band.thresh) {
        band.lastX = focus.x; band.lastZ = focus.z; band.lastEra = era;
        if (band.hiOff && !band.on) mesh0Off(band);
        else regenerate(band, focus.x, focus.z, era);
        if (band.key === 'near') regenFlowers(focus.x, focus.z, era);
      }
    });
  }
  function mesh0Off(band) {
    band.mesh.count = 0;
    band.mesh.instanceMatrix.needsUpdate = true;
  }
  // budget hook for the FPS governor: k in (0,1] scales per-cell density
  function setBudget(k) {
    for (const band of bands) {
      band.budget = k;
      band.lastEra = -1; // force regen
    }
  }
  return { update, setBudget, meshes: bands.map((b) => b.mesh) };
}
