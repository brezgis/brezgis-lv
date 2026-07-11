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

function wallBox(axis, w, h, depth, along, y, normal, mat) {
  const geo = axis === 'z'
    ? new THREE.BoxGeometry(w, h, depth)
    : new THREE.BoxGeometry(depth, h, w);
  const m = new THREE.Mesh(geo, mat);
  if (axis === 'z') m.position.set(along, y, normal);
  else m.position.set(normal, y, along);
  return m;
}

function addDoor(g, { axis = 'z', face, along = 0, w = 0.9, h = 1.7, lintel = true, threshold = true, double = false }) {
  const side = Math.sign(face) || 1;
  // Leaf face is 0.07m behind the lintel face, but clear of the wall plane.
  const leaf = wallBox(axis, w, h, 0.04, along, h / 2, face + side * 0.03, MAT.door);
  g.add(leaf);
  if (lintel) g.add(wallBox(axis, w + 0.2, 0.14, 0.12, along, h + 0.07, face + side * 0.06, MAT.darkWood));
  if (threshold) g.add(wallBox(axis, w + 0.24, 0.12, 0.34, along, 0.06, face + side * 0.17, MAT.stone));
  if (double) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.035, h * 0.88), MAT.darkWood);
    if (axis === 'z') seam.position.set(along, h * 0.5, face + side * 0.052);
    else seam.position.set(face + side * 0.052, h * 0.5, along);
    seam.rotation.y = axis === 'z' ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2;
    g.add(seam);
  }
}

function addWindow(g, { axis = 'z', face, along, y, w = 1, h = 1.4, trim = MAT.white, panes = 6 }) {
  const side = Math.sign(face) || 1;
  const innerW = w - 0.18, innerH = h - 0.18;
  const fr = wallBox(axis, w, h, 0.08, along, y, face + side * 0.045, trim);
  const gl = wallBox(axis, innerW, innerH, 0.018, along, y, face + side * 0.058, MAT.glass);
  g.add(fr, gl);
  const addBar = (bw, bh, da, dy) => {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), trim);
    if (axis === 'z') bar.position.set(along + da, y + dy, face + side * 0.087);
    else bar.position.set(face + side * 0.087, y + dy, along + da);
    bar.rotation.y = axis === 'z' ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2;
    g.add(bar);
  };
  addBar(0.035, innerH, 0, 0);
  if (panes === 6) {
    addBar(innerW, 0.035, 0, -innerH / 6);
    addBar(innerW, 0.035, 0, innerH / 6);
  } else addBar(innerW, 0.035, 0, 0);
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

  const roofMat = { thatchGable: MAT.thatch, thatchGableOld: MAT.thatchOld, shingleGable: MAT.shingle, tileGable: MAT.tile, barkGable: MAT.bark }[roof] || MAT.thatch;
  if (roof.includes('Hip')) {
    const r = hipRoof(w, d, roofH, roof.includes('thatch') ? (old ? MAT.thatchOld : MAT.thatch) : MAT.shingle);
    r.position.y = wallH;
    g.add(r);
  } else {
    // gable runs along the long axis (d)
    const r = gableRoof(w, d, roofH, roofMat);
    r.position.y = wallH;
    g.add(r);
    if (roof === 'barkGable') {
      // bark sheets are held down by weight poles laid along the slope (Āraiši)
      const slope = Math.atan2(roofH, w / 2 + 0.45);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const t = 0.28 + k * 0.26;
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, d + 0.8, 5), MAT.logOld);
          pole.rotation.x = Math.PI / 2;
          pole.position.set(s * (w / 2 + 0.45) * t, wallH + roofH * (1 - t) + 0.1, 0);
          pole.rotation.z = 0;
          void slope;
          g.add(pole);
        }
      }
    }
  }

  addDoor(g, doorEnd ? { face: d / 2 } : { axis: 'x', face: w / 2 });

  // windows on the long sides
  const whitePanes = windowStyle === 'framed' || hasChimney;
  for (let i = 0; i < windows; i++) {
    const zoff = (i - (windows - 1) / 2) * (d / (windows + 0.4));
    for (const side of [1, -1]) {
      addWindow(g, {
        axis: 'x', face: side * w / 2, along: zoff, y: wallH * 0.62, w: 0.7, h: 0.86,
        trim: whitePanes ? MAT.white : MAT.darkWood,
        panes: whitePanes ? 6 : 4,
      });
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
      addWindow(g, { face: side * 6.5, along: x, y: 2.7, w: 1.15, h: 2.0 });
    }
  }
  addDoor(g, { face: 6.5, w: 2, h: 2.8, threshold: false });

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
  addDoor(g, { face: 4, w: 1.6, h: 2.25, double: true });
  for (const side of [1, -1]) {
    for (const f of [-0.36, -0.12, 0.12, 0.36]) {
      addWindow(g, { face: side * 4, along: f * len, y: 2.3, w: 0.9, h: 1.25 });
    }
  }
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
    // 34m deck + sloped approach ramps: the channel carve is sub-waterline
    // out to ±16m, so the old 28m deck ended standing in open water
    const deck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 3.6), MAT.plank);
    deck.position.y = 1.2;
    g.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 34, 5), MAT.lightWood);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 2.1, s * 1.7);
      g.add(rail);
      for (let i = -4; i <= 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), MAT.darkWood);
        post.position.set(i * 4.2, 1.7, s * 1.7);
        g.add(post);
      }
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 3.6), MAT.plank);
      ramp.position.set(s * 21.4, 0.64, 0);
      ramp.rotation.z = s * -0.13;
      g.add(ramp);
    }
    for (const px of [-13, -4.5, 4.5, 13]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 2.9, 6), MAT.logOld);
      pile.position.set(px, -0.1, 0);
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
  addDoor(g, { axis: 'x', face: 18, w: 2.2, h: 3.2 });
  for (const side of [1, -1]) {
    for (const x of [-8, -2, 5]) addWindow(g, { face: side * 6, along: x, y: 5, w: 1.4, h: 3.6 });
  }
  addWindow(g, { axis: 'x', face: 18, along: 0, y: 11.5, w: 1.25, h: 2.2, panes: 4 });
  return g;
}

