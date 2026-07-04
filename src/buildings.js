// Parametric vernacular architecture of the Vidzeme countryside:
// corner-notched log buildings, thatch/shingle/tile roofs, the klēts on
// posts, the well-sweep (vinda), riķu fences, the manor, the watermill.
import * as THREE from 'three';
import { MAT } from './textures.js';
import { heightAt } from './terrain.js';
import { makeNoise } from './util.js';

const rng = makeNoise(606).rng;

function shadowize(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function placeOnGround(g, x, z, rotY = 0, sink = 0.08) {
  g.position.set(x, heightAt(x, z) - sink, z);
  g.rotation.y = rotY;
  return g;
}

// --- roof primitives --------------------------------------------------------
// One closed roof solid: eaves rectangle + ridge segment. ridgeHalf = D gives
// a gable (vertical closed ends); ridgeHalf < D gives a hip.
function roofSolid(w, d, h, mat, over, ridgeHalf) {
  const W = w / 2 + over, D = d / 2 + over;
  const R = Math.min(ridgeHalf, D);
  // slight eave drop so the overhang slopes with the roof plane
  const drop = (over / (w / 2)) * h * 0.8;
  const pos = [
    -W, -drop, -D, W, -drop, -D, W, -drop, D, -W, -drop, D,   // eaves corners
    0, h, -R, 0, h, R,                                        // ridge ends
  ];
  // faces: two slopes (quads) + two ends (triangles) — non-indexed for crisp edges
  const quads = [
    [0, 4, 5, 3],   // west slope (x<0)
    [1, 2, 5, 4],   // east slope (x>0)
  ];
  const tris = [
    [0, 1, 4],      // north end
    [2, 3, 5],      // south end
  ];
  const verts = [], uvs = [];
  const push = (i) => {
    verts.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    uvs.push((pos[i * 3] + pos[i * 3 + 1]) / 3.2, pos[i * 3 + 2] / 3.2);
  };
  for (const [a, b, c, dd] of quads) { push(a); push(b); push(c); push(a); push(c); push(dd); }
  for (const [a, b, c] of tris) { push(a); push(b); push(c); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.material.side = THREE.DoubleSide;
  return mesh;
}
function gableRoof(w, d, h, mat, over = 0.45) {
  return roofSolid(w, d, h, mat, over, d / 2 + over);
}
function hipRoof(w, d, h, mat, over = 0.5) {
  return roofSolid(w, d, h, mat, over, Math.max(0.1, (d - w) / 2));
}
function chimney(h = 1.6) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.7), MAT.plaster);
  c.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.9), MAT.stone);
  cap.position.y = h + 0.08;
  g.add(c, cap);
  return g;
}
function cornerLogs(w, d, wallH) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6);
  geo.rotateZ(Math.PI / 2);
  const rows = Math.floor(wallH / 0.24);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, rows * 8);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const y = 0.12 + r * 0.24;
    const along = r % 2 === 0;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      dummy.position.set(sx * w / 2 + (along ? 0 : sx * 0.09), y, sz * d / 2 + (along ? sz * 0.09 : 0));
      dummy.rotation.set(0, along ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
  }
  mesh.count = i;
  g.add(mesh);
  return g;
}

// --- the log building family ------------------------------------------------
export function logCabin({
  w = 6, d = 8, wallH = 2.2, roofH = 2.4, roof = 'thatchGable', old = false,
  hasChimney = false, windows = 0, windowStyle = 'dark', doorEnd = false, porch = false,
} = {}) {
  const g = new THREE.Group();
  const wallMat = old ? MAT.logOld : MAT.log;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
  walls.position.y = wallH / 2;
  g.add(walls, cornerLogs(w, d, wallH));

  const roofMat = { thatchGable: MAT.thatch, thatchGableOld: MAT.thatchOld, shingleGable: MAT.shingle, tileGable: MAT.tile }[roof] || MAT.thatch;
  if (roof.includes('Hip')) {
    const r = hipRoof(w, d, roofH, roof.includes('thatch') ? (old ? MAT.thatchOld : MAT.thatch) : MAT.shingle);
    r.position.y = wallH;
    g.add(r);
  } else {
    // gable runs along the long axis (d)
    const r = gableRoof(w, d, roofH, roofMat);
    r.position.y = wallH;
    g.add(r);
  }

  // door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.12), MAT.door);
  if (doorEnd) door.position.set(0, 0.88, d / 2 + 0.04);
  else door.position.set(w / 2 + 0.04, 0.88, 0);
  if (!doorEnd) door.rotation.y = Math.PI / 2;
  g.add(door);

  // windows on the long sides
  for (let i = 0; i < windows; i++) {
    const zoff = (i - (windows - 1) / 2) * (d / (windows + 0.4));
    for (const side of [1, -1]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.86, 0.7), windowStyle === 'framed' ? MAT.white : MAT.darkWood);
      fr.position.set(side * (w / 2 + 0.03), wallH * 0.62, zoff);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.56), windowStyle === 'framed' ? MAT.glass : MAT.door);
      gl.position.set(side * (w / 2 + 0.07), wallH * 0.62, zoff);
      g.add(fr, gl);
    }
  }
  if (hasChimney) {
    const ch = chimney(roofH * 0.8 + 0.7);
    ch.position.set(0, wallH + roofH * 0.45, -d * 0.12);
    g.add(ch);
  }
  if (porch) {
    const p = new THREE.Group();
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 6), MAT.lightWood);
      col.position.set(w / 2 + 0.9, 0.95, s * 0.9);
      p.add(col);
    }
    const pr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 2.6), MAT.shingle);
    pr.position.set(w / 2 + 0.75, 1.95, 0);
    pr.rotation.z = 0.28;
    p.add(pr);
    g.add(p);
  }
  return shadowize(g);
}

