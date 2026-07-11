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
  horse = false, legColor = null, tailColor = null, dorsalStripeColor = null,
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
  if (dorsalStripeColor) {
    // hug the spine — at 1.14·bodyH the stripe hovered over the back
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.13, bodyH * 0.1, length * 0.82), M(dorsalStripeColor));
    stripe.position.set(0, legH + bodyH * 1.0, -length * 0.02);
    g.add(stripe);
  }
  if (belly) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M(belly));
    b.scale.set(width * 0.5, bodyH * 0.42, length * 0.46);
    b.position.y = legH + bodyH * 0.28;
    g.add(b);
  }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const legLen = legH + bodyH * 0.3;
    let leg;
    if (legColor) {
      const lowerMat = M(legColor);
      const upperH = legLen * 0.43;
      const lowerH = legLen - upperH;
      leg = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 0.88, upperH, 6), bodyMat);
      upper.geometry.translate(0, -upperH / 2, 0);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(legR * 0.88, legR * 0.72, lowerH, 6), lowerMat);
      lower.geometry.translate(0, -lowerH / 2, 0);
      lower.position.y = -upperH;
      leg.add(upper, lower);
    } else {
      leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 0.75, legLen, 6), bodyMat);
      leg.geometry.translate(0, -legLen / 2, 0);
    }
    // legs sit UNDER the barrel, not at its corners — corner legs are the
    // single biggest "creepy toy" tell
    leg.position.set(sx * width * 0.3, legLen, sz * length * 0.33);
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
  const headTop = neckL * 0.62, headZ = neckL * 0.58;
  if (horse) {
    const skullLen = headSize * 0.9;
    const muzzleLen = skullLen * 0.55;
    const muzzleDrop = 0.35;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.72, headSize * 0.58, skullLen), headMat);
    skull.position.set(0, headTop, headZ);
    skull.rotation.x = -0.08;
    neck.add(skull);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.86, headSize * 0.2, skullLen * 0.45), headMat);
    brow.position.set(0, headTop + headSize * 0.18, headZ + skullLen * 0.08);
    brow.rotation.x = -0.08;
    neck.add(brow);
    // horse nose: shorter, narrower, and tipped down so it stops reading as a pipe
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.4, headSize * 0.32, muzzleLen), headMat);
    muzzle.rotation.x = muzzleDrop;
    muzzle.position.set(
      0,
      headTop - headSize * 0.08 - Math.sin(muzzleDrop) * muzzleLen * 0.5,
      headZ + skullLen * 0.42 + Math.cos(muzzleDrop) * muzzleLen * 0.5);
    neck.add(muzzle);
    if (ears) {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.09, headSize * 0.34, 4), headMat);
        ear.position.set(s * headSize * 0.24, headTop + headSize * 0.44, headZ - skullLen * 0.18);
        ear.rotation.set(-0.12, 0, s * -0.32);
        neck.add(ear);
      }
    }
  } else {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), headMat);
    head.scale.set(headSize * 0.42, headSize * 0.5, headSize * 0.55);
    head.position.set(0, headTop, headZ);
    neck.add(head);
    // muzzle drops slightly from the brow — a level muzzle reads reptilian
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.24, headSize * 0.33, headSize * 0.62, 8), headMat);
    muzzle.rotation.x = Math.PI / 2 + 0.4;
    muzzle.position.set(0, headTop - headSize * 0.18, headZ + headSize * 0.48);
    neck.add(muzzle);
  }
  if (ears && !horse) {
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
      if (horns.palmate) {
        // moose palm: a flattened shovel at the beam's end — the plain
        // cylinders read as long cow horns on an elk
        const palm = new THREE.Mesh(new THREE.BoxGeometry(horns.len * 0.55, horns.len * 0.4, horns.r * 2.6), M(0xd8cfb8));
        palm.position.set(
          s * (headSize * 0.42 + Math.sin(horns.spread) * horns.len * 0.82),
          headTop + headSize * 0.42 + Math.cos(horns.spread) * horns.len * 0.66,
          headZ + horns.fwd * horns.len * 0.7);
        palm.rotation.set(-horns.fwd * 1.2, s * 0.25, s * -horns.spread * 0.55);
        neck.add(palm);
      }
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
    // thin livestock tails HANG; only bushy brushes (fox, wolf) are carried
    const hang = tailR < 0.03 && !horse;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(tailR, tailR * 2, tail, 5), tailColor ? M(tailColor) : bodyMat);
    // hanging tails pivot from the dock, not through it — centred rods
    // poked half their length up past the rump like a pump handle
    t.position.set(0, legH + bodyH * 0.62 - (hang ? tail * 0.4 : 0), -length / 2 - 0.02);
    t.rotation.x = hang ? 0.13 : 0.42;
    g.add(t);
    const tassel = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.055, tailR * 1.6), 6, 5), M(tasselColor));
    if (hang) tassel.position.set(0, legH + bodyH * 0.62 - tail * 0.78, -length / 2 - 0.02 - tail * 0.14);
    else tassel.position.set(0, legH + bodyH * 0.62 - tail * 0.46, -length / 2 - 0.02 - tail * 0.2);
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
  // tail fan — more upright and less knife-flat than the first pass
  const tail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.55, size * 0.9, 6), M(color));
  tail.scale.z = 0.42;
  tail.rotation.x = -1.05;
  tail.position.set(0, size * 1.78, -size * 1.0);
  g.add(tail);
  const neck = new THREE.Group();
  neck.position.set(0, size * 1.6, size * 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 6, 5), M(color));
  head.position.set(0, size * 0.7 + neckLen, size * 0.28);
  neck.add(head);
  {
    // EVERY fowl gets a neck — the old neckLen>0 gate left chicken, rooster,
    // ptarmigan and grouse heads floating beside the body
    const nl = neckLen + size * 0.75;
    const nm = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.22, nl, 5), M(color));
    nm.position.set(0, nl / 2 - size * 0.05, size * 0.18);
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

