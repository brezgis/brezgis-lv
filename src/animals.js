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
  g.add(neck);
  if (tail > 0) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, tail, 5), bodyMat);
    t.position.set(0, legH + bodyH * 0.62, -length / 2 - 0.02);
    t.rotation.x = 0.42;
    g.add(t);
    const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), M(0x2a2018));
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
};

// --- behaviour ----------------------------------------------------------------
export class AnimalManager {
  constructor() { this.animals = []; this.group = new THREE.Group(); this.group.name = 'animals'; }

  spawn(kind, home, opts = {}) {
    const a = SPECIES[kind]();
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * home.r;
    const x = home.x + Math.cos(angle) * r, z = home.z + Math.sin(angle) * r;
    a.group.position.set(x, heightAt(x, z), z);
    a.group.rotation.y = rng() * Math.PI * 2;
    const rec = {
      ...a, kind, home,
      speed: opts.speed ?? (kind.startsWith('chicken') || kind === 'rooster' ? 0.8 : kind === 'goose' ? 0.7 : 0.55),
      state: 'graze', timer: 1 + rng() * 5, tx: x, tz: z, heading: a.group.rotation.y,
      grazeBias: opts.grazeBias ?? (kind === 'pig' ? 0.85 : 0.68),
      static: opts.static ?? false, phase: rng() * 10,
    };
    this.animals.push(rec);
    this.group.add(a.group);
    return rec;
  }

  clear() {
    for (const a of this.animals) this.group.remove(a.group);
    this.animals.length = 0;
  }

  tick(t, dt) {
    for (const a of this.animals) {
      if (a.static) {
        // nest stork: occasional preen
        a.neck.rotation.x = Math.sin(t * 0.3 + a.phase) > 0.92 ? 0.8 : Math.sin(t * 0.5 + a.phase) * 0.06;
        continue;
      }
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
