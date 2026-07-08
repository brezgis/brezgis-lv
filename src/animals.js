// Fauna: stylised low-poly animals with simple graze/wander behaviour.
// Species and sizes follow the zooarchaeology notes in the write-up
// (small Iron Age cattle and horses, primitive dark sheep, and the
// aurochs — bulls black with a pale eel-stripe, cows red-brown).
import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { makeNoise, clamp, lerp } from './util.js';

const rng = makeNoise(909).rng;
const M = (c) => new THREE.MeshLambertMaterial({ color: c });

function quadruped({
  shoulder = 1.2, length = 1.9, width = 0.55, legR = 0.07,
  color = 0x6b4a33, belly = null, headColor = null, neckLen = 0.5, headSize = 0.32,
  horns = null, ears = true, tail = 0.5, maneColor = null,
  tusks = false, tailR = 0.02, tasselColor = 0x2a2018,
}) {
  const g = new THREE.Group();
  const bodyH = shoulder * 0.52;
  const legH = shoulder - bodyH / 2;
  const bodyMat = M(color);
  // rounded barrel: ellipsoid trunk + chest and rump volumes
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), bodyMat);
  body.scale.set(width * 0.56, bodyH * 0.62, length * 0.53);
  body.position.y = legH + bodyH / 2;
  g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), bodyMat);
  chest.scale.set(width * 0.5, bodyH * 0.56, bodyH * 0.6);
  chest.position.set(0, legH + bodyH * 0.52, length * 0.3);
  g.add(chest);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), bodyMat);
  rump.scale.set(width * 0.47, bodyH * 0.54, bodyH * 0.56);
  rump.position.set(0, legH + bodyH * 0.54, -length * 0.3);
  g.add(rump);
  if (belly) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M(belly));
    b.scale.set(width * 0.5, bodyH * 0.42, length * 0.46);
    b.position.y = legH + bodyH * 0.28;
    g.add(b);
  }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 0.75, legH + bodyH * 0.3, 6), bodyMat);
    leg.geometry.translate(0, -(legH + bodyH * 0.3) / 2, 0);
    // legs sit UNDER the barrel, not at its corners — corner legs are the
    // single biggest "creepy toy" tell
    leg.position.set(sx * width * 0.3, legH + bodyH * 0.3, sz * length * 0.33);
    g.add(leg);
    legs.push(leg);
  }
  // neck + head pivot
  const neck = new THREE.Group();
  neck.position.set(0, legH + bodyH * 0.6, length / 2 - 0.12);
  const neckL = neckLen + headSize * 0.8;
  // short thick neck rising ~40° and blending into the chest
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.5, headSize * 0.78, neckL, 8), bodyMat);
  neckMesh.position.set(0, neckL * 0.3, neckL * 0.32);
  neckMesh.rotation.x = Math.PI / 2 - 0.72;
  neck.add(neckMesh);
  const headMat = M(headColor || color);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), headMat);
  head.scale.set(headSize * 0.42, headSize * 0.5, headSize * 0.55);
  head.position.set(0, neckL * 0.62, neckL * 0.58);
  neck.add(head);
  // muzzle drops slightly from the brow — a level muzzle reads reptilian
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.24, headSize * 0.33, headSize * 0.62, 8), headMat);
  muzzle.rotation.x = Math.PI / 2 + 0.4;
  muzzle.position.set(0, neckL * 0.62 - headSize * 0.18, neckL * 0.58 + headSize * 0.48);
  neck.add(muzzle);
  const headTop = neckL * 0.62, headZ = neckL * 0.58;
  if (ears) {
    for (const s of [-1, 1]) {
      // ears stick out SIDEWAYS from the poll, slightly drooped
      const ear = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.14, headSize * 0.4, 5), bodyMat);
      ear.position.set(s * headSize * 0.5, headTop + headSize * 0.32, headZ - headSize * 0.08);
      ear.rotation.z = s * -1.25;
      neck.add(ear);
    }
  }
  if (horns) {
    for (const s of [-1, 1]) {
      // aurochs sweep: out-and-up base, tips hooking forward-inward
      const h1 = new THREE.Mesh(new THREE.CylinderGeometry(horns.r * 0.8, horns.r * 1.4, horns.len * 0.6, 6), M(0xd8cfb8));
      h1.position.set(s * headSize * 0.42, headTop + headSize * 0.42, headZ);
      h1.rotation.z = s * -horns.spread;
      neck.add(h1);
      const h2 = new THREE.Mesh(new THREE.CylinderGeometry(horns.r * 0.3, horns.r * 0.75, horns.len * 0.52, 6), M(0xe6dcc4));
      h2.position.set(
        s * (headSize * 0.42 + Math.sin(horns.spread) * horns.len * 0.5),
        headTop + headSize * 0.42 + Math.cos(horns.spread) * horns.len * 0.42,
        headZ + horns.fwd * horns.len * 0.5);
      h2.rotation.set(-horns.fwd * 1.6, 0, s * -horns.spread * 0.25);
      neck.add(h2);
    }
  }
  if (maneColor) {
    const mane = new THREE.Mesh(new THREE.BoxGeometry(width * 0.14, headSize * 0.55, neckL * 0.9), M(maneColor));
    mane.position.set(0, neckL * 0.42 + headSize * 0.3, neckL * 0.3);
    mane.rotation.x = -0.72;
    neck.add(mane);
  }
  if (tusks) {
    for (const s of [-1, 1]) {
      const tk = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.06, headSize * 0.28, 5), M(0xe8e0cc));
      tk.position.set(s * headSize * 0.24, headTop - headSize * 0.22, headZ + headSize * 0.52);
      tk.rotation.set(-0.5, 0, s * 0.7);
      neck.add(tk);
    }
  }
  g.add(neck);
  if (tail > 0) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(tailR, tailR * 2, tail, 5), bodyMat);
    t.position.set(0, legH + bodyH * 0.62, -length / 2 - 0.02);
    t.rotation.x = 0.42;
    g.add(t);
    const tassel = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.055, tailR * 1.6), 6, 5), M(tasselColor));
    tassel.position.set(0, legH + bodyH * 0.62 - tail * 0.46, -length / 2 - 0.02 - tail * 0.2);
    g.add(tassel);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { group: g, legs, neck, shoulder };
}

