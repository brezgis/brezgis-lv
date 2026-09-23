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
  krogs, observationTower, modernHouse, car, motorcar1930s, erratics, deadIce, placeOnGround,
  barrowMounds,
} from './buildings.js';
import { MAT } from './textures.js';
import { roadMaterial, buildingMaterial, fieldMaterial } from './surfaces.js';
import { buildRoadside } from './roadside.js';
import { heightAt, meshHeightAt } from './terrain.js';
import { LOC, BUMPS, BRIDGE, BRIDGE2, riverXAt, riverLevelAt, farmSiteKept, ERA2_FARMS, distToRiver, distToStreams, distToRoadEx, nearStagePOI, osmRoadsForEra, roadJunctionsForEra, ROAD_HALF_W, fieldsForEra, FIELD_COLORS } from './landuse.js';
import { riverAt, streamAt, lakeAt, pondAt, vegExcluded, waterLevelAt, RIVER, STREAM_CHANNELS } from './riverzone.js';
import { registerFootprints, registerTrample, buildingAt, stageFootprint } from './footprints.js';
import { LAKES, RIVER_PTS } from './geodata.js';
import { BUILDINGS_OSM, DWELLINGS_OSM } from './geodata-osm.js';
import { mulberry32, pointInPoly, chaikinPoly } from './util.js';
import { bakeSpeciesGeometry } from './animals.js';
import { HM_OFF_X, HM_OFF_Z, HM_SPAN } from './heightmap.js';

const S = LOC.STEAD, C = LOC.CAMP, Mn = LOC.MANOR, P = LOC.POND, B = LOC.BREZGA, K = LOC.KROGS;

export function leanTo() {
  const g = new THREE.Group(); g.name = 'hunters-shelter';
  const branch = (a,b,r=.055) => {
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.75,r,dir.length(),8),MAT.roundwood);
    m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());g.add(m);
  };
  for(const side of [-1,1]){
    branch([side*1.6,-.1,0],[side*1.6,1.94,0],.075);
    branch([side*1.6,-.1,-2.6],[side*1.6,.35,-2.6],.065);
  }
  branch([-1.8,1.85,0],[1.8,1.85,0],.08);
  branch([-1.8,.25,-2.6],[1.8,.25,-2.6],.06);
  for(let i=0;i<7;i++){const x=-1.6+i*3.2/6;branch([x,1.85,.08],[x,.22,-2.7],.038);}
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.65,.10,3.25),MAT.thatchOld);
  roof.position.set(0,1.09,-1.3);roof.rotation.x=-Math.atan2(1.6,2.6);g.add(roof);
  // A low brush bed under the cover, not another floating roof slab.
  const bedding=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),MAT.hay);bedding.scale.set(1.12,.075,.48);
  bedding.position.set(0,.035,-1.22);g.add(bedding);
  for(const s of [-1,1])branch([s*1.6,.1,-2.6],[s*1.6,1.8,0],.045);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}

export function fishRack() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 8), MAT.roundwood);
    post.position.set(s * 1.1, 0.85, 0);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), MAT.lightWood);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.55;
  g.add(bar);
  for (let i = 0; i < 4; i++) {
    const fish = new THREE.Mesh(new THREE.SphereGeometry(1,12,8), new THREE.MeshLambertMaterial({ color: 0x8c8d78 }));
    fish.scale.set(.046,.18,.025);
    fish.position.set(-0.8 + i * 0.55, 1.28, 0);
    g.add(fish);
    const cord=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.12,4),MAT.darkWood);cord.position.set(fish.position.x,1.50,0);g.add(cord);
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
    for (const r of osmRoadsForEra(modern ? 5 : 4)) {
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
    const yBase = meshHeightAt(x, zz);
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

// A cart standing on the verge with its horse cropping the grass — the pose
// the baked model actually holds. (Driving it would slide a frozen horse
// along the road; motor traffic below moves instead.)
function horseDrawnCart() {
  const g = cart();
  const horse = new THREE.Mesh(
    bakeSpeciesGeometry('horseBay'),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  horse.position.set(4.15, 0, 0);
  horse.rotation.y = Math.PI / 2; // baked horse faces +z; cart shafts face +x
  horse.castShadow = true;
  g.add(horse);
  for (const side of [-1, 1]) {
    const trace = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.0, 4), MAT.darkWood);
    trace.rotation.z = Math.PI / 2;
    trace.position.set(2.9, 0.72, side * 0.42);
    g.add(trace);
  }
  g.name = 'horse-drawn-cart';
  return g;
}

// The rendered road surface: the ribbon crowns 0.16 m over the ground, and
// lifts onto a deck ≥ 1.9 m over the water where it bridges. Anything that
// stands or rolls on the road must use THIS height, not the bare terrain —
// placeOnGround's terrain seat buried a quarter of every wheel.
const ROAD_CROWN = 0.16;
// camber rise from edge to crown, per road class
const CROWN_RISE = [0.095, 0.067, 0.058, 0.04];
// ...and it crowns over the HIGHEST ground under the carriageway, not over
// the centreline. A road is a graded bench: cut on the uphill side, filled on
// the downhill one. Seating the edges off the centreline height instead let
// the uphill edge sink into every hillside the road traversed — 10-12% of all
// carriageway vertices sat under the terrain, up to 1.26 m deep, and the road
// visibly dipped in and out of the ground. `data/roadcheck.mjs` guards this.
function roadBenchY(x, z, dx, dz, half) {
  let m = -Infinity;
  for (const off of [-half, -half * 0.5, 0, half * 0.5, half]) {
    const h = meshHeightAt(x + dz * off, z - dx * off);
    if (h > m) m = h;
  }
  return m + ROAD_CROWN;
}
function waterDeckLevel(x, z) {
  const rv = riverAt(x, z);
  const st = streamAt(x, z);
  let level = -Infinity;
  if (rv && rv.d < rv.hw + 7) level = Math.max(level, rv.level);
  if (st && st.d < st.hw + 4) level = Math.max(level, st.level);
  return level > -Infinity ? level + 1.9 : null;
}
// The mapped main road as a real route: arc-length segments plus a sampler
// that returns position, surface height, heading and grade at any distance
// along it. Used both to park things beside it and to drive things down it.
function mainRoadRoute(era) {
  let road = null, bestLength = 0;
  for (const r of osmRoadsForEra(era)) {
    if (r.c !== 0 || r.pts.length < 2) continue;
    let length = 0;
    for (let i = 0; i < r.pts.length - 1; i++) length += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
    if (length > bestLength) { bestLength = length; road = r; }
  }
  if (!road) return null;
  const segs = [];
  let total = 0;
  for (let i = 0; i < road.pts.length - 1; i++) {
    const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len > 0.1) { segs.push({ ax, az, bx, bz, len, at: total }); total += len; }
  }
  if (!segs.length) return null;
  const at = (distance) => {
    const d = Math.max(0, Math.min(total, distance));
    let lo = 0, hi = segs.length - 1;                 // binary search: runs per frame
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].at <= d) lo = mid; else hi = mid - 1;
    }
    const seg = segs[lo];
    const t = Math.max(0, Math.min(1, (d - seg.at) / seg.len));
    return {
      x: seg.ax + (seg.bx - seg.ax) * t, z: seg.az + (seg.bz - seg.az) * t,
      dx: (seg.bx - seg.ax) / seg.len, dz: (seg.bz - seg.az) / seg.len, s: d,
    };
  };
  // Bridge decks, resolved once: a deck is a plateau over its whole run, so
  // sample the water crossings along the route and dilate them ±16 m. Doing
  // this per frame would mean a channel query per wheel-turn.
  const DS = 4, N = Math.ceil(total / DS) + 1;
  const raw = new Float32Array(N).fill(-Infinity);
  for (let i = 0; i < N; i++) {
    const p = at(i * DS);
    const deck = waterDeckLevel(p.x, p.z);
    if (deck !== null) raw[i] = deck;
  }
  const deck = new Float32Array(N).fill(-Infinity);
  const R = Math.round(16 / DS);
  for (let i = 0; i < N; i++) {
    let m = -Infinity;
    for (let j = Math.max(0, i - R); j <= Math.min(N - 1, i + R); j++) m = Math.max(m, raw[j]);
    deck[i] = m;
  }
  const poseAt = (distance) => {
    const p = at(distance);
    const y0 = meshHeightAt(p.x - p.dx * 2, p.z - p.dz * 2);
    const y1 = meshHeightAt(p.x + p.dx * 2, p.z + p.dz * 2);
    // ride the graded bench, not the bare centreline — on a cross-slope the
    // two differ by up to a metre and the wheels sank into the carriageway
    const ground = roadBenchY(p.x, p.z, p.dx, p.dz, ROAD_HALF_W[0] + (era === 5 ? 1.2 : 0))
      + CROWN_RISE[0];
    const lift = deck[Math.max(0, Math.min(N - 1, Math.round(p.s / DS)))];
    return { ...p, y: Math.max(ground, lift), rot: Math.atan2(-p.dz, p.dx), pitch: Math.atan2(y1 - y0, 4) };
  };
  return { segs, total, poseAt };
}

// Spread `count` sites along the route, each locally searched for dry ground
// clear of buildings and of the other sites.
function mainRoadPoses(route, era, count) {
  if (!route || !count) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const target = route.total * (0.18 + ((i + 0.5) / count) * 0.64);
    let found = null;
    for (let j = 0; j < 18 && !found; j++) {
      const offset = (j ? Math.ceil(j / 2) * (j % 2 ? 1 : -1) : 0) * 55;
      const p = route.poseAt(target + offset);
      if (distToRiver(p.x, p.z) < 18 || distToStreams(p.x, p.z) < 10) continue;
      if (buildingAt(era, p.x, p.z, 3.2)) continue;
      if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 90)) continue;
      found = p;
    }
    if (found) out.push(found);
  }
  return out;
}

// Right-hand lane centre (Latvia drives on the right), offset from the
// surveyed centreline the ribbon is built around.
function laneOffset(p, side = 1, dist = 1.6) {
  return [p.x - p.dz * dist * side, p.z + p.dx * dist * side];
}