// klēts raised on posts / stones (Iron Age & later granary)
export function postGranary({ w = 3, d = 3.6, wallH = 1.8 } = {}) {
  const g = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6), MAT.logOld);
    post.position.set(sx * (w / 2 - 0.3), 0.45, sz * (d / 2 - 0.3));
    g.add(post);
  }
  const body = logCabin({ w, d, wallH, roofH: 1.5, roof: 'thatchGable', doorEnd: true });
  body.position.y = 0.9;
  g.add(body);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.8), MAT.darkWood);
  steps.position.set(0, 0.25, d / 2 + 0.5);
  g.add(steps);
  return shadowize(g);
}

// rija — the great threshing barn, roof nearly to the ground
export function rija() {
  const g = logCabin({ w: 8, d: 13, wallH: 1.9, roofH: 4.6, roof: 'thatchGableOld', old: true, doorEnd: true });
  return g;
}

export function wellSweep() {
  const g = new THREE.Group();
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), MAT.logOld);
  fork.position.y = 1.7;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), MAT.logOld);
  box.position.set(1.6, 0.4, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 5.6, 6), MAT.lightWood);
  pole.position.y = 3.3;
  pole.rotation.z = -0.5;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 5), MAT.lightWood);
  rod.position.set(2.15, 2.2, 0);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 8), MAT.darkWood);
  bucket.position.set(2.15, 0.95, 0);
  g.add(fork, box, pole, rod, bucket);
  g.userData.tick = (t) => {
    const a = -0.5 + Math.sin(t * 0.32) * 0.045;
    pole.rotation.z = a;
    const tipX = Math.sin(-a) * 2.6 * 0.83, tipY = 3.3 + Math.cos(a) * 0; // approximate sway
    rod.position.x = 2.15 + Math.sin(t * 0.32) * 0.1 + tipX * 0;
    bucket.position.x = rod.position.x;
    void tipY;
  };
  return shadowize(g);
}

// riķu žogs — slanted-pole fence between paired stakes
export function rikuFence(pts, spacing = 0.55) {
  const g = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.05, 2.0, 4);
  const total = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = (bx - ax) / len, nz = (bz - az) / len;
    for (let dl = 0; dl < len; dl += spacing) total.push([ax + nx * dl, az + nz * dl, Math.atan2(nx, nz)]);
  }
  const mesh = new THREE.InstancedMesh(poleGeo, MAT.logOld, total.length + Math.ceil(total.length / 5) * 2);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  total.forEach(([x, z, dir], k) => {
    const y = heightAt(x, z);
    dummy.position.set(x, y + 0.75, z);
    dummy.rotation.set(0.6, dir, 0);                            // the slant
    dummy.scale.setScalar(0.95 + rng() * 0.15);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
    if (k % 5 === 0) {                                          // paired upright stakes
      for (const off of [-0.12, 0.12]) {
        dummy.position.set(x + Math.cos(dir) * off, y + 0.6, z - Math.sin(dir) * off);
        dummy.rotation.set(0, dir, 0);
        dummy.scale.setScalar(0.75);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
  });
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// woven wattle fence (Iron Age yards)
export function wattleFence(pts) {
  const g = new THREE.Group();
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const y = heightAt(mx, mz);
    for (let r = 0; r < 3; r++) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 4), MAT.lightWood);
      rail.position.set(mx, y + 0.32 + r * 0.28 + Math.sin(s * 3 + r) * 0.03, mz);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = -Math.atan2(bz - az, bx - ax);
      g.add(rail);
    }
    const nposts = Math.max(2, Math.round(len / 1.1));
    for (let p = 0; p <= nposts; p++) {
      const x = ax + (bx - ax) * (p / nposts), z = az + (bz - az) * (p / nposts);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.15, 4), MAT.logOld);
      post.position.set(x, heightAt(x, z) + 0.55, z);
      g.add(post);
    }
  }
  return shadowize(g);
}