// the white wagtail — baltā cielava, Latvia's national bird. Grey back,
// white face and belly, black cap and bib, and the long tail that never
// stops bobbing. Built with a tail PIVOT so the perch behaviour can wag it.
function wagtail() {
  const g = new THREE.Group();
  const grey = M(0x9aa0a4), white = M(0xf0efe8), black = M(0x1c1d20);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), grey);
  body.scale.set(0.8, 0.78, 1.25);
  body.position.y = 0.085;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 6), white);
  belly.scale.set(0.72, 0.6, 1.1);
  belly.position.y = 0.062;
  g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.034, 7, 6), white);
  head.position.set(0, 0.135, 0.062);
  g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0345, 7, 6), black);
  cap.scale.set(0.94, 0.62, 0.8);
  cap.position.set(0, 0.152, 0.052);
  g.add(cap);
  const bib = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), black);
  bib.scale.set(0.8, 0.7, 0.5);
  bib.position.set(0, 0.108, 0.088);
  g.add(bib);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.028, 4), black);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.133, 0.1);
  g.add(beak);
  // tail pivot at the rump — the wag
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.095, -0.055);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.1), black);
  tail.position.z = -0.05;
  tailPivot.add(tail);
  g.add(tailPivot);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.006, 0.05), grey);
    w.geometry.translate(s * 0.0425, 0, 0);
    w.position.set(s * 0.02, 0.1, 0.01);
    g.add(w);
    wings.push(w);
  }
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 3), black);
    leg.position.set(s * 0.016, 0.028, 0.01);
    g.add(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, neck: null, legs: [], wings, tailPivot };
}