// Motor traffic that actually travels: sparse, lane-correct, riding the road
// surface with the road's own grade. A parked car on a highway reads as a
// breakdown; a village with three of them reads as a car park.
function drivingTraffic(group, route, vehicles) {
  if (!route || !vehicles.length) return null;
  const fleet = [];
  for (const v of vehicles) {
    const obj = v.build();
    obj.name = v.name;
    obj.userData.noCollide = true;         // it moves; a frozen AABB would not
    group.add(obj);
    fleet.push({ obj, s: v.s, dir: v.dir, speed: v.speed });
  }
  const place = (car) => {
    const p = route.poseAt(car.s);
    const [lx, lz] = laneOffset(p, car.dir);
    // -0.04: the camber drop from crown to lane centre on a class-0 road
    car.obj.position.set(lx, p.y - 0.04, lz);
    car.obj.rotation.set(0, car.dir > 0 ? p.rot : p.rot + Math.PI,
      car.dir > 0 ? p.pitch : -p.pitch);
  };
  fleet.forEach(place);
  return (t, dt) => {
    for (const car of fleet) {
      car.s += car.speed * car.dir * dt;
      if (car.s > route.total) car.s -= route.total;
      else if (car.s < 0) car.s += route.total;
      place(car);
    }
  };
}

// ---------------------------------------------------------------------------
// The main roads as real draped ribbons: paint alone lands on 17m-spaced
// terrain vertices, so narrow lanes all but vanished. The P30 is paved
// today; the V-roads, lanes and tracks keep their gravel or dirt skin.
function roadRibbons(group, era) {
  if (era < 3) return;
  const mkMat = (color, offset) => roadMaterial(color, offset);
  // roles: 1 per carriageway vertex, 0 per verge/skirt vertex (the skirt
  // tucks into the slope beside a cutting — data/roadcheck.mjs needs to know)
  const surf = {
    asphalt: { mat: mkMat(0x393c40, -2), positions: [], indices: [], roles: [] },
    gravel: { mat: mkMat(0x9d947f, -1), positions: [], indices: [], roles: [] },
    darkGravel: { mat: mkMat(0x8d8570, -1), positions: [], indices: [], roles: [] },
    dirt: {
      mat: roadMaterial(0xffffff,-1,true),
      positions: [], colors: [], indices: [], roles: [],
    },
  };
  const patchSurf = {
    asphalt: { mat: mkMat(0x393c40, -4), positions: [], indices: [], count: 0 },
    gravel: { mat: mkMat(0x9d947f, -4), positions: [], indices: [], count: 0 },
    darkGravel: { mat: mkMat(0x8d8570, -4), positions: [], indices: [], count: 0 },
    dirt: { mat: mkMat(0x7d7558, -4), positions: [], indices: [], count: 0 },
  };
  const bridgeMat = era === 5 ? new THREE.MeshLambertMaterial({ color: 0x9a9a94 }) : MAT.darkWood;
  const bridgeFixtures = [], bridgeCandidates = [], bridgeSites = [];
  let roadRowCount = 0, bridgeRunCount = 0, fixtureClusterCount = 0;
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
      // a run can span a meander neck (two crossings merged): the straight
      // deck must still clear the land between them
      run.floor = [];
      for (let i = run.from; i <= run.to; i++) {
        const [tdx, tdz] = tangentAt(pts, i);
        run.floor.push(roadBenchY(pts[i][0], pts[i][1], tdx, tdz, 4.2) - ROAD_CROWN + 0.14);
      }
    }
    return merged;
  };
  const bridgeAt = (runs, i) => runs.find((run) => i >= run.from && i <= run.to) || null;
  const bridgeYAt = (run, dists, i) => {
    const t = (dists[i] - dists[run.from]) / run.len;
    return Math.max(run.y0 + (run.y1 - run.y0) * t, run.floor[i - run.from] ?? -Infinity);
  };
  // Centreline paint rides the CROWN, so it must use the same graded bench
  // the asphalt does or the dashes sink through their own road.
  const rowYAt = (pts, runs, dists, i, half) => {
    const run = bridgeAt(runs, i);
    if (run) return bridgeYAt(run, dists, i);
    const [x, z] = pts[i];
    const [dx, dz] = tangentAt(pts, i);
    return roadBenchY(x, z, dx, dz, half + 1.2) + CROWN_RISE[0];
  };
  const queueBridgeFixtures = (runs, pts, dists, half, c) => {
    for (const run of runs) {
      const [x0, z0] = pts[run.from], [x1, z1] = pts[run.to];
      bridgeCandidates.push({ run, pts, dists, half, c, x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
    }
  };
  const finishBridgeFixtures = () => {
    const clusters = [];
    for (const candidate of bridgeCandidates) {
      let cluster = clusters.find((q) => Math.hypot(q.x - candidate.x, q.z - candidate.z) <= 40);
      if (!cluster) clusters.push(cluster = { x: candidate.x, z: candidate.z, candidates: [] });
      cluster.candidates.push(candidate);
      const n = cluster.candidates.length;
      cluster.x += (candidate.x - cluster.x) / n;
      cluster.z += (candidate.z - cluster.z) / n;
    }
    for (const cluster of clusters) {
      cluster.candidates.sort((a, b) => a.c - b.c || b.run.len - a.run.len);
      const { run, pts, dists, half } = cluster.candidates[0];
      for (let i = run.from; i < run.to; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
        const len = Math.max(0.001, Math.hypot(x1 - x0, z1 - z0));
        const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
        const y0 = bridgeYAt(run, dists, i), y1 = bridgeYAt(run, dists, i + 1);
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.35, 0.25), bridgeMat);
          rail.position.set((x0 + x1) / 2 - dz * side * (half + 0.18), (y0 + y1) / 2 + 0.18,
            (z0 + z1) / 2 + dx * side * (half + 0.18));
          rail.rotation.y = -Math.atan2(dz, dx);
          rail.castShadow = rail.receiveShadow = true;
          rail.name = "bridge-rail"; bridgeFixtures.push(rail);
        }
      }
      const ends = [run.from, run.to];
      for (const i of ends) {
        const [x, z] = pts[i], [dx, dz] = tangentAt(pts, i);
        const y = bridgeYAt(run, dists, i);
        const ab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, half * 2 + 0.9), bridgeMat);
        ab.position.set(x, y - 0.52, z);
        ab.rotation.y = -Math.atan2(dz, dx);
        ab.castShadow = ab.receiveShadow = true;
        ab.name = "bridge-abutment"; bridgeFixtures.push(ab);
      }
    }
    fixtureClusterCount = clusters.length;
  };
  // Batter the verge down to grade at roughly 45°, so a filled edge reads as
  // a low embankment rather than a floating lip. Returns [offset, y] for the
  // outer skirt vertex on the given side.
  const shoulderVert = (x, z, dx, dz, half, edgeY, side, deckY) => {
    if (deckY !== null) return [half + 0.3, deckY - 0.35];
    const g = meshHeightAt(x + dz * side * half, z - dx * side * half);
    const w = 0.3 + Math.max(0, edgeY - 0.08 - (g + 0.02)) * 0.9;
    const gy = meshHeightAt(x + dz * side * (half + w), z - dx * side * (half + w));
    return [half + w, Math.min(edgeY - 0.08, gy + 0.02)];
  };
  // benchHalf: how wide a strip of ground the bench must clear. The paved
  // P30 carries gravel shoulders 1.2 m beyond the asphalt, and both must be
  // graded off the SAME bench or the shoulder stands proud of its own road.
  const pushCamberedRow = (positions, x, z, dx, dz, half, c, deckY = null, benchHalf = half) => {
    const bench = deckY !== null ? deckY : roadBenchY(x, z, dx, dz, benchHalf);
    const edgeY = deckY !== null ? deckY : bench;
    const crownY = deckY !== null ? deckY : bench + CROWN_RISE[c];
    const [wl, yl] = shoulderVert(x, z, dx, dz, half, edgeY, -1, deckY);
    const [wr, yr] = shoulderVert(x, z, dx, dz, half, edgeY, 1, deckY);
    for (const [off, y] of [[-wl, yl], [-half, edgeY], [0, crownY], [half, edgeY], [wr, yr]]) {
      positions.push(x + dz * off, y, z - dx * off);
    }
  };
  const pushShoulderRow = (positions, x, z, dx, dz, half, deckY = null) => {
    // The gravel shoulders under today's asphalt: same graded bench, sampled
    // over the full shoulder width so the verge cannot bury itself either.
    const bench = deckY !== null ? deckY : roadBenchY(x, z, dx, dz, half + 1.2);
    const edgeY = deckY !== null ? deckY : bench;
    for (const off of [-half - 1.2, -half - 0.9, -half, half, half + 0.9, half + 1.2]) {
      let y = edgeY - Math.max(0, Math.abs(off) - half) * 0.025;
      if (Math.abs(off) > half + 0.9) y = deckY !== null ? deckY - 0.35
        : Math.min(y - 0.08, meshHeightAt(x + dz * off, z - dx * off) + 0.02);
      positions.push(x + dz * off, y, z - dx * off);
    }
  };
  const pushDirtRow = (positions, colors, x, z, dx, dz, half, deckY = null) => {
    const rut = half * 0.45;
    const rows = [
      [-half - 0.25, null, [0.31, 0.26, 0.17]],
      [-half, -CROWN_RISE[3], [0.38, 0.30, 0.20]],
      [-rut, -CROWN_RISE[3] * 0.45, [0.20, 0.15, 0.095]],
      [0, 0, [0.34, 0.29, 0.17]],
      [rut, -CROWN_RISE[3] * 0.45, [0.20, 0.15, 0.095]],
      [half, -CROWN_RISE[3], [0.38, 0.30, 0.20]],
      [half + 0.25, null, [0.31, 0.26, 0.17]],
    ];
    const crownY = deckY !== null ? deckY : roadBenchY(x, z, dx, dz, half) + CROWN_RISE[3];
    for (const [off, lift, rgb] of rows) {
      let y = deckY !== null ? deckY : crownY + (lift ?? -CROWN_RISE[3] - 0.08);
      if (lift === null) y = deckY !== null ? deckY - 0.35
        : Math.min(y, meshHeightAt(x + dz * off, z - dx * off) + 0.02);
      positions.push(x + dz * off, y, z - dx * off);
      colors.push(...rgb);
    }
  };
  for (const r of osmRoadsForEra(era)) {
    const half = ROAD_HALF_W[r.c];
    const pts = roadRows(r);
    if (pts.length < 2) continue;
    roadRowCount += pts.length;
    const dists = roadDists(pts);
    // Mapped ends retain the road width. Tapering every dangling OSM way
    // produced spearheads, including at data boundaries and driveway ends.
    const endK = () => 1;
    const runs = bridgeRuns(pts, dists);
    bridgeRunCount += runs.length;
    for (const run of runs) {
      const a = pts[run.from], b = pts[run.to];
      bridgeSites.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 });
    }
    if (r.c <= 1) queueBridgeFixtures(runs, pts, dists, half, r.c);
    if (r.c === 3) {
      const { positions, colors, indices } = surf.dirt;
      const base = positions.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const [dx, dz] = tangentAt(pts, i);
        const run = bridgeAt(runs, i);
        pushDirtRow(positions, colors, x, z, dx, dz, half * endK(i), run ? bridgeYAt(run, dists, i) : null);
        surf.dirt.roles.push(0, 1, 1, 1, 1, 1, 0);
        if (i > 0) addIndices(indices, base, i, 7);
      }
      continue;
    }
    if (era === 5 && (r.c === 0 || ['asphalt','paved','paving_stones'].includes(r.surface))) {
      {
        const { positions, indices } = surf.gravel;
        const base = positions.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i];
          const [dx, dz] = tangentAt(pts, i);
          const run = bridgeAt(runs, i);
          pushShoulderRow(positions, x, z, dx, dz, half * endK(i), run ? bridgeYAt(run, dists, i) : null);
          surf.gravel.roles.push(0, 1, 1, 1, 1, 0);
          if (i > 0) addIndices(indices, base, i, 6, [0, 1, 3, 4]);
        }
      }
      {
        const { positions, indices } = surf.asphalt;
        const base = positions.length / 3;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i];
          const [dx, dz] = tangentAt(pts, i);
          const run = bridgeAt(runs, i);
          pushCamberedRow(positions, x, z, dx, dz, half * endK(i), r.c,
            run ? bridgeYAt(run, dists, i) : null, half * endK(i) + 1.2);
          surf.asphalt.roles.push(0, 1, 1, 1, 0);
          if (i > 0) {
            addIndices(indices, base, i, 5, [1, 2]);
            if(r.c===0){
              const [px,pz]=pts[i-1],[pdx,pdz]=tangentAt(pts,i-1);
              const ya=rowYAt(pts,runs,dists,i-1,half)-CROWN_RISE[0]+.025;
              const yb=rowYAt(pts,runs,dists,i,half)-CROWN_RISE[0]+.025;
              for(const side of [-1,1]){
                const b=dashPos.length/3,off=side*(half-.23);
                dashPos.push(px+pdz*(off-.055),ya,pz-pdx*(off-.055),px+pdz*(off+.055),ya,pz-pdx*(off+.055),
                  x+dz*(off+.055),yb,z-dx*(off+.055),x+dz*(off-.055),yb,z-dx*(off-.055));
                dashIdx.push(b,b+2,b+1,b,b+3,b+2);
              }
            }
            // dashed centreline on the paved P30: ~3.4m of paint per 18m cycle
            // (the full-span 9m dashes read like runway markings from the air)
            if (r.c === 0 && i % 2 === 0) {
              const b2 = dashPos.length / 3;
              const px = pts[i - 1][0], pz = pts[i - 1][1];
              const sx = px + (x - px) * 0.31, sz = pz + (z - pz) * 0.31;
              const ex = px + (x - px) * 0.69, ez = pz + (z - pz) * 0.69;
              const yPrev = rowYAt(pts, runs, dists, i - 1, half * endK(i - 1));
              const yNow = rowYAt(pts, runs, dists, i, half * endK(i));
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
      pushCamberedRow(positions, x, z, dx, dz, half * endK(i), r.c, run ? bridgeYAt(run, dists, i) : null);
      s.roles.push(0, 1, 1, 1, 0);
      if (i > 0) addIndices(indices, base, i, 5);
    }
  }
  finishBridgeFixtures();
  const convexHull = (points) => {
    const pp = [...new Map(points.map((p) => [`${p[0].toFixed(7)},${p[1].toFixed(7)}`, p])).values()]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pp.length < 3) return pp;
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const lower = [], upper = [];
    for (const p of pp) {
      while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = pp.length - 1; i >= 0; i--) {
      const p = pp[i];
      while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  };
  for (const node of roadJunctionsForEra(era)) {
    const edgePoints = [[node.x, node.z]];
    let dominant = 3;
    for (const arm of node.arms) {
      dominant = Math.min(dominant, arm.c);
      const reach = Math.max(2, arm.halfW * 1.15);
      edgePoints.push(
        [node.x + arm.dx * reach - arm.dz * arm.halfW, node.z + arm.dz * reach + arm.dx * arm.halfW],
        [node.x + arm.dx * reach + arm.dz * arm.halfW, node.z + arm.dz * reach - arm.dx * arm.halfW]);
    }
    const hull = convexHull(edgePoints);
    if (hull.length < 3) continue;
    const key = era === 5 && dominant === 0 ? 'asphalt'
      : dominant <= 1 ? 'gravel' : dominant === 2 ? 'darkGravel' : 'dirt';
    const patch = patchSurf[key], base = patch.positions.length / 3;
    patch.count++;
    // A junction is a flat pad. Hold it at least at the bench height of every
    // arm meeting here, or the ribbons now ride above their own junction.
    let nodeBench = -Infinity;
    const armHalf = Math.max(...node.arms.map((a) => a.halfW));
    for (const arm of node.arms) {
      nodeBench = Math.max(nodeBench, roadBenchY(node.x, node.z, arm.dx, arm.dz, armHalf));
    }
    const yAt = (x, z) => {
      const water = crossingAt(x, z);
      return Math.max(nodeBench, meshHeightAt(x, z) + 0.18, water === null ? -Infinity : water + 1.9);
    };
    patch.positions.push(node.x, yAt(node.x, node.z), node.z);
    for (const [x, z] of hull) patch.positions.push(x, yAt(x, z), z);
    for (let i = 0; i < hull.length; i++) patch.indices.push(base, base + 1 + (i + 1) % hull.length, base + 1 + i);
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
    if (surf[key].roles.length * 3 === positions.length) geo.userData.carriage = Uint8Array.from(surf[key].roles);
    mesh.name = `road-ribbon-${key}`;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const key of ['asphalt', 'gravel', 'darkGravel', 'dirt']) {
    const { mat, positions, indices } = patchSurf[key];
    if (!positions.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `road-junction-${key}`;
    mesh.userData.patchCount = patchSurf[key].count;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const bridgeClusters = [];
  for (const site of bridgeSites) {
    let cluster = bridgeClusters.find((q) => Math.hypot(q.x - site.x, q.z - site.z) <= 40);
    if (!cluster) bridgeClusters.push(cluster = { x: site.x, z: site.z, count: 0 });
    cluster.count++;
    cluster.x += (site.x - cluster.x) / cluster.count;
    cluster.z += (site.z - cluster.z) / cluster.count;
  }
  group.userData.roadNetwork = {
    rows: roadRowCount,
    bridgeRuns: bridgeRunCount,
    bridgeClusters: bridgeClusters.map((q) => [q.x, q.z]),
    fixtureClusters: fixtureClusterCount,
    junctionPatches: Object.values(patchSurf).reduce((sum, p) => sum + p.count, 0),
    halfWidths: ROAD_HALF_W.slice(),
    crossfall: CROWN_RISE.map((rise, c) => rise / ROAD_HALF_W[c]),
  };
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
  const merged = (parts) => {
    const pos = [], norm = [], colors = [];
    for (const { geo: src, color } of parts) {
      const g = src.toNonIndexed();
      const p = g.getAttribute('position'), n = g.getAttribute('normal');
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        norm.push(n.getX(i), n.getY(i), n.getZ(i));
        if (color) colors.push(color[0], color[1], color[2]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    if (colors.length) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeBoundingSphere();
    return g;
  };
  const doorPanel = new THREE.BoxGeometry(1, 1, 0.035);
  doorPanel.translate(0, 0.5, 0);
  const lintel = new THREE.BoxGeometry(1.16, 0.1, 0.09);
  lintel.translate(0, 1.03, 0.025);
  const door = merged([{ geo: doorPanel }, { geo: lintel }]);
  const window = (panes) => {
    const parts = [];
    const glass = new THREE.BoxGeometry(1, 1, 0.025);
    parts.push({ geo: glass, color: [0.055, 0.075, 0.085] });
    const strip = (w, h, x, y) => {
      const q = new THREE.BoxGeometry(w, h, 0.055);
      q.translate(x, y, 0.025);
      parts.push({ geo: q, color: [0.9, 0.88, 0.8] });
    };
    strip(1.12, 0.085, 0, -0.5); strip(1.12, 0.085, 0, 0.5);
    strip(0.085, 1.08, -0.5, 0); strip(0.085, 1.08, 0.5, 0);
    strip(0.055, 0.98, 0, 0);
    if (panes === 6) {
      strip(0.98, 0.05, 0, -1 / 6);
      strip(0.98, 0.05, 0, 1 / 6);
    } else {
      strip(0.98, 0.055, 0, 0);
    }
    return merged(parts);
  };
  bgGeos = { wall, roof, door, window4: window(4), window6: window(6), chimney: new THREE.BoxGeometry(1, 1, 1) };
  return bgGeos;
}

// Final-position rule for things which sit in a farmyard. distToRoadEx is
// already signed from the rendered road edge; retaining the class width as a
// second verge margin keeps small props out of the visually busy road belt.
function propOK(era, x, z, radius = 0.2) {
  if (buildingAt(era, x, z, radius)) return false;
  const road = distToRoadEx(era, x, z);
  if (road.d < ROAD_HALF_W[road.c] + radius) return false;
  const y = heightAt(x, z);
  return !vegExcluded(x, z, y, era, radius);
}

function splitFenceRuns(pts, era) {
  const closed = pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.01;
  const samples = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const steps = Math.max(1, Math.ceil(len / 0.18));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      samples.push({ x, z, seg: s, ok: propOK(era, x, z, 0.6) });
    }
  }
  if (!closed) {
    const [x, z] = pts.at(-1);
    samples.push({ x, z, seg: pts.length - 2, ok: propOK(era, x, z, 0.6) });
  }
  if (!samples.length) return { runs: [], gates: 0, dropped: 0 };
  const dropped = samples.reduce((n, p) => n + !p.ok, 0);
  let gates = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].ok) continue;
    const prev = i ? samples[i - 1].ok : closed ? samples.at(-1).ok : true;
    if (prev) gates++;
  }
  if (!dropped) return { runs: [pts], gates: 0, dropped: 0 };
  const ordered = [];
  if (closed) {
    const cut = samples.findIndex((p) => !p.ok);
    for (let i = 1; i <= samples.length; i++) ordered.push(samples[(cut + i) % samples.length]);
  } else {
    ordered.push(...samples);
  }
  const raw = [];
  let run = [];
  for (const p of ordered) {
    if (p.ok) run.push(p);
    else if (run.length) { raw.push(run); run = []; }
  }
  if (run.length) raw.push(run);
  const runs = raw.map((arr) => {
    const out = [[arr[0].x, arr[0].z]];
    for (let i = 1; i < arr.length - 1; i++) {
      if (arr[i].seg !== arr[i - 1].seg) out.push([arr[i].x, arr[i].z]);
    }
    const last = arr.at(-1);
    if (Math.hypot(last.x - out.at(-1)[0], last.z - out.at(-1)[1]) > 0.2) out.push([last.x, last.z]);
    return out;
  }).filter((arr) => arr.length > 1);
  return { runs, gates, dropped };
}

