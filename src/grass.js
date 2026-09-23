// Near-field grass — LAAS GroundRing, WebGL edition, stable-world variant.
// Four camera-following bands: a SHORT DENSE CARPET everywhere the ground is
// green, tall blade CLUMPS near (per-pixel blade overlap is what reads as
// "lush"), lighter clumps mid, crossed wide tufts far out to ~430m; beyond
// that the terrain shader's sward speckle carries the look. Placement is
// DETERMINISTIC PER WORLD CELL (hashed grid): as the rings move with the
// camera the same world positions yield the same blades, so walking never
// reshuffles the sward — new growth only fades in at the feathered rim.
import * as THREE from 'three';
import { heightAt, meshHeightAt } from './terrain.js';
import { forestDensity, distToRiver, distToRoad, distToRoadEx, ROAD_HALF_W, fieldAt, PADS, ERA2_FARMS, LOC } from './landuse.js';
import { vegExcluded, lakeShoreWavyAt, lakeAt, streamAt, pondAt } from './riverzone.js';
import { shoreBodies } from './shore.js';
import { buildingAt, trampleAt } from './footprints.js';
import { mulberry32, makeNoise, smoothstep as smoothstepJ } from './util.js';
import { WIND } from './vegetation.js';

// world-cell hash → deterministic rng stream per cell
function cellSeed(ix, iz, salt) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// bands: cell size (m), expected instances per cell, regen threshold, widen
// FULL ground carpet: an ultra ring of wide-bladed turf right at the eye,
// a carpet ring behind it, tall clumps over both, and tufts all the way to
// the 900m horizon so nothing visibly spawns. cellRules bands evaluate the
// exclusion rules once per cell so walk-regen stays hitch-free; the coarse
// bands still check roads per blade (an 11m cell straddles a whole lane).
// altLo..altHi: the band THINS smoothly as the camera climbs through this
// range (deterministic prefix — lowering perCell keeps a stable subset of
// the same blades). The old binary 140m shed made the dense rings read as
// a furry disc gliding along under a flying camera, then pop off at once.
const BANDS = [
  // fade geometry: the dense trio must be GONE by ~75m — while the nadir
  // footprint still fits inside the mid ring, so the whole view thins as one
  // field, never as a disc. The mid band's altFloor is calibrated against the
  // far band's areal density so that at height the ring boundary dissolves
  // into the uniform tuft field instead of reading as a circle.
  { key: 'turf', r0: 0, r1: 26, cell: 1.3, perCell: 22, thresh: 9, wide: 1.2, carpet: true, hiOff: true, cellRules: true, altLo: 22, altHi: 48 },
  { key: 'carpet', r0: 22, r1: 62, cell: 1.6, perCell: 14, thresh: 18, wide: 1.1, carpet: true, hiOff: true, cellRules: true, altLo: 28, altHi: 62 },
  { key: 'near', r0: 0, r1: 55, cell: 1.6, perCell: 11, thresh: 15, wide: 1.15, hiOff: true, cellRules: true, altLo: 34, altHi: 78 },
  // The 60-130 m ground was the thinnest part of the whole view: the dense
  // trio has faded out by ~62 m and only this band carried it, at 1.3 tufts/m²
  // against the carpet's 5.5. Read as painted felt from any standing camera.
  // Only perCell moved — the radii and the altLo/altHi feathering are what
  // stop the rings reading as a disc under a flying camera, and the density
  // is a stable rng PREFIX per cell, so raising it keeps every existing blade.
  // altFloor stays calibrated to the far band's areal density so the ring
  // boundary still dissolves from the air: 6.5/9² = 0.080/m², and
  // 12.5 × 0.043 / 2.6² = 0.080/m². Move either perCell and this moves too.
  { key: 'mid', r0: 45, r1: 130, cell: 2.6, perCell: 12.5, thresh: 38, wide: 1.85, tallK: 0.9, cellRules: true, roadPerBlade: true, altLo: 78, altHi: 170, altFloor: 0.043 },
  // the far tuft is a WIDE crossed slab so that a sparse scatter still covers
  // ground; at full clump height those slabs stood up like thistles across
  // the middle distance, so keep the coverage and crop the height
  { key: 'far', r0: 115, r1: 900, cell: 9, perCell: 6.5, thresh: 260, wide: 2.4, tallK: 0.42, cellRules: true, roadPerBlade: true },
];