function fowl({ size = 0.22, color = 0xd8d3c4, comb = false, neckLen = 0 }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 7), M(color));
  body.scale.set(0.85, 0.9, 1.25);
  body.position.y = size * 1.25;
  body.rotation.x = -0.22;               // breast down, tail up
  g.add(body);
  // tail fan
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 0.9, 6), M(color));
  tail.scale.z = 0.28;
  tail.rotation.x = -0.9;
  tail.position.set(0, size * 1.75, -size * 1.05);
  g.add(tail);
  const neck = new THREE.Group();
  neck.position.set(0, size * 1.6, size * 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 6, 5), M(color));
  head.position.set(0, size * 0.7 + neckLen, size * 0.28);
  neck.add(head);
  if (neckLen > 0) {
    const nm = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.2, neckLen + size * 0.6, 5), M(color));
    nm.position.set(0, (neckLen + size * 0.5) / 2, size * 0.15);
    nm.rotation.x = 0.22;
    neck.add(nm);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(size * 0.14, size * 0.5, 4), M(0xd08a28));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, size * 0.68 + neckLen, size * 0.75);
  neck.add(beak);
  if (comb) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(size * 0.1, size * 0.3, size * 0.45), M(0xc03028));
    cm.position.set(0, size * 1.1 + neckLen, size * 0.25);
    neck.add(cm);
  }
  g.add(neck);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, size * 1.1, 4), M(0xc09030));
    leg.position.set(s * size * 0.3, size * 0.55, 0);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [] };
}

function stork() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0xf0ece2));
  body.scale.set(0.8, 0.85, 1.4);
  body.position.y = 0.78;
  g.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.55), M(0x2a2a2c));
  wing.position.set(0, 0.86, -0.18);
  g.add(wing);
  const neck = new THREE.Group();
  neck.position.set(0, 0.95, 0.3);
  const nm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5), M(0xf0ece2));
  nm.position.set(0, 0.24, 0.06);
  nm.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), M(0xf0ece2));
  head.position.set(0, 0.5, 0.16);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 4), M(0xc23a28));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.5, 0.45);
  neck.add(nm, head, beak);
  g.add(neck);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 4), M(0xc23a28));
    leg.position.set(s * 0.09, 0.31, 0);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck, legs: [] };
}

// --- small ground game --------------------------------------------------------
function hare(color = 0x8a7a64, belly = 0xcfc6b4) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), M(color));
  body.scale.set(0.75, 0.8, 1.15);
  body.position.y = 0.17;
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), M(color));
  rump.position.set(0, 0.2, -0.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), M(color));
  head.position.set(0, 0.28, 0.17);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), M(belly));
  bl.scale.set(0.7, 0.55, 1.0);
  bl.position.y = 0.12;
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), M(0xf2ede2));
  tail.position.set(0, 0.21, -0.23);
  g.add(body, rump, head, bl, tail);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.022, 0.2, 5), M(color));
    ear.position.set(s * 0.038, 0.42, 0.14);
    ear.rotation.set(-0.15, 0, s * -0.18);
    g.add(ear);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null };
}

function squirrel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), M(0xa14e28));
  body.scale.set(0.8, 1.0, 1.2);
  body.position.y = 0.085;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 5), M(0xa14e28));
  head.position.set(0, 0.15, 0.08);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 6, 8, Math.PI * 1.25), M(0x8a3f20));
  tail.position.set(0, 0.12, -0.1);
  tail.rotation.set(0, Math.PI / 2, 0.3);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), M(0xe8dcc8));
  bl.position.set(0, 0.07, 0.03);
  g.add(body, head, tail, bl);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null };
}