let grazerGeos = null;
function grazerAssets() {
  if (grazerGeos) return grazerGeos;
  // the REAL animal models, baked mid-graze — the box assemblies read as
  // "a super square cow" the moment anyone flew close
  grazerGeos = {
    cow: bakeSpeciesGeometry('cattleFarm'),
    sheep: bakeSpeciesGeometry('sheepWhite'),
    horse: bakeSpeciesGeometry('horseBay'),
  };
  return grazerGeos;
}

function bgSettlement(group, era, smokes, stageItems = []) {
  const rng = mulberry32(4300 + era * 17);
  const trampleRects = [];   // paddocks: grazed bare by the stock inside
  const props = { hay: [], wood: [], vinda: [], fence: [], boxWell: [], garden: [], tuft: [], cabbage: [], peas: [], cow: [], sheep: [], horse: [] };
  const { wall, roof, door, window4, window6, chimney } = bgAssets();
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
  const fencePoleOK = (px, pz, siteItems, final = false) => {
    if (final) return propOK(era, px, pz, 0.6);
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
    for (const [x, z, w, d, rot, metadata = {}] of BUILDINGS_OSM) {
      if (skip(x, z)) continue;
      const dwelling=['house','detached','residential','apartments'].includes(metadata.kind);
      const it = { x, z, w, d, rot, metadata, big: !dwelling && w * d > 220, kind: 'new' };
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
            trampleRects.push({ x: paddock.x, z: paddock.z, w: paddock.w, d: paddock.d, rot: paddock.rot });
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
            const gardenId = props.garden.length;
            props.garden.push([garden.x, garden.z, garden.rot, gardenId]);
            // A sakņu dārzs is laid out in STRIPS, one crop to a strip.
            // Cabbage, onions, beets, peas, carrots and turnips are what the
            // Piebalga kitchen garden actually held (research/manor-and-
            // interwar.md, "Orchard, Garden, Bees"), with potatoes the
            // 19th-century staple. Rendering every row as the same 22 cm
            // green cone made the whole plot read as one patch of weeds.
            const rows = 3 + ((sr() * 3) | 0);
            for (let gr = 0; gr < rows; gr++) {
              const ox = -garden.w / 2 + ((gr + 1) * garden.w) / (rows + 1);
              const roll = sr();
              // peas and beans climb sticks and stand a metre proud of the
              // rest; cabbages are the unmistakable glaucous ball
              const crop = roll < 0.30 ? 'cabbage' : roll < 0.46 ? 'peas' : 'tuft';
              const spacing = crop === 'cabbage' ? 0.62 : crop === 'peas' ? 0.5 : 0.85;
              for (let lz = -garden.d / 2 + 0.55; lz < garden.d / 2 - 0.3; lz += spacing) {
                const [tx, tz] = localPoint(garden.x, garden.z, garden.rot, ox + (sr() - 0.5) * 0.14, lz + (sr() - 0.5) * 0.18);
                props[crop].push([tx, tz, sr() * 6.3, 0.7 + sr() * 0.45, gardenId]);
              }
            }
          }
        }
      }
    });
  }
  // the planters ask "is there a building here?" — hand them the final,
  // validated footprints (plus the stage rects footprints.js lists itself)
  registerFootprints(era, items.concat(stageItems));
  registerTrample(era, trampleRects);
  const propCandidates = Object.fromEntries(Object.entries(props).map(([kind, arr]) => [kind, arr.length]));
  const keep = (kind, radius) => { props[kind] = props[kind].filter(([x, z]) => propOK(era, x, z, radius)); };
  keep('hay', 1.6); keep('wood', 1.2); keep('vinda', 1.0); keep('boxWell', 0.8);
  keep('cow', 1.0); keep('sheep', 0.75); keep('horse', 1.1);
  props.fence = props.fence.filter(([x, z]) => fencePoleOK(x, z, null, true));
  const keptGardens = new Set();
  props.garden = props.garden.filter(([x, z, , id]) => {
    const ok = propOK(era, x, z, 3.7);
    if (ok) keptGardens.add(id);
    return ok;
  });
  for (const crop of ['tuft', 'cabbage', 'peas']) {
    props[crop] = props[crop].filter(([x, z, , , id]) => keptGardens.has(id) && propOK(era, x, z, 0.16));
  }
  const walls = new THREE.InstancedMesh(wall.clone(), buildingMaterial(false), items.length);
  const roofs = new THREE.InstancedMesh(roof.clone(), buildingMaterial(true), items.length);
  const wallFinishes=new Float32Array(items.length),roofFinishes=new Float32Array(items.length);
  walls.geometry.setAttribute('aFinish',new THREE.InstancedBufferAttribute(wallFinishes,1));
  roofs.geometry.setAttribute('aFinish',new THREE.InstancedBufferAttribute(roofFinishes,1));
  walls.castShadow = roofs.castShadow = true;
  walls.receiveShadow = roofs.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const facades = { door: [], window4: [], window6: [], chimney: [], foundation: [] };
  const facadeAt = (arr, it, parent, lx, ly, lz, ry, sx, sy, sz = 1) => {
    const ca = Math.cos(it.rot), sa = Math.sin(it.rot);
    arr.push({
      x: it.x + lx * ca - lz * sa, y: ly, z: it.z + lx * sa + lz * ca,
      ry: -it.rot + ry, sx, sy, sz, parent,
    });
  };
  items.forEach((it, i) => {
    // seat on the LOWEST footprint corner and stretch the walls up to the
    // highest — a single centre sample floated corners 2m+ on slopes
    let minH = Infinity, maxH = -Infinity;
    for (const [cx, cz] of cornersOf(it)) {
      const hh = meshHeightAt(cx, cz);
      if (hh < minH) minH = hh;
      if (hh > maxH) maxH = hh;
    }
    const y = minH - 0.1;
    const plinth = maxH - minH;
    const levels=it.metadata?.levels;
    const wallH = (levels ? Math.min(5,levels)*2.8 : it.big ? 4.6 + rng() * 1.4 : Math.min(3.4, Math.max(2.3, Math.min(it.w, it.d) * 0.5))) + plinth;
    const roofH = it.metadata?.roof==='flat' ? .12 : Math.min(5.5,Math.min(it.w, it.d) * (era === 3 ? 0.52 : it.big ? .20 : .42));
    wallFinishes[i]=era===5?(i%4===0?1:i%3===0?2:0):2;
    roofFinishes[i]=era===5?i%3===0?1:0:1;
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
    if(it.metadata?.color && /^(#[0-9a-f]{3,6}|white|brown|grey|gray|yellow|red|beige)$/i.test(it.metadata.color))col.set(it.metadata.color);
    if(it.metadata?.material==='wood')wallFinishes[i]=2;
    if(it.metadata?.material==='brick')wallFinishes[i]=1;
    walls.setColorAt(i, col);
    facadeAt(facades.foundation,it,i,0,y+(plinth+.25)/2,0,0,it.w+.08,plinth+.25,it.d+.08);
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
    if(it.metadata?.roofColor && /^(#[0-9a-f]{3,6}|brown|grey|gray|red|black|green)$/i.test(it.metadata.roofColor))col.set(it.metadata.roofColor);
    roofs.setColorAt(i, col);
    const dwelling = it.kind === 'dwell' || it.kind === 'dairy' || (era === 5 && !it.big);
    const alongX = it.w >= it.d;
    const longSpan = alongX ? it.w : it.d;
    const shortSpan = alongX ? it.d : it.w;
    if (dwelling) {
      const doorH = era <= 2 ? 1.45 : era === 3 ? 1.78 : 2.02;
      const doorW = era <= 2 ? 1.22 : 0.94;
      const off = (i % 2 ? -1 : 1) * Math.min(longSpan * 0.22, longSpan / 2 - doorW * 0.7);
      if (alongX) facadeAt(facades.door, it, i, off, y + plinth + 0.02, shortSpan / 2 + 0.045, 0, doorW, doorH);
      else facadeAt(facades.door, it, i, it.w / 2 + 0.045, y + plinth + 0.02, off, Math.PI / 2, doorW, doorH);
    }
    if (era >= 3) {
      let windowCount = dwelling ? 2 + (i % 3) : it.kind === 'barn' || it.big ? (i % 3 === 0 ? 1 : 0) : i % 2;
      if (it.kind === 'klets') windowCount = i % 2;
      if(era===5&&dwelling){
        windowCount=0;
        const floors=Math.max(1,Math.min(4,Math.floor(levels??1)));
        for(let floor=0;floor<floors;floor++)for(const side of [-1,1])for(const axis of [0,1]){
          const span=axis?it.d:it.w,count=Math.max(1,Math.floor(span/3.0));
          for(let j=0;j<count;j++){
            const across=-span/2+(j+.5)*span/count;
            const doorOff=(i%2?-1:1)*Math.min(longSpan*.22,longSpan/2-.94*.7);
            if(floor===0&&side===1&&((alongX&&!axis)||(!alongX&&axis))&&Math.abs(across-doorOff)<1.25)continue;
            const yy=y+plinth+1.55+floor*2.8;
            if(axis)facadeAt(facades.window4,it,i,side*(it.w/2+.048),yy,across,side>0?Math.PI/2:-Math.PI/2,1.03,1.12);
            else facadeAt(facades.window4,it,i,across,yy,side*(it.d/2+.048),side>0?0:Math.PI,1.03,1.12);
          }
        }
      }
      // windows scale with the wall (0.7m panes on a 5m shed read as
      // portholes), and front-wall windows sit OPPOSITE the door — the old
      // ±0.24 span landed j=0 on top of the door whenever i was odd
      const wScale = dwelling ? 1 : Math.min(1.8, Math.max(1, wallH / 2.8));
      const doorSign = i % 2 ? -1 : 1;
      for (let j = 0; j < windowCount; j++) {
        const target = (i + j) % 2 ? facades.window6 : facades.window4;
        const ww = (dwelling ? 0.92 : 0.72) * wScale, wh = (dwelling ? 0.92 : 0.68) * wScale;
        if (j === windowCount - 1 && dwelling) {
          const side = i % 2 ? -1 : 1;
          if (alongX) facadeAt(target, it, i, side * (it.w / 2 + 0.045), y + wallH + roofH * 0.3, 0, Math.PI / 2, ww, wh);
          else facadeAt(target, it, i, 0, y + wallH + roofH * 0.3, side * (it.d / 2 + 0.045), 0, ww, wh);
        } else {
          const side = j % 2 ? -1 : 1;
          // front wall (door side): stay clear of the doorway; back wall: free
          const across = side > 0 && dwelling
            ? -doorSign * 0.28 * longSpan
            : ((j >> 1) ? 0.26 : -0.26) * longSpan;
          if (alongX) facadeAt(target, it, i, across, y + Math.min(1.75, wallH * 0.57), side * (shortSpan / 2 + 0.045), side < 0 ? Math.PI : 0, ww, wh);
          else facadeAt(target, it, i, side * (shortSpan / 2 + 0.045), y + Math.min(1.75, wallH * 0.57), across, side < 0 ? -Math.PI / 2 : Math.PI / 2, ww, wh);
        }
      }
      if (dwelling) {
        const ch = 0.9 + (i % 3) * 0.12;
        facadeAt(facades.chimney, it, i, 0, y + wallH + roofH + .28, 0, 0, 0.55, ch, 0.55);
        it.chimneyTop = y + wallH + roofH + .28 + ch / 2;
      }
    }
  });
  walls.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = true;
  walls.name = `bg-walls-era-${era}`;
  roofs.name = `bg-roofs-era-${era}`;
  group.add(walls, roofs);
  const facadeMesh = (geo, mat, arr, kind) => {
    if (!arr.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, arr.length);
    mesh.name = `bg-facade-${kind}-era-${era}`;
    mesh.userData.facadeKind = kind;
    mesh.userData.parentIndices = arr.map((p) => p.parent);
    arr.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.ry, 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = arr.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    group.add(mesh);
  };
  facadeMesh(door, new THREE.MeshLambertMaterial({ color: 0x201712 }), facades.door, 'door');
  const windowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  facadeMesh(window4, windowMat, facades.window4, 'window-4');
  facadeMesh(window6, windowMat, facades.window6, 'window-6');
  facadeMesh(chimney, new THREE.MeshLambertMaterial({ color: 0x6f4030 }), facades.chimney, 'chimney');
  facadeMesh(chimney, new THREE.MeshLambertMaterial({ color: 0x6e6a60 }), facades.foundation, 'foundation');
  group.userData.backgroundSettlement = {
    era, itemCount: items.length,
    facadeCounts: {
      door: facades.door.length,
      window: facades.window4.length + facades.window6.length,
      chimney: facades.chimney.length,
    },
    propCounts: Object.fromEntries(Object.entries(props).map(([kind, arr]) => [kind, arr.length])),
    propRejected: Object.fromEntries(Object.entries(props).map(([kind, arr]) => [kind, propCandidates[kind] - arr.length])),
    items: items.map(({ x, z, w, d, rot }) => ({ x, z, w, d, rot })),
  };

  // --- yard props, all instanced: haystacks, woodpiles, wells, fences ------
  if (era < 5 && props.hay.length + props.wood.length + props.vinda.length + props.fence.length +
      props.boxWell.length + props.garden.length + props.tuft.length + props.cabbage.length
      + props.peas.length + props.cow.length + props.sheep.length + props.horse.length > 0) {
    const put = (mesh, arr, fill) => {
      if (!arr.length) return;
      arr.forEach((p, i) => { fill(p, i); mesh.setMatrixAt(i, dummy.matrix); });
      mesh.count = arr.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      group.add(mesh);
    };
    if (props.hay.length) {
      // the stage stack's own profile (buildings.haystack): a kaudze built
      // round its pole, bellied low and drawn in to a rounded top — the old
      // 9-sided cone flat-shaded into a tent
      const H = 2.4, prof = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        prof.push(new THREE.Vector2(Math.max(0.02, H * 0.43 * Math.pow(1 - t * t, 0.7) * (1 + 0.05 * Math.sin(t * 13))), H * t - H / 2));
      }
      const hayCone = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 14), MAT.hay, props.hay.length);
      hayCone.name = `bg-prop-hay-era-${era}`;
      hayCone.userData.positions = props.hay;
      put(hayCone, props.hay, ([x, z, r, sc]) => {
        dummy.position.set(x, meshHeightAt(x, z) + 1.2 * sc - 0.05, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    }
    if (props.wood.length) {
      const woodGeo = new THREE.BoxGeometry(2.1, 1.05, 1.0);
      const wood = new THREE.InstancedMesh(woodGeo, MAT.logOld, props.wood.length);
      wood.name = `bg-prop-wood-era-${era}`;
      wood.userData.positions = props.wood;
      put(wood, props.wood, ([x, z, r, sc]) => {
        dummy.position.set(x, meshHeightAt(x, z) + 0.5 * sc, z);
        dummy.rotation.set(0, r, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
      });
    }
    if (props.vinda.length) {
      // vinda: post + counterweighted sweep beam + hanging rod, baked into
      // one transform frame
      const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 6), MAT.logOld, props.vinda.length);
      post.name = `bg-prop-vinda-era-${era}`;
      post.userData.positions = props.vinda;
      const beamGeo = new THREE.CylinderGeometry(0.05, 0.07, 4.8, 5);
      beamGeo.rotateZ(1.05);
      beamGeo.translate(0.9, 3.1, 0);
      const beam = new THREE.InstancedMesh(beamGeo, MAT.lightWood, props.vinda.length);
      const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 4);
      rodGeo.translate(2.9, 2.2, 0);
      const rod = new THREE.InstancedMesh(rodGeo, MAT.lightWood, props.vinda.length);
      props.vinda.forEach(([x, z, r], i) => {
        dummy.position.set(x, meshHeightAt(x, z) + 1.55, z);
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
      shaft.name = `bg-prop-well-era-${era}`;
      shaft.userData.positions = props.boxWell;
      props.boxWell.forEach(([x, z, r], i) => {
        const y = meshHeightAt(x, z);
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
      // Bake each plot directly onto the rendered terrain triangles. The old
      // 4x7 m horizontal plane used one centre height, so sloped gardens had a
      // buried uphill half and a floating downhill half.
      const pos = [], color = [], idx = [];
      for (const [x, z, r] of props.garden) {
        const ca = Math.cos(r), sa = Math.sin(r);
        const base = pos.length / 3;
        const NX = 4, NZ = 7;
        for (let iz = 0; iz <= NZ; iz++) for (let ix = 0; ix <= NX; ix++) {
          const lx = -2 + (ix / NX) * 4, lz = -3.5 + (iz / NZ) * 7;
          const px = x + lx * ca - lz * sa, pz = z + lx * sa + lz * ca;
          pos.push(px, meshHeightAt(px, pz) + 0.035, pz);
          const row = 0.86 + (iz % 2) * 0.08;
          color.push(0.30 * row, 0.23 * row, 0.15 * row);
        }
        for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
          const a = base + iz * (NX + 1) + ix, b = a + 1, c = a + NX + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const gardenGeo = new THREE.BufferGeometry();
      gardenGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gardenGeo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
      gardenGeo.setIndex(idx);
      gardenGeo.computeVertexNormals();
      const gardenMat = new THREE.MeshLambertMaterial({
        vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      const gardens = new THREE.Mesh(gardenGeo, gardenMat);
      gardens.name = `bg-prop-garden-era-${era}`;
      gardens.userData.positions = props.garden;
      gardens.receiveShadow = true;
      group.add(gardens);
    }
    // three crop habits, one instanced mesh each: root-crop haulm (potato,
    // beet, turnip, carrot), cabbage heads, and pea/bean rows up their sticks
    const CROPS = [
      ['tuft', new THREE.ConeGeometry(0.13, 0.34, 5), 0x3c6b2a, 0.17],
      ['cabbage', (() => {
        const cg = new THREE.SphereGeometry(0.17, 7, 5);
        cg.scale(1, 0.62, 1);
        return cg;
      })(), 0x8ba579, 0.11],
      ['peas', new THREE.ConeGeometry(0.11, 0.95, 5), 0x5c8438, 0.47],
    ];
    for (const [key, geo, color, lift] of CROPS) {
      if (!props[key].length) continue;
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), props[key].length);
      mesh.name = `bg-prop-${key}-era-${era}`;
      mesh.userData.positions = props[key];
      put(mesh, props[key], ([x, z, r, sc]) => {
        dummy.position.set(x, meshHeightAt(x, z) + lift * sc, z);
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
      fence.name = `bg-prop-fence-era-${era}`;
      fence.userData.positions = props.fence;
      props.fence.forEach(([x, z, r], i) => {
        dummy.position.set(x, meshHeightAt(x, z) + 0.8, z);
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
    // the baked models carry the real palettes as vertex colours
    const grazerVC = new THREE.MeshLambertMaterial({ vertexColors: true });
    const grazerMat = { cow: grazerVC, sheep: grazerVC, horse: grazerVC };
    const putGrazer = (kind) => {
      if (!props[kind].length) return;
      const mesh = new THREE.InstancedMesh(geos[kind], grazerMat[kind], props[kind].length);
      mesh.name = `bg-prop-${kind}-era-${era}`;
      mesh.userData.positions = props[kind];
      put(mesh, props[kind], ([x, z, r, sc]) => {
        dummy.position.set(x, meshHeightAt(x, z), z);
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
      smokes.push([it.x, it.chimneyTop || meshHeightAt(it.x, it.z) + 4.2, it.z, { rate: 0.3, gray: 0.86 }]);
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
  // on the harmonised channel (the raw OSM points carry DEM levels that
  // differ from the rendered water by up to a metre)
  const i = Math.min(RIVER.samples.length - 1, Math.round((RIVER.samples.length - 1) * t));
  const p = RIVER.samples[i];
  return { x: p[0], z: p[1], r: 30, level: p[2] };
};
// the reach nearest a place, as a spawn home
const reachNear = (x, z, r = 32) => {
  let best = RIVER.samples[0], bd = Infinity;
  RIVER.samples.forEach((p, i) => {
    if (RIVER.lakeRun[i]) return;
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bd) { bd = d; best = p; }
  });
  return { x: best[0], z: best[1], r, level: best[2] };
};
const streamHome = (name, t, r = 22) => {
  const ch = STREAM_CHANNELS.find((c) => c.name === name);
  if (!ch) return null;
  const p = ch.samples[Math.round((ch.samples.length - 1) * t)];
  return { x: p[0], z: p[1], r, level: p[2] };
};
const depthIn = (era, lo, hi = 99) => (x, z) => {
  const d = waterLevelAt(x, z, era) - meshHeightAt(x, z);
  return d >= lo && d <= hi;
};

// Life in and on the water, eras 1-5 — species of the upper Gauja, its
// brooks and the Vidzeme lakes. Everything follows the local water level.
function aquaticSpawns(era, spawns) {
  const lvl = (x, z) => waterLevelAt(x, z, era);
  const swim = (extra = {}) => ({ medium: 'water', levelFn: lvl, ...extra });
  const S2 = LOC.STEAD;
  const lakeHome = { x: LAKE_MAIN.cx, z: LAKE_MAIN.cz, r: 120 };
  const homes = [reachNear(S2.x - 200, S2.z), reachNear(LOC.CAMP.x, LOC.CAMP.z), reachNear(-400, 0),
    reachNear(LOC.DAM.x - LOC.DAM.dx * 90, LOC.DAM.z - LOC.DAM.dz * 90), RIVER_REACH(0.28), RIVER_REACH(0.5), RIVER_REACH(0.66), RIVER_REACH(0.82)];
  const deep = depthIn(era, 0.55), shallows = depthIn(era, 0.03, 0.32), anyWater = depthIn(era, 0.25);
  // fish, seen through the clear shallows: roach shoals, perch, pike in the
  // slow water, grayling on the riffles of the upper river
  homes.forEach((h, i) => {
    spawns.push(['roachShoal', 1, { ...h, r: 26 }, swim({ depth: 0.38, inWater: deep, speed: 0.55 })]);
    if (i % 2 === 0) spawns.push(['fishPerch', 3, h, swim({ depth: 0.45, inWater: deep, speed: 0.7 })]);
  });
  spawns.push(['fishPike', 1, homes[2], swim({ depth: 0.5, inWater: deep, speed: 0.45 })]);
  spawns.push(['fishPike', 1, homes[6], swim({ depth: 0.5, inWater: deep, speed: 0.45 })]);
  spawns.push(['grayling', 3, RIVER_REACH(0.2), swim({ depth: 0.32, inWater: depthIn(era, 0.45, 1.6), speed: 0.8 })]);
  spawns.push(['grayling', 2, homes[0], swim({ depth: 0.32, inWater: depthIn(era, 0.45, 1.6), speed: 0.8 })]);
  // brown trout hold in the brooks
  for (const [name, t] of [['Pīsla', 0.55], ['Dzērbe', 0.4], ['Dzērbe', 0.8]]) {
    const h = streamHome(name, t);
    if (h) spawns.push(['troutBrown', 2, h, swim({ depth: 0.18, inWater: depthIn(era, 0.25), speed: 0.6 })]);
  }
  // the lake: bream shoals over the deep basin, roach in the margins
  spawns.push(['breamShoal', 2, { ...lakeHome, r: 90 }, swim({ depth: 0.9, inWater: depthIn(era, 1.4), speed: 0.35 })]);
  spawns.push(['roachShoal', 2, lakeHome, swim({ depth: 0.4, inWater: deep, speed: 0.5 })]);
  // ducks: mallards everywhere; goosanders are the river's own sawbills;
  // goldeneyes dive on the lake
  spawns.push(['duckM', 2, homes[0], swim({ inWater: anyWater, speed: 0.5 })]);
  spawns.push(['duckF', 2, homes[0], swim({ inWater: anyWater, speed: 0.5 })]);
  spawns.push(['duckM', 2, homes[4], swim({ inWater: anyWater, speed: 0.5 })]);
  spawns.push(['duckF', 1, homes[4], swim({ inWater: anyWater, speed: 0.5 })]);
  spawns.push(['duckGoosanderM', 1, homes[2], swim({ inWater: anyWater, speed: 0.6 })]);
  spawns.push(['duckGoosanderF', 2, homes[2], swim({ inWater: anyWater, speed: 0.6 })]);
  spawns.push(['duckGoosanderM', 1, homes[5], swim({ inWater: anyWater, speed: 0.6 })]);
  spawns.push(['duckGoosanderF', 1, homes[5], swim({ inWater: anyWater, speed: 0.6 })]);
  spawns.push(['duckM', 3, lakeHome, swim({ inWater: inMainLake, speed: 0.5 })]);
  spawns.push(['duckGoldeneyeM', 2, lakeHome, swim({ inWater: inMainLake, speed: 0.5 })]);
  spawns.push(['duckGoldeneyeF', 2, lakeHome, swim({ inWater: inMainLake, speed: 0.5 })]);
  // swans: whoopers bred here before drainage; extirpated by the 1800s;
  // mute swans only colonised Latvia in the 20th century (Engure 1935)
  if (era <= 2) spawns.push(['swanWhooper', 2, lakeHome, swim({ inWater: inMainLake, speed: 0.4 })]);
  if (era >= 5) spawns.push(['swanMute', 3, lakeHome, swim({ inWater: inMainLake, speed: 0.4 })]);
  // grey herons stalk the shallows
  for (const h of [homes[1], homes[3], homes[6]]) spawns.push(['heron', 1, { ...h, r: 40 }, swim({ wade: true, inWater: shallows, speed: 0.14, idleT: 4 })]);
  spawns.push(['heron', 1, lakeHome, swim({ wade: true, inWater: shallows, speed: 0.14, idleT: 4 })]);
  // an otter works the middle river
  spawns.push(['otter', 1, { ...homes[2], r: 60 }, swim({ depth: null, inWater: deep, speed: 0.9, diver: true })]);
  // kingfishers: twigs over the water, straight low flights, plunge dives
  for (const h of [homes[0], homes[3]]) {
    const perches = [];
    for (const [dx, dz] of [[-18, 6], [-6, -14], [9, 12], [17, -5], [2, 20]]) {
      const q = riverAt(h.x + dx, h.z + dz);
      if (!q) continue;
      const nx = -q.dz * q.side, nz = q.dx * q.side;
      const px = q.x + nx * (q.hw + 0.4), pz = q.z + nz * (q.hw + 0.4);
      perches.push([px, q.level + 0.75 + (perches.length % 2) * 0.35, pz]);
    }
    if (perches.length >= 2) spawns.push(['kingfisher', 1, { ...h, r: 30 }, { medium: 'air', fly: 'perch', perches, noGround: true, dives: true, levelFn: lvl }]);
  }
  spawns.push(['frog', 5, { x: homes[1].x + 14, z: homes[1].z, r: 10 }, HOP_FROG]);
  spawns.push(['dragonfly', 6, { x: homes[2].x, z: homes[2].z, r: 26 }, { medium: 'air', fly: 'hawk', alt: [0.6, 2.4] }]);
}
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
  // the river never emptied: fish, ducks, herons, otters, kingfishers
  aquaticSpawns(era, spawns);
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
        pts.push([px, meshHeightAt(px, pz) + 0.95 + (i % 2) * 0.35, pz]);
      }
      pts.push([cx + 4, meshHeightAt(cx + 4, cz - 3) + 4.1, cz - 3]);   // the roof ridge perch
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
    spawns.push(['beaver', 2, rDown, { medium: 'water', levelFn: (x, z) => waterLevelAt(x, z, era), inWater: inRiver, speed: 0.45 }]);
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
    spawns.push(['frog', 4, { x: LOC.DAM.x + LOC.DAM.nx * (LOC.DAM.hw + 4) - LOC.DAM.dx * 40, z: LOC.DAM.z + LOC.DAM.nz * (LOC.DAM.hw + 4) - LOC.DAM.dz * 40, r: 12 }, HOP_FROG]);
    spawns.push(['stork', 2, { x: S2.x - 100, z: S2.z + 150, r: 55 }, { speed: 0.4, grazeBias: 0.55 }]);
    spawns.push(['duckM', 2, { x: LOC.DAM.x - LOC.DAM.dx * 60, z: LOC.DAM.z - LOC.DAM.dz * 60, r: 25 }, { medium: 'water', levelFn: (x, z) => waterLevelAt(x, z, era), inWater: (x, z) => !!pondAt(x, z), speed: 0.5 }]);
  } else {
    // the quiet century: the forest fauna is back
    spawns.push(['roeDeer', 4, forestN, { grazeBias: 0.75 }]);
    spawns.push(['roeBuck', 1, forestN, { grazeBias: 0.75 }]);
    spawns.push(['redDeer', 2, forestS, { grazeBias: 0.78 }]);
    spawns.push(['boar', 3, forestS, { grazeBias: 0.85, speed: 0.7 }]);
    spawns.push(['beaver', 1, rDown, { medium: 'water', levelFn: (x, z) => waterLevelAt(x, z, era), inWater: inRiver, speed: 0.45 }]);
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

// Field parcels as draped decals: the terrain's 17 m vertex paint could
// only ever draw fields as soft ovals. Each parcel is its own small grid,
// seated on the rendered ground, carrying its crop colour and a row
// coordinate the shader draws drill rows, potato ridges or furrows from.
const FIELD_ROW_STYLE = { rye: 0, barley: 0, oats: 0, flax: 0, clover: 1, potato: 2, fallow: 3 };
function fieldDecals(era) {
  const parcels = fieldsForEra(era);
  if (!parcels.length) return null;
  const pos = [], col = [], row = [], idx = [];
  for (const f of parcels) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const nu = Math.max(2, Math.ceil((2 * f.hw) / 6)), nv = Math.max(1, Math.ceil((2 * f.hh) / 6));
    const base = pos.length / 3;
    const [r, g, b] = FIELD_COLORS[f.type];
    // ~0.7: the terrain's detail shader darkens the ground it paints by
    // about that much, and a crop is no brighter than the sward beside it
    const tint = (0.9 + f.tint * 0.18) * 0.7;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = -f.hw + (2 * f.hw * i) / nu, v = -f.hh + (2 * f.hh * j) / nv;
      const x = f.cx + u * c - v * s, z = f.cz + u * s + v * c;
      pos.push(x, meshHeightAt(x, z) + 0.035, z);
      col.push(r * tint, g * tint, b * tint);
      // across-row coordinate, distance in from the nearest end, row style
      row.push(v, f.hw - Math.abs(u), FIELD_ROW_STYLE[f.type] ?? 0);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b2 = a + 1, c2 = a + nu + 2, d = a + nu + 1;
      idx.push(a, b2, c2, a, c2, d);
    }
  }
  // wind every triangle CCW seen from above (rotations mirror some parcels)
  for (let i = 0; i < idx.length; i += 3) {
    const A = idx[i] * 3, B = idx[i + 1] * 3, C = idx[i + 2] * 3;
    if ((pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]) < 0) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 3));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, fieldMaterial());
  mesh.receiveShadow = true;
  mesh.name = 'field-parcels';
  mesh.userData.noCollide = true;
  return mesh;
}

export function buildEra(era, ctx) {
  const g = new THREE.Group();
  g.name = `era${era}`;
  const ticks = [];
  const stageFootprints = [];
  const markBuilding = (x, z, w, d, rot = 0) => stageFootprints.push(stageFootprint(x,z,w,d,rot));
  const refreshFootprints = () => registerFootprints(era, stageFootprints);
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
  if (era >= 2 && era <= 4) { const fd = fieldDecals(era); if (fd) g.add(fd); }
  g.userData.fenceGates = {};
  const addStageFence = (kind, pts, label) => {
    refreshFootprints();
    const split = splitFenceRuns(pts, era);
    split.runs.forEach((run, i) => {
      const fence = kind === 'riku' ? rikuFence(run) : wattleFence(run);
      fence.name = `stage-fence-${label}-${i}`;
      fence.userData.fenceKind = kind;
      fence.userData.fenceLabel = label;
      addRaw(fence);
    });
    g.userData.fenceGates[label] = { openings: split.gates, droppedSamples: split.dropped };
  };

  // ======================= 0 · ~10,800 BC =================================
  if (era === 0) {
    refreshFootprints();
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
    markBuilding(C.x-1.3*Math.sin(-.6), C.z-1.3*Math.cos(-.6), 3.8, 3.2, -0.6);
    refreshFootprints();
    add(campfire({cooking:false}), C.x + 3.4, C.z + 2.2);
    fires.push([C.x + 3.4, meshHeightAt(C.x + 3.4, C.z + 2.2) + 0.15, C.z + 2.2]);
    smokes.push([C.x + 3.4, meshHeightAt(C.x + 3.4, C.z + 2.2) + 0.9, C.z + 2.2, { rate: 1.1, gray: 0.8 }]);
    add(fishRack(), C.x - 3, C.z + 3.5, 0.4);
    add(dugoutCanoe(), riverXAt(C.z + 20) + 7, C.z + 20, 1.2);
    const meadow = { x: S.x - 20, z: S.z + 30, r: 70 };
    spawns.push(['aurochsBull', 1, meadow]);
    spawns.push(['aurochsCow', 3, meadow]);
    spawns.push(['aurochsCalf', 1, meadow]);
    spawns.push(['elk', 2, { x: S.x + 250, z: S.z + 190, r: 50 }]);
  }

  // ======================= 2 · ~AD 950 =====================================
  if (era === 2) {
    addRaw(barrowMounds(BUMPS, 1));
    const dw = add(logCabin({ w: 5, d: 6, wallH: 2.0, roofH: 2.2, roof: 'barkGable', doorEnd: true }), S.x - 5, S.z - 9, 0.15);
    markBuilding(S.x - 5, S.z - 9, 5, 6, 0.15);
    void dw;
    smokes.push([S.x - 5, meshHeightAt(S.x - 5, S.z - 9) + 4.0, S.z - 6.6, { rate: 0.65, gray: 0.74 }]);
    add(logCabin({ w: 4, d: 5, wallH: 1.8, roofH: 1.9, roof: 'barkGable', old: true }), S.x + 10, S.z + 6, 1.62);
    markBuilding(S.x + 10, S.z + 6, 4, 5, 1.62);
    add(postGranary(), S.x + 2, S.z + 13, -0.1);
    markBuilding(S.x + 2, S.z + 13, 3, 3.6, -0.1);
    add(logCabin({ w: 4.5, d: 7, wallH: 1.6, roofH: 2.0, roof: 'thatchGableOld', old: true }), S.x - 14, S.z + 7, 1.55);
    markBuilding(S.x - 14, S.z + 7, 4.5, 7, 1.55);
    addRaw(palisadeRing(LOC.HILLFORT.x, LOC.HILLFORT.z, 17));
    add(logCabin({ w: 3.6, d: 4.4, wallH: 1.7, roofH: 1.8, roof: 'barkGable', old: true }), LOC.HILLFORT.x + 4, LOC.HILLFORT.z - 3, 0.7);
    markBuilding(LOC.HILLFORT.x + 4, LOC.HILLFORT.z - 3, 3.6, 4.4, 0.7);
    // refuge forts held more than one roof: a second dwelling + raised store
    add(logCabin({ w: 3.2, d: 4.0, wallH: 1.6, roofH: 1.7, roof: 'barkGable', old: true }), LOC.HILLFORT.x - 6, LOC.HILLFORT.z + 4, -0.9);
    markBuilding(LOC.HILLFORT.x - 6, LOC.HILLFORT.z + 4, 3.2, 4, -0.9);
    add(postGranary(), LOC.HILLFORT.x - 9, LOC.HILLFORT.z - 7, 1.9);
    markBuilding(LOC.HILLFORT.x - 9, LOC.HILLFORT.z - 7, 3, 3.6, 1.9);
    add(campfire(), S.x + 1.5, S.z - 1);
    fires.push([S.x + 1.5, meshHeightAt(S.x + 1.5, S.z - 1) + 0.15, S.z - 1]);
    smokes.push([S.x + 1.5, meshHeightAt(S.x + 1.5, S.z - 1) + 0.9, S.z - 1, { rate: 1.0, gray: 0.8 }]);
    addStageFence('wattle', [
      [S.x - 20, S.z - 16], [S.x + 16, S.z - 16], [S.x + 18, S.z + 18], [S.x - 8, S.z + 20],
    ], 'stead-wattle');
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
      const fw = 4.2 + fr() * 1.2, fd = 5 + fr() * 1.4;
      add(logCabin({
        w: fw, d: fd, wallH: 1.8, roofH: 2.0,
        roof: fr() < 0.5 ? 'barkGable' : 'thatchGableOld', doorEnd: true, old: true,
      }), f.x, f.z, rot);
      markBuilding(f.x, f.z, fw, fd, rot);
      smokes.push([f.x, meshHeightAt(f.x, f.z) + 3.8, f.z, { rate: 0.45, gray: 0.76 }]);
      if (fr() < 0.7) {
        const gx = f.x + 9 + fr() * 4;
        add(postGranary(), gx, f.z + 6, rot + 1.4);
        markBuilding(gx, f.z + 6, 3, 3.6, rot + 1.4);
      } else {
        add(logCabin({ w: 3.6, d: 4.6, wallH: 1.6, roofH: 1.8, roof: 'barkGable', old: true }), f.x + 10, f.z + 7, rot + 1.6);
        markBuilding(f.x + 10, f.z + 7, 3.6, 4.6, rot + 1.6);
      }
      add(haystack(2.2 + fr()), f.x - 9, f.z + 8);
      addStageFence('wattle', [
        [f.x - 13, f.z - 10], [f.x + 12, f.z - 11], [f.x + 14, f.z + 12],
      ], `farm-${i}-wattle`);
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
    addRaw(barrowMounds(BUMPS, era === 3 ? 0.9 : 0.82));
    const modern = era === 4;
    add(logCabin({
      w: 6.5, d: 12, wallH: 2.5, roofH: 2.9,
      roof: modern ? 'shingleGable' : 'thatchGable',
      hasChimney: true, windows: modern ? 3 : 2,
      windowStyle: modern ? 'framed' : 'dark', porch: modern,
    }), S.x, S.z - 15, Math.PI / 2);
    markBuilding(S.x, S.z - 15, 6.5, 12, Math.PI / 2);
    smokes.push([S.x, meshHeightAt(S.x, S.z - 15) + 6.6, S.z - 13.5, { rate: 0.55, gray: 0.86 }]);
    add(logCabin({ w: 5, d: 8, wallH: 2.2, roofH: 2.3, roof: 'shingleGable', doorEnd: true }), S.x + 21, S.z + 2, -Math.PI / 2);
    markBuilding(S.x + 21, S.z + 2, 5, 8, -Math.PI / 2);
    add(logCabin({ w: 5.5, d: 13, wallH: 1.9, roofH: 2.4, roof: 'thatchGableOld', old: true }), S.x - 21, S.z + 5, 0.03);
    markBuilding(S.x - 21, S.z + 5, 5.5, 13, 0.03);
    add(rija(), S.x + 17, S.z + 36, 0.5);
    markBuilding(S.x + 17, S.z + 36, 8, 13, 0.5);
    const px = riverXAt(S.z + 85) + 16, pz = S.z + 85;
    add(logCabin({ w: 3.4, d: 4.2, wallH: 1.7, roofH: 1.9, roof: 'thatchGableOld', old: true, doorEnd: true }), px, pz, -0.4);
    markBuilding(px, pz, 3.4, 4.2, -0.4);
    smokes.push([px, meshHeightAt(px, pz) + 3.6, pz, { rate: 1.25, gray: 0.66 }]);
    refreshFootprints();
    if (propOK(era, S.x + 7, S.z - 7, 1.0)) add(wellSweep(), S.x + 7, S.z - 7, 0.7);
    addStageFence('riku', [
      [S.x - 27, S.z - 22], [S.x + 27, S.z - 22], [S.x + 28, S.z + 24], [S.x - 27, S.z + 26], [S.x - 27, S.z - 22],
    ], 'stead-riku-ring');
    addStageFence('riku', [[S.x - 27, S.z + 40], [S.x + 5, S.z + 44]], 'stead-riku-north');
    add(laundryLine(), S.x - 8, S.z - 20.5, 0.1);
    if (propOK(era, S.x - 4, S.z - 10, 1.2)) add(woodpile(), S.x - 4, S.z - 10, 0.4);
    add(choppingBlock(), S.x - 2.5, S.z - 8);
    add(cart(), S.x + 14, S.z + 9, -0.5);
    if (propOK(era, S.x - 36, S.z + 42, 2.0)) add(haystack(3.4), S.x - 36, S.z + 42);
    if (propOK(era, S.x - 44, S.z + 34, 1.8)) add(haystack(3), S.x - 44, S.z + 34);
    for (let i = 0; i < 3; i++) add(beehiveLog(), S.x - 20 + i * 4, S.z - 36, i);
    add(rowboat(), riverXAt(S.z + 62) + 6.5, S.z + 62, 1.5);
    const wb = add(bridge(false), BRIDGE.x, BRIDGE.z, 0);
    wb.position.y = riverLevelAt(BRIDGE.z) + 0.2;
    const nb = add(bridge(false), BRIDGE2.x, BRIDGE2.z, Math.PI / 2);
    nb.position.y = BRIDGE2.level + 0.2;
    add(storkNestPole(), S.x + 30, S.z + 22);

    // the manor: old classicist house in 1860; brick new manor from 1888 on
    const mh = add(modern ? manorNew({ flag: false }) : manorHouse({ flag: false }), Mn.x, Mn.z, 0.35);
    markBuilding(Mn.x, Mn.z, modern ? 26 : 30, modern ? 14 : 13, 0.35);
    if (mh.userData.tick) ticks.push(mh.userData.tick);
    if (modern) {
      add(manorHouse({ flag: false }), Mn.x - 105, Mn.z - 15, 0.9);
      markBuilding(Mn.x - 105, Mn.z - 15, 30, 13, 0.9);
    }
    add(manorOutbuilding(22), Mn.x - 52, Mn.z - 14, 0.35 + Math.PI / 2);
    markBuilding(Mn.x - 52, Mn.z - 14, 22, 8, 0.35 + Math.PI / 2);
    add(manorOutbuilding(16), Mn.x + 58, Mn.z - 12, 1.56);
    markBuilding(Mn.x + 58, Mn.z - 12, 16, 8, 1.56);
    add(brewery(), P.x + 58, P.z + 48, Math.PI * 0.72);
    markBuilding(P.x + 58, P.z + 48, 16, 7.5, Math.PI * 0.72);
    smokes.push([Mn.x - 8, meshHeightAt(Mn.x, Mn.z) + 9.6, Mn.z, { rate: 0.4, gray: 0.88 }]);
    // The mill weir spans the Gauja; the mill stands in the far bank just
    // below it, its floor half a storey down so the undershot wheel meets
    // the water a plank flume brings it from the pond.
    {
      const D = LOC.DAM, L = ctx.water.pondLevel, Mi = LOC.MILL;
      const damRot = Math.atan2(-D.nz, D.nx);
      const len = 2 * (D.hw + 7), bed = D.level - 3.3, top = L + 0.35;
      const dam = new THREE.Mesh(new THREE.BoxGeometry(len, top - bed, 2.4), MAT.plank);
      dam.position.set(D.x, (top + bed) / 2, D.z);
      dam.rotation.y = damRot;
      dam.castShadow = dam.receiveShadow = true;
      dam.name = 'mill-dam';
      addRaw(dam);
      // the overflow: a thin glassy sheet down the dam face to the tailrace
      const spillW = D.hw * 1.3, run = 2.2, drop = top - 0.2 - D.level;
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(spillW, Math.hypot(run, drop)),
        new THREE.MeshLambertMaterial({ color: 0xdfe9e6, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      spill.position.set(D.x + D.dx * (1.2 + run / 2), D.level + drop / 2, D.z + D.dz * (1.2 + run / 2));
      spill.rotation.set(0, Math.atan2(D.dx, D.dz), 0);
      spill.rotateX(-Math.PI / 2 + Math.atan2(drop, run));
      spill.name = 'mill-spill';
      addRaw(spill);
      const mill = watermill(L);
      mill.position.set(Mi.x, Mi.base, Mi.z);
      mill.rotation.y = Mi.rot;
      addRaw(mill);
      markBuilding(Mi.x, Mi.z, 8, 7, Mi.rot);
      // flume: from the pond just above the dam to the wheel's axle
      const wheel = new THREE.Vector3(-3.2, 1.2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Mi.rot).add(mill.position);
      const f0 = new THREE.Vector3(D.x + D.nx * (D.hw - 2) - D.dx * 2.5, L - 0.12, D.z + D.nz * (D.hw - 2) - D.dz * 2.5);
      const f1 = new THREE.Vector3(wheel.x, L - 0.12, wheel.z);
      const flen = f0.distanceTo(f1);
      const flume = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, flen), MAT.plank);
      flume.add(floor);
      for (const sd of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, flen), MAT.plank);
        wall.position.set(sd * 0.45, 0.25, 0);
        flume.add(wall);
      }
      for (let k = 1; k < flen / 2.5; k++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), MAT.darkWood);
        post.position.set(0, -1.2, -flen / 2 + k * 2.5);
        flume.add(post);
      }
      flume.position.copy(f0).lerp(f1, 0.5);
      flume.lookAt(f1.x, flume.position.y, f1.z);
      flume.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      flume.name = 'mill-flume';
      addRaw(flume);
    }
    add(churchSilhouette(), LOC.CHURCH.x, LOC.CHURCH.z, 0.8);
    markBuilding(LOC.CHURCH.x, LOC.CHURCH.z, 38, 24, 0.8);

    // Brežģa krogs on the old road south — where the manor's ale was drunk
    add(krogs(), K.x - 16, K.z + 2, 0.28);
    markBuilding(K.x - 16, K.z + 2, 18, 8.5, 0.28);
    smokes.push([K.x - 19, meshHeightAt(K.x - 16, K.z + 2) + 5.2, K.z + 2, { rate: 0.4, gray: 0.85 }]);
    // Jāņi fire pyre on Brežģa kalns — the parish's festival hill
    add(pyre(), B.x, B.z, 0.4);
    fires.push([B.x, meshHeightAt(B.x, B.z) + 0.9, B.z, { intensity: 30, dist: 150, duskOnly: true, scale: 3.6 }]);

    if (modern) {
      add(poemStone(), LOC.STONE.x, LOC.STONE.z, -0.5);
      utilityPoles(g, false);
    }
    bgSettlement(g, modern ? 4 : 3, smokes, stageFootprints);
    roadRibbons(g, modern ? 4 : 3);
    const route = mainRoadRoute(era);
    const parked = mainRoadPoses(route, era, 1)[0];
    if (parked) {
      // drawn up on the verge, clear of the carriageway, horse at the grass —
      // whichever shoulder is free of walls, water and ditch
      const spot = [1, -1]
        .map((side) => laneOffset(parked, side, ROAD_HALF_W[0] + 2.1))
        .find(([vx, vz]) => !buildingAt(era, vx, vz, 3.5)
          && !vegExcluded(vx, vz, heightAt(vx, vz), era, 2));
      if (spot) {
        const cartObj = add(horseDrawnCart(), spot[0], spot[1], parked.rot + 0.14);
        cartObj.rotation.z = parked.pitch;
      }
    }
    if (modern) {
      // 1935: motor traffic on the Cēsis–Madona road was occasional — one car
      const tick = drivingTraffic(g, route, [{
        name: 'interwar-motorcar', build: motorcar1930s,
        s: route.total * 0.42, dir: 1, speed: 9,
      }]);
      if (tick) ticks.push(tick);
    }

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
    addRaw(barrowMounds(BUMPS, 0.72));
    // the farmstead site today: renovated house, the old klēts, a car
    add(modernHouse(), S.x, S.z - 14, Math.PI / 2);
    markBuilding(S.x, S.z - 14, 9.5, 7, Math.PI / 2);
    smokes.push([S.x, meshHeightAt(S.x, S.z - 14) + 5.6, S.z - 14, { rate: 0.3, gray: 0.9 }]);
    add(logCabin({ w: 5, d: 8, wallH: 2.2, roofH: 2.3, roof: 'shingleGable', doorEnd: true, old: true }), S.x + 21, S.z + 2, -Math.PI / 2);
    markBuilding(S.x + 21, S.z + 2, 5, 8, -Math.PI / 2);
    add(car(), S.x + 10, S.z - 4, 0.4);
    add(storkNestPole(), S.x + 30, S.z + 22);
    add(poemStone(), LOC.STONE.x, LOC.STONE.z, -0.5);

    // the manor ensemble survives: new manor (parish house), old manor, outbuildings
    const mh = add(manorNew({ flag: true }), Mn.x, Mn.z, 0.35);
    markBuilding(Mn.x, Mn.z, 26, 14, 0.35);
    if (mh.userData.tick) ticks.push(mh.userData.tick);
    add(manorHouse({ flag: false }), Mn.x - 105, Mn.z - 15, 0.9);
    markBuilding(Mn.x - 105, Mn.z - 15, 30, 13, 0.9);
    add(manorOutbuilding(22), Mn.x - 52, Mn.z - 14, 0.35 + Math.PI / 2);
    markBuilding(Mn.x - 52, Mn.z - 14, 22, 8, 0.35 + Math.PI / 2);
    add(manorOutbuilding(16), Mn.x + 58, Mn.z - 12, 1.56);
    markBuilding(Mn.x + 58, Mn.z - 12, 16, 8, 1.56);
    add(churchSilhouette(), LOC.CHURCH.x, LOC.CHURCH.z, 0.8);
    markBuilding(LOC.CHURCH.x, LOC.CHURCH.z, 38, 24, 0.8);
    const nb = add(bridge(false), BRIDGE2.x, BRIDGE2.z, Math.PI / 2);
    nb.position.y = BRIDGE2.level + 0.2;

    // Brezgis today: two quiet houses where the krogs stood
    add(modernHouse(), K.x - 20, K.z + 6, 0.3);
    markBuilding(K.x - 20, K.z + 6, 9.5, 7, 0.3);
    add(logCabin({ w: 4.5, d: 6, wallH: 2.1, roofH: 2.2, roof: 'shingleGable', old: true }), K.x + 26, K.z - 14, -0.4);
    markBuilding(K.x + 26, K.z - 14, 4.5, 6, -0.4);

    // Brežģa kalns: the 2017 observation tower, the summit oak, the Jāņi pyre
    add(observationTower(), B.x, B.z, 0.2);
    markBuilding(B.x, B.z, 4, 4, 0.2);
    addRaw(gravelEllipse(B.x + 55, B.z - 60, 12, 7, -0.58, 0x9d947f));
    add(infoSign(), B.x + 48, B.z - 52, -0.7);
    add(picnicTable(), B.x + 24, B.z - 18, -0.45);
    add(fireRing(), B.x + 10, B.z - 8, 0.25);
    add(outhouse(), B.x + 38, B.z - 36, 0.55);
    markBuilding(B.x + 38, B.z - 36, 1.4, 1.4, 0.55);
    const roadside = buildRoadside();
    for (const stop of roadside.children) {
      stageFootprints.push(stageFootprint(stop.position.x,stop.position.z,3.6,2.3,stop.rotation.y));
    }
    bgSettlement(g, 5, smokes, stageFootprints);
    roadRibbons(g, 5);
    g.add(roadside);
    const carColors = [0x45576b, 0x6c7068, 0x7a4438, 0x30383c];
    const route5 = mainRoadRoute(5);
    const trafficTick = drivingTraffic(g, route5, mainRoadPoses(route5, 5, 4).map((p, i) => ({
      name: 'mapped-road-car',
      build: () => car(carColors[i % carColors.length]),
      s: p.s, dir: i % 2 ? -1 : 1, speed: 15 + (i % 3) * 2.5,
    })));
    if (trafficTick) ticks.push(trafficTick);
    add(pyre(), B.x + 22, B.z + 10, 0.4);
    fires.push([B.x + 22, meshHeightAt(B.x + 22, B.z + 10) + 0.9, B.z + 10, { intensity: 30, dist: 150, duskOnly: true, scale: 3.6 }]);

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
  if (era < 3) refreshFootprints();
  g.userData.stageFootprintCount = stageFootprints.length;
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
        rec.group.position.y = meshHeightAt(home.x, home.z) + 5.75;
      } else {
        mgr.spawn(kind, home, opts);
      }
    }
  }
}