// palisade ring for the hillfort refuge (Lejstupu pilskalns)
export function palisadeRing(cx, cz, radius = 17) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.09, 0.11, 2.4, 5);
  const N = Math.floor((2 * Math.PI * radius) / 0.28);
  const mesh = new THREE.InstancedMesh(geo, MAT.logOld, N);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    if (a > 5.6 && a < 5.95) continue;                        // gate gap (NE)
    const x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
    dummy.position.set(x, heightAt(x, z) + 1.05, z);
    dummy.rotation.set((rng() - 0.5) * 0.06, 0, (rng() - 0.5) * 0.06);
    dummy.scale.setScalar(0.9 + rng() * 0.25);
    dummy.updateMatrix();
    mesh.setMatrixAt(i++, dummy.matrix);
  }
  mesh.count = i;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// the 1888 neo-Renaissance new manor (arch. R. G. Šmēlings), two-tone brick
export function manorNew({ flag = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(24, 7.4, 11), MAT.brick);
  body.position.y = 3.7;
  g.add(body);
  // central risalit with a low gable
  const ris = new THREE.Mesh(new THREE.BoxGeometry(7.5, 8.4, 12.6), MAT.brick);
  ris.position.set(0, 4.2, 0);
  g.add(ris);
  const risGable = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-3.75, 0), new THREE.Vector2(3.75, 0), new THREE.Vector2(0, 1.9),
  ])), MAT.plaster);
  risGable.position.set(0, 8.4, 6.32);
  g.add(risGable);
  const roof = hipRoof(11, 24, 2.6, MAT.tile, 0.6);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 7.4;
  g.add(roof);
  const risRoof = gableRoof(12.6, 7.5, 2.2, MAT.tile, 0.3);
  risRoof.rotation.y = Math.PI / 2;
  risRoof.position.y = 8.4;
  g.add(risRoof);
  for (const dx of [-7, 7]) {
    const ch = chimney(2.0);
    ch.position.set(dx, 8.9, 0);
    g.add(ch);
  }
  // two storeys of windows with pale surrounds
  for (const side of [1, -1]) {
    for (let fl = 0; fl < 2; fl++) {
      for (let i = 0; i < 6; i++) {
        const x = -9.5 + i * 3.8;
        if (Math.abs(x) < 4 && side > 0) continue;            // risalit face handled below
        addWindow(g, { face: side * 5.5, along: x, y: 2.1 + fl * 3.1, w: 1.2, h: 2.0, trim: MAT.plaster });
      }
    }
  }
  // risalit door + windows
  addDoor(g, { face: 6.3, w: 2, h: 3, lintel: false, threshold: false });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.2), MAT.plaster);
  arch.position.set(0, 3.2, 6.34);
  g.add(arch);
  for (const dx of [-2.2, 2.2]) {
    addWindow(g, { face: 6.3, along: dx, y: 5.6, w: 1.1, h: 2.0, trim: MAT.plaster });
  }
  const steps = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 2), MAT.stone);
  steps.position.set(0, 0.3, 7.4);
  g.add(steps);
  if (flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 9, 6), MAT.white);
    pole.position.set(11.5, 4.5, 8);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.2, 10, 4);
    const fl = new THREE.Mesh(flagGeo, MAT.flagRed);
    fl.position.set(12.75, 8.4, 8);
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