// --- water creatures ----------------------------------------------------------
function fish({ len = 0.5, color = 0x37424a, belly = 0x93a29a } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), M(color));
  body.scale.set(len * 0.13, len * 0.2, len * 0.5);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), M(belly));
  bl.scale.set(len * 0.11, len * 0.14, len * 0.44);
  bl.position.y = -len * 0.05;
  const tailF = new THREE.Mesh(new THREE.ConeGeometry(len * 0.16, len * 0.24, 4), M(color));
  tailF.scale.x = 0.22;
  tailF.rotation.x = Math.PI / 2 + 0.2;
  tailF.position.set(0, 0, -len * 0.58);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(len * 0.1, len * 0.16, 4), M(color));
  dorsal.scale.x = 0.2;
  dorsal.position.set(0, len * 0.2, -len * 0.05);
  g.add(body, bl, tailF, dorsal);
  return { group: g, legs: [], neck: null, wiggle: true };
}

function duck(male = true) {
  const g = new THREE.Group();
  const bodyC = male ? 0x8d867a : 0x8a7457;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), M(bodyC));
  body.scale.set(0.75, 0.62, 1.25);
  body.position.y = 0.02;
  const breast = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), M(male ? 0x5a3a2c : 0x7a6448));
  breast.position.set(0, 0.03, 0.12);
  const neck = new THREE.Group();
  neck.position.set(0, 0.1, 0.14);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 7, 6), M(male ? 0x1e5e30 : 0x8a7457));
  head.position.set(0, 0.12, 0.05);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.09, 4), M(0xc9a028));
  bill.scale.y = 0.55;
  bill.rotation.x = Math.PI / 2;
  bill.position.set(0, 0.11, 0.12);
  neck.add(head, bill);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), M(bodyC));
  tail.scale.y = 0.4;
  tail.rotation.x = -Math.PI / 2 - 0.5;
  tail.position.set(0, 0.06, -0.2);
  g.add(body, breast, neck, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck };
}

function swan(beakC = 0xd8c030) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M(0xf4f2ea));
  body.scale.set(0.72, 0.6, 1.25);
  body.position.y = 0.05;
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M(0xfaf8f2));
    wing.scale.set(0.4, 0.5, 1.0);
    wing.position.set(s * 0.14, 0.14, -0.05);
    g.add(wing);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 0.16, 0.3);
  const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6), M(0xf4f2ea));
  n1.position.set(0, 0.16, 0.02);
  n1.rotation.x = 0.18;
  const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), M(0xf4f2ea));
  n2.position.set(0, 0.36, 0.07);
  n2.rotation.x = -0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), M(0xf4f2ea));
  head.position.set(0, 0.46, 0.1);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), M(beakC));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.45, 0.17);
  neck.add(n1, n2, head, beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 5), M(0xf4f2ea));
  tail.scale.y = 0.5;
  tail.rotation.x = -Math.PI / 2 - 0.55;
  tail.position.set(0, 0.12, -0.36);
  g.add(neck, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck };
}

function frog() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), M(0x5a7a2e));
  body.scale.set(1, 0.75, 1.2);
  body.position.y = 0.04;
  g.add(body);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 4), M(0x314a1c));
    eye.position.set(s * 0.03, 0.085, 0.035);
    g.add(eye);
  }
  return { group: g, legs: [], neck: null };
}

function beaver() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 9, 7), M(0x4a3322));
  body.scale.set(0.75, 0.55, 1.15);
  body.position.y = 0.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), M(0x543a26));
  head.position.set(0, 0.1, 0.26);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.26), M(0x3a3234));
  tail.position.set(0, 0.0, -0.36);
  g.add(body, head, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null };
}

// --- the air -------------------------------------------------------------------
function butterfly(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.065), mat);
    w.geometry.translate(s * 0.045, 0, 0);
    w.rotation.y = 0;
    g.add(w);
    wings.push(w);
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.06, 4), M(0x241c14));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

function dragonfly() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.24, 4), M(0x2a6a8a));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wMat = new THREE.MeshLambertMaterial({ color: 0xdce8ec, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const wings = [];
  for (const [s, dz] of [[-1, 0.03], [1, 0.03], [-1, -0.03], [1, -0.03]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.03), wMat);
    w.geometry.translate(s * 0.078, 0, 0);
    w.position.set(0, 0.008, dz);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
    wings.push(w);
  }
  return { group: g, legs: [], neck: null, wings, flapAxis: 'y' };
}

