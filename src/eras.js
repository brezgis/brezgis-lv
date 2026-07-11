// The six moments in time, staged on the same ground:
//   0  ~10,800 BC — Younger Dryas tundra: reindeer, dead ice, no one yet
//   1  ~AD 50     — wilderness: aurochs on the terrace, a hunters' camp
//   2  ~AD 950    — a Latgalian farmstead (built on the Āraiši evidence)
//   3  1860       — the Brezgi viensēta under Nēķens (Nötkenshof) manor
//   4  1935       — Taurene, independent Latvia: the manor is the parish's own
//   5  2025       — today: satellite-real land cover, the tower on Brežģa kalns
import * as THREE from 'three';
import {
  logCabin, postGranary, rija, wellSweep, rikuFence, wattleFence, manorHouse,
  manorNew, manorOutbuilding, watermill, brewery, bridge, campfire, haystack,
  woodpile, choppingBlock, dugoutCanoe, rowboat, cart, beehiveLog, laundryLine,
  poemStone, storkNestPole, churchSilhouette, barrowStones, palisadeRing, pyre,
  krogs, observationTower, modernHouse, car, erratics, deadIce, placeOnGround,
} from './buildings.js';
import { MAT } from './textures.js';
import { heightAt, meshHeightAt } from './terrain.js';
import { LOC, BUMPS, BRIDGE, BRIDGE2, riverXAt, riverLevelAt, farmSiteKept, ERA2_FARMS, distToRiver, distToStreams, distToRoadEx, nearStagePOI } from './landuse.js';
import { riverAt, streamAt, lakeAt, pondAt } from './riverzone.js';
import { registerFootprints } from './footprints.js';
import { LAKES, RIVER_PTS } from './geodata.js';
import { BUILDINGS_OSM, DWELLINGS_OSM, ROADS_OSM } from './geodata-osm.js';
import { mulberry32, pointInPoly, chaikinPoly } from './util.js';
import { HM_OFF_X, HM_OFF_Z, HM_SPAN } from './heightmap.js';

const S = LOC.STEAD, C = LOC.CAMP, Mn = LOC.MANOR, P = LOC.POND, B = LOC.BREZGA, K = LOC.KROGS;

function leanTo() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 5), MAT.logOld);
    post.position.set(s * 1.6, 0.95, 0);
    g.add(post);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 5), MAT.logOld);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = 1.85;
  g.add(ridge);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.9), MAT.thatchOld);
  roof.position.set(0, 1.2, -1.15);
  roof.rotation.x = 1.0;
  g.add(roof);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function fishRack() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 4), MAT.logOld);
    post.position.set(s * 1.1, 0.85, 0);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), MAT.lightWood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.55;
  g.add(bar);
  for (let i = 0; i < 4; i++) {
    const fish = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 4), new THREE.MeshLambertMaterial({ color: 0x9aa3a8 }));
    fish.position.set(-0.8 + i * 0.55, 1.28, 0);
    g.add(fish);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function offeringPile() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (i % 3) * 0.05), MAT.stone);
    st.position.set(Math.cos(i * 2.2) * 0.4, 0.1 + (i > 3 ? 0.18 : 0), Math.sin(i * 2.2) * 0.4);
    g.add(st);
  }
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 12), new THREE.MeshLambertMaterial({ color: 0x7a8a3a }));
  wreath.rotation.x = Math.PI / 2;
  wreath.position.y = 0.32;
  g.add(wreath);
  return g;
}

function utilityPoles(group, modern) {
  // the line follows the REAL main road (poles offset onto the verge), the
  // way the 1935 chronicle photo shows it — the old blind sine route stood
  // poles in the Gauja, in the carriageway and at the manor door
  const stops = [];
  {
    let best = null, bestLen = 0;
    for (const r of ROADS_OSM) {
      if (r.c !== 0) continue;
      let L = 0;
      for (let k = 0; k < r.pts.length - 1; k++) L += Math.hypot(r.pts[k + 1][0] - r.pts[k][0], r.pts[k + 1][1] - r.pts[k][1]);
      if (L > bestLen) { bestLen = L; best = r; }
    }
    if (best) {
      const zMin = -760, zMax = modern ? 2450 : 950;
      let carry = 0;
      for (let k = 0; k < best.pts.length - 1 && stops.length < 118; k++) {
        const [ax, az] = best.pts[k], [bx, bz] = best.pts[k + 1];
        const segL = Math.hypot(bx - ax, bz - az) || 1;
        const dx = (bx - ax) / segL, dz = (bz - az) / segL;
        for (let s = carry; s < segL; s += 46) {
          const px = ax + dx * s - dz * 6.2, pz = az + dz * s + dx * 6.2; // verge side
          carry = s + 46 - segL;
          if (pz < zMin || pz > zMax) continue;
          if (distToRiver(px, pz) < 14 || distToStreams(px, pz) < 8) continue; // wire spans water
          stops.push([px, pz]);
        }
      }
    }
  }
  const geo = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 5);
  const cap = Math.max(stops.length, 1);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, cap);
  mesh.frustumCulled = false;
  const arm = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4);
  arm.rotateZ(Math.PI / 2);
  const arms = new THREE.InstancedMesh(arm, MAT.darkWood, cap);
  arms.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  const tops = [];
  for (const [x, zz] of stops) {
    const yBase = heightAt(x, zz);
    dummy.position.set(x, yBase + 3.2, zz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 2.9;
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);
    tops.push([x, yBase + 6.1, zz]);
    i++;
  }
  mesh.count = arms.count = i;
  mesh.castShadow = true;
  group.add(mesh, arms);
  // the wires: two catenaries between crossarm tips, sagging mid-span
  const wirePos = [];
  const STEPS = 9;
  for (let p = 0; p < tops.length - 1; p++) {
    const [ax, ay, az] = tops[p], [bx, by, bz] = tops[p + 1];
    const span = Math.hypot(bx - ax, bz - az);
    if (span > 220) continue;                        // line break, not a 200m drape
    const SAG = Math.min(3.4, 0.6 * (span / 46) * (span / 46)); // sag ∝ span²
    for (const off of [-0.45, 0.45]) {
      for (let s = 0; s < STEPS; s++) {
        const t0 = s / STEPS, t1 = (s + 1) / STEPS;
        const y0 = ay + (by - ay) * t0 - SAG * 4 * t0 * (1 - t0);
        const y1 = ay + (by - ay) * t1 - SAG * 4 * t1 * (1 - t1);
        wirePos.push(
          ax + (bx - ax) * t0 + off, y0, az + (bz - az) * t0,
          ax + (bx - ax) * t1 + off, y1, az + (bz - az) * t1);
      }
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
  const wires = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x15161a }));
  wires.frustumCulled = false;
  group.add(wires);
}

