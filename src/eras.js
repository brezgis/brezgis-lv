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
import { LAKES } from './geodata.js';
import { BUILDINGS_OSM, DWELLINGS_OSM, ROADS_OSM } from './geodata-osm.js';
import { mulberry32 } from './util.js';
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
// terrain vertices, so a 5m carriageway all but vanished. The P30 is a
// paved regional highway today; gravel before the war.
function roadRibbons(group, era) {
  // 2025: only the P30 (class 0) is asphalt — the V-roads are still gravel.
  // Before the war everything is gravel.
  const mkMat = (color) => new THREE.MeshLambertMaterial({
    color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const surf = {
    asphalt: { mat: mkMat(0x393c40), positions: [], indices: [] },
    gravel: { mat: mkMat(0x8d7c5f), positions: [], indices: [] },
  };
  const dashPos = [], dashIdx = [];   // painted centreline on today's P30
  for (const r of ROADS_OSM) {
    if (r.c > 1) continue;
    const { positions, indices } = era === 5 && r.c === 0 ? surf.asphalt : surf.gravel;
    const half = r.c === 0 ? 3.2 : 2.4;
    const pts = [];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 9));
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    pts.push(r.pts[r.pts.length - 1]);
    if (pts.length < 2) continue;
    const base = positions.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const j = Math.min(i + 1, pts.length - 1);
      let dx = pts[j][0] - pts[Math.max(0, i - 1)][0];
      let dz = pts[j][1] - pts[Math.max(0, i - 1)][1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const y = meshHeightAt(x, z);
      // cambered profile on the RENDERED surface, edges tucked
      positions.push(
        x - dz * half, meshHeightAt(x - dz * half, z + dx * half) - 0.35, z + dx * half,
        x, y + 0.14, z,
        x + dz * half, meshHeightAt(x + dz * half, z - dx * half) - 0.35, z - dx * half);
      if (i > 0) {
        const a2 = base + (i - 1) * 3;
        // wind CCW seen from +y or the whole ribbon back-face culls from above
        indices.push(a2, a2 + 4, a2 + 1, a2, a2 + 3, a2 + 4);
        indices.push(a2 + 1, a2 + 5, a2 + 2, a2 + 1, a2 + 4, a2 + 5);
        // dashed centreline on the paved P30: ~3.4m of paint per 18m cycle
        // (the full-span 9m dashes read like runway markings from the air)
        if (era === 5 && r.c === 0 && i % 2 === 0) {
          const b2 = dashPos.length / 3;
          const px = pts[i - 1][0], pz = pts[i - 1][1];
          const sx = px + (x - px) * 0.31, sz = pz + (z - pz) * 0.31;
          const ex = px + (x - px) * 0.69, ez = pz + (z - pz) * 0.69;
          const sy = meshHeightAt(sx, sz) + 0.17, ey = meshHeightAt(ex, ez) + 0.17;
          dashPos.push(
            sx - dz * 0.09, sy, sz + dx * 0.09, sx + dz * 0.09, sy, sz - dx * 0.09,
            ex + dz * 0.09, ey, ez - dx * 0.09, ex - dz * 0.09, ey, ez + dx * 0.09);
          dashIdx.push(b2, b2 + 2, b2 + 1, b2, b2 + 3, b2 + 2);
        }
      }
    }
  }
  if (dashPos.length) {
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dashPos, 3));
    dg.setIndex(dashIdx);
    dg.computeVertexNormals();
    const dashes = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({
      color: 0xc9cdd1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    group.add(dashes);
  }
  for (const key of ['asphalt', 'gravel']) {
    const { mat, positions, indices } = surf[key];
    if (!positions.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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

function bgSettlement(group, era, smokes) {
  const rng = mulberry32(4300 + era * 17);
  const props = { hay: [], wood: [], vinda: [], fence: [] };
  const { wall, roof } = bgAssets();
  const skip = (x, z) => nearStagePOI(x, z);
  const items = [];
  if (era === 5) {
    for (const [x, z, w, d, rot] of BUILDINGS_OSM) {
      if (skip(x, z)) continue;
      items.push({ x, z, w, d, rot, big: w * d > 220, kind: 'new' });
    }
  } else {
    DWELLINGS_OSM.forEach(([x, z, name], si) => {
      // Brežģu Pienotava — the family dairy co-op point: a white plastered
      // creamery by the krogs road in 1935; no such site before the co-op era
      if (/pienotava/i.test(name || '')) {
        if (era === 4) items.push({ x, z, w: 11, d: 7, rot: 0.98, kind: 'dairy', white: true });
        return;
      }
      if (skip(x, z) || !farmSiteKept(si, era)) return;
      // OSM place nodes are approximate: nudge any site out of the
      // carriageway (a farmhouse stood ON the P30 before this check)
      {
        const rd = distToRoadEx(era, x, z);
        if (rd.c <= 1 && rd.d < 8) {
          let moved = false;
          for (const a of [0, 1.57, 3.14, 4.71, 0.79, 2.36, 3.93, 5.5]) {
            const nx2 = x + Math.cos(a) * 16, nz2 = z + Math.sin(a) * 16;
            if (distToRoadEx(era, nx2, nz2).d >= 8) { x = nx2; z = nz2; moved = true; break; }
          }
          if (!moved) return;
        }
      }
      const sr = mulberry32(si * 613 + era * 37);
      const rot = sr() * Math.PI;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      items.push({ x, z, w: 8 + sr() * 5, d: 5.5 + sr() * 2, rot, kind: 'dwell', site: si });
      const yd = 15 + sr() * 8;
      items.push({
        x: x + ca * yd, z: z + sa * yd,
        w: 10 + sr() * 7, d: 6 + sr() * 3,
        rot: rot + (sr() - 0.5) * 0.5, kind: 'barn',
      });
      if (sr() < 0.65) {
        const yd2 = 12 + sr() * 6;
        items.push({
          x: x - sa * yd2, z: z + ca * yd2,
          w: 5 + sr() * 2, d: 4 + sr(), rot: rot + 1.57, kind: 'klets',
        });
      }
      // signs of life in the yard (period props, instanced below)
      if (era < 5) {
        const py = 9 + sr() * 5;
        props.hay.push([x + sa * py, z - ca * py, sr() * 6.3, 0.8 + sr() * 0.5]);
        if (sr() < 0.6) props.hay.push([x + sa * (py + 5), z - ca * (py + 4), sr() * 6.3, 0.7 + sr() * 0.4]);
        if (sr() < 0.75) props.wood.push([x + ca * 6 - sa * 4, z + sa * 6 + ca * 4, rot + 1.57, 0.8 + sr() * 0.4]);
        if (sr() < 0.55) props.vinda.push([x - ca * 8, z - sa * 8, sr() * 6.3]);
        // a run of riķu fence closing the yard
        if (sr() < 0.8) {
          const fl = 16 + sr() * 14, fx = x - ca * 12, fz = z - sa * 12;
          for (let fp = 0; fp < fl; fp += 0.9) {
            props.fence.push([fx + sa * (fp - fl / 2), fz - ca * (fp - fl / 2), rot + 0.9 + (fp % 2) * 1.3]);
          }
        }
      }
    });
  }
  const walls = new THREE.InstancedMesh(wall, new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length);
  const roofs = new THREE.InstancedMesh(roof, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), items.length);
  walls.castShadow = roofs.castShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    // seat on the LOWEST footprint corner and stretch the walls up to the
    // highest — a single centre sample floated corners 2m+ on slopes
    const cca = Math.cos(it.rot), csa = Math.sin(it.rot);
    let minH = Infinity, maxH = -Infinity;
    for (const [ox, oz] of [[it.w / 2, it.d / 2], [it.w / 2, -it.d / 2], [-it.w / 2, it.d / 2], [-it.w / 2, -it.d / 2]]) {
      const hh = heightAt(it.x + ox * cca - oz * csa, it.z + ox * csa + oz * cca);
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
      if (pick < 0.35) col.setRGB(0.82, 0.78, 0.68);        // render/plaster
      else if (pick < 0.6) col.setRGB(0.62, 0.55, 0.44);    // timber
      else if (pick < 0.8) col.setRGB(0.72, 0.68, 0.62);    // silicate/grey
      else col.setRGB(0.5, 0.42, 0.34);                     // dark wood
      if (it.big) col.setRGB(0.66, 0.68, 0.7);              // steel-clad barn
    } else if (it.white) {
      col.setRGB(0.88, 0.85, 0.78);                         // plastered creamery
    } else {
      col.setRGB(0.42 + rng() * 0.12, 0.34 + rng() * 0.08, 0.24 + rng() * 0.06);
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
      else if (pick < 0.4) col.setRGB(0.48, 0.2, 0.14);     // red metal/tile
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

  // --- yard props, all instanced: haystacks, woodpiles, well-sweeps -------
  if (era < 5 && props.hay.length + props.wood.length + props.vinda.length + props.fence.length > 0) {
    const put = (mesh, arr, fill) => {
      arr.forEach((p, i) => { fill(p, i); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.count = arr.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      group.add(mesh);
    };
    const hayCone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.4, 9), MAT.hay, props.hay.length);
    put(hayCone, props.hay, ([x, z, r, sc]) => {
      dummy.position.set(x, heightAt(x, z) + 1.2 * sc - 0.05, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
    });
    const woodGeo = new THREE.BoxGeometry(2.1, 1.05, 1.0);
    const wood = new THREE.InstancedMesh(woodGeo, MAT.logOld, props.wood.length);
    put(wood, props.wood, ([x, z, r, sc]) => {
      dummy.position.set(x, heightAt(x, z) + 0.5 * sc, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
    });
    // vinda: post + counterweighted sweep beam + hanging rod, baked into one
    // transform frame
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
    bgSettlement(g, 5, smokes);
    roadRibbons(g, 5);
    add(pyre(), B.x + 22, B.z + 10, 0.4);
    fires.push([B.x + 22, heightAt(B.x + 22, B.z + 10) + 0.9, B.z + 10, { intensity: 30, dist: 150, duskOnly: true, scale: 3.6 }]);

    utilityPoles(g, true);

    spawns.push(['cattleFarm', 4, { x: S.x - 115, z: S.z + 35, r: 60 }]);
    spawns.push(['storkNest', 1, { x: S.x + 30, z: S.z + 22, r: 0 }]);
    spawns.push(['stork', 1, { x: S.x - 90, z: S.z + 50, r: 40 }]);
    spawns.push(['elk', 2, { x: B.x - 700, z: B.z - 900, r: 90 }]); // forest has returned
  }

  g.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
  return { group: g, ticks, smokes, fires, spawns };
}

// spawn helper used by main (handles the special cases)
export function applySpawns(mgr, spawns) {
  for (const [kind, count, home] of spawns) {
    for (let i = 0; i < count; i++) {
      if (kind === 'aurochsCalf') {
        const rec = mgr.spawn('aurochsCow', home);
        rec.group.scale.setScalar(0.58);
      } else if (kind === 'storkNest') {
        const rec = mgr.spawn('stork', { ...home, r: 0.1 }, { static: true });
        rec.group.position.y = heightAt(home.x, home.z) + 5.75;
      } else {
        mgr.spawn(kind, home);
      }
    }
  }
}