// --- manor / school ----------------------------------------------------------
export function manorHouse({ flag = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(30, 5.2, 13), MAT.plaster);
  body.position.y = 2.6;
  g.add(body);
  const roof = hipRoof(13, 30, 3.4, MAT.tile, 0.7);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 5.2;
  g.add(roof);
  for (const dx of [-8, 8]) {
    const ch = chimney(2.2);
    ch.position.set(dx, 7.1, 0);
    g.add(ch);
  }
  // portico
  const ped = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.4), MAT.plaster);
  ped.position.set(0, 5.0, 7.1);
  const pedTri = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(0, 1.6),
  ])), MAT.plaster);
  pedTri.position.set(0, 5.2, 7.28);
  g.add(ped, pedTri);
  for (let i = 0; i < 4; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.6, 10), MAT.white);
    col.position.set(-3 + i * 2, 2.3, 7.0);
    g.add(col);
  }
  const steps = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 2.2), MAT.stone);
  steps.position.set(0, 0.3, 7.6);
  g.add(steps);
  // windows: two rows front & back
  for (const side of [1, -1]) {
    for (let i = 0; i < 8; i++) {
      if (side > 0 && (i === 3 || i === 4)) continue;           // door bay
      const x = -12.7 + i * 3.65;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.0, 0.1), MAT.white);
      fr.position.set(x, 2.7, side * 6.55);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.75, 0.08), MAT.glass);
      gl.position.set(x, 2.7, side * 6.62);
      g.add(fr, gl);
    }
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 0.15), MAT.door);
  door.position.set(0, 1.4, 6.6);
  g.add(door);

  if (flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 8, 6), MAT.white);
    pole.position.set(14, 4, 10);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.2, 10, 4);
    const fl = new THREE.Mesh(flagGeo, MAT.flagRed);
    fl.position.set(15.25, 7.4, 10);
    g.add(pole, fl);
    const base = flagGeo.attributes.position.array.slice();
    g.userData.tick = (t) => {
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 2.4 + t * 5) * 0.1 * (x + 1.2) * 0.5);
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    };
  }
  return shadowize(g);
}

export function manorOutbuilding(len = 20) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 8), MAT.stone);
  base.position.y = 0.7;
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 8), MAT.plaster);
  top.position.y = 2.3;
  g.add(base, top);
  const roof = gableRoof(8, len, 2.6, MAT.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 3.2;
  g.add(roof);
  return shadowize(g);
}

export function watermill(pondLevel) {
  const g = new THREE.Group();
  const house = logCabin({ w: 5, d: 6.5, wallH: 3, roofH: 2.2, roof: 'shingleGable', old: true, windows: 1 });
  g.add(house);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 18), MAT.darkWood);
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.8), MAT.darkWood);
    const a = (i / 8) * Math.PI * 2;
    paddle.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
    paddle.rotation.z = a;
    wheel.add(paddle);
  }
  wheel.position.set(-3.2, 1.2, 0);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
  g.userData.tick = (t) => { wheel.rotation.x = t * 0.7; };
  void pondLevel;
  return shadowize(g);
}

export function bridge(simple = false) {
  const g = new THREE.Group();
  if (simple) {
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 26, 7), MAT.logOld);
    log1.rotation.z = Math.PI / 2;
    log1.position.y = 0.5;
    const log2 = log1.clone();
    log2.position.set(0, 0.5, 0.5);
    g.add(log1, log2);
  } else {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 3.6), MAT.plank);
    deck.position.y = 1.2;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 28, 5), MAT.lightWood);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 2.1, s * 1.7);
      g.add(rail);
      for (let i = -3; i <= 3; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), MAT.darkWood);
        post.position.set(i * 4, 1.7, s * 1.7);
        g.add(post);
      }
    }
    for (const px of [-9, 0, 9]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 2.6, 6), MAT.logOld);
      pile.position.set(px, 0, 0);
      g.add(pile);
    }
  }
  return shadowize(g);
}

// --- small life props --------------------------------------------------------
export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rng() * 0.08), MAT.stone);
    st.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    g.add(st);
  }
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.9, 4), MAT.darkWood);
    const a = (i / 3) * Math.PI * 2;
    stick.position.set(Math.cos(a) * 0.32, 0.8, Math.sin(a) * 0.32);
    stick.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * -0.4);
    g.add(stick);
  }
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, 2.1), MAT.iron);
  pot.position.y = 0.62;
  g.add(pot);
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
  ember.position.y = 0.06;
  ember.name = 'ember';
  g.add(ember);
  return shadowize(g);
}