function swallow() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), M(0x1c2430));
  body.scale.set(0.75, 0.7, 1.5);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M(0xe8e2d4));
  bl.position.set(0, -0.02, 0.02);
  g.add(body, bl);
  const wings = [];
  const wMat = M(0x1c2430);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.05), wMat);
    w.material.side = THREE.DoubleSide;
    w.geometry.translate(s * 0.088, 0, -0.01);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
    wings.push(w);
  }
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), wMat);
    t.rotation.x = -Math.PI / 2;
    t.position.set(s * 0.015, 0, -0.11);
    g.add(t);
  }
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

function craneBird() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 7), M(0xb5b3ac));
  body.scale.set(0.55, 0.5, 1.2);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5), M(0xb5b3ac));
  neckM.rotation.x = Math.PI / 2;
  neckM.position.set(0, 0.02, 0.55);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), M(0x8a8880));
  head.position.set(0, 0.02, 0.85);
  const legsM = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 4), M(0x3a3430));
  legsM.rotation.x = Math.PI / 2;
  legsM.position.set(0, -0.05, -0.55);
  g.add(body, neckM, head, legsM);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.3), M(0xa8a69e));
    w.material.side = THREE.DoubleSide;
    w.geometry.translate(s * 0.44, 0, 0);
    w.rotation.x = -Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), M(0x2e2c28));
    tip.position.set(s * 0.74, 0.001, 0);
    tip.rotation.x = -Math.PI / 2;
    g.add(w, tip);
    wings.push(w);
    wings.push(tip);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

function buzzard() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 6), M(0x4a3826));
  body.scale.set(0.7, 0.55, 1.3);
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), M(0x54402c));
    w.material.side = THREE.DoubleSide;
    w.geometry.translate(s * 0.26, 0, 0);
    w.rotation.set(-Math.PI / 2, 0, s * 0.12);   // slight soaring dihedral
    g.add(w);
    wings.push(w);
  }
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), M(0x54402c));
  tail.material.side = THREE.DoubleSide;
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -0.2);
  g.add(tail);
  return { group: g, legs: [], neck: null, wings, flapAxis: 'z' };
}