// the manor ale brewery on the Gauja bank — three vaulted cellars in the slope
export function brewery() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 7.5), MAT.stone);
  base.position.y = 1.1;
  const top = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 7.5), MAT.plaster);
  top.position.y = 3.3;
  g.add(base, top);
  const roof = gableRoof(7.5, 16, 2.4, MAT.tile);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 4.4;
  g.add(roof);
  const chim = chimney(1.8);
  chim.position.set(-4, 5.5, 0);
  g.add(chim);
  // cellar arches facing the river (local -z)
  for (const dx of [-5, 0, 5]) {
    const archGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.7, 12, 1, false, 0, Math.PI);
    const arch = new THREE.Mesh(archGeo, MAT.stone);
    arch.rotation.set(0, 0, Math.PI / 2);
    arch.rotation.x = Math.PI / 2;
    arch.position.set(dx, 1.0, -3.9);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x120d08 }));
    mouth.position.set(dx, 1.0, -3.86);
    g.add(arch, mouth);
  }
  addDoor(g, { face: 3.75, w: 1.35, h: 2.15 });
  for (const x of [-5.5, -2.5, 2.5, 5.5]) {
    addWindow(g, { face: 3.75, along: x, y: 3.35, w: 1, h: 1.3 });
  }
  return shadowize(g);
}

// unlit Jāņi bonfire pyre (lit by the era manager at dusk)
export function pyre() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 5), MAT.lightWood);
    log.position.set(Math.cos(a) * 0.55, 1.1, Math.sin(a) * 0.55);
    log.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42);
    g.add(log);
  }
  // the tar-barrel pole beside it
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 5), MAT.logOld);
  pole.position.set(1.6, 2.2, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 9), MAT.darkWood);
  barrel.position.set(1.6, 4.5, 0);
  g.add(pole, barrel);
  return shadowize(g);
}

// Brežģa krogs — the roadside tavern that bought the manor's ale.
// Latvian krogi were long log buildings under a massive hip roof, one end a
// stable for travellers' horses.
export function krogs() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 2.6, 8.5), MAT.logOld);
  body.position.y = 1.3;
  g.add(body, cornerLogs(18, 8.5, 2.6));
  const roof = hipRoof(8.5, 18, 3.8, MAT.thatchOld, 0.7);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.6;
  g.add(roof);
  const ch = chimney(2.2);
  ch.position.set(-3, 4.4, 0);
  g.add(ch);
  // tavern door + wide stable door
  addDoor(g, { face: 4.25, along: -4, w: 1.1, h: 1.9 });
  addDoor(g, { face: 4.25, along: 6, w: 2.6, h: 2.2, double: true });
  for (const wx of [-7.5, -0.5]) {
    addWindow(g, { face: 4.25, along: wx, y: 1.6, w: 0.8, h: 0.8, trim: MAT.darkWood, panes: 4 });
  }
  // hitching rail
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5, 5), MAT.lightWood);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-4, 1, 6.4);
  g.add(rail);
  return shadowize(g);
}