// bumblebee — kamene: a fat black-and-gold speck with a wing blur. Big
// enough to read at arm's length in the flowers, cheap enough for a dozen.
function bumblebee() {
  const g = new THREE.Group();
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), M(0x18140f));
  thorax.position.set(0, 0, 0.012);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.019, 6, 5), M(0xd8a020));
  band.scale.set(1, 0.85, 0.55);
  band.position.set(0, 0.002, -0.004);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), M(0x18140f));
  rump.scale.set(0.95, 0.9, 1.1);
  rump.position.set(0, 0, -0.02);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 5, 4), M(0xe8e2d4));
  tip.position.set(0, 0, -0.034);
  g.add(thorax, band, rump, tip);
  const wings = [];
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xdce8f0, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.016), wingMat);
    w.geometry.translate(s * 0.015, 0, 0);
    w.rotation.x = -Math.PI / 2;
    w.position.set(s * 0.008, 0.016, 0.005);
    g.add(w);
    wings.push(w);
  }
  return { group: g, neck: null, legs: [], wings, flapAxis: 'y' };
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
  // the S: base leans back, mid rises, top arches forward and the head
  // tips down — a straight column read as a periscope, not a swan
  const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.052, 0.26, 6), M(0xf4f2ea));
  n1.position.set(0, 0.1, 0.045);
  n1.rotation.x = -0.5;
  const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.24, 6), M(0xf4f2ea));
  n2.position.set(0, 0.3, 0.1);
  n2.rotation.x = 0.12;
  const n3 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 6), M(0xf4f2ea));
  n3.position.set(0, 0.44, 0.075);
  n3.rotation.x = 0.55;
  neck.add(n3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), M(0xf4f2ea));
  head.scale.set(0.85, 0.8, 1.15);
  head.position.set(0, 0.5, 0.03);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), M(beakC));
  beak.rotation.x = Math.PI / 2 + 0.25;      // swans carry the bill tipped down
  beak.position.set(0, 0.485, 0.1);
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
    // the pale eel-stripe the header always promised the bulls
    dorsalStripeColor: 0xb8a888,
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
    horse: true,
  }),
  horseBay: () => quadruped({
    shoulder: 1.55, length: 2.3, width: 0.58, legR: 0.06, color: 0x5a3a24,
    maneColor: 0x201812, neckLen: 0.7, headSize: 0.33, tail: 0.8,
    horse: true,
  }),
  horseKonik: () => quadruped({
    shoulder: 1.43, length: 2.12, width: 0.56, legR: 0.06, color: 0x85807a,
    maneColor: 0x181513, neckLen: 0.64, headSize: 0.3, tail: 0.74,
    horse: true, legColor: 0x383330, tailColor: 0x181513,
    tasselColor: 0x181513, dorsalStripeColor: 0x24201e,
  }),
  pig: () => quadruped({
    shoulder: 0.62, length: 1.2, width: 0.44, legR: 0.04, color: 0x3d3229,
    neckLen: 0.1, headSize: 0.24, ears: true, tail: 0.12,
  }),
  elk: () => quadruped({
    shoulder: 1.9, length: 2.7, width: 0.7, legR: 0.08, color: 0x4d4136,
    belly: 0x5c5044, neckLen: 0.5, headSize: 0.44, tail: 0.1,
    horns: { len: 0.7, r: 0.045, spread: 1.15, fwd: -0.1, palmate: true },
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
  wagtail: () => wagtail(),
  bee: () => bumblebee(),
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
      homeY: opts.fly === 'soar' ? heightAt(home.x, home.z) : null,
      speed: opts.speed ?? (kind.startsWith('chicken') || kind === 'rooster' ? 0.8 : kind === 'goose' ? 0.7 : 0.55),
      state: 'graze', timer: 1 + rng() * 5, tx: x, tz: z, heading: a.group.rotation.y,
      grazeBias: opts.grazeBias ?? (kind === 'pig' ? 0.85 : 0.68),
      static: opts.static ?? false, phase: rng() * 10,
      fly: opts.fly || null, level: opts.level, inWater: opts.inWater || null,
      hop: opts.hop || false, alt: opts.alt || [4, 16],
      low: opts.low || false, perches: opts.perches || null, pt: null,
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
    const geometries = new Set(), materials = new Set();
    for (const a of this.animals) {
      a.group.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (Array.isArray(o.material)) o.material.forEach((m) => materials.add(m));
        else if (o.material) materials.add(o.material);
      });
      this.group.remove(a.group);
    }
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
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
        const nx = g.position.x + Math.sin(a.heading) * a.speed * dart * dt;
        const nz = g.position.z + Math.cos(a.heading) * a.speed * dart * dt;
        // a straight chord between two in-water targets can cut a meander
        // bank — never take a step onto dry land, retarget instead
        if (!a.inWater || a.inWater(nx, nz)) {
          g.position.x = nx; g.position.z = nz;
        } else {
          a.state = 'idle'; a.timer = 0.4 + rng();
        }
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
      // bees work the flower layer, ankle-height; butterflies ride higher
      const wantY = a.low
        ? ground + 0.18 + (Math.sin(t * 0.9 + a.phase) + 1) * 0.3
        : ground + 0.5 + (Math.sin(t * 0.7 + a.phase) + 1) * 0.7 + Math.sin(t * 3.1 + a.phase * 2) * 0.15;
      g.position.y += clamp(wantY - g.position.y, -1.2 * dt, 1.2 * dt);
      g.rotation.y = Math.atan2(a.vx, a.vz);
      this.flap(a, t, a.low ? 70 : 24, a.low ? 0.5 : 1.05);
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
      g.position.y = a.homeY + a.alt[0] + (Math.sin(t * 0.04 + a.phase) + 1) * 0.5 * (a.alt[1] - a.alt[0]);
      g.rotation.y = -a.soarA + (a.phase > 5 ? 0 : Math.PI);
      g.rotation.z = (a.phase > 5 ? -1 : 1) * 0.22;
      this.flap(a, t, 3, Math.sin(t * 0.11 + a.phase) > 0.9 ? 0.4 : 0.02);
    } else if (a.fly === 'perch') {
      // wagtail life: bound-flight to a perch, sit and WAG, drop to the
      // grass to forage, flit to the next post. States: pfly / perched / forage
      if (!a.state || a.state === 'graze') { a.state = 'pfly'; a.pt = a.perches[(rng() * a.perches.length) | 0]; }
      if (a.state === 'pfly') {
        const dx = a.pt[0] - g.position.x, dy = a.pt[1] - g.position.y, dz = a.pt[2] - g.position.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 0.25) {
          g.position.set(a.pt[0], a.pt[1], a.pt[2]);
          a.state = a.pt[3] === 'ground' ? 'forage' : 'perched';
          a.timer = a.state === 'perched' ? 4 + rng() * 9 : 3 + rng() * 4;
        } else {
          const sp = Math.min(5.5, d * 2.2 + 1.2);
          g.position.x += (dx / d) * sp * dt;
          g.position.z += (dz / d) * sp * dt;
          // undulating bound flight: climb on flaps, dip on folds
          const bound = Math.sin(t * 5.5 + a.phase * 3);
          g.position.y += ((dy / d) * sp + bound * 0.9) * dt;
          g.rotation.y = Math.atan2(dx, dz);
          this.flap(a, t, bound > -0.2 ? 30 : 4, bound > -0.2 ? 0.8 : 0.08);
        }
      } else if (a.state === 'perched') {
        a.timer -= dt;
        this.flap(a, t, 0, 0);          // wings folded
        // THE wag: bursts of tail bobbing, a small head-turn between them
        if (a.tailPivot) {
          const burst = Math.sin(t * 0.6 + a.phase) > 0.1 ? 1 : 0.15;
          a.tailPivot.rotation.x = Math.sin(t * 8.5 + a.phase) * 0.4 * burst;
        }
        g.rotation.y += Math.sin(t * 0.4 + a.phase * 2) > 0.94 ? 1.4 * dt : 0;
        if (a.timer <= 0) {
          a.state = 'pfly';
          const ground = rng() < 0.4;
          if (ground) {
            const ang = rng() * Math.PI * 2, r = 2 + rng() * 5;
            const gx = g.position.x + Math.cos(ang) * r, gz = g.position.z + Math.sin(ang) * r;
            a.pt = [gx, heightAt(gx, gz) + 0.03, gz, 'ground'];
          } else {
            a.pt = a.perches[(rng() * a.perches.length) | 0];
          }
        }
      } else if (a.state === 'forage') {
        a.timer -= dt;
        this.flap(a, t, 0, 0);
        // quick runs and stops, tail going the whole time
        const running = Math.sin(t * 1.7 + a.phase * 4) > 0.2;
        if (running) {
          g.position.x += Math.sin(g.rotation.y) * 0.7 * dt;
          g.position.z += Math.cos(g.rotation.y) * 0.7 * dt;
          g.position.y = heightAt(g.position.x, g.position.z) + 0.03;
        } else if (Math.sin(t * 2.3 + a.phase) > 0.9) {
          g.rotation.y += (rng() - 0.5) * 2;
        }
        if (a.tailPivot) a.tailPivot.rotation.x = Math.sin(t * 8.5 + a.phase) * 0.35;
        if (a.timer <= 0) {
          a.state = 'pfly';
          a.pt = a.perches[(rng() * a.perches.length) | 0];
        }
      }
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