// --- species presets ---------------------------------------------------------
export const SPECIES = {
  aurochsBull: () => quadruped({
    shoulder: 1.75, length: 3.0, width: 0.95, legR: 0.1, color: 0x1d1712,
    belly: 0x2a221a, maneColor: null, neckLen: 0.55, headSize: 0.45,
    horns: { len: 0.85, r: 0.05, spread: 0.9, fwd: 0.25 },
  }),
  aurochsCow: () => quadruped({
    shoulder: 1.5, length: 2.6, width: 0.8, legR: 0.09, color: 0x5c3a24,
    neckLen: 0.5, headSize: 0.4, horns: { len: 0.6, r: 0.04, spread: 0.85, fwd: 0.2 },
  }),
  cattleIron: () => quadruped({
    shoulder: 1.05, length: 1.8, width: 0.55, legR: 0.06,
    color: [0x4a3526, 0x6b4a33, 0x2e261e][(rng() * 3) | 0],
    neckLen: 0.4, headSize: 0.3, horns: { len: 0.3, r: 0.03, spread: 0.7, fwd: 0.1 },
  }),
  cattleFarm: () => quadruped({
    shoulder: 1.25, length: 2.1, width: 0.62, legR: 0.07, color: 0x7a4a2c,
    belly: 0x8a5a38, neckLen: 0.45, headSize: 0.34, horns: { len: 0.26, r: 0.026, spread: 0.75, fwd: 0.08 },
  }),
  sheepDark: () => quadruped({
    shoulder: 0.6, length: 0.95, width: 0.42, legR: 0.035,
    color: [0x4d4238, 0x6e6055, 0x8c8175][(rng() * 3) | 0],
    headColor: 0x3a2f26, neckLen: 0.16, headSize: 0.17, tail: 0.15,
  }),
  sheepWhite: () => quadruped({
    shoulder: 0.68, length: 1.05, width: 0.48, legR: 0.035, color: 0xd6cfbe,
    headColor: 0x4a4038, neckLen: 0.18, headSize: 0.18, tail: 0.2,
  }),
  horseTarpan: () => quadruped({
    shoulder: 1.3, length: 2.0, width: 0.5, legR: 0.055, color: 0x8a7a5c,
    maneColor: 0x2e2820, neckLen: 0.62, headSize: 0.3, tail: 0.7, ears: true,
  }),
  horseBay: () => quadruped({
    shoulder: 1.55, length: 2.3, width: 0.58, legR: 0.06, color: 0x5a3a24,
    maneColor: 0x201812, neckLen: 0.7, headSize: 0.33, tail: 0.8,
  }),
  pig: () => quadruped({
    shoulder: 0.62, length: 1.2, width: 0.44, legR: 0.04, color: 0x3d3229,
    neckLen: 0.1, headSize: 0.24, ears: true, tail: 0.12,
  }),
  elk: () => quadruped({
    shoulder: 1.9, length: 2.7, width: 0.7, legR: 0.08, color: 0x4d4136,
    belly: 0x5c5044, neckLen: 0.5, headSize: 0.44, tail: 0.1,
    horns: { len: 0.7, r: 0.045, spread: 1.15, fwd: -0.1 },
  }),
  reindeer: () => quadruped({
    shoulder: 1.1, length: 1.8, width: 0.5, legR: 0.05,
    color: [0x8a8378, 0x9a938a, 0x7a7268][(rng() * 3) | 0],
    belly: 0xb5afa4, headColor: 0x6e675e, neckLen: 0.42, headSize: 0.28, tail: 0.12,
    horns: { len: 0.62, r: 0.028, spread: 0.55, fwd: -0.3 }, // swept-back branched antlers (both sexes)
  }),
  chicken: () => fowl({ size: 0.16, color: [0xc8b490, 0x8a5a30, 0xd8d3c4][(rng() * 3) | 0] }),
  rooster: () => fowl({ size: 0.19, color: 0x8a3820, comb: true }),
  goose: () => fowl({ size: 0.3, color: 0xe6e2d6, neckLen: 0.3 }),
  stork: () => stork(),
  // wild ungulates & ground game
  roeDeer: () => quadruped({
    shoulder: 0.76, length: 1.1, width: 0.33, legR: 0.028, color: 0xa5713f,
    belly: 0xc9a06a, neckLen: 0.36, headSize: 0.2, tail: 0.05, tailR: 0.012,
  }),
  roeBuck: () => quadruped({
    shoulder: 0.8, length: 1.15, width: 0.35, legR: 0.03, color: 0x9a6838,
    belly: 0xc9a06a, neckLen: 0.38, headSize: 0.21, tail: 0.05, tailR: 0.012,
    horns: { len: 0.16, r: 0.012, spread: 0.35, fwd: 0.05 },
  }),
  redDeer: () => quadruped({
    shoulder: 1.35, length: 2.05, width: 0.55, legR: 0.055, color: 0x8a5a34,
    belly: 0xa07048, neckLen: 0.55, headSize: 0.32, tail: 0.12, tailR: 0.015,
    horns: { len: 0.72, r: 0.03, spread: 0.7, fwd: -0.35 },
  }),
  boar: () => quadruped({
    shoulder: 0.85, length: 1.45, width: 0.5, legR: 0.05, color: 0x3a2e24,
    maneColor: 0x241c14, neckLen: 0.14, headSize: 0.34, tail: 0.18, tailR: 0.012,
    tusks: true,
  }),
  fox: () => quadruped({
    shoulder: 0.38, length: 0.62, width: 0.2, legR: 0.018, color: 0xb4562a,
    belly: 0xe8dcc8, neckLen: 0.2, headSize: 0.15, tail: 0.42, tailR: 0.05,
    tasselColor: 0xf2ede2,
  }),
  arcticFox: () => quadruped({
    shoulder: 0.32, length: 0.55, width: 0.19, legR: 0.017, color: 0xeceae4,
    neckLen: 0.16, headSize: 0.13, tail: 0.34, tailR: 0.048, tasselColor: 0xffffff,
  }),
  hare: () => hare(),
  arcticHare: () => hare(0xf0efe8, 0xffffff),
  squirrel: () => squirrel(),
  ptarmigan: () => fowl({ size: 0.14, color: 0xf2f2ee }),
  // water
  fishPerch: () => fish({ len: 0.34, color: 0x4a5a3c }),
  fishPike: () => fish({ len: 0.72, color: 0x39503c, belly: 0xa8b49a }),
  duckM: () => duck(true),
  duckF: () => duck(false),
  swanWhooper: () => swan(0xd8c030),   // Cygnus cygnus — the native breeder
  swanMute: () => swan(0xd07828),      // Cygnus olor — 20th-century colonist
  wolf: () => quadruped({
    shoulder: 0.78, length: 1.25, width: 0.34, legR: 0.036, color: 0x6e675c,
    belly: 0x9a927f, neckLen: 0.32, headSize: 0.24, tail: 0.42, tailR: 0.035,
    tasselColor: 0x4a443a,
  }),
  blackGrouse: () => fowl({ size: 0.24, color: 0x23242c, comb: true }),
  frog: () => frog(),
  beaver: () => beaver(),
  // air
  butterflyW: () => butterfly(0xf2f0e2),
  butterflyO: () => butterfly(0xd07818),
  butterflyY: () => butterfly(0xe8d84a),
  dragonfly: () => dragonfly(),
  swallow: () => swallow(),
  crane: () => craneBird(),
  buzzard: () => buzzard(),
};

// --- behaviour ----------------------------------------------------------------
export class AnimalManager {
  constructor() { this.animals = []; this.group = new THREE.Group(); this.group.name = 'animals'; }