function bladeGeometry(segs) {
  const pos = [], nrm = [], col = [], idx = [];
  const W = 0.012, H = 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = W * (1 - t * 0.8);
    const bendZ = t * t * 0.16; // gentle forward arc
    // Vertex colours are linear and then multiplied by Lambert + instance
    // tint. The previous albedo was so low that even upward-lit blades read
    // nearly black beside the terrain at noon.
    const c0 = [0.065 + t * 0.12, 0.12 + t * 0.20, 0.025 + t * 0.06];
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
  col.push(0.21, 0.35, 0.085);
  idx.push(segs * 2, segs * 2 + 1, pos.length / 3 - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// N-blade clump merged into one instance
function bladeClump(blades, segs, widthK = 1, spread = 0.22) {
  let s = 1234567 + blades * 77 + segs * 13;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = [], nrm = [], col = [], idx = [], roots = [];
  const base = bladeGeometry(segs);
  const p = base.attributes.position, nA = base.attributes.normal, cA = base.attributes.color;
  const ix = base.index;
  for (let b = 0; b < blades; b++) {
    const yaw = rnd() * Math.PI * 2;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const ox = (rnd() - 0.5) * spread * 2, oz = (rnd() - 0.5) * spread * 2;
    const hk = 0.62 + rnd() * 0.65;
    const lean = (rnd() - 0.5) * 0.42;
    const vJ = 0.85 + rnd() * 0.3;
    const v0 = pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * 1.25 * widthK, y = p.getY(i) * hk, z = p.getZ(i);
      pos.push(x * c + z * sn + ox + lean * y * c, y, z * c - x * sn + oz + lean * y * sn);
      roots.push(ox,oz);
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
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(roots,2));
  return g;
}

// three crossed wide blades — far-band tuft
function tuftGeometry(W = 0.025) {
  const pos = [], nrm = [], col = [], idx = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 1.92 + 0.4;
    const c = Math.cos(a), s = Math.sin(a);
    const base = pos.length / 3;
    for (const [u, v] of [[-W, 0], [W, 0], [W * 0.3, 0.68], [0, 1]]) {
      pos.push(u * c, v, u * s);
      const sgn = u < 0 ? -1 : 1;
      nrm.push(-s * 0.76 + sgn * 0.62 * c, 0.25, c * 0.76 + sgn * 0.62 * s);
      col.push(0.09 + v * 0.12, 0.16 + v * 0.20, 0.035 + v * 0.065);
    }
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.setAttribute('aRoot',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));
  return g;
}

const FACE_DIRECTION_NEEDLE = 'float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;';
const DOUBLE_SIDED_NORMAL_CHUNK = (() => {
  const chunk = THREE.ShaderChunk.normal_fragment_begin;
  const patched = chunk.replace(FACE_DIRECTION_NEEDLE, 'float faceDirection = 1.0;');
  if (patched === chunk) throw new Error('grass.js: normal_fragment_begin no longer defines faceDirection');
  return patched;
})();

function grassMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = WIND.time;
    sh.uniforms.uWindD = WIND.dir;
    sh.uniforms.uWindS = WIND.strength;
    sh.vertexShader = 'uniform float uWindT; uniform vec2 uWindD; uniform float uWindS; attribute vec2 aRoot;\n' +
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
          // Short turf used metre-high blade curves scaled only vertically:
          // its tips bent almost horizontally, like scattered straw shards.
          float aspect = min(1.0, length(instanceMatrix[1].xyz) / max(0.01,length(instanceMatrix[0].xyz)));
          transformed.xz = aRoot + (transformed.xz-aRoot)*aspect;
        }
        #endif
        `);
    // Blades are optically thin. Three's generic DoubleSide path flips the
    // backface normal downward, making half the meadow render as black shards
    // at noon. Light both sides with the same grass-facing normal instead.
    //
    // This must splice the RESOLVED chunk: onBeforeCompile runs before three
    // expands `#include <...>`, so replacing a line that lives inside
    // normal_fragment_begin matched nothing and the fix never once ran. The
    // assert makes a three upgrade fail loudly instead of silently.
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <normal_fragment_begin>', DOUBLE_SIDED_NORMAL_CHUNK);
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
    pos.push(cxx,cy,cz);nrm.push(0,1,0);col.push(cr,cg,cb);
    for(let k=0;k<8;k++){const a=k*Math.PI/4;pos.push(cxx+Math.cos(a)*r,cy,cz+Math.sin(a)*r);nrm.push(0,1,0);col.push(cr,cg,cb);idx.push(b,b+1+k,b+1+(k+1)%8);}
  };
  const b0 = pos.length / 3;
  pos.push(-0.003, 0, 0, 0.003, 0, 0, 0.002, H, 0.05, -0.002, H, 0.05);
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
      cx - ux*.25, cy, cz - uz*.25, cx + ux*.25, cy, cz + uz*.25,
      cx + ox*.65 + ux, cy + oy*.65, cz + oz*.65 + uz,
      cx + ox, cy + oy, cz + oz,
      cx + ox*.65 - ux, cy + oy*.65, cz + oz*.65 - uz);
    const nx = -ca * Math.sin(tilt), ny = Math.cos(tilt), nz = -sa * Math.sin(tilt);
    for (let k = 0; k < 5; k++) { nrm.push(nx, ny, nz); col.push(cr, cg, cb); }
    idx.push(b,b+1,b+2,b,b+2,b+3,b,b+3,b+4);
  };
  for(let i=0;i<3;i++)petal(0,H*(.22+i*.19),.05*(.22+i*.19),i*2.4,.09,.022,.28,.075,.18,.038);
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
  // Dense carpet blades must stay narrow: the old 1.55x/1.3x width multipliers
  // produced ~5 cm straps that crossed into a field of dark triangular shards.
  const geos = [bladeClump(10, 2, 0.72, 0.34), bladeClump(6, 2, 0.82, 0.28), bladeClump(8, 3, 0.92), bladeClump(4, 2), tuftGeometry()];
  const mat = grassMaterial();
  const bands = BANDS.map((b, i) => {
    const cells = Math.PI * b.r1 * b.r1 / (b.cell * b.cell);
    const cap = Math.ceil(cells * b.perCell * 0.92); // 0.75 saturated in open meadow and chopped the outer feather
    const mesh = new THREE.InstancedMesh(geos[i], mat, cap);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = i < 4;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.onUpload(() => mesh.instanceMatrix.clearUpdateRanges());
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.onUpload(() => mesh.instanceColor.clearUpdateRanges());
    mesh.name = `grass-${b.key}`;          // so data/dbg.mjs can hide one band
    scene.add(mesh);
    return { ...b, mesh, cap, idx: i, lastX: 1e9, lastZ: 1e9, lastEra: -1, on: true, budget: 1, altK: 1 };
  });
  const flowerMeshes = [flowerGeometry(0), flowerGeometry(1), flowerGeometry(2)].map((g, fi) => {
    const mesh = new THREE.InstancedMesh(g, mat, 4000);
    mesh.receiveShadow = true;
    mesh.name = `grass-flower-${fi}`;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  });

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // flowers on the same stable world grid (cell 6m, deterministic kinds).
  // k thins them with camera altitude alongside the near band.
  const meadowNoise=makeNoise(591);
  function regenFlowers(cx, cz, era, k = 1) {
    const counts = [0, 0, 0];
    if (era >= 1 && k > 0.02) {
      const perCell = (era === 5 ? 2.4 : era >= 3 ? 3.5 : 3.0) * k;
      const R = 125, CELL = 6;
      const ix0 = Math.floor((cx - R) / CELL), ix1 = Math.ceil((cx + R) / CELL);
      const iz0 = Math.floor((cz - R) / CELL), iz1 = Math.ceil((cz + R) / CELL);
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const rng = mulberry32(cellSeed(ix, iz, 51 + era));
        const n = (perCell | 0) + (rng() < perCell % 1 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          // fixed draw order, ALL draws before any camera-dependent bail —
          // a conditional draw shifted every later flower in the cell when
          // the camera crossed the rim (flowers teleported / changed species)
          const x = (ix + rng()) * CELL, z = (iz + rng()) * CELL;
          const rot = rng() * 6.3, sc = 0.7 + rng() * 0.7, pick = rng(), gate = rng();
          const d = Math.hypot(x - cx, z - cz);
          if (d > R) continue;
          // Flower-rich patches and quieter sward, stable in world space.
          if(gate > smoothstepJ(.28,.65,meadowNoise.noise2(x*.028,z*.028)))continue;
          if (gate < smoothstepJ(R * 0.75, R, d)) continue;   // feathered rim
          const y = heightAt(x, z);
          if (forestDensity(era, x, z, y) > 0.3) continue;
          if (buildingAt(era, x, z, 0.3)) continue;
          if (era >= 2) {
            if (fieldAt(era, x, z)) continue;
            const road = distToRoadEx(era, x, z);
            if (road.d < ROAD_HALF_W[road.c] + 0.3) continue;
          }
          const dRiv = Math.min(distToRiver(x, z),lakeShoreWavyAt(x,z),streamAt(x,z)?.d??Infinity);
          if (vegExcluded(x, z, y, era, 3.5)) continue;
          const kind = dRiv < 45 ? (pick < 0.7 ? 0 : 2) : (pick < 0.55 ? 1 : 2);
          if (counts[kind] >= 4000) continue;
          dummy.position.set(x, meshHeightAt(x, z) - 0.02, z);
          dummy.rotation.set(0, rot, 0);
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          flowerMeshes[kind].setMatrixAt(counts[kind]++, dummy.matrix);
        }
      }
    }
    flowerMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  }

  const REGEN_CHUNK_INSTANCES = 2800;
  const REGEN_CHUNK_CELLS = 2800;
  let activeJob = null;
  const queue = [];

  function startBandJob(job) {
    const { band, cx, cz, era } = job;
    const { mesh, cell } = band;
    const r0 = band.r0Dyn !== undefined ? band.r0Dyn : band.r0;
    const r1 = band.r1;
    job.r0 = r0;
    job.r1 = r1;
    job.perCell = band.perCell * band.budget * band.altK;
    job.cap = mesh.instanceMatrix.count;
    job.salt = 7 * era + band.idx * 131 + 17;
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
    job.cellsArr = cellsArr;
    job.cursor = 0;
    job.i = 0;
    job.started = true;
  }

  function writeBandCell(job, ix, iz) {
    const { band, cx, cz, era, r0, r1, perCell, cap, salt } = job;
    const { mesh, cell, carpet, wide, cellRules } = band;
    if (job.i >= cap) return;
    const rng = mulberry32(cellSeed(ix, iz, salt));
    const n = (perCell | 0) + (rng() < perCell % 1 ? 1 : 0);
    // dense bands: rules once per 1.3m cell — blades that close together
    // share their fate, and per-blade rule checks made walk-regen hitch
    let cellOK = true, cFa = null, cTrodden = false, cDRiv = 0, cFd = 0, cY = 0, cShoreK = 1, cWater = -Infinity;
    if (cellRules) {
      const ccx = (ix + 0.5) * cell, ccz = (iz + 0.5) * cell;
      cY = heightAt(ccx, ccz);
      cDRiv = distToRiver(ccx, ccz);
      if (vegExcluded(ccx, ccz, cY, era, 2 + cell * 0.75)) cellOK = false;
      if (cellOK) {
        // no sward through a farmhouse floor — flowers checked footprints,
        // the blade carpet never did (cell test; the margin covers the cell)
        if (buildingAt(era, ccx, ccz, cell * 0.75)) cellOK = false;
        // lakeshore feather: the sward thins gently to the waterline
        // instead of stopping on a drawn rim; the wavy distance makes the
        // fade wander with the real water's edge
        const dSh = lakeShoreWavyAt(ccx, ccz);
        if (dSh < 8) cShoreK = lakeAt(ccx, ccz) ? 0 : smoothstepJ(0.4, 7.5, dSh);
        if (cShoreK <= 0.02) cellOK = false;
        // the cell may straddle a waterline its centre doesn't: remember the
        // water level nearby so each blade can check its own footing
        if (cellOK && (cDRiv < 45 || dSh < 30 || streamAt(ccx, ccz))) {
          for (const b of shoreBodies(ccx, ccz)) if (b.e < cell + 6 && b.level > cWater) cWater = b.level;
        }
        if (cellOK && (era === 3 || era === 4) && pondAt(ccx, ccz)) cWater = Math.max(cWater, LOC.POND_LEVEL);
      }
      if (cellOK) {
        cFd = forestDensity(era, ccx, ccz, cY);
        if (!band.roadPerBlade && era >= 2 && distToRoad(era, ccx, ccz) < 1.2) cellOK = false;
      }
      if (cellOK) {
        for (const p of PADS) {
          if (era === 1 && p !== PADS[2]) continue;
          if (Math.hypot(ccx - p.x, ccz - p.z) < p.r * 0.8) { cTrodden = true; break; }
        }
        if (era === 2 && !cTrodden) {
          for (const f of ERA2_FARMS) {
            if (Math.hypot(ccx - f.x, ccz - f.z) < 11) { cTrodden = true; break; }
          }
        }
        if (!cTrodden && trampleAt(era, ccx, ccz, 0.5)) cTrodden = true;   // paddocks graze bare
        cFa = era >= 2 ? fieldAt(era, ccx, ccz) : null;
      }
      if (!cellOK) return;
    }
    let i = job.i;
    for (let k = 0; k < n && i < cap; k++) {
      // every draw below comes from the CELL stream — consume in fixed
      // order so a blade's look never depends on its neighbours' fate
      const x = (ix + rng()) * cell, z = (iz + rng()) * cell;
      const rot = rng() * Math.PI * 2;
      const hJ = rng(), wJ = rng(), gate = rng(), cJ1 = rng(), cJ2 = rng(), cJ3 = rng();
      const r = Math.hypot(x - cx, z - cz);
      if (r > r1 || r < r0 * 0.8) continue;
      // feathered rims: this band ramps up where the denser one ramps down.
      // WIDE ramps (outer from 0.68·r1, full kill at the edge) — the old
      // short 0.82 ramp left 10% of blades alive right AT the boundary and
      // the residual step read as a ring around the player
      if (r0 > 0 && gate > 0.22 + smoothstepJ(r0 * 0.72, r0 * 1.2, r) * 0.78) continue;
      if (gate < smoothstepJ(r1 * 0.68, r1, r)) continue;
      // lakeshore feather (cJ3 doubles as the gate — its survivors skew
      // low-red, which reads wetter exactly where the sward thins)
      if (cShoreK < 1 && cJ3 > cShoreK) continue;
      let y, dRiv, fd, trodden, fa;
      if (cellRules) {
        y = heightAt(x, z);
        dRiv = cDRiv;
        fd = cFd;
        trodden = cTrodden;
        fa = cFa;
        if (band.roadPerBlade && era >= 2 && distToRoad(era, x, z) < 1.4) continue;
      } else {
        y = heightAt(x, z);
        dRiv = distToRiver(x, z);
        if (vegExcluded(x, z, y, era, 2)) continue;
        fd = forestDensity(era, x, z, y);
        if (era >= 2 && distToRoad(era, x, z) < 1.2) continue;
        trodden = false;
        for (const p of PADS) {
          if (era === 1 && p !== PADS[2]) continue;
          if (Math.hypot(x - p.x, z - p.z) < p.r * 0.8) { trodden = true; break; }
        }
        fa = era >= 2 ? fieldAt(era, x, z) : null;
      }
      // the carpet creeps into the forest as a thin moss-grass floor
      if (fd > 0.62 && (!carpet || cJ1 < 0.5)) continue;
      if (!carpet && fd > 0.35 && cJ1 < 0.6) continue;
      // yards: tall clumps die, the short carpet merely thins
      if (trodden && cJ2 < (carpet ? 0.6 : 0.93)) continue;
      const gy = meshHeightAt(x, z);
      if (gy < cWater + 0.08) continue;              // no sward under the water
      dummy.position.set(x, gy - 0.02, z);
      dummy.rotation.set(0, rot, 0);
      const tall = (carpet
        ? 0.13 + hJ * 0.14
        : fa ? 1.0 + hJ * 0.25 : (trodden ? 0.2 : 0.42) + hJ * 0.5) * (band.tallK || 1);
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
        const wetK = Math.max(Math.max(0, 1 - dRiv / 60) * 0.25, (1 - cShoreK) * 0.3);
        col.setRGB(0.84 + cJ3 * 0.26 - wetK * 0.3, 0.95 + cJ2 * 0.28, 0.76 + cJ1 * 0.22);
      }
      if (carpet) col.multiplyScalar(0.92);                  // carpet sits darker
      if (band.key === 'far') col.multiplyScalar(1.08);
      if (era === 5) col.multiplyScalar(0.82);               // the drape is darker, but not by this much
      mesh.setColorAt(i, col);
      i++;
    }
    job.i = i;
  }

  function stepBandJob(job, maxInstances, maxCells = Infinity) {
    if (!job.started) startBandJob(job);
    const startI = job.i;
    let cells = 0;
    while (job.cursor < job.cellsArr.length && job.i < job.cap) {
      const [, ix, iz] = job.cellsArr[job.cursor++];
      writeBandCell(job, ix, iz);
      cells++;
      if (job.i - startI >= maxInstances || cells >= maxCells) break;
    }
    const mesh = job.band.mesh;
    const count = job.i - startI;
    if (count > 0) {
      mesh.instanceMatrix.addUpdateRange(startI * 16, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.addUpdateRange(startI * 3, count * 3);
      mesh.instanceColor.needsUpdate = true;
    }
    return job.cursor >= job.cellsArr.length || job.i >= job.cap;
  }

  function finishBandJob(job) {
    const mesh = job.band.mesh;
    mesh.count = job.i;
  }

  function regenerate(band, cx, cz, era) {
    cancelBandJob(band);
    const job = { kind: 'band', band, cx, cz, era, started: false };
    stepBandJob(job, Infinity);
    finishBandJob(job);
  }

  function jobPriority(job) {
    if (job.kind === 'flowers') return 3;
    return job.band.idx < 3 ? job.band.idx : job.band.idx + 1;
  }

  function dropQueued(match) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (match(queue[i])) queue.splice(i, 1);
    }
  }

  function cancelFlowerJobs() {
    dropQueued((job) => job.kind === 'flowers');
    if (activeJob && activeJob.kind === 'flowers') activeJob = null;
  }

  function cancelBandJob(band) {
    dropQueued((job) => job.kind === 'band' && job.band === band);
    if (activeJob && activeJob.kind === 'band' && activeJob.band === band) activeJob = null;
    if (band.key === 'near') cancelFlowerJobs();
  }

  function enqueueBandJob(band, cx, cz, era) {
    cancelBandJob(band);
    queue.push({ kind: 'band', band, cx, cz, era, started: false });
  }

  function enqueueFlowerJob(cx, cz, era) {
    cancelFlowerJobs();
    queue.push({ kind: 'flowers', cx, cz, era });
  }

  function nextQueuedIndex() {
    let best = -1, bestPri = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const pri = jobPriority(queue[i]);
      if (pri < bestPri) { bestPri = pri; best = i; }
    }
    return best;
  }

  function pullNextJob() {
    const i = nextQueuedIndex();
    return i < 0 ? null : queue.splice(i, 1)[0];
  }

  function processQueue() {
    if (activeJob) {
      const i = nextQueuedIndex();
      if (i >= 0 && jobPriority(queue[i]) < jobPriority(activeJob)) {
        queue.push(activeJob);
        activeJob = null;
      }
    }
    if (!activeJob) activeJob = pullNextJob();
    if (!activeJob) return;

    const job = activeJob;
    if (job.kind === 'flowers') {
      regenFlowers(job.cx, job.cz, job.era, nearBand.altK);
      activeJob = null;
      return;
    }
    if (job.era !== job.band.lastEra || job.cx !== job.band.lastX || job.cz !== job.band.lastZ) {
      activeJob = null;
      return;
    }
    if (job.band.hiOff && !job.band.on) {
      mesh0Off(job.band);
      activeJob = null;
      return;
    }
    if (stepBandJob(job, REGEN_CHUNK_INSTANCES, REGEN_CHUNK_CELLS)) {
      finishBandJob(job);
      activeJob = null;
      if (job.band.key === 'near') enqueueFlowerJob(job.cx, job.cz, job.era);
    }
  }

  const nearBand = bands.find((b) => b.key === 'near');
  const midBand = bands.find((b) => b.key === 'mid');

  function update(focus, era, camPos) {
    // from high above blades are subpixel and dense rings read as a furry
    // disc gliding along under the camera — thin each band SMOOTHLY through
    // its altLo..altHi window instead of a binary 140m shed. main.js passes
    // camera.position as both focus and camPos, so judge by height above
    // the ground under the camera.
    const camAlt = camPos ? camPos.y - meshHeightAt(camPos.x, camPos.z) : 0;
    for (const band of bands) {
      if (band.altLo === undefined) continue;
      let k = 1 - smoothstepJ(band.altLo, band.altHi, camAlt);
      if (band.altFloor) k = band.altFloor + (1 - band.altFloor) * k;
      const off = k <= 0.02;
      const wasOff = band.altK <= 0.02;
      if (Math.abs(k - band.altK) > 0.14 || off !== wasOff) {
        band.altK = off ? 0 : k;
        band.on = !off;
        band.lastX = focus.x; band.lastZ = focus.z;
        if (off) {
          mesh0Off(band);
          if (band.key === 'near') enqueueFlowerJob(focus.x, focus.z, era);
        } else {
          enqueueBandJob(band, focus.x, focus.z, era);
          if (band.key === 'near') enqueueFlowerJob(focus.x, focus.z, era);
        }
      }
    }
    // the mid band carries r=0 coverage once the near ring has thinned away
    const wantR0 = nearBand.on ? midBand.r0 : 0;
    if ((midBand.r0Dyn !== undefined ? midBand.r0Dyn : midBand.r0) !== wantR0) {
      midBand.r0Dyn = wantR0;
      midBand.lastX = focus.x; midBand.lastZ = focus.z;
      enqueueBandJob(midBand, focus.x, focus.z, era);
    }
    let ranSync = false;
    bands.forEach((band) => {
      const dx = focus.x - band.lastX, dz = focus.z - band.lastZ;
      if (era !== band.lastEra) {
        band.lastX = focus.x; band.lastZ = focus.z; band.lastEra = era;
        if (band.hiOff && !band.on) mesh0Off(band);
        else regenerate(band, focus.x, focus.z, era);
        if (band.key === 'near') regenFlowers(focus.x, focus.z, era, band.altK);
        ranSync = true;
      } else if (dx * dx + dz * dz > band.thresh * band.thresh) {
        band.lastX = focus.x; band.lastZ = focus.z; band.lastEra = era;
        if (band.hiOff && !band.on) {
          mesh0Off(band);
          if (band.key === 'near') enqueueFlowerJob(focus.x, focus.z, era);
        } else {
          enqueueBandJob(band, focus.x, focus.z, era);
        }
      }
    });
    if (!ranSync) processQueue();
  }
  function mesh0Off(band) {
    cancelBandJob(band);
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
  // `bands` is exposed for data/dbg.mjs grassstate: a camera-follow ring that
  // silently fails to re-centre is invisible in a screenshot but obvious here.
  return { update, setBudget, meshes: bands.map((b) => b.mesh), bands, debugQueue: () => queue.length };
}