export function haystack(h = 3.2) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h + 0.7, 5), MAT.logOld);
  pole.position.y = (h + 0.7) / 2;
  const hay = new THREE.Mesh(new THREE.ConeGeometry(h * 0.45, h, 9), MAT.hay);
  hay.position.y = h / 2 + 0.15;
  g.add(pole, hay);
  return shadowize(g);
}

export function woodpile() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, MAT.lightWood, 36);
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9 - r; c++) {
    dummy.position.set((c - (8 - r) / 2) * 0.19, 0.1 + r * 0.165, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
  }
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

export function choppingBlock() {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 8), MAT.logOld);
  stump.position.y = 0.27;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.75, 5), MAT.lightWood);
  handle.position.set(0.05, 0.85, 0);
  handle.rotation.z = 0.5;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), MAT.iron);
  head.position.set(-0.11, 1.14, 0);
  g.add(stump, handle, head);
  return shadowize(g);
}

export function dugoutCanoe() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 4.6, 8, 1, false), MAT.logOld);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.6);
  hull.position.y = 0.25;
  const hollow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 0.4), new THREE.MeshLambertMaterial({ color: 0x241a10 }));
  hollow.position.y = 0.45;
  g.add(hull, hollow);
  return shadowize(g);
}

export function rowboat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 4.2, 7), MAT.plank);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 1, 0.5);
  hull.position.y = 0.3;
  g.add(hull);
  return shadowize(g);
}

export function cart() {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 1.3), MAT.plank);
  bed.position.y = 0.85;
  g.add(bed);
  for (const [dx, dz] of [[-0.9, 0.75], [-0.9, -0.75], [0.9, 0.75], [0.9, -0.75]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), MAT.darkWood);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(dx, 0.55, dz);
    g.add(wheel);
  }
  const shafts = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4), MAT.lightWood);
  shafts.rotation.z = Math.PI / 2 - 0.15;
  shafts.position.set(2.2, 0.75, 0.4);
  g.add(shafts.clone(), shafts.translateZ(-0.8));
  return shadowize(g);
}

export function beehiveLog() {
  const g = new THREE.Group();
  const hive = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.4, 8), MAT.logOld);
  hive.position.y = 0.9;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.4, 8), MAT.thatchOld);
  cap.position.y = 1.8;
  g.add(hive, cap);
  return shadowize(g);
}

export function laundryLine() {
  const g = new THREE.Group();
  const cloths = [];
  for (const px of [-2.2, 2.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.9, 5), MAT.logOld);
    post.position.set(px, 0.95, 0);
    g.add(post);
  }
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.4, 3), MAT.darkWood);
  line.rotation.z = Math.PI / 2;
  line.position.y = 1.78;
  g.add(line);
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(0.85, 1.05, 6, 6);
    const cl = new THREE.Mesh(geo, MAT.cloth);
    cl.position.set(-1.4 + i * 1.4, 1.25, 0);
    g.add(cl);
    cloths.push({ geo, base: geo.attributes.position.array.slice(), phase: i * 2.1 });
  }
  g.userData.tick = (t) => {
    for (const c of cloths) {
      const p = c.geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = c.base[i * 3], y = c.base[i * 3 + 1];
        p.setZ(i, Math.sin(t * 2.2 + c.phase + x * 2) * 0.12 * (0.55 - y));
      }
      p.needsUpdate = true;
    }
  };
  return shadowize(g);
}

export function poemStone() {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 1), MAT.stone);
  rock.position.y = 0.6;
  rock.scale.set(1, 0.85, 0.8);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0x6d5a2e }));
  plaque.position.set(0, 0.72, 0.72);
  plaque.rotation.x = -0.15;
  g.add(rock, plaque);
  return shadowize(g);
}

export function storkNestPole() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), MAT.logOld);
  pole.position.y = 2.7;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 5, 12), MAT.darkWood);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = 5.45;
  const nest = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 5, 12), MAT.hay);
  nest.rotation.x = Math.PI / 2;
  nest.position.y = 5.6;
  g.add(pole, wheel, nest);
  return shadowize(g);
}

export function churchSilhouette() {
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 12), MAT.plaster);
  nave.position.y = 4.5;
  const naveRoof = gableRoof(12, 24, 5, MAT.tile);
  naveRoof.rotation.y = Math.PI / 2;
  naveRoof.position.y = 9;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 8), MAT.plaster);
  tower.position.set(14, 8, 0);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(4.4, 12, 8), MAT.iron);
  spire.position.set(14, 22, 0);
  g.add(nave, naveRoof, tower, spire);
  return g;
}

// stone/wooden grave markers on the barrows
export function barrowStones(bumps) {
  const g = new THREE.Group();
  for (const b of bumps) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rng() * 0.2), MAT.stone);
    st.position.set(b.x + (rng() - 0.5) * 2, heightAt(b.x, b.z) + 0.15, b.z + (rng() - 0.5) * 2);
    g.add(st);
  }
  return shadowize(g);
}