  spawn(kind, home, opts = {}) {
    const a = SPECIES[kind]();
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * home.r;
    let x = home.x + Math.cos(angle) * r, z = home.z + Math.sin(angle) * r;
    // water dwellers must START in water, not on the bank
    if (opts.inWater) {
      for (let tries = 0; tries < 24 && !opts.inWater(x, z); tries++) {
        const a2 = rng() * Math.PI * 2, r2 = Math.sqrt(rng()) * home.r;
        x = home.x + Math.cos(a2) * r2; z = home.z + Math.sin(a2) * r2;
      }
      if (!opts.inWater(x, z)) { x = home.x; z = home.z; }
    }
    const medium = opts.medium || 'land';
    const y = medium === 'water' ? (opts.level ?? heightAt(x, z))
      : medium === 'air' ? heightAt(x, z) + (opts.alt ? (opts.alt[0] + opts.alt[1]) / 2 : 8)
      : heightAt(x, z);
    a.group.position.set(x, y, z);
    a.group.rotation.y = rng() * Math.PI * 2;
    a.group.name = kind;
    const rec = {
      ...a, kind, home, medium,
      speed: opts.speed ?? (kind.startsWith('chicken') || kind === 'rooster' ? 0.8 : kind === 'goose' ? 0.7 : 0.55),
      state: 'graze', timer: 1 + rng() * 5, tx: x, tz: z, heading: a.group.rotation.y,
      grazeBias: opts.grazeBias ?? (kind === 'pig' ? 0.85 : 0.68),
      static: opts.static ?? false, phase: rng() * 10,
      fly: opts.fly || null, level: opts.level, inWater: opts.inWater || null,
      hop: opts.hop || false, alt: opts.alt || [4, 16],
      vx: 0, vz: 0, soarA: rng() * Math.PI * 2, soarR: 45 + rng() * 45,
      hopT: -1, wingP: rng() * Math.PI * 2,
      hopLen: opts.hopLen ?? 0.5, hopH: opts.hopH ?? 0.12,
      hopDur: opts.hopDur ?? 0.32, restT: opts.restT ?? [2, 6], chainT: opts.chainT ?? 0.15,
    };
    this.animals.push(rec);
    this.group.add(a.group);
    return rec;
  }

  clear() {
    for (const a of this.animals) this.group.remove(a.group);
    this.animals.length = 0;
  }

  // shared wing flap
  flap(a, t, speed, amp, rest = 0) {
    if (!a.wings) return;
    const v = rest + Math.sin(t * speed + a.wingP) * amp;
    a.wings.forEach((w, i) => {
      const s = i % 2 === 0 ? 1 : -1;
      if (a.flapAxis === 'y') w.rotation.y = s * v * 0.4;
      else w.rotation.z = (i < 2 ? s : s) * v + (w.userData.dihedral || 0);
    });
  }

  tickWater(a, t, dt) {
    a.timer -= dt;
    if (a.timer <= 0) {
      if (a.state !== 'swim' && rng() > 0.4) {
        // pick a target that stays in the water
        for (let tries = 0; tries < 12; tries++) {
          const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
          const tx = a.home.x + Math.cos(ang) * r, tz = a.home.z + Math.sin(ang) * r;
          if (!a.inWater || a.inWater(tx, tz)) { a.tx = tx; a.tz = tz; a.state = 'swim'; a.timer = 40; break; }
        }
        if (a.state !== 'swim') { a.state = 'idle'; a.timer = 2 + rng() * 4; }
      } else {
        a.state = 'idle';
        a.timer = (a.wiggle ? 1 : 3) + rng() * 5;
      }
    }
    const g = a.group;
    if (a.state === 'swim') {
      const dx = a.tx - g.position.x, dz = a.tz - g.position.z;
      if (Math.hypot(dx, dz) < 0.6) { a.state = 'idle'; a.timer = 1.5 + rng() * 4; }
      else {
        const want = Math.atan2(dx, dz);
        let da = want - a.heading;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a.heading += clamp(da, -1.2 * dt, 1.2 * dt);
        // fish put on occasional darts; ducks paddle steadily
        const dart = a.wiggle && Math.sin(t * 0.23 + a.phase * 3) > 0.94 ? 3.4 : 1;
        g.position.x += Math.sin(a.heading) * a.speed * dart * dt;
        g.position.z += Math.cos(a.heading) * a.speed * dart * dt;
      }
    }
    // stay at the waterline (fish ride a little under it)
    g.position.y = a.level + Math.sin(t * (a.wiggle ? 1.3 : 0.7) + a.phase) * (a.wiggle ? 0.06 : 0.015);
    g.rotation.y = a.heading + (a.wiggle ? Math.sin(t * 7 + a.phase) * 0.12 : 0);
    if (a.neck && !a.wiggle) {
      // dabble: head dips to the water now and then
      a.neck.rotation.x = Math.sin(t * 0.4 + a.phase) > 0.86 ? 0.9 : Math.sin(t * 0.8 + a.phase) * 0.08;
    }
  }