// ---------------------------------------------------------------------------
// The main roads as real draped ribbons: paint alone lands on 17m-spaced
// terrain vertices, so narrow lanes all but vanished. The P30 is paved
// today; the V-roads, lanes and tracks keep their gravel or dirt skin.
function roadRibbons(group, era) {
  if (era < 3) return;
  const mkMat = (color, offset) => new THREE.MeshLambertMaterial({
    color, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset,
  });
  const surf = {
    asphalt: { mat: mkMat(0x393c40, -2), positions: [], indices: [] },
    gravel: { mat: mkMat(0x8d7c5f, -1), positions: [], indices: [] },
    darkGravel: { mat: mkMat(0x7d6f56, -1), positions: [], indices: [] },
    dirt: {
      mat: new THREE.MeshLambertMaterial({
        color: 0xffffff, vertexColors: true,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
      positions: [], colors: [], indices: [],
    },
  };
  const bridgeMat = era === 5 ? new THREE.MeshLambertMaterial({ color: 0x9a9a94 }) : MAT.darkWood;
  const bridgeFixtures = [];
  const dashPos = [], dashIdx = [];   // painted centreline on today's P30
  const roadRows = (r) => {
    const pts = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 4.5));
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    pts.push(r.pts[r.pts.length - 1]);
    return pts;
  };
  const roadDists = (pts) => {
    const d = [0];
    for (let i = 1; i < pts.length; i++) d[i] = d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return d;
  };
  const addIndices = (indices, base, row, n, spans = null) => {
    const prev = base + (row - 1) * n;
    const use = spans || [...Array(n - 1).keys()];
    for (const j of use) {
      const a = prev + j;
      // wind CCW seen from +y or the whole ribbon back-face culls from above
      indices.push(a, a + n + 1, a + 1, a, a + n, a + n + 1);
    }
  };
  const tangentAt = (pts, i) => {
    const j = Math.min(i + 1, pts.length - 1);
    let dx = pts[j][0] - pts[Math.max(0, i - 1)][0];
    let dz = pts[j][1] - pts[Math.max(0, i - 1)][1];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };
  const crossingAt = (x, z) => {
    const rv = riverAt(x, z);
    const st = streamAt(x, z);
    let level = -Infinity;
    if (rv && rv.d < rv.hw + 7) level = Math.max(level, rv.level);
    if (st && st.d < st.hw + 4) level = Math.max(level, st.level);
    return level > -Infinity ? level : null;
  };
  const bridgeRuns = (pts, dists) => {
    const hits = pts.map(([x, z]) => crossingAt(x, z));
    const raw = [];
    for (let i = 0; i < hits.length; i++) {
      if (hits[i] === null) continue;
      const start = i;
      let water = hits[i];
      while (i + 1 < hits.length && hits[i + 1] !== null) water = Math.max(water, hits[++i]);
      raw.push({
        from: Math.max(0, start - 1),
        to: Math.min(pts.length - 1, i + 1),
        water,
      });
    }
    const merged = [];
    for (const run of raw) {
      const last = merged[merged.length - 1];
      if (last && run.from <= last.to + 1) {
        last.to = Math.max(last.to, run.to);
        last.water = Math.max(last.water, run.water);
      } else {
        merged.push({ ...run });
      }
    }
    for (const run of merged) {
      while (dists[run.to] - dists[run.from] < 8 && (run.from > 0 || run.to < pts.length - 1)) {
        if (run.from > 0) run.from--;
        if (dists[run.to] - dists[run.from] >= 8) break;
        if (run.to < pts.length - 1) run.to++;
      }
      const [x0, z0] = pts[run.from], [x1, z1] = pts[run.to];
      const minY = run.water + 1.9;
      run.y0 = Math.max(meshHeightAt(x0, z0) + 0.14, minY);
      run.y1 = Math.max(meshHeightAt(x1, z1) + 0.14, minY);
      run.len = Math.max(0.001, dists[run.to] - dists[run.from]);
    }
    return merged;
  };
  const bridgeAt = (runs, i) => runs.find((run) => i >= run.from && i <= run.to) || null;
  const bridgeYAt = (run, dists, i) => {
    const t = (dists[i] - dists[run.from]) / run.len;
    return run.y0 + (run.y1 - run.y0) * t;
  };
  const rowYAt = (pts, runs, dists, i) => {
    const run = bridgeAt(runs, i);
    if (run) return bridgeYAt(run, dists, i);
    const [x, z] = pts[i];
    return meshHeightAt(x, z) + 0.2;
  };
  const addBridgeFixtures = (runs, pts, dists, half) => {
    for (const run of runs) {
      const [x0, z0] = pts[run.from], [x1, z1] = pts[run.to];
      const len = Math.max(1, Math.hypot(x1 - x0, z1 - z0));
      const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const y0 = bridgeYAt(run, dists, run.from), y1 = bridgeYAt(run, dists, run.to);
      const yMid = (y0 + y1) / 2;
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.25), bridgeMat);
        rail.position.set(mx - dz * side * (half + 0.18), yMid + 0.18, mz + dx * side * (half + 0.18));
        rail.rotation.y = -Math.atan2(dz, dx);
        rail.castShadow = rail.receiveShadow = true;
        bridgeFixtures.push(rail);
      }
      for (const [x, z, y] of [[x0, z0, y0], [x1, z1, y1]]) {
        const ab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, half * 2 + 0.9), bridgeMat);
        ab.position.set(x, y - 0.52, z);
        ab.rotation.y = -Math.atan2(dz, dx);
        ab.castShadow = ab.receiveShadow = true;
        bridgeFixtures.push(ab);
      }
    }
  };
  const pushCamberedRow = (positions, x, z, dx, dz, half, deckY = null) => {
    if (deckY !== null) {
      positions.push(
        x - dz * half, deckY, z + dx * half,
        x, deckY, z,
        x + dz * half, deckY, z - dx * half);
      return;
    }
    positions.push(
      x - dz * half, meshHeightAt(x - dz * half, z + dx * half) - 0.42, z + dx * half,
      x, meshHeightAt(x, z) + 0.2, z,
      x + dz * half, meshHeightAt(x + dz * half, z - dx * half) - 0.42, z - dx * half);
  };
  const pushShoulderRow = (positions, x, z, dx, dz, half, deckY = null) => {
    const out = half + 0.9;
    for (const off of [-out, -half, 0, half, out]) {
      const crown = off === 0;
      const edge = Math.abs(off) >= half;
      const y = deckY !== null
        ? deckY
        : meshHeightAt(x + dz * off, z - dx * off) + (crown ? 0.2 : edge ? -0.42 : -0.1);
      positions.push(
        x + dz * off,
        y,
        z - dx * off);
    }
  };
  const pushDirtRow = (positions, colors, x, z, dx, dz, half, deckY = null) => {
    const rut = half * 0.45;
    const rows = [
      [-half, -0.42, [0.45, 0.42, 0.28]],
      [-rut, 0.06, [0.36, 0.30, 0.22]],
      [0, 0.2, [0.45, 0.42, 0.28]],
      [rut, 0.06, [0.36, 0.30, 0.22]],
      [half, -0.42, [0.45, 0.42, 0.28]],
    ];
    for (const [off, lift, rgb] of rows) {
      const y = deckY !== null ? deckY : meshHeightAt(x + dz * off, z - dx * off) + lift;
      positions.push(x + dz * off, y, z - dx * off);
      colors.push(...rgb);
    }
  };
  for (const r of ROADS_OSM) {
    if (era === 3 && r.c === 2) continue;
    const half = [3.6, 3.0, 2.3, 1.7][r.c] || 1.7;
    const pts = roadRows(r);
    if (pts.length < 2) continue;
    const dists = roadDists(pts);
    const runs = bridgeRuns(pts, dists);
    if (r.c <= 1) addBridgeFixtures(runs, pts, dists, half);
    if (r.c === 3) {
      const { positions, colors, indices } = surf.dirt;
      const base = positions.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const [dx, dz] = tangentAt(pts, i);
        const run = bridgeAt(runs, i);
        pushDirtRow(positions, colors, x, z, dx, dz, half, run ? bridgeYAt(run, dists, i) : null);
        if (i > 0) addIndices(indices, base, i, 5);
      }
      continue;
    }
    if (era === 5 && r.c === 0) {
      {
        const { positions, indices } = surf.gravel;
        const base = positions.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i];
          const [dx, dz] = tangentAt(pts, i);
          const run = bridgeAt(runs, i);
          pushShoulderRow(positions, x, z, dx, dz, half, run ? bridgeYAt(run, dists, i) : null);
          if (i > 0) addIndices(indices, base, i, 5);
        }
      }
      {
        const { positions, indices } = surf.asphalt;
        const base = positions.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i];
          const [dx, dz] = tangentAt(pts, i);
          const run = bridgeAt(runs, i);
          pushCamberedRow(positions, x, z, dx, dz, half, run ? bridgeYAt(run, dists, i) : null);
          if (i > 0) {
            addIndices(indices, base, i, 3);
            // dashed centreline on the paved P30: ~3.4m of paint per 18m cycle
            // (the full-span 9m dashes read like runway markings from the air)
            if (i % 2 === 0) {
              const b2 = dashPos.length / 3;
              const px = pts[i - 1][0], pz = pts[i - 1][1];
              const sx = px + (x - px) * 0.31, sz = pz + (z - pz) * 0.31;
              const ex = px + (x - px) * 0.69, ez = pz + (z - pz) * 0.69;
              const yPrev = rowYAt(pts, runs, dists, i - 1), yNow = rowYAt(pts, runs, dists, i);
              const sy = yPrev + (yNow - yPrev) * 0.31 + 0.03;
              const ey = yPrev + (yNow - yPrev) * 0.69 + 0.03;
              dashPos.push(
                sx - dz * 0.09, sy, sz + dx * 0.09, sx + dz * 0.09, sy, sz - dx * 0.09,
                ex + dz * 0.09, ey, ez - dx * 0.09, ex - dz * 0.09, ey, ez + dx * 0.09);
              dashIdx.push(b2, b2 + 2, b2 + 1, b2, b2 + 3, b2 + 2);
            }
          }
        }
      }
      continue;
    }
    const s = r.c === 2 ? surf.darkGravel : surf.gravel;
    const { positions, indices } = s;
    const base = positions.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [dx, dz] = tangentAt(pts, i);
      const run = bridgeAt(runs, i);
      pushCamberedRow(positions, x, z, dx, dz, half, run ? bridgeYAt(run, dists, i) : null);
      if (i > 0) addIndices(indices, base, i, 3);
    }
  }
  for (const fixture of bridgeFixtures) group.add(fixture);
  if (dashPos.length) {
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dashPos, 3));
    dg.setIndex(dashIdx);
    dg.computeVertexNormals();
    const dashes = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({
      color: 0xc9cdd1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    dashes.receiveShadow = true;
    group.add(dashes);
  }
  for (const key of ['asphalt', 'gravel', 'darkGravel', 'dirt']) {
    const { mat, positions, colors, indices } = surf[key];
    if (!positions.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// Background settlement — the real pattern, not one lonely diorama:
//   2025: every OSM building footprint (496 of them, © OSM contributors)
//   1935: the OSM viensēta sites — Latvian farm names persist for centuries,
//         and the parish then held ~1,300 people on these same farms
//   1860: ~60% of the sites (the 1920 agrarian reform later carved 72 new
//         farms out of Nēķene manor land alone)
let bgGeos = null;
function bgAssets() {
  if (bgGeos) return bgGeos;
  const wall = new THREE.BoxGeometry(1, 1, 1);
  wall.translate(0, 0.5, 0);
  const wallCols = [];
  const wp = wall.getAttribute('position');
  for (let i = 0; i < wp.count; i++) {
    const shade = wp.getY(i) < 0.001 ? 0.62 : 1.0;
    wallCols.push(shade, shade, shade);
  }
  wall.setAttribute('color', new THREE.Float32BufferAttribute(wallCols, 3));
  // unit gable roof: 1×1 base, ridge along x at y=1
  const A = [-0.5, 0, -0.5], Bc = [0.5, 0, -0.5], Cc = [0.5, 0, 0.5], D = [-0.5, 0, 0.5];
  const R1 = [-0.5, 1, 0], R2 = [0.5, 1, 0];
  const tris = [
    A, R2, Bc, A, R1, R2,      // slope z<0
    Cc, R1, D, Cc, R2, R1,     // slope z>0
    A, D, R1,                  // west gable
    Bc, R2, Cc,                // east gable
  ];
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  roof.computeVertexNormals();
  bgGeos = { wall, roof };
  return bgGeos;
}

let grazerGeos = null;
function grazerAssets() {
  if (grazerGeos) return grazerGeos;
  const part = (geo, x, y, z, rz = 0) => {
    const g = geo.clone();
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    g.applyMatrix4(m);
    return g;
  };
  const box = (w, h, d, x, y, z, rz = 0) => part(new THREE.BoxGeometry(w, h, d), x, y, z, rz);
  const merge = (parts) => {
    const pos = [];
    for (const src of parts) {
      const g = src.toNonIndexed();
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  };
  const legs = (h, spreadX, spreadZ, w = 0.1) => [
    box(w, h, w, -spreadX, h / 2, -spreadZ),
    box(w, h, w, spreadX, h / 2, -spreadZ),
    box(w, h, w, -spreadX, h / 2, spreadZ),
    box(w, h, w, spreadX, h / 2, spreadZ),
  ];
  grazerGeos = {
    cow: merge([
      box(1.35, 0.54, 0.5, 0, 0.78, 0),
      ...legs(0.62, 0.43, 0.18, 0.11),
      box(0.36, 0.16, 0.18, 0.72, 0.57, 0, -0.62),
      box(0.32, 0.24, 0.24, 0.96, 0.39, 0, -0.18),
      box(0.08, 0.16, 0.04, 1.03, 0.52, -0.1, -0.55),
      box(0.08, 0.16, 0.04, 1.03, 0.52, 0.1, -0.55),
    ]),
    sheep: merge([
      box(0.92, 0.42, 0.42, 0, 0.56, 0),
      ...legs(0.42, 0.3, 0.15, 0.07),
      box(0.24, 0.13, 0.14, 0.5, 0.44, 0, -0.55),
      box(0.22, 0.18, 0.18, 0.68, 0.29, 0, -0.16),
      box(0.06, 0.1, 0.035, 0.74, 0.39, -0.08, -0.45),
      box(0.06, 0.1, 0.035, 0.74, 0.39, 0.08, -0.45),
    ]),
    horse: merge([
      box(1.55, 0.5, 0.42, 0, 0.94, 0),
      ...legs(0.86, 0.5, 0.15, 0.08),
      box(0.46, 0.16, 0.18, 0.8, 0.78, 0, -0.72),
      box(0.34, 0.22, 0.2, 1.08, 0.52, 0, -0.2),
      box(0.06, 0.18, 0.035, 1.15, 0.66, -0.08, -0.38),
      box(0.06, 0.18, 0.035, 1.15, 0.66, 0.08, -0.38),
    ]),
  };
  return grazerGeos;
}

function bgSettlement(group, era, smokes) {
  const rng = mulberry32(4300 + era * 17);
  const props = { hay: [], wood: [], vinda: [], fence: [], boxWell: [], garden: [], tuft: [], cow: [], sheep: [], horse: [] };
  const { wall, roof } = bgAssets();
  const skip = (x, z) => nearStagePOI(x, z);
  const cornersOf = (it, pad = 0) => {
    const ca = Math.cos(it.rot), sa = Math.sin(it.rot);
    const hw = it.w / 2 + pad, hd = it.d / 2 + pad;
    return [[hw, hd], [hw, -hd], [-hw, hd], [-hw, -hd]]
      .map(([ox, oz]) => [it.x + ox * ca - oz * sa, it.z + ox * sa + oz * ca]);
  };
  const waterBlockedAt = (x, z) => {
    const rv = riverAt(x, z);
    if (rv && rv.d < rv.hw + 1.5) return true;
    const st = streamAt(x, z);
    if (st && st.d < st.hw + 1) return true;
    const lk = lakeAt(x, z);
    if (lk && heightAt(x, z) < lk.level + 0.5) return true;
    if ((era === 3 || era === 4) && pondAt(x, z)) return true;
    return false;
  };
  const waterBlocked = (it) => cornersOf(it).some(([x, z]) => waterBlockedAt(x, z));
  const roadBlocked = (it) => cornersOf(it).some(([x, z]) => distToRoadEx(era, x, z).d < 4);
  const itemBlocked = (it) => waterBlocked(it) || roadBlocked(it);
  const footprintRoadHit = (it, limit = 1.2) => cornersOf(it).some(([x, z]) => distToRoadEx(era, x, z).d < limit);
  const placementBlocked = (it) => cornersOf(it).some(([x, z]) => {
    if (distToRoadEx(era, x, z).d < 1) return true;
    return waterBlockedAt(x, z);
  });
  const nudgeBy = (it, blocked) => {
    if (!blocked(it)) return { it, nudged: false };
    for (const a of [0, 1.57, 3.14, 4.71, 0.79, 2.36, 3.93, 5.5]) {
      const moved = { ...it, x: it.x + Math.cos(a) * 16, z: it.z + Math.sin(a) * 16 };
      if (!blocked(moved)) return { it: moved, nudged: true };
    }
    return null;
  };
  const nudgeDwelling = (it) => nudgeBy(it, itemBlocked);
  const nudgeFootprint = (it) => nudgeBy(it, (moved) => itemBlocked(moved) || footprintRoadHit(moved));
  const insideSiteItem = (px, pz, siteItems) => siteItems.some((it) => {
    const ca = Math.cos(it.rot), sa = Math.sin(it.rot);
    const dx = px - it.x, dz = pz - it.z;
    const lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca;
    return Math.abs(lx) <= it.w / 2 + 0.6 && Math.abs(lz) <= it.d / 2 + 0.6;
  });
  const fencePoleOK = (px, pz, siteItems) => {
    if (insideSiteItem(px, pz, siteItems)) return false;
    if (distToRoadEx(era, px, pz).d < 1.2) return false;
    if (waterBlockedAt(px, pz)) return false;
    return true;
  };
  const localPoint = (x, z, rot, ox, oz) => {
    const ca = Math.cos(rot), sa = Math.sin(rot);
    return [x + ox * ca - oz * sa, z + ox * sa + oz * ca];
  };
  const addFenceRect = (x, z, w, d, rot, siteItems) => {
    const pts = [
      localPoint(x, z, rot, -w / 2, -d / 2),
      localPoint(x, z, rot, w / 2, -d / 2),
      localPoint(x, z, rot, w / 2, d / 2),
      localPoint(x, z, rot, -w / 2, d / 2),
      localPoint(x, z, rot, -w / 2, -d / 2),
    ];
    const poles = [];
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      const dir = Math.atan2(dx, dz);
      for (let fp = 0; fp < len; fp += 0.9) {
        const px = ax + dx * fp, pz = az + dz * fp;
        if (!fencePoleOK(px, pz, siteItems)) return false;
        poles.push([px, pz, dir + 0.9 + (poles.length % 2) * 1.3]);
      }
    }
    props.fence.push(...poles);
    return true;
  };
  const items = [];
  if (era === 5) {
    let osmWaterSkipped = 0;
    for (const [x, z, w, d, rot] of BUILDINGS_OSM) {
      if (skip(x, z)) continue;
      const it = { x, z, w, d, rot, big: w * d > 220, kind: 'new' };
      if (waterBlocked(it)) { osmWaterSkipped++; continue; }
      items.push(it);
    }
    console.info(`bgSettlement: skipped ${osmWaterSkipped} OSM building footprints in water`);
  } else {
    DWELLINGS_OSM.forEach(([x, z, name], si) => {
      // Brežģu Pienotava — the family dairy co-op point: a white plastered
      // creamery by the krogs road in 1935; no such site before the co-op era
      if (/pienotava/i.test(name || '')) {
        if (era === 4) {
          const dairy = { x, z, w: 11, d: 7, rot: 0.98, kind: 'dairy', white: true };
          const nudgedDairy = nudgeFootprint(dairy);
          if (nudgedDairy) items.push(nudgedDairy.it);
        }
        return;
      }
      if (skip(x, z) || !farmSiteKept(si, era)) return;
      const sr = mulberry32(si * 613 + era * 37);
      const rot = sr() * Math.PI;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      // OSM place nodes are approximate: nudge any farmhouse footprint out of
      // carriageways and water before the whole site is dropped.
      const nudged = nudgeDwelling({ x, z, w: 8 + sr() * 5, d: 5.5 + sr() * 2, rot, kind: 'dwell', site: si });
      if (!nudged) return;
      const hardClear = nudgeFootprint(nudged.it);
      if (!hardClear) return;
      const dwelling = hardClear.it;
      ({ x, z } = dwelling);
      const siteItems = [dwelling];
      items.push(dwelling);
      const yd = 15 + sr() * 8;
      const barn = {
        x: x + ca * yd, z: z + sa * yd,
        w: 10 + sr() * 7, d: 6 + sr() * 3,
        rot: rot + (sr() - 0.5) * 0.5, kind: 'barn',
      };
      if (!itemBlocked(barn)) { items.push(barn); siteItems.push(barn); }
      if (sr() < 0.65) {
        const yd2 = 12 + sr() * 6;
        const klets = {
          x: x - sa * yd2, z: z + ca * yd2,
          w: 5 + sr() * 2, d: 4 + sr(), rot: rot + 1.57, kind: 'klets',
        };
        if (!itemBlocked(klets)) { items.push(klets); siteItems.push(klets); }
      }
      // signs of life in the yard (period props, instanced below)
      if (era < 5) {
        let hadVinda = false;
        const py = 9 + sr() * 5;
        props.hay.push([x + sa * py, z - ca * py, sr() * 6.3, 0.8 + sr() * 0.5]);
        if (sr() < 0.6) props.hay.push([x + sa * (py + 5), z - ca * (py + 4), sr() * 6.3, 0.7 + sr() * 0.4]);
        if (sr() < 0.75) props.wood.push([x + ca * 6 - sa * 4, z + sa * 6 + ca * 4, rot + 1.57, 0.8 + sr() * 0.4]);
        if (sr() < (era === 3 ? 0.8 : 0.55)) {
          props.vinda.push([x - ca * 8, z - sa * 8, sr() * 6.3]);
          hadVinda = true;
        }
        // a run of riķu fence closing the yard
        if (sr() < 0.8) {
          const fl = 16 + sr() * 14, fx = x - ca * 12, fz = z - sa * 12;
          for (let fp = 0; fp < fl; fp += 0.9) {
            const px = fx + sa * (fp - fl / 2), pz = fz - ca * (fp - fl / 2);
            if (fencePoleOK(px, pz, siteItems)) props.fence.push([px, pz, rot + 0.9 + (fp % 2) * 1.3]);
          }
        }
        // appended draws only: the old farm layout stream above stays stable.
        if (era === 4 && !hadVinda && sr() < 0.5) {
          const well = { x: x - ca * 8, z: z - sa * 8, w: 1.4, d: 1.4, rot };
          if (!placementBlocked(well) && !insideSiteItem(well.x, well.z, siteItems)) props.boxWell.push([well.x, well.z, rot]);
        }
        if ((era === 3 || era === 4) && sr() < 0.45) {
          const pw = 14 + sr() * 8, pd = 14 + sr() * 8;
          const side = sr() < 0.5 ? -1 : 1;
          const sideOff = side * (2 + sr() * 4);
          const dist = dwelling.w / 2 + 8 + pw / 2;
          const paddock = {
            x: x - ca * dist + sa * sideOff,
            z: z - sa * dist - ca * sideOff,
            w: pw, d: pd, rot,
          };
          if (!placementBlocked(paddock) && addFenceRect(paddock.x, paddock.z, paddock.w, paddock.d, paddock.rot, siteItems)) {
            const pick = sr();
            const kind = pick < 0.45 ? 'cow' : pick < 0.82 ? 'sheep' : 'horse';
            const count = kind === 'sheep' ? 2 + ((sr() * 2) | 0) : kind === 'cow' ? 1 + (sr() < 0.35 ? 1 : 0) : 1;
            for (let li = 0; li < count; li++) {
              const lx = (sr() - 0.5) * (pw - 4), lz = (sr() - 0.5) * (pd - 4);
              const [px, pz] = localPoint(paddock.x, paddock.z, paddock.rot, lx, lz);
              props[kind].push([px, pz, sr() * 6.3, 0.85 + sr() * 0.25]);
            }
          }
        }
        if ((era === 3 || era === 4) && sr() < 0.5) {
          const garden = {
            x: x - ca * (dwelling.w / 2 + 4.4),
            z: z - sa * (dwelling.w / 2 + 4.4),
            w: 4, d: 7, rot,
          };
          if (!placementBlocked(garden) && !insideSiteItem(garden.x, garden.z, siteItems)) {
            props.garden.push([garden.x, garden.z, garden.rot]);
            const rows = 3 + ((sr() * 3) | 0);
            for (let gr = 0; gr < rows; gr++) {
              const ox = -garden.w / 2 + ((gr + 1) * garden.w) / (rows + 1);
              for (let lz = -garden.d / 2 + 0.55; lz < garden.d / 2 - 0.3; lz += 0.85) {
                const [tx, tz] = localPoint(garden.x, garden.z, garden.rot, ox + (sr() - 0.5) * 0.14, lz + (sr() - 0.5) * 0.18);
                props.tuft.push([tx, tz, sr() * 6.3, 0.7 + sr() * 0.45]);
              }
            }
          }
        }
      }
    });
  }
  // the planters ask "is there a building here?" — hand them the final,
  // validated footprints (plus the stage rects footprints.js lists itself)
  registerFootprints(era, items);
  const walls = new THREE.InstancedMesh(wall, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), items.length);
  const roofs = new THREE.InstancedMesh(roof, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), items.length);
  walls.castShadow = roofs.castShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    // seat on the LOWEST footprint corner and stretch the walls up to the
    // highest — a single centre sample floated corners 2m+ on slopes
    let minH = Infinity, maxH = -Infinity;
    for (const [cx, cz] of cornersOf(it)) {
      const hh = heightAt(cx, cz);
      if (hh < minH) minH = hh;
      if (hh > maxH) maxH = hh;
    }
    const y = minH - 0.1;
    const plinth = Math.min(1.4, maxH - minH);
    const wallH = (it.big ? 4.6 + rng() * 1.4 : Math.min(3.4, Math.max(2.3, Math.min(it.w, it.d) * 0.5))) + plinth;
    const roofH = Math.min(it.w, it.d) * (era === 3 ? 0.52 : 0.42);
    dummy.position.set(it.x, y, it.z);
    dummy.rotation.set(0, -it.rot, 0);
    dummy.scale.set(it.w, wallH, it.d);
    dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
    // walls: aged log browns before the war, mixed render/wood today
    if (era === 5) {
      const pick = rng();
      if (pick < 0.22) col.setRGB(0.66, 0.55, 0.36);        // ochre plaster
      else if (pick < 0.4) col.setRGB(0.55, 0.53, 0.49);    // silicate brick
      else if (pick < 0.54) col.setRGB(0.45, 0.28, 0.20);   // red brick
      else if (pick < 0.7) col.setRGB(0.32, 0.38, 0.27);    // painted wood
      else if (pick < 0.88) col.setRGB(0.42, 0.35, 0.26);   // weathered timber
      else col.setRGB(0.28, 0.24, 0.20);                    // tarred wood
      // darker than the palette midpoint: mid-grey steel tone-maps to white
      // under the noon sun and reads as the old untextured box
      if (it.big) col.setRGB(0.36, 0.41, 0.39);             // steel-clad barn
    } else if (it.white) {
      col.setRGB(0.88, 0.85, 0.78);                         // plastered creamery
    } else {
      col.setRGB(0.42 + (rng() - 0.5) * 0.1, 0.34 + (rng() - 0.5) * 0.1, 0.24 + (rng() - 0.5) * 0.1);
    }
    walls.setColorAt(i, col);
    // roof: ridge along the longer footprint axis
    const along = it.w >= it.d;
    dummy.position.set(it.x, y + wallH - 0.05, it.z);
    dummy.rotation.set(0, along ? -it.rot : -it.rot - Math.PI / 2, 0);
    dummy.scale.set((along ? it.w : it.d) + 0.7, roofH, (along ? it.d : it.w) + 0.8);
    dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);
    if (era === 5) {
      const pick = rng();
      if (it.big) col.setRGB(0.45, 0.47, 0.5);
      else if (pick < 0.5) col.setRGB(0.48, 0.2, 0.14);     // red metal/tile
      else if (pick < 0.7) col.setRGB(0.36, 0.38, 0.4);     // grey metal
      else col.setRGB(0.3, 0.28, 0.26);                     // dark bitumen
    } else if (era === 4) {
      const pick = rng();
      if (pick < 0.55) col.setRGB(0.42, 0.36, 0.28);        // shingle
      else if (pick < 0.75) col.setRGB(0.5, 0.24, 0.16);    // tile
      else col.setRGB(0.5, 0.42, 0.26);                     // surviving thatch
    } else {
      col.setRGB(0.5 + rng() * 0.08, 0.42 + rng() * 0.06, 0.25);  // thatch
    }
    roofs.setColorAt(i, col);
  });
  walls.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = true;
  group.add(walls, roofs);

  // --- yard props, all instanced: haystacks, woodpiles, wells, fences ------
  if (era < 5 && props.hay.length + props.wood.length + props.vinda.length + props.fence.length +
      props.boxWell.length + props.garden.length + props.tuft.length + props.cow.length + props.sheep.length + props.horse.length > 0) {
    const put = (mesh, arr, fill) => {
      if (!arr.length) return;
      arr.forEach((p, i) => { fill(p, i); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.count = arr.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      group.add(mesh);
    };
    if (props.hay.length) {
      const hayCone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.4, 9), MAT.hay, props.hay.length);
      put(hayCone, props.hay, ([x, z, r, sc]) => {
        dummy.position.set(x, heightAt(x, z) + 1.2 * sc - 0.05, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    }
    if (props.wood.length) {
      const woodGeo = new THREE.BoxGeometry(2.1, 1.05, 1.0);
      const wood = new THREE.InstancedMesh(woodGeo, MAT.logOld, props.wood.length);
      put(wood, props.wood, ([x, z, r, sc]) => {
        dummy.position.set(x, heightAt(x, z) + 0.5 * sc, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    }
    if (props.vinda.length) {
      // vinda: post + counterweighted sweep beam + hanging rod, baked into
      // one transform frame
      const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 6), MAT.logOld, props.vinda.length);
      const beamGeo = new THREE.CylinderGeometry(0.05, 0.07, 4.8, 5);
      beamGeo.rotateZ(1.05);
      beamGeo.translate(0.9, 3.1, 0);
      const beam = new THREE.InstancedMesh(beamGeo, MAT.lightWood, props.vinda.length);
      const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4);
      rodGeo.translate(2.9, 2.2, 0);
      const rod = new THREE.InstancedMesh(rodGeo, MAT.lightWood, props.vinda.length);
      props.vinda.forEach(([x, z, r], i) => {
        dummy.position.set(x, heightAt(x, z) + 1.55, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        post.setMatrixAt(i, dummy.matrix);
        dummy.position.y -= 1.55;
        dummy.updateMatrix();
        beam.setMatrixAt(i, dummy.matrix);
        rod.setMatrixAt(i, dummy.matrix);
      });
      for (const m of [post, beam, rod]) {
        m.count = props.vinda.length;
        m.instanceMatrix.needsUpdate = true;
        m.castShadow = true;
        group.add(m);
      }
    }
    if (props.boxWell.length) {
      const shaft = new THREE.InstancedMesh(wall, MAT.plank, props.boxWell.length);
      const wellRoof = new THREE.InstancedMesh(roof, MAT.darkWood, props.boxWell.length);
      props.boxWell.forEach(([x, z, r], i) => {
        const y = heightAt(x, z);
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, -r, 0);
        dummy.scale.set(1, 0.82, 1);
        dummy.updateMatrix();
        shaft.setMatrixAt(i, dummy.matrix);
        dummy.position.y = y + 0.82;
        dummy.scale.set(1.35, 0.45, 1.15);
        dummy.updateMatrix();
        wellRoof.setMatrixAt(i, dummy.matrix);
      });
      for (const m of [shaft, wellRoof]) {
        m.count = props.boxWell.length;
        m.instanceMatrix.needsUpdate = true;
        m.castShadow = true;
        group.add(m);
      }
    }
    if (props.garden.length) {
      const gardenGeo = new THREE.PlaneGeometry(4, 7);
      gardenGeo.rotateX(-Math.PI / 2);
      const gardenMat = new THREE.MeshLambertMaterial({
        color: 0x4d3d2b, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      const gardens = new THREE.InstancedMesh(gardenGeo, gardenMat, props.garden.length);
      put(gardens, props.garden, ([x, z, r]) => {
        dummy.position.set(x, heightAt(x, z) + 0.04, z);
        dummy.rotation.set(0, -r, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
      });
      gardens.receiveShadow = true;
    }
    if (props.tuft.length) {
      const tuftGeo = new THREE.ConeGeometry(0.08, 0.22, 5);
      const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0x3f6f2d }), props.tuft.length);
      put(tufts, props.tuft, ([x, z, r, sc]) => {
        dummy.position.set(x, heightAt(x, z) + 0.11 * sc, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    }
    if (props.fence.length) {
      // slanted riķu-fence poles
      const fenceGeo = new THREE.CylinderGeometry(0.035, 0.05, 2.1, 4);
      fenceGeo.rotateZ(0.42);
      const fence = new THREE.InstancedMesh(fenceGeo, MAT.logOld, props.fence.length);
      props.fence.forEach(([x, z, r], i) => {
        dummy.position.set(x, heightAt(x, z) + 0.8, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        fence.setMatrixAt(i, dummy.matrix);
      });
      fence.count = props.fence.length;
      fence.instanceMatrix.needsUpdate = true;
      group.add(fence);
    }
    const geos = grazerAssets();
    const grazerMat = {
      cow: new THREE.MeshLambertMaterial({ color: new THREE.Color(0.42, 0.24, 0.16) }),
      sheep: new THREE.MeshLambertMaterial({ color: new THREE.Color(0.78, 0.75, 0.68) }),
      horse: new THREE.MeshLambertMaterial({ color: new THREE.Color(0.18, 0.08, 0.045) }),
    };
    const putGrazer = (kind) => {
      if (!props[kind].length) return;
      const mesh = new THREE.InstancedMesh(geos[kind], grazerMat[kind], props[kind].length);
      put(mesh, props[kind], ([x, z, r, sc]) => {
        dummy.position.set(x, heightAt(x, z), z);
        dummy.rotation.set(0, -r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    };
    putGrazer('cow');
    putGrazer('sheep');
    putGrazer('horse');
  }
  // hearth smoke at the farms nearest the stage — the horizon breathes
  if (smokes && era < 5) {
    const dwells = items.filter((it) => it.kind === 'dwell')
      .map((it) => ({ ...it, d: Math.hypot(it.x - S.x, it.z - S.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
    for (const it of dwells) {
      smokes.push([it.x, heightAt(it.x, it.z) + 4.2, it.z, { rate: 0.3, gray: 0.86 }]);
    }
  }
}

// ---------------------------------------------------------------------------
// Wild fauna, era-appropriate. Water anchors come from the real geometry:
// the biggest lake (Taurenes ezers) and quiet reaches of the Gauja.
const LAKE_MAIN = (() => {
  // the chronicle lake: whichever polygon lies at the LAKE_VIEW overlook
  // ("biggest lake" grabbed a bog pool on the far map edge)
  let best = null, bestD = 1e18;
  for (const lake of LAKES) {
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const [x, z] of lake.poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const d = Math.hypot(cx - LOC.LAKE_VIEW.x, cz - LOC.LAKE_VIEW.z);
    if (d < bestD) {
      bestD = d;
      best = { cx, cz, level: lake.level, shore: chaikinPoly(lake.poly) };
    }
  }
  return best;
})();
const inMainLake = (x, z) => pointInPoly(x, z, LAKE_MAIN.shore);
const inRiver = (x, z) => { const rv = riverAt(x, z); return !!rv && rv.d < rv.hw; };
const RIVER_REACH = (t) => {
  const i = Math.min(RIVER_PTS.length - 1, Math.round(RIVER_PTS.length * t));
  const p = RIVER_PTS[i];
  return { x: p[0], z: p[1], r: 30, level: p[2] };
};
const HOP_HARE = { hop: true, hopLen: 1.7, hopH: 0.3, hopDur: 0.32, restT: [3, 8], chainT: 0.05 };
const HOP_FROG = { hop: true, hopLen: 0.32, hopH: 0.14, hopDur: 0.3, restT: [4, 9], chainT: 0.5 };

function wildSpawns(era, spawns) {
  const S2 = LOC.STEAD;
  const lakeHome = { x: LAKE_MAIN.cx, z: LAKE_MAIN.cz, r: 120 };
  const rUp = RIVER_REACH(0.28), rMid = RIVER_REACH(0.5), rDown = RIVER_REACH(0.66);
  const meadow = { x: S2.x - 60, z: S2.z + 80, r: 90 };
  const wideMeadow = { x: S2.x + 150, z: S2.z + 500, r: 160 };
  const forestN = { x: S2.x + 150, z: S2.z - 800, r: 140 };
  const forestS = { x: S2.x + 300, z: S2.z + 1100, r: 160 };

  if (era === 0) {
    // Younger Dryas tundra: reindeer spawn with the era — these are the
    // small companions of the ice edge
    spawns.push(['arcticHare', 3, { x: S2.x - 200, z: S2.z + 250, r: 120 }, { ...HOP_HARE, hopLen: 1.5 }]);
    spawns.push(['arcticFox', 1, { x: S2.x + 100, z: S2.z - 300, r: 160 }, { speed: 1.1, grazeBias: 0.45 }]);
    spawns.push(['ptarmigan', 6, { x: S2.x - 320, z: S2.z + 60, r: 60 }]);
    spawns.push(['swanWhooper', 2, lakeHome, { medium: 'water', level: LAKE_MAIN.level + 0.04, inWater: inMainLake, speed: 0.4 }]);
    return;
  }
  // the river never emptied: fish, ducks, swans, frogs, dragonflies always
  spawns.push(['fishPerch', 7, rMid, { medium: 'water', level: rMid.level - 0.28, inWater: inRiver, speed: 0.7 }]);
  spawns.push(['fishPerch', 5, rUp, { medium: 'water', level: rUp.level - 0.28, inWater: inRiver, speed: 0.7 }]);
  spawns.push(['fishPike', 2, rDown, { medium: 'water', level: rDown.level - 0.32, inWater: inRiver, speed: 0.5 }]);
  spawns.push(['duckM', 3, rUp, { medium: 'water', level: rUp.level + 0.03, inWater: inRiver, speed: 0.5 }]);
  spawns.push(['duckF', 3, rUp, { medium: 'water', level: rUp.level + 0.03, inWater: inRiver, speed: 0.5 }]);
  // swans: whoopers bred here before drainage; extirpated by the 1800s;
  // mute swans only colonised Latvia in the 20th century (Engure 1935)
  if (era <= 2) spawns.push(['swanWhooper', 2, lakeHome, { medium: 'water', level: LAKE_MAIN.level + 0.04, inWater: inMainLake, speed: 0.4 }]);
  if (era >= 5) spawns.push(['swanMute', 3, lakeHome, { medium: 'water', level: LAKE_MAIN.level + 0.04, inWater: inMainLake, speed: 0.4 }]);
  spawns.push(['duckM', 3, lakeHome, { medium: 'water', level: LAKE_MAIN.level + 0.03, inWater: inMainLake, speed: 0.5 }]);
  spawns.push(['frog', 5, { x: rUp.x + 14, z: rUp.z, r: 10 }, HOP_FROG]);
  spawns.push(['dragonfly', 6, { x: rMid.x, z: rMid.z, r: 26 }, { medium: 'air', fly: 'hawk', alt: [0.6, 2.4] }]);
  spawns.push(['butterflyW', 6, meadow, { medium: 'air', fly: 'flutter' }]);
  spawns.push(['butterflyO', 4, wideMeadow, { medium: 'air', fly: 'flutter' }]);
  spawns.push(['butterflyY', 4, meadow, { medium: 'air', fly: 'flutter' }]);
  // a soaring pair — with the old main.js triangle birds gone, the buzzards
  // ARE the sky (and a pair circling a thermal is the true Vidzeme default)
  spawns.push(['buzzard', 2, { x: S2.x + 400, z: S2.z + 300, r: 1 }, { medium: 'air', fly: 'soar', alt: [70, 130] }]);
  spawns.push(['buzzard', 1, { x: S2.x - 300, z: S2.z - 250, r: 1 }, { medium: 'air', fly: 'soar', alt: [60, 110] }]);
  // bumblebees work the flower layer wherever there are flowers
  if (era >= 1) {
    spawns.push(['bee', 7, meadow, { medium: 'air', fly: 'flutter', low: true }]);
    spawns.push(['bee', 4, wideMeadow, { medium: 'air', fly: 'flutter', low: true }]);
  }
  // baltā cielava — the national bird flits between yard fence posts,
  // wags on top, drops to the grass to forage (inhabited eras)
  if (era >= 2) {
    const mkPerches = (cx, cz) => {
      const pts = [];
      for (let i = 0; i < 9; i++) {
        const pa = (i / 9) * Math.PI * 2 + 0.4;
        const pr = 9 + (i % 3) * 4.5;
        const px = cx + Math.cos(pa) * pr, pz = cz + Math.sin(pa) * pr;
        pts.push([px, heightAt(px, pz) + 0.95 + (i % 2) * 0.35, pz]);
      }
      pts.push([cx + 4, heightAt(cx + 4, cz - 3) + 4.1, cz - 3]);   // the roof ridge perch
      return pts;
    };
    spawns.push(['wagtail', 3, { x: S2.x, z: S2.z, r: 30 }, { medium: 'air', fly: 'perch', perches: mkPerches(S2.x, S2.z) }]);
    if (era >= 3) spawns.push(['wagtail', 2, { x: LOC.MANOR.x, z: LOC.MANOR.z, r: 30 }, { medium: 'air', fly: 'perch', perches: mkPerches(LOC.MANOR.x, LOC.MANOR.z) }]);
  }
  spawns.push(['crane', 7, { x: 500, z: 1700, r: 400 }, { medium: 'air', fly: 'cross', level: 360 }]);

  if (era <= 2) {
    // wilderness & Iron Age: the full wild suite
    spawns.push(['redDeer', era === 1 ? 3 : 2, forestN, { grazeBias: 0.75 }]);
    spawns.push(['roeBuck', 1, forestS, { grazeBias: 0.75 }]);
    spawns.push(['roeDeer', 3, forestS, { grazeBias: 0.75 }]);
    spawns.push(['boar', era === 1 ? 5 : 4, { x: S2.x - 350, z: S2.z + 700, r: 90 }, { grazeBias: 0.85, speed: 0.7 }]);
    spawns.push(['beaver', 2, rDown, { medium: 'water', level: rDown.level + 0.02, inWater: inRiver, speed: 0.45 }]);
    spawns.push(['fox', 1, wideMeadow, { speed: 1.2, grazeBias: 0.45 }]);
    spawns.push(['hare', 3, wideMeadow, HOP_HARE]);
    spawns.push(['squirrel', 2, { x: LOC.OAK.x, z: LOC.OAK.z, r: 30 }, { hop: true, hopLen: 0.8, hopH: 0.16, hopDur: 0.24, restT: [2, 6], chainT: 0.08 }]);
    spawns.push(['wolf', 2, { x: S2.x + 400, z: S2.z - 1100, r: 120 }, { speed: 1.3, grazeBias: 0.4 }]);
    spawns.push(['blackGrouse', 4, { x: S2.x - 500, z: S2.z + 400, r: 60 }]);
  } else if (era <= 4) {
    // agrarian parish: wildlife keeps to the margins; swallows own the yards
    spawns.push(['swallow', 6, { x: S2.x, z: S2.z, r: 70 }, { medium: 'air', fly: 'hawk', alt: [4, 15] }]);
    spawns.push(['swallow', 4, { x: LOC.MANOR.x, z: LOC.MANOR.z, r: 80 }, { medium: 'air', fly: 'hawk', alt: [4, 16] }]);
    spawns.push(['roeDeer', 2, forestN, { grazeBias: 0.8 }]);
    spawns.push(['fox', 1, { x: S2.x + 500, z: S2.z - 500, r: 130 }, { speed: 1.2, grazeBias: 0.45 }]);
    spawns.push(['hare', 2, wideMeadow, HOP_HARE]);
    spawns.push(['frog', 4, { x: LOC.POND.x - 30, z: LOC.POND.z + 20, r: 14 }, HOP_FROG]);
    spawns.push(['stork', 2, { x: S2.x - 100, z: S2.z + 150, r: 55 }, { speed: 0.4, grazeBias: 0.55 }]);
    spawns.push(['duckM', 2, { x: LOC.POND.x + 4, z: LOC.POND.z, r: 30 }, { medium: 'water', level: LOC.POND_LEVEL + 0.03, speed: 0.5 }]);
  } else {
    // the quiet century: the forest fauna is back
    spawns.push(['roeDeer', 4, forestN, { grazeBias: 0.75 }]);
    spawns.push(['roeBuck', 1, forestN, { grazeBias: 0.75 }]);
    spawns.push(['redDeer', 2, forestS, { grazeBias: 0.78 }]);
    spawns.push(['boar', 3, forestS, { grazeBias: 0.85, speed: 0.7 }]);
    spawns.push(['beaver', 1, rDown, { medium: 'water', level: rDown.level + 0.02, inWater: inRiver, speed: 0.45 }]);
    spawns.push(['fox', 1, wideMeadow, { speed: 1.2, grazeBias: 0.45 }]);
    spawns.push(['hare', 2, wideMeadow, HOP_HARE]);
    spawns.push(['swallow', 4, { x: S2.x, z: S2.z, r: 80 }, { medium: 'air', fly: 'hawk', alt: [4, 15] }]);
    spawns.push(['stork', 2, { x: S2.x - 100, z: S2.z + 150, r: 55 }, { speed: 0.4, grazeBias: 0.55 }]);
    spawns.push(['wolf', 1, { x: S2.x + 300, z: S2.z - 1300, r: 150 }, { speed: 1.3, grazeBias: 0.4 }]);
  }
}

function shadowProps(g) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

function gravelEllipse(x, z, rx, rz, rot, color) {
  const pos = [x, meshHeightAt(x, z) + 0.055, z];
  const idx = [];
  const N = 36;
  const ca = Math.cos(rot), sa = Math.sin(rot);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
    const px = x + lx * ca - lz * sa, pz = z + lx * sa + lz * ca;
    pos.push(px, meshHeightAt(px, pz) + 0.055, pz);
  }
  for (let i = 0; i < N; i++) idx.push(0, 1 + ((i + 1) % N), 1 + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function infoSign() {
  const g = new THREE.Group();
  for (const x of [-0.32, 0.32]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), MAT.darkWood);
    post.position.set(x, 0.58, 0);
    g.add(post);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), MAT.plank);
  panel.position.set(0, 1.12, 0);
  panel.rotation.x = -0.16;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.46, 0.018), new THREE.MeshLambertMaterial({ color: 0xd8cfac }));
  face.position.set(0, 1.12, -0.04);
  face.rotation.x = -0.16;
  g.add(panel, face);
  return shadowProps(g);
}

function picnicTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.62), MAT.plank);
  top.position.y = 0.72;
  g.add(top);
  for (const z of [-0.58, 0.58]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.22), MAT.plank);
    bench.position.set(0, 0.46, z);
    g.add(bench);
  }
  for (const x of [-0.58, 0.58]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14), MAT.darkWood);
    leg.position.set(x, 0.33, -0.22);
    const leg2 = leg.clone();
    leg2.position.z = 0.22;
    g.add(leg, leg2);
  }
  return shadowProps(g);
}

function fireRing() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.16), MAT.stone);
    st.position.set(Math.cos(a) * 0.52, 0.08, Math.sin(a) * 0.52);
    st.rotation.y = -a;
    g.add(st);
  }
  return shadowProps(g);
}

function outhouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.65, 1.2), MAT.plank);
  body.position.y = 0.82;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.25, 0.04), MAT.darkWood);
  door.position.set(0, 0.68, -0.62);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.14, 1.34), MAT.darkWood);
  roof.position.y = 1.72;
  roof.rotation.x = -0.18;
  g.add(body, door, roof);
  return shadowProps(g);
}

export function buildEra(era, ctx) {
  const g = new THREE.Group();
  g.name = `era${era}`;
  const ticks = [];
  const add = (obj, x, z, rot = 0, sink = 0.08) => {
    placeOnGround(obj, x, z, rot, sink);
    g.add(obj);
    if (obj.userData.tick) ticks.push(obj.userData.tick);
    return obj;
  };
  const addRaw = (obj) => {
    g.add(obj);
    if (obj.userData.tick) ticks.push(obj.userData.tick);
    return obj;
  };
  const smokes = [], fires = [];
  const spawns = [];

  // ======================= 0 · ~10,800 BC =================================
  if (era === 0) {
    // dead ice stranded in the future lake basins — the lakes being born
    for (const lake of LAKES) {
      const cx = lake.poly.reduce((s2, p) => s2 + p[0], 0) / lake.poly.length;
      const cz = lake.poly.reduce((s2, p) => s2 + p[1], 0) / lake.poly.length;
      addRaw(deadIce(cx, cz, lake.poly.length > 60 ? 1.6 : 1));
    }
    addRaw(erratics(300, { x: HM_OFF_X, z: HM_OFF_Z, w: HM_SPAN - 400, h: HM_SPAN - 400 }));
    // reindeer bands on the tundra
    spawns.push(['reindeer', 7, { x: S.x - 60, z: S.z + 120, r: 130 }]);
    spawns.push(['reindeer', 5, { x: B.x - 300, z: B.z - 500, r: 160 }]);
    spawns.push(['elk', 1, { x: S.x + 500, z: S.z + 600, r: 80 }]);
  }

  // ======================= 1 · ~AD 50 ======================================
  if (era === 1) {
    add(leanTo(), C.x, C.z, -0.6);
    add(campfire(), C.x + 3.4, C.z + 2.2);
    fires.push([C.x + 3.4, heightAt(C.x + 3.4, C.z + 2.2) + 0.15, C.z + 2.2]);
    smokes.push([C.x + 3.4, heightAt(C.x + 3.4, C.z + 2.2) + 0.9, C.z + 2.2, { rate: 1.1, gray: 0.8 }]);
    add(fishRack(), C.x - 3, C.z + 3.5, 0.4);
    add(dugoutCanoe(), riverXAt(C.z + 20) + 7, C.z + 20, 1.2);
    addRaw(barrowStones(BUMPS.slice(0, 3)));
    const meadow = { x: S.x - 20, z: S.z + 30, r: 70 };
    spawns.push(['aurochsBull', 1, meadow]);
    spawns.push(['aurochsCow', 3, meadow]);
    spawns.push(['aurochsCalf', 1, meadow]);
    spawns.push(['elk', 2, { x: S.x + 250, z: S.z + 190, r: 50 }]);
  }

  // ======================= 2 · ~AD 950 =====================================
  if (era === 2) {
    const dw = add(logCabin({ w: 5, d: 6, wallH: 2.0, roofH: 2.2, roof: 'barkGable', doorEnd: true }), S.x - 5, S.z - 9, 0.15);
    void dw;
    smokes.push([S.x - 5, heightAt(S.x - 5, S.z - 9) + 4.0, S.z - 6.6, { rate: 0.65, gray: 0.74 }]);
    add(logCabin({ w: 4, d: 5, wallH: 1.8, roofH: 1.9, roof: 'barkGable', old: true }), S.x + 10, S.z + 6, 1.62);
    add(postGranary(), S.x + 2, S.z + 13, -0.1);
    add(logCabin({ w: 4.5, d: 7, wallH: 1.6, roofH: 2.0, roof: 'thatchGableOld', old: true }), S.x - 14, S.z + 7, 1.55);
    addRaw(palisadeRing(LOC.HILLFORT.x, LOC.HILLFORT.z, 17));
    add(logCabin({ w: 3.6, d: 4.4, wallH: 1.7, roofH: 1.8, roof: 'barkGable', old: true }), LOC.HILLFORT.x + 4, LOC.HILLFORT.z - 3, 0.7);
    // refuge forts held more than one roof: a second dwelling + raised store
    add(logCabin({ w: 3.2, d: 4.0, wallH: 1.6, roofH: 1.7, roof: 'barkGable', old: true }), LOC.HILLFORT.x - 6, LOC.HILLFORT.z + 4, -0.9);
    add(postGranary(), LOC.HILLFORT.x - 9, LOC.HILLFORT.z - 7, 1.9);
    add(campfire(), S.x + 1.5, S.z - 1);
    fires.push([S.x + 1.5, heightAt(S.x + 1.5, S.z - 1) + 0.15, S.z - 1]);
    smokes.push([S.x + 1.5, heightAt(S.x + 1.5, S.z - 1) + 0.9, S.z - 1, { rate: 1.0, gray: 0.8 }]);
    addRaw(wattleFence([
      [S.x - 20, S.z - 16], [S.x + 16, S.z - 16], [S.x + 18, S.z + 18], [S.x - 8, S.z + 20],
    ]));
    add(haystack(2.8), S.x - 24, S.z + 24);
    add(haystack(2.4), S.x - 30, S.z + 18);
    add(beehiveLog(), S.x + 26, S.z - 20, 0.3);
    add(beehiveLog(), S.x + 30, S.z - 15, -0.2);
    add(dugoutCanoe(), riverXAt(S.z + 60) + 6, S.z + 60, 1.45);
    const logBridge = add(bridge(true), BRIDGE.x, BRIDGE.z, 0);
    logBridge.position.y = riverLevelAt(BRIDGE.z) + 0.35;
    add(offeringPile(), LOC.OAK.x + 2.5, LOC.OAK.z + 1.5);
    addRaw(barrowStones(BUMPS));
    // the neighbours: dispersed Latgalian viensētas on the same terrace,
    // each a smoke-dwelling + granary or byre in a small stake-fenced yard
    ERA2_FARMS.forEach((f, i) => {
      const fr = mulberry32(900 + i * 97);
      const rot = fr() * 3.1;
      add(logCabin({
        w: 4.2 + fr() * 1.2, d: 5 + fr() * 1.4, wallH: 1.8, roofH: 2.0,
        roof: fr() < 0.5 ? 'barkGable' : 'thatchGableOld', doorEnd: true, old: true,
      }), f.x, f.z, rot);
      smokes.push([f.x, heightAt(f.x, f.z) + 3.8, f.z, { rate: 0.45, gray: 0.76 }]);
      if (fr() < 0.7) add(postGranary(), f.x + 9 + fr() * 4, f.z + 6, rot + 1.4);
      else add(logCabin({ w: 3.6, d: 4.6, wallH: 1.6, roofH: 1.8, roof: 'barkGable', old: true }), f.x + 10, f.z + 7, rot + 1.6);
      add(haystack(2.2 + fr()), f.x - 9, f.z + 8);
      addRaw(wattleFence([
        [f.x - 13, f.z - 10], [f.x + 12, f.z - 11], [f.x + 14, f.z + 12],
      ]));
    });
    spawns.push(['cattleIron', 4, { x: S.x - 115, z: S.z + 35, r: 55 }]);
    spawns.push(['sheepDark', 5, { x: S.x - 60, z: S.z - 30, r: 35 }]);
    spawns.push(['horseTarpan', 2, { x: S.x - 115, z: S.z + 90, r: 45 }]);
    spawns.push(['pig', 2, { x: S.x + 40, z: S.z + 40, r: 25 }]);
    spawns.push(['chicken', 3, { x: S.x, z: S.z + 3, r: 10 }]);
    spawns.push(['rooster', 1, { x: S.x, z: S.z + 3, r: 10 }]);
  }

  // ======================= 3 & 4 · 1860 / 1935 =============================
  if (era === 3 || era === 4) {
    const modern = era === 4;
    add(logCabin({
      w: 6.5, d: 12, wallH: 2.5, roofH: 2.9,
      roof: modern ? 'shingleGable' : 'thatchGable',
      hasChimney: true, windows: modern ? 3 : 2,
      windowStyle: modern ? 'framed' : 'dark', porch: modern,
    }), S.x, S.z - 15, Math.PI / 2);
    smokes.push([S.x, heightAt(S.x, S.z - 15) + 6.6, S.z - 13.5, { rate: 0.55, gray: 0.86 }]);
    add(logCabin({ w: 5, d: 8, wallH: 2.2, roofH: 2.3, roof: 'shingleGable', doorEnd: true }), S.x + 21, S.z + 2, -Math.PI / 2);
    add(logCabin({ w: 5.5, d: 13, wallH: 1.9, roofH: 2.4, roof: 'thatchGableOld', old: true }), S.x - 21, S.z + 5, 0.03);
    add(rija(), S.x + 17, S.z + 36, 0.5);
    const px = riverXAt(S.z + 85) + 16, pz = S.z + 85;
    add(logCabin({ w: 3.4, d: 4.2, wallH: 1.7, roofH: 1.9, roof: 'thatchGableOld', old: true, doorEnd: true }), px, pz, -0.4);
    smokes.push([px, heightAt(px, pz) + 3.6, pz, { rate: 1.25, gray: 0.66 }]);
    add(wellSweep(), S.x + 7, S.z - 7, 0.7);
    addRaw(rikuFence([
      [S.x - 27, S.z - 22], [S.x + 27, S.z - 22], [S.x + 28, S.z + 24], [S.x - 27, S.z + 26], [S.x - 27, S.z - 22],
    ]));
    addRaw(rikuFence([[S.x - 27, S.z + 40], [S.x + 5, S.z + 44]]));
    add(laundryLine(), S.x - 8, S.z - 20.5, 0.1);
    add(woodpile(), S.x - 4, S.z - 10, 0.4);
    add(choppingBlock(), S.x - 2.5, S.z - 8);
    add(cart(), S.x + 14, S.z + 9, -0.5);
    add(haystack(3.4), S.x - 36, S.z + 42);
    add(haystack(3), S.x - 44, S.z + 34);
    for (let i = 0; i < 3; i++) add(beehiveLog(), S.x - 20 + i * 4, S.z - 36, i);
    add(rowboat(), riverXAt(S.z + 62) + 6.5, S.z + 62, 1.5);
    const wb = add(bridge(false), BRIDGE.x, BRIDGE.z, 0);
    wb.position.y = riverLevelAt(BRIDGE.z) + 0.2;
    const nb = add(bridge(false), BRIDGE2.x, BRIDGE2.z, Math.PI / 2);
    nb.position.y = BRIDGE2.level + 0.2;
    add(storkNestPole(), S.x + 30, S.z + 22);

    // the manor: old classicist house in 1860; brick new manor from 1888 on
    const mh = add(modern ? manorNew({ flag: true }) : manorHouse({ flag: false }), Mn.x, Mn.z, 0.35);
    if (mh.userData.tick) ticks.push(mh.userData.tick);
    if (modern) add(manorHouse({ flag: false }), Mn.x - 105, Mn.z - 15, 0.9);
    add(manorOutbuilding(22), Mn.x - 46, Mn.z - 26, 0.35 + Math.PI / 2);
    add(manorOutbuilding(16), Mn.x + 44, Mn.z - 22, 0.2);
    add(brewery(), P.x + 58, P.z + 48, Math.PI * 0.72);
    smokes.push([Mn.x - 8, heightAt(Mn.x, Mn.z) + 9.6, Mn.z, { rate: 0.4, gray: 0.88 }]);
    const mill = add(watermill(ctx.water.pondLevel), P.x + 30, P.z + 16, Math.PI * 0.75);
    if (mill.userData.tick) ticks.push(mill.userData.tick);
    const dam = new THREE.Mesh(new THREE.BoxGeometry(30, 2.4, 1.8), MAT.plank);
    dam.position.set(P.x + 26, ctx.water.pondLevel - 0.9, P.z + 2);
    dam.rotation.y = -0.75;
    dam.castShadow = true;
    g.add(dam);
    add(churchSilhouette(), LOC.CHURCH.x, LOC.CHURCH.z, 0.8);

    // Brežģa krogs on the old road south — where the manor's ale was drunk
    add(krogs(), K.x - 16, K.z + 2, 0.28);
    smokes.push([K.x - 19, heightAt(K.x - 16, K.z + 2) + 5.2, K.z + 2, { rate: 0.4, gray: 0.85 }]);
    // Jāņi fire pyre on Brežģa kalns — the parish's festival hill
    add(pyre(), B.x, B.z, 0.4);
    fires.push([B.x, heightAt(B.x, B.z) + 0.9, B.z, { intensity: 30, dist: 150, duskOnly: true, scale: 3.6 }]);

    if (modern) {
      add(poemStone(), LOC.STONE.x, LOC.STONE.z, -0.5);
      utilityPoles(g, false);
    }
    bgSettlement(g, modern ? 4 : 3, smokes);
    roadRibbons(g, modern ? 4 : 3);

    spawns.push(['cattleFarm', modern ? 6 : 5, { x: S.x - 115, z: S.z + 35, r: 60 }]);
    spawns.push(['sheepWhite', modern ? 4 : 6, { x: S.x - 55, z: S.z - 35, r: 35 }]);
    spawns.push(['horseBay', 2, { x: S.x - 110, z: S.z + 95, r: 45 }]);
    spawns.push(['chicken', modern ? 4 : 5, { x: S.x + 2, z: S.z + 2, r: 12 }]);
    spawns.push(['rooster', 1, { x: S.x + 2, z: S.z + 2, r: 12 }]);
    spawns.push(['goose', modern ? 3 : 4, { x: S.x - 10, z: S.z + 14, r: 14 }]);
    spawns.push(['storkNest', 1, { x: S.x + 30, z: S.z + 22, r: 0 }]);
    spawns.push(['stork', 1, { x: S.x - 90, z: S.z + 50, r: 40 }]);
    // nests scattered on the background farms too — the stork parish
    spawns.push(['storkNest', 1, { x: 812, z: 452, r: 0 }]);
    spawns.push(['storkNest', 1, { x: 439, z: -455, r: 0 }]);
    spawns.push(['horseBay', 1, { x: K.x + 14, z: K.z + 16, r: 8 }]); // traveller's horse at the krogs
  }

  // ======================= 5 · 2025 ========================================
  if (era === 5) {
    // the farmstead site today: renovated house, the old klēts, a car
    add(modernHouse(), S.x, S.z - 14, Math.PI / 2);
    smokes.push([S.x, heightAt(S.x, S.z - 14) + 5.6, S.z - 14, { rate: 0.3, gray: 0.9 }]);
    add(logCabin({ w: 5, d: 8, wallH: 2.2, roofH: 2.3, roof: 'shingleGable', doorEnd: true, old: true }), S.x + 21, S.z + 2, -Math.PI / 2);
    add(car(), S.x + 10, S.z - 4, 0.4);
    add(storkNestPole(), S.x + 30, S.z + 22);
    add(poemStone(), LOC.STONE.x, LOC.STONE.z, -0.5);

    // the manor ensemble survives: new manor (parish house), old manor, outbuildings
    const mh = add(manorNew({ flag: true }), Mn.x, Mn.z, 0.35);
    if (mh.userData.tick) ticks.push(mh.userData.tick);
    add(manorHouse({ flag: false }), Mn.x - 105, Mn.z - 15, 0.9);
    add(manorOutbuilding(22), Mn.x - 46, Mn.z - 26, 0.35 + Math.PI / 2);
    add(manorOutbuilding(16), Mn.x + 44, Mn.z - 22, 0.2);
    add(churchSilhouette(), LOC.CHURCH.x, LOC.CHURCH.z, 0.8);
    const nb = add(bridge(false), BRIDGE2.x, BRIDGE2.z, Math.PI / 2);
    nb.position.y = BRIDGE2.level + 0.2;

    // Brezgis today: two quiet houses where the krogs stood
    add(modernHouse(), K.x - 20, K.z + 6, 0.3);
    add(logCabin({ w: 4.5, d: 6, wallH: 2.1, roofH: 2.2, roof: 'shingleGable', old: true }), K.x + 26, K.z - 14, -0.4);

    // Brežģa kalns: the 2017 observation tower, the summit oak, the Jāņi pyre
    add(observationTower(), B.x, B.z, 0.2);
    addRaw(gravelEllipse(B.x + 55, B.z - 60, 12, 7, -0.58, 0x8d7c5f));
    add(infoSign(), B.x + 48, B.z - 52, -0.7);
    add(picnicTable(), B.x + 24, B.z - 18, -0.45);
    add(fireRing(), B.x + 10, B.z - 8, 0.25);
    add(outhouse(), B.x + 38, B.z - 36, 0.55);
    bgSettlement(g, 5, smokes);
    roadRibbons(g, 5);
    add(pyre(), B.x + 22, B.z + 10, 0.4);
    fires.push([B.x + 22, heightAt(B.x + 22, B.z + 10) + 0.9, B.z + 10, { intensity: 30, dist: 150, duskOnly: true, scale: 3.6 }]);

    utilityPoles(g, true);

    spawns.push(['cattleFarm', 4, { x: S.x - 115, z: S.z + 35, r: 60 }]);
    // the ARK herd grazes OPEN floodplain — the satellite says the meadow
    // by the Gauja at (101,-374) is grass today; the first pick was forest
    spawns.push(['horseKonik', 8, { x: 101, z: -374, r: 55 }]);
    spawns.push(['storkNest', 1, { x: S.x + 30, z: S.z + 22, r: 0 }]);
    spawns.push(['stork', 1, { x: S.x - 90, z: S.z + 50, r: 40 }]);
    // nests scattered on the background farms too — the stork parish
    spawns.push(['storkNest', 1, { x: 812, z: 452, r: 0 }]);
    spawns.push(['storkNest', 1, { x: 439, z: -455, r: 0 }]);
    spawns.push(['elk', 2, { x: B.x - 700, z: B.z - 900, r: 90 }]); // forest has returned
  }

  g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  wildSpawns(era, spawns);
  return { group: g, ticks, smokes, fires, spawns };
}

// spawn helper used by main (handles the special cases)
export function applySpawns(mgr, spawns) {
  for (const [kind, count, home, opts = {}] of spawns) {
    for (let i = 0; i < count; i++) {
      if (kind === 'aurochsCalf') {
        const rec = mgr.spawn('aurochsCow', home);
        rec.group.scale.setScalar(0.58);
      } else if (kind === 'storkNest') {
        const rec = mgr.spawn('stork', { ...home, r: 0.1 }, { static: true });
        rec.group.position.y = heightAt(home.x, home.z) + 5.75;
      } else {
        mgr.spawn(kind, home, opts);
      }
    }
  }
}