// the 2017 observation tower on Brežģa kalns (11 m, timber lattice)
export function observationTower() {
  const g = new THREE.Group();
  const H = 11;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, H, 6), MAT.lightWood);
    leg.position.set(sx * 1.5, H / 2, sz * 1.5);
    leg.rotation.set(sz * -0.045, 0, sx * 0.045);
    g.add(leg);
  }
  for (let lvl = 1; lvl <= 3; lvl++) {
    const y = lvl * (H / 3.2);
    const s = 3.4 - lvl * 0.35;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(s, 0.12, s), MAT.plank);
    floor.position.y = y;
    g.add(floor);
    for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(sx ? 0.06 : s, 0.06, sz ? 0.06 : s), MAT.lightWood);
      rail.position.set(sx * s / 2, y + 1, sz * s / 2);
      g.add(rail);
    }
  }
  const roof = hipRoof(3.2, 3.2, 1.1, MAT.shingle, 0.3);
  roof.position.y = H + 0.4;
  g.add(roof);
  // stairs suggestion: diagonal stringers between floors
  for (let lvl = 0; lvl < 3; lvl++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.6), MAT.plank);
    st.position.set((lvl % 2 ? -0.9 : 0.9), lvl * (H / 3.2) + H / 6.4, 0);
    st.rotation.x = (lvl % 2 ? 1 : -1) * 0.75;
    g.add(st);
  }
  return shadowize(g);
}

// a renovated 2020s farmhouse: plank siding, metal roof
export function modernHouse() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.9, 7), MAT.plank);
  body.position.y = 1.45;
  g.add(body);
  const metal = new THREE.MeshLambertMaterial({ color: 0x6e7880 });
  const roof = gableRoof(7, 9.5, 2.3, metal, 0.5);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.9;
  g.add(roof);
  const ch = chimney(1.4);
  ch.position.set(1.5, 4.4, 0);
  g.add(ch);
  for (let i = 0; i < 3; i++) {
    addWindow(g, { face: 3.5, along: -3 + i * 3, y: 1.55, w: 1.3, h: 1.25 });
  }
  addDoor(g, { face: 3.5, along: 3.9, w: 1, h: 2.1 });
  return shadowize(g);
}

export function car() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color: 0x44566b, shininess: 90 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.8), paint);
  body.position.y = 0.62;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.65), paint);
  cab.position.set(-0.2, 1.15, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.7), MAT.glass);
  glass.position.set(-0.2, 1.12, 0);
  g.add(body, cab, glass);
  for (const [dx, dz] of [[-1.4, 0.85], [-1.4, -0.85], [1.4, 0.85], [1.4, -0.85]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), MAT.iron);
    w.rotation.x = Math.PI / 2;
    w.position.set(dx, 0.34, dz);
    g.add(w);
  }
  return shadowize(g);
}

// glacial erratics — big till boulders dropped by the ice
export function erratics(count, area) {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, MAT.stone, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = area.x + (rng() - 0.5) * area.w;
    const z = area.z + (rng() - 0.5) * area.h;
    const s = 0.4 + Math.pow(rng(), 2.2) * 2.4;
    dummy.position.set(x, heightAt(x, z) + s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.7 + rng() * 0.4), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// stranded dead-ice blocks melting into the future lake basins
export function deadIce(x, z, s = 1) {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshPhongMaterial({
    color: 0xcfe6ee, shininess: 140, specular: 0xffffff, transparent: true, opacity: 0.92,
  });
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), iceMat);
    blob.position.set((rng() - 0.5) * 14 * s, -1.2 + i * 0.4, (rng() - 0.5) * 10 * s);
    blob.scale.set((5 + rng() * 6) * s, (2 + rng() * 1.6) * s, (4 + rng() * 4) * s);
    blob.rotation.set(rng(), rng(), rng());
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(x, heightAt(x, z), z);
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