  tickHop(a, t, dt) {
    const g = a.group;
    if (a.hopT >= 0) {
      // mid-hop: parabolic arc toward the target
      a.hopT += dt / a.hopDur;
      const k = Math.min(1, a.hopT);
      g.position.x += Math.sin(a.heading) * a.hopLen * dt / a.hopDur;
      g.position.z += Math.cos(a.heading) * a.hopLen * dt / a.hopDur;
      g.position.y = heightAt(g.position.x, g.position.z) + a.hopH * 4 * k * (1 - k);
      if (a.hopT >= 1) {
        a.hopT = -1;
        g.position.y = heightAt(g.position.x, g.position.z);
        const dx = a.tx - g.position.x, dz = a.tz - g.position.z;
        if (Math.hypot(dx, dz) < a.hopLen || rng() < 0.12) { a.state = 'idle'; a.timer = a.restT[0] + rng() * a.restT[1]; }
        else a.timer = a.chainT;
      }
      return;
    }
    a.timer -= dt;
    if (a.timer > 0) return;
    if (a.state === 'idle' || Math.hypot(a.tx - g.position.x, a.tz - g.position.z) < a.hopLen) {
      const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
      a.tx = a.home.x + Math.cos(ang) * r;
      a.tz = a.home.z + Math.sin(ang) * r;
      a.state = 'move';
    }
    const want = Math.atan2(a.tx - g.position.x, a.tz - g.position.z);
    a.heading = want + (rng() - 0.5) * 0.4;
    g.rotation.y = a.heading;
    a.hopT = 0;
  }

  tickAir(a, t, dt) {
    const g = a.group;
    if (a.fly === 'flutter') {
      // erratic wander around the home meadow, low over the flowers —
      // with a guaranteed drift (pure zero-mean noise left them hovering)
      if (Math.hypot(a.vx, a.vz) < 0.45) {
        const th = a.phase + t * 0.13;
        a.vx += Math.cos(th) * 0.5; a.vz += Math.sin(th) * 0.5;
      }
      a.vx += (rng() - 0.5) * 8 * dt; a.vz += (rng() - 0.5) * 8 * dt;
      const hx = a.home.x - g.position.x, hz = a.home.z - g.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > a.home.r) { a.vx += (hx / hd) * 2.4 * dt * 30; a.vz += (hz / hd) * 2.4 * dt * 30; }
      const sp = Math.hypot(a.vx, a.vz) || 1;
      const max = 1.5;
      if (sp > max) { a.vx *= max / sp; a.vz *= max / sp; }
      g.position.x += a.vx * dt;
      g.position.z += a.vz * dt;
      const ground = heightAt(g.position.x, g.position.z);
      const wantY = ground + 0.5 + (Math.sin(t * 0.7 + a.phase) + 1) * 0.7 + Math.sin(t * 3.1 + a.phase * 2) * 0.15;
      g.position.y += clamp(wantY - g.position.y, -1.2 * dt, 1.2 * dt);
      g.rotation.y = Math.atan2(a.vx, a.vz);
      this.flap(a, t, 24, 1.05);
    } else if (a.fly === 'hawk') {
      // swallow: fast sweeping curves over meadow and water
      a.heading += (Math.sin(t * 0.8 + a.phase) + Math.sin(t * 0.31 + a.phase * 2) * 0.7) * 1.6 * dt;
      const hx = a.home.x - g.position.x, hz = a.home.z - g.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > a.home.r) {
        const want = Math.atan2(hx, hz);
        let da = want - a.heading;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a.heading += clamp(da, -2.2 * dt, 2.2 * dt);
      }
      const sp = 9 + Math.sin(t * 0.5 + a.phase) * 2;
      g.position.x += Math.sin(a.heading) * sp * dt;
      g.position.z += Math.cos(a.heading) * sp * dt;
      const ground = heightAt(g.position.x, g.position.z);
      const wantY = ground + a.alt[0] + (Math.sin(t * 0.42 + a.phase) + 1) * 0.5 * (a.alt[1] - a.alt[0]);
      g.position.y += clamp(wantY - g.position.y, -6 * dt, 6 * dt);
      g.rotation.y = a.heading;
      g.rotation.z = clamp(-Math.sin(t * 0.8 + a.phase) * 0.7, -0.8, 0.8);
      const gliding = Math.sin(t * 0.9 + a.phase * 3) > 0.2;
      this.flap(a, t, 16, gliding ? 0.06 : 0.6);
    } else if (a.fly === 'soar') {
      // buzzard: circling a thermal, wings held still
      a.soarA += (7 / a.soarR) * dt * (a.phase > 5 ? 1 : -1);
      a.soarR += Math.sin(t * 0.05 + a.phase) * 0.6 * dt * 10;
      a.soarR = clamp(a.soarR, 35, 110);
      g.position.x = a.home.x + Math.cos(a.soarA) * a.soarR;
      g.position.z = a.home.z + Math.sin(a.soarA) * a.soarR;
      const ground = heightAt(a.home.x, a.home.z);
      g.position.y = ground + a.alt[0] + (Math.sin(t * 0.04 + a.phase) + 1) * 0.5 * (a.alt[1] - a.alt[0]);
      g.rotation.y = -a.soarA + (a.phase > 5 ? 0 : Math.PI);
      g.rotation.z = (a.phase > 5 ? -1 : 1) * 0.22;
      this.flap(a, t, 3, Math.sin(t * 0.11 + a.phase) > 0.9 ? 0.4 : 0.02);
    } else if (a.fly === 'cross') {
      // crane skein: straight transit, wraps to the far side of the map
      g.position.x += Math.sin(a.heading) * 11 * dt;
      g.position.z += Math.cos(a.heading) * 11 * dt;
      g.position.y = a.level + Math.sin(t * 0.15 + a.phase) * 4;
      g.rotation.y = a.heading;
      if (Math.abs(g.position.x - 500) > 4600 || Math.abs(g.position.z - 1700) > 4600) {
        g.position.x = 500 - Math.sin(a.heading) * 4400 + (rng() - 0.5) * 800;
        g.position.z = 1700 - Math.cos(a.heading) * 4400 + (rng() - 0.5) * 800;
      }
      this.flap(a, t, 2.6, 0.5);
    }
  }

  tick(t, dt, camPos) {
    for (const a of this.animals) {
      // distance cull: ground fauna beyond 650m is invisible anyway but
      // still costs its draw calls; sky fliers stay (silhouettes carry far).
      // Visibility ONLY — the simulation keeps running (a culled fish that
      // stops swimming is a frozen fish when you arrive).
      if (camPos && a.medium !== 'air') {
        const dx = a.group.position.x - camPos.x, dz = a.group.position.z - camPos.z;
        const vis = dx * dx + dz * dz < 650 * 650;
        if (a.group.visible !== vis) a.group.visible = vis;
      }
      if (a.static) {
        // nest stork: occasional preen
        a.neck.rotation.x = Math.sin(t * 0.3 + a.phase) > 0.92 ? 0.8 : Math.sin(t * 0.5 + a.phase) * 0.06;
        continue;
      }
      if (a.medium === 'air') { this.tickAir(a, t, dt); continue; }
      if (a.medium === 'water') { this.tickWater(a, t, dt); continue; }
      if (a.hop) { this.tickHop(a, t, dt); continue; }
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.state !== 'walk' && rng() > a.grazeBias) {
          const ang = rng() * Math.PI * 2, r = Math.sqrt(rng()) * a.home.r;
          a.tx = a.home.x + Math.cos(ang) * r;
          a.tz = a.home.z + Math.sin(ang) * r;
          a.state = 'walk';
          a.timer = 30;
        } else {
          a.state = rng() < 0.75 ? 'graze' : 'idle';
          a.timer = 2.5 + rng() * 6;
        }
      }
      const g = a.group;
      if (a.state === 'walk') {
        const dx = a.tx - g.position.x, dz = a.tz - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.8) { a.state = 'graze'; a.timer = 3 + rng() * 5; }
        else {
          const want = Math.atan2(dx, dz);
          let da = want - a.heading;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          a.heading += clamp(da, -1.6 * dt, 1.6 * dt);
          g.rotation.y = a.heading;
          const sp = a.speed * (a.shoulder ? a.shoulder * 0.8 : 1);
          g.position.x += Math.sin(a.heading) * sp * dt;
          g.position.z += Math.cos(a.heading) * sp * dt;
        }
        g.position.y = heightAt(g.position.x, g.position.z);
        const swing = Math.sin(t * 7 + a.phase);
        a.legs.forEach((leg, i) => { leg.rotation.x = swing * 0.45 * (i % 2 === 0 ? 1 : -1) * (i < 2 ? 1 : -0.9); });
        if (a.neck) a.neck.rotation.x = Math.sin(t * 7 + a.phase) * 0.04;
        g.position.y += a.legs.length ? Math.abs(Math.sin(t * 7 + a.phase)) * 0.015 * (a.shoulder || 0.3) : Math.abs(Math.sin(t * 12 + a.phase)) * 0.03;
      } else {
        a.legs.forEach((leg) => { leg.rotation.x *= 0.85; });
        if (a.state === 'graze' && a.neck) {
          // head down, with little nibble movements (peck for fowl)
          const target = a.shoulder ? 0.95 : 1.1;
          a.neck.rotation.x = lerp(a.neck.rotation.x, target + Math.sin(t * (a.shoulder ? 2.4 : 9) + a.phase) * 0.12, 0.05);
        } else if (a.neck) {
          a.neck.rotation.x = lerp(a.neck.rotation.x, Math.sin(t * 0.6 + a.phase) * 0.1, 0.06);
          a.neck.rotation.y = Math.sin(t * 0.4 + a.phase * 2) * 0.25;
        }
      }
    }
  }
}
