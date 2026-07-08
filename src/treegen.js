// Procedural tree generator — a WebGL port of the LAAS vegetation pipeline
// (MIT, github.com/Braffolk/fable5-world-demo): parametric branching grammar
// (Skeleton.ts), generalized-cylinder bark tubes with root flare
// (TubeMesh.ts), real leaf/needle-spray meshes rendered once into a per-
// species twig atlas (FoliageCards.ts), then big alpha-tested cluster cards
// at the foliage anchors. Species parameters re-tuned from LAAS's Estonian
// old-growth presets to the Vidzeme Upland flora: Norway spruce, Scots pine,
// silver birch, pedunculate oak, black alder, small-leaved lime, apple.
//
// Attribute layout (consumed by the veg materials in vegetation.js):
//   color  : vec3 per-vertex albedo tint (hue jitter × baked crown AO)
//   aWind  : vec2 (flex 0 rigid..1 tip, phase 0..2π)
import * as THREE from 'three';
import { mulberry32 } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const GOLDEN = 2.39996323;

export function makeRng(seed) {
  const f = mulberry32(seed);
  return {
    float: f,
    int: (n) => (f() * n) | 0,
    chance: (p) => f() < p,
  };
}

// ---------------------------------------------------------------------------
// MeshGrower — one big indexed buffer per asset (1-2 draw calls per tree)
// ---------------------------------------------------------------------------
export class MeshGrower {
  constructor() {
    this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.wnd = [];
    this.idx = [];
    this.vertCount = 0;
  }
  vertex(px, py, pz, nx, ny, nz, u, v, cr, cg, cb, flex, phase) {
    this.pos.push(px, py, pz);
    this.nrm.push(nx, ny, nz);
    this.uv.push(u, v);
    this.col.push(cr, cg, cb);
    this.wnd.push(flex, phase);
    return this.vertCount++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  // blend normals toward a sphere around center — the crown-cohesion trick
  bendNormals(center, radius, k, fromVert = 0) {
    const inv = 1 / Math.max(0.001, radius);
    for (let i = fromVert; i < this.vertCount; i++) {
      let sx = (this.pos[i * 3] - center.x) * inv;
      let sy = (this.pos[i * 3 + 1] - center.y) * inv;
      let sz = (this.pos[i * 3 + 2] - center.z) * inv;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl; sy /= sl; sz /= sl;
      const nx = this.nrm[i * 3] * (1 - k) + sx * k;
      const ny = this.nrm[i * 3 + 1] * (1 - k) + sy * k;
      const nz = this.nrm[i * 3 + 2] * (1 - k) + sz * k;
      const l = Math.hypot(nx, ny, nz) || 1;
      this.nrm[i * 3] = nx / l; this.nrm[i * 3 + 1] = ny / l; this.nrm[i * 3 + 2] = nz / l;
    }
  }
  // depth-in-crown AO baked into the color attribute
  crownAO(center, radius, strength, fromVert = 0) {
    const inv = 1 / Math.max(0.001, radius);
    for (let i = fromVert; i < this.vertCount; i++) {
      const dx = (this.pos[i * 3] - center.x) * inv;
      const dy = (this.pos[i * 3 + 1] - center.y) * inv;
      const dz = (this.pos[i * 3 + 2] - center.z) * inv;
      const d = Math.min(1, Math.hypot(dx, dy, dz));
      const ao = 1 - strength * (1 - d) * (1 - d);
      this.col[i * 3] *= ao; this.col[i * 3 + 1] *= ao; this.col[i * 3 + 2] *= ao;
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(this.wnd), 2));
    g.setIndex(this.vertCount > 65535
      ? new THREE.BufferAttribute(new Uint32Array(this.idx), 1)
      : new THREE.BufferAttribute(new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Skeleton growth — recursive grammar with tropisms, wander, crown envelope
// ---------------------------------------------------------------------------
function crownEnvelope(shape, t, rng) {
  switch (shape) {
    case 'cone': return 0.18 + 0.82 * Math.pow(1 - t, 0.9);
    case 'ellipsoid': return Math.max(0.12, Math.sin(Math.PI * (0.08 + 0.88 * t)));
    case 'dome': return Math.max(0.15, Math.sqrt(Math.max(0, 1 - t * t * 0.92)));
    case 'column': return 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    default: return 0.3 + 0.7 * Math.abs(Math.sin(t * 9.7 + rng.float() * 6.28)) * (1 - t * 0.4);
  }
}
function perpBasis(dir, outN, outB) {
  const ref = Math.abs(dir.y) < 0.94 ? UP : new THREE.Vector3(1, 0, 0);
  outN.crossVectors(ref, dir).normalize();
  outB.crossVectors(dir, outN).normalize();
}

function growBranch(ctx, spec) {
  if (ctx.budget <= 0) return null;
  ctx.budget--;
  const { sp, rng, inst } = ctx;
  const lp = sp.levels[spec.level];
  const segs = Math.max(2, lp.segs);
  const isTrunk = spec.level === 0;
  const len = spec.stub ? spec.len * (0.12 + rng.float() * 0.18) : spec.len;
  const broken = spec.stub || (isTrunk && sp.brokenTop > 0 && sp.brokenTop < 1);
  const effLen = isTrunk && sp.brokenTop > 0 ? len * sp.brokenTop : len;

  const pts = [], radii = [], dirs = [];
  const dir = spec.baseDir.clone().normalize();
  const pos = spec.basePos.clone();
  const segLen = effLen / segs;
  const wanderPhase = rng.float() * Math.PI * 2;
  const wanderFreq = 1.5 + rng.float() * 2.5;
  const droopTotal = lp.droop * (0.7 + rng.float() * 0.6);
  const N = new THREE.Vector3(), B = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const tTaper = isTrunk && sp.brokenTop > 0 ? t * sp.brokenTop : t;
    let r = spec.baseR * Math.pow(Math.max(0, 1 - tTaper), lp.taper);
    r = isTrunk ? Math.max(r, spec.baseR * 0.012) : Math.max(r, 0.0035);
    pts.push(pos.clone()); radii.push(r); dirs.push(dir.clone());
    if (i === segs) break;
    perpBasis(dir, N, B);
    const wob = lp.wander * (isTrunk ? 1 : 1.4);
    const a1 = Math.sin(t * wanderFreq * Math.PI * 2 + wanderPhase) * wob + (rng.float() - 0.5) * wob;
    const a2 = Math.cos(t * wanderFreq * Math.PI * 1.7 + wanderPhase * 1.7) * wob + (rng.float() - 0.5) * wob;
    dir.addScaledVector(N, a1).addScaledVector(B, a2);
    dir.addScaledVector(UP, lp.gravitropism * (isTrunk ? 1 : 0.4 + t));
    dir.y -= droopTotal * t * (1 / segs) * 2.4;
    dir.y += lp.tipCurl * Math.max(0, t - 0.62) * (1 / segs) * 5.2;
    if (isTrunk) {
      dir.x += inst.leanX * (1 / segs) * (1.6 - t);
      dir.z += inst.leanZ * (1 / segs) * (1.6 - t);
    }
    dir.normalize();
    pos.addScaledVector(dir, segLen * (0.92 + rng.float() * 0.16));
  }

  const branch = { level: spec.level, pts, radii, dirs, len: effLen, broken };
  ctx.branches.push(branch);
  if (spec.stub) return branch;

  // children
  const childLevel = spec.level + 1;
  if (childLevel < sp.levels.length) {
    const cp = sp.levels[childLevel];
    const span = Math.max(0, cp.childEnd - cp.childStart);
    const count = Math.round(effLen * span * cp.density * (0.75 + inst.age * 0.45));
    if (count > 0) {
      const whorl = cp.whorl, planar = cp.planar || 0;
      const groups = whorl >= 2 ? Math.max(1, Math.round(count / whorl)) : count;
      let azimuth = rng.float() * Math.PI * 2;
      for (let gi = 0; gi < groups; gi++) {
        const tG = cp.childStart + span * ((gi + 0.5) / groups);
        const inWhorl = whorl >= 2 ? whorl : 1;
        azimuth += whorl >= 2 ? GOLDEN * 0.5 + rng.float() * 0.4 : 0;
        for (let wi = 0; wi < inWhorl; wi++) {
          const t = Math.min(0.985, tG + (rng.float() - 0.5) * (span / groups) * 0.6);
          let az;
          if (rng.float() < planar) {
            az = ((gi + wi) % 2 === 0 ? 0 : Math.PI) + (rng.float() - 0.5) * 0.55;
          } else if (whorl >= 2) {
            az = azimuth + (wi / inWhorl) * Math.PI * 2 + (rng.float() - 0.5) * 0.5;
          } else {
            az = azimuth += GOLDEN + (rng.float() - 0.5) * 0.35;
          }
          const idxF = t * segs;
          const i0 = Math.min(segs - 1, Math.floor(idxF));
          const f = idxF - i0;
          const pPos = new THREE.Vector3().lerpVectors(pts[i0], pts[i0 + 1], f);
          const pDir = new THREE.Vector3().lerpVectors(dirs[i0], dirs[i0 + 1], f).normalize();
          const pR = radii[i0] * (1 - f) + radii[i0 + 1] * f;
          perpBasis(pDir, N, B);
          const side = new THREE.Vector3()
            .addScaledVector(N, Math.cos(az)).addScaledVector(B, Math.sin(az));
          const angle = cp.angleBase + (cp.angleTip - cp.angleBase) * t + (rng.float() - 0.5) * 0.16;
          const cDir = new THREE.Vector3()
            .addScaledVector(pDir, Math.cos(angle)).addScaledVector(side, Math.sin(angle)).normalize();
          const env = crownEnvelope(sp.crown, isTrunk ? t : t * 0.6 + 0.4, rng);
          const asymK = 1 + sp.asym * (cDir.x * inst.biasX + cDir.z * inst.biasZ) * (isTrunk ? 1 : 0.4);
          const cLen = effLen * cp.lenRatio * env * asymK * (1 + (rng.float() - 0.5) * 2 * cp.lenJitter);
          if (cLen < 0.05) continue;
          const cR = Math.min(pR * cp.radRatio * (0.55 + env * 0.45), pR * 0.8);
          growBranch(ctx, {
            level: childLevel, basePos: pPos, baseDir: cDir, len: cLen, baseR: cR,
            stub: sp.stubChance > 0 && rng.chance(sp.stubChance),
          });
        }
      }
    }
  }

  // foliage anchors on the twig level
  const fol = sp.foliage;
  if (fol && spec.level === fol.anchorLevel && !branch.broken) {
    const from = Math.max(0, fol.tStart);
    const n = Math.max(1, Math.round((effLen * (1 - from)) / fol.spacing));
    // when the anchor level has NO rendered tube (conifers: tubeMaxLevel 1,
    // anchors on invisible level-2 twigs), crowd the anchors toward the twig
    // BASE so the sprays attach to the visible branch instead of floating
    // beside it — the cards span outward and still fill the old crown
    const hug = fol.anchorLevel > (sp.tubeMaxLevel ?? 1);
    const q = new THREE.Quaternion(), qTwist = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
    for (let i = 0; i <= n; i++) {
      const t = Math.min(1, from + (1 - from) * (i / n) * (hug ? 0.5 : 1));
      const idxF = t * segs;
      const i0 = Math.min(segs - 1, Math.floor(idxF));
      const f = idxF - i0;
      const aPos = new THREE.Vector3().lerpVectors(pts[i0], pts[i0 + 1], f);
      const aDir = new THREE.Vector3().lerpVectors(dirs[i0], dirs[i0 + 1], f).normalize();
      const terminal = i === n;
      perpBasis(aDir, N, B);
      const az = terminal ? 0
        : fol.planarLeaves ? (i % 2 === 0 ? 0 : Math.PI) + (rng.float() - 0.5) * 0.6
        : GOLDEN * i + (rng.float() - 0.5) * 0.7;
      const out = terminal ? aDir.clone()
        : new THREE.Vector3()
            .addScaledVector(aDir, Math.cos(fol.tilt))
            .addScaledVector(new THREE.Vector3().addScaledVector(N, Math.cos(az)).addScaledVector(B, Math.sin(az)), Math.sin(fol.tilt))
            .normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
      const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const horizUp = new THREE.Vector3().addScaledVector(out, -out.y).add(UP).normalize();
      const twistAngle = Math.atan2(
        new THREE.Vector3().crossVectors(localY, horizUp).dot(out), localY.dot(horizUp));
      qTwist.setFromAxisAngle(out, twistAngle + (rng.float() - 0.5) * 0.5);
      q.premultiply(qTwist);
      const sideAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      qTilt.setFromAxisAngle(sideAxis, (rng.float() - 0.5) * 0.24 + 0.08);
      q.premultiply(qTilt);
      const sc = (fol.scale[0] + rng.float() * (fol.scale[1] - fol.scale[0])) *
        (terminal ? 0.85 : 0.72 + t * 0.42) * (hug ? 1.2 : 1);
      ctx.anchors.push({
        pos: aPos.clone().addScaledVector(out, sc * 0.06),
        quat: q.clone(), scale: sc,
        hue: rng.float() * 2 - 1,
        age: Math.max(0, 1 - t) * 0.7 + rng.float() * 0.3,
      });
    }
  }
  return branch;
}

export function growSkeleton(sp, rng, instOverride) {
  const inst = {
    leanX: (rng.float() - 0.5) * 0.12, leanZ: (rng.float() - 0.5) * 0.12,
    biasX: 0, biasZ: 0, age: 0.5 + rng.float() * 0.5, ...instOverride,
  };
  if (inst.biasX === 0 && inst.biasZ === 0) {
    const a = rng.float() * Math.PI * 2;
    inst.biasX = Math.cos(a); inst.biasZ = Math.sin(a);
  }
  const height = (sp.height[0] + rng.float() * (sp.height[1] - sp.height[0])) * (0.72 + inst.age * 0.36);
  const ctx = { sp, rng, inst, branches: [], anchors: [], budget: 4000 };
  growBranch(ctx, {
    level: 0, basePos: new THREE.Vector3(),
    baseDir: new THREE.Vector3(inst.leanX * 0.7, 1, inst.leanZ * 0.7).normalize(),
    len: height, baseR: height * sp.trunkRadiusK, stub: false,
  });
  let minY = Infinity, maxY = -Infinity, maxR = 0.5;
  for (const a of ctx.anchors) {
    minY = Math.min(minY, a.pos.y); maxY = Math.max(maxY, a.pos.y);
    maxR = Math.max(maxR, Math.hypot(a.pos.x, a.pos.z));
  }
  if (!Number.isFinite(minY)) { minY = height * 0.3; maxY = height; }
  return {
    branches: ctx.branches, anchors: ctx.anchors, height,
    crownCenter: new THREE.Vector3(0, (minY + maxY) * 0.5, 0), crownRadius: Math.max(maxR, (maxY - minY) * 0.55),
  };
}

// ---------------------------------------------------------------------------
// Tube mesher — parallel-transport generalized cylinders + root flare
// ---------------------------------------------------------------------------
const _N = new THREE.Vector3(), _B = new THREE.Vector3(), _T = new THREE.Vector3(), _v = new THREE.Vector3();

export function tubeForBranch(g, br, opts, rng) {
  const n = br.pts.length;
  if (n < 2) return;
  const rings = [];
  let lastRingPos = [], firstRingPos = [];
  _T.copy(br.dirs[0]);
  const ref = Math.abs(_T.y) < 0.94 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  _N.crossVectors(ref, _T).normalize();
  _B.crossVectors(_T, _N).normalize();
  const segsAround = Math.max(4, opts.ringSegs);
  let vAlong = 0;
  const baseR = Math.max(br.radii[0], 1e-4);
  const tint = opts.tint;

  for (let i = 0; i < n; i++) {
    const p = br.pts[i], r = br.radii[i];
    if (i > 0) {
      vAlong += _v.subVectors(p, br.pts[i - 1]).length();
      const axis = _v.crossVectors(br.dirs[i - 1], br.dirs[i]);
      const s = axis.length();
      if (s > 1e-6) {
        axis.multiplyScalar(1 / s);
        const ang = Math.asin(Math.min(1, s));
        _N.applyAxisAngle(axis, ang).normalize();
        _B.applyAxisAngle(axis, ang).normalize();
      }
    }
    const tt = i / (n - 1);
    const rNext = br.radii[Math.min(n - 1, i + 1)], rPrev = br.radii[Math.max(0, i - 1)];
    const slope = (rPrev - rNext) * (n - 1) / Math.max(0.05, br.len) * 0.5;
    const ring = [], ringPos = [];
    const flex = opts.swayFlexBase + (opts.swayFlexTip - opts.swayFlexBase) * tt;
    for (let k = 0; k <= segsAround; k++) {
      const a = (k / segsAround) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let rr = r;
      if (opts.flare && br.level === 0) {
        const h = br.pts[i].y - br.pts[0].y;
        const lobe = Math.pow(Math.max(0, Math.cos(opts.flare.lobes * a + opts.flare.phase)), 1.6);
        rr *= 1 + opts.flare.amp * Math.exp(-h / opts.flare.height) * (0.45 + 0.9 * lobe);
      }
      const dx = _N.x * ca + _B.x * sa, dy = _N.y * ca + _B.y * sa, dz = _N.z * ca + _B.z * sa;
      const tan = br.dirs[i];
      let nx = dx + tan.x * slope, ny = dy + tan.y * slope, nz = dz + tan.z * slope;
      const nl = Math.hypot(nx, ny, nz) || 1;
      ringPos.push(p.x + dx * rr, p.y + dy * rr, p.z + dz * rr);
      ring.push(g.vertex(
        p.x + dx * rr, p.y + dy * rr, p.z + dz * rr,
        nx / nl, ny / nl, nz / nl,
        (k / segsAround) * opts.uRepeats,
        (vAlong / (Math.PI * 2 * baseR)) * opts.uRepeats * (opts.vScale || 1),
        tint[0], tint[1], tint[2], flex, opts.swayPhase));
    }
    rings.push(ring);
    lastRingPos = ringPos;
    if (i === 0) firstRingPos = ringPos;
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let k = 0; k < segsAround; k++) g.quad(a[k], a[k + 1], b[k + 1], b[k]);
  }
  // base cap for free-lying logs
  if (opts.capBase && baseR > 0.015) {
    const baseP = br.pts[0], baseD = br.dirs[0], first = rings[0];
    const dk = 0.55; // cut-face darkening
    const center = g.vertex(
      baseP.x - baseD.x * baseR * 0.4, baseP.y - baseD.y * baseR * 0.4, baseP.z - baseD.z * baseR * 0.4,
      -baseD.x, -baseD.y, -baseD.z, 0.5, 0.5, tint[0] * dk, tint[1] * dk, tint[2] * dk, opts.swayFlexBase, opts.swayPhase);
    const jag = [];
    for (let k = 0; k <= segsAround; k++) {
      const px = baseP.x + (firstRingPos[k * 3] - baseP.x) * 0.45;
      const py = baseP.y + (firstRingPos[k * 3 + 1] - baseP.y) * 0.45;
      const pz = baseP.z + (firstRingPos[k * 3 + 2] - baseP.z) * 0.45;
      const spike = (rng.float() * 0.9 + 0.25) * baseR * 1.4;
      jag.push(g.vertex(px - baseD.x * spike, py - baseD.y * spike, pz - baseD.z * spike,
        -baseD.x, -baseD.y, -baseD.z, 0.5, 0.5, tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5, opts.swayFlexBase, opts.swayPhase));
    }
    for (let k = 0; k < segsAround; k++) {
      g.quad(first[k], jag[k], jag[k + 1], first[k + 1]);
      g.tri(jag[k], center, jag[k + 1]);
    }
  }
  // tip: jagged break or taper to a point
  const last = rings[rings.length - 1];
  const tipP = br.pts[n - 1], tipD = br.dirs[n - 1], tipR = br.radii[n - 1];
  if (br.broken && tipR > 0.015) {
    const center = g.vertex(
      tipP.x + tipD.x * tipR * 0.4, tipP.y + tipD.y * tipR * 0.4, tipP.z + tipD.z * tipR * 0.4,
      tipD.x, tipD.y, tipD.z, 0.5, 0.5, tint[0] * 0.55, tint[1] * 0.55, tint[2] * 0.55, opts.swayFlexTip, opts.swayPhase);
    const jag = [];
    for (let k = 0; k <= segsAround; k++) {
      const px = tipP.x + (lastRingPos[k * 3] - tipP.x) * 0.45;
      const py = tipP.y + (lastRingPos[k * 3 + 1] - tipP.y) * 0.45;
      const pz = tipP.z + (lastRingPos[k * 3 + 2] - tipP.z) * 0.45;
      const spike = (rng.float() * 0.9 + 0.25) * tipR * 1.4;
      jag.push(g.vertex(px + tipD.x * spike, py + tipD.y * spike, pz + tipD.z * spike,
        tipD.x, tipD.y, tipD.z, 0.5, 0.5, tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5, opts.swayFlexTip, opts.swayPhase));
    }
    for (let k = 0; k < segsAround; k++) {
      g.quad(last[k], last[k + 1], jag[k + 1], jag[k]);
      g.tri(jag[k + 1], center, jag[k]);
    }
  } else {
    const tip = g.vertex(
      tipP.x + tipD.x * tipR * 2, tipP.y + tipD.y * tipR * 2, tipP.z + tipD.z * tipR * 2,
      tipD.x, tipD.y, tipD.z, 0.5, vAlong / (Math.PI * 2 * baseR) + 0.2,
      tint[0], tint[1], tint[2], opts.swayFlexTip, opts.swayPhase);
    for (let k = 0; k < segsAround; k++) g.tri(last[k + 1], tip, last[k]);
  }
}

function ringsForLevel(level, lodK) {
  const base = level === 0 ? 11 : level === 1 ? 6 : 5;
  return Math.max(4, Math.round(base * lodK));
}

export function tubesForSkeleton(g, skel, sp, rng, { lodK = 0.8, maxLevel = 99, stride = 1 } = {}) {
  let bi = 0;
  for (const br of skel.branches) {
    if (br.level > maxLevel) continue;
    if (br.level >= 1 && stride > 1 && bi++ % stride !== 0) continue;
    const flexB = br.level === 0 ? 0 : br.level === 1 ? 0.1 : 0.28;
    const flexT = br.level === 0 ? 0.04 : br.level === 1 ? 0.3 : 0.6;
    const j = 0.9 + rng.float() * 0.2; // per-branch bark value jitter
    tubeForBranch(g, br, {
      ringSegs: ringsForLevel(br.level, lodK),
      uRepeats: br.level === 0 ? sp.barkRepeats : Math.max(1, Math.round(sp.barkRepeats * 0.4)),
      vScale: 1,
      flare: br.level === 0 ? { ...sp.flare, phase: rng.float() * 6.28 } : undefined,
      swayPhase: rng.float() * Math.PI * 2,
      swayFlexBase: flexB, swayFlexTip: flexT,
      tint: [j, j, j],
    }, rng);
  }
}

// ---------------------------------------------------------------------------
// Leaf & needle-spray meshes (real geometry — only ever rendered into atlases)
// ---------------------------------------------------------------------------
const _p = new THREE.Vector3(), _n2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

function pushXf(g, m, px, py, pz, nx, ny, nz, u, v, cr, cg, cb) {
  _p.set(px, py, pz).applyMatrix4(m);
  _n2.set(nx, ny, nz).transformDirection(m);
  return g.vertex(_p.x, _p.y, _p.z, _n2.x, _n2.y, _n2.z, u, v, cr, cg, cb, 0, 0);
}

// per-leaf albedo: species base × hue jitter × AO; vein/tip light painted per-vertex
function leafColor(sp, hue, ao, s /* 0 base .. 1 tip */, isMid) {
  const c = sp.foliageColor;
  const k = hue * c.hueVar;
  let r = c.r, gg = c.g, b = c.b;
  if (k > 0) { r *= 1 + 0.25 * k; gg *= 1 + 0.05 * k; b *= 1 - 0.5 * k; }
  else { r *= 1 + 0.28 * k; gg *= 1 - 0.05 * k; b *= 1 - 0.2 * k; }
  const tip = 0.92 + 0.26 * s;
  const mid = isMid ? 1.14 : 1.0;
  return [r * ao * tip * mid, gg * ao * tip * mid, b * ao * tip * mid];
}

export function buildLeaf(g, m, sp, shape, hue, ao) {
  const ROWS = 4, L = shape.len, W = shape.width;
  const rows = [];
  const stem = L * 0.14;
  for (let i = 0; i <= ROWS; i++) {
    const s = i / ROWS;
    const w = W * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.86 + 0.07)), shape.shapePow);
    // oak: lobed margin — scallop the width along the blade
    const scallop = shape.lobes ? 1 - 0.34 * Math.abs(Math.sin(s * Math.PI * shape.lobes)) : 1;
    const z = stem + s * (L - stem);
    const curlY = -shape.curl * s * s * L;
    const foldY = shape.fold * w;
    const [er, eg, eb] = leafColor(sp, hue, ao * 0.92, s, false);
    const [mr, mg, mb] = leafColor(sp, hue, ao, s, true);
    const r = [];
    r.push(pushXf(g, m, -w * scallop, curlY - foldY, z, -shape.fold * 0.8, 1, 0, 0, s, er, eg, eb));
    r.push(pushXf(g, m, 0, curlY + foldY * 0.35, z, 0, 1, shape.curl * s, 0.5, s, mr, mg, mb));
    r.push(pushXf(g, m, w * scallop, curlY - foldY, z, shape.fold * 0.8, 1, 0, 1, s, er, eg, eb));
    rows.push(r);
  }
  for (let i = 0; i < ROWS; i++) {
    const a = rows[i], b = rows[i + 1];
    g.quad(a[0], b[0], b[1], a[1]);
    g.quad(a[1], b[1], b[2], a[2]);
  }
  const [sr, sg, sb] = leafColor(sp, hue, ao * 0.8, 0, false);
  const p0 = pushXf(g, m, -W * 0.06, 0, 0, 0, 1, 0, 0.45, 0, sr, sg, sb);
  const p1 = pushXf(g, m, W * 0.06, 0, 0, 0, 1, 0, 0.55, 0, sr, sg, sb);
  g.quad(p0, rows[0][0], rows[0][1], p1);
  g.tri(p1, rows[0][1], rows[0][2]);
}

export function buildNeedleSpray(g, m, sp, shape, scale, rng, hue, ao) {
  const SEGS = 4, L = scale;
  const stemPts = [];
  let dz = 1, dy = 0, z = 0, y = 0;
  for (let i = 0; i <= SEGS; i++) {
    stemPts.push(new THREE.Vector3(0, y, z));
    const step = L / SEGS;
    dy -= 0.16 * (i / SEGS);
    const dl = Math.hypot(dy, dz);
    z += (dz / dl) * step; y += (dy / dl) * step;
  }
  const sw = L * 0.012 + 0.002;
  const twig = [0.21 * ao, 0.15 * ao, 0.1 * ao];
  const stemRows = [];
  for (let i = 0; i <= SEGS; i++) {
    const p = stemPts[i], w = sw * (1 - (i / SEGS) * 0.7);
    stemRows.push([
      pushXf(g, m, p.x - w, p.y, p.z, 0, 1, 0, 0.48, i / SEGS, twig[0], twig[1], twig[2]),
      pushXf(g, m, p.x + w, p.y, p.z, 0, 1, 0, 0.52, i / SEGS, twig[0], twig[1], twig[2]),
    ]);
  }
  for (let i = 0; i < SEGS; i++) {
    g.quad(stemRows[i][0], stemRows[i + 1][0], stemRows[i + 1][1], stemRows[i][1]);
  }
  const count = shape.needleCount, nl = shape.len, nw = shape.width;
  for (let i = 0; i < count; i++) {
    const s = (i + 0.5) / count;
    const idxF = s * SEGS;
    const i0 = Math.min(SEGS - 1, Math.floor(idxF));
    const base = _p.copy(stemPts[i0]).lerp(stemPts[i0 + 1], idxF - i0).clone();
    const side = i % 2 === 0 ? 1 : -1;
    const layer = i % 4 < 2 ? 1 : 0;
    const az = shape.brush > 0.5 ? rng.float() * Math.PI * 2 : side * (1.05 + (rng.float() - 0.5) * 0.85);
    const elev = shape.brush > 0.5 ? (rng.float() - 0.2) * 1.1
      : (layer === 1 ? 0.42 : 0.02) + (rng.float() - 0.5) * 0.3;
    const swing = (rng.float() - 0.5) * 0.3 + s * 0.55;
    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(elev), Math.sin(elev),
      Math.cos(az) * Math.cos(elev) * 0.35 + swing).normalize();
    const lenJ = nl * (0.75 + rng.float() * 0.5) * (0.65 + 0.35 * Math.sin(Math.PI * Math.min(1, s * 1.18)));
    const tip = base.clone().addScaledVector(dir, lenJ);
    const across = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(nw * 0.5);
    const nrm = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -0.25).normalize();
    const hueN = hue + (rng.float() - 0.5) * 0.5;
    const [br2, bg, bb] = leafColor(sp, hueN, ao * 0.9, 0.15, false);
    const [tr, tg, tb] = leafColor(sp, hueN, ao, 0.9, false);
    const a0 = pushXf(g, m, base.x - across.x, base.y, base.z - across.z, nrm.x, nrm.y, nrm.z, 0, 0, br2, bg, bb);
    const a1 = pushXf(g, m, base.x + across.x, base.y, base.z + across.z, nrm.x, nrm.y, nrm.z, 1, 0, br2, bg, bb);
    const b0 = pushXf(g, m, tip.x - across.x * 0.25, tip.y, tip.z - across.z * 0.25, nrm.x, nrm.y, nrm.z, 0.4, 1, tr, tg, tb);
    const b1 = pushXf(g, m, tip.x + across.x * 0.25, tip.y, tip.z + across.z * 0.25, nrm.x, nrm.y, nrm.z, 0.6, 1, tr, tg, tb);
    g.quad(a0, b0, b1, a1);
  }
}

// twig content for one atlas tile (cx, cy centred, tile size 1) — LAAS
// buildTwigTile: a lush spray/cluster of REAL meshes, captured once
export function buildTwigTile(g, sp, rng, cx, cy) {
  const fol = sp.foliage;
  if (!fol) return;
  const half = 0.46;
  if (fol.kind === 'needleSpray') {
    const brush = fol.leaf.brush > 0.5;
    const scaleToTile = (2 * half) / (fol.scale[1] * 1.15);
    const leaf = {
      ...fol.leaf,
      len: fol.leaf.len * scaleToTile,
      width: fol.leaf.width * scaleToTile * 1.15,
      needleCount: Math.round(fol.leaf.needleCount * (brush ? 1.4 : 1.2)),
    };
    const sprayLen = fol.scale[1] * scaleToTile;
    const sub = brush ? 6 : 9;
    for (let i = -1; i < sub; i++) {
      const t = i < 0 ? 0 : (i + 0.6) / sub;
      const along = -half + t * sprayLen * 0.8;
      const ang = i < 0 ? 0 : (i % 2 === 0 ? 1 : -1) * (0.75 + rng.float() * 0.65) * (brush ? 1.1 : 1);
      _q.setFromAxisAngle(Z, ang);
      _q2.setFromAxisAngle(X, -Math.PI / 2);
      _q.multiply(_q2);
      const s = i < 0 ? 1 : (0.5 + rng.float() * 0.32) * (1.1 - t * 0.35);
      _m.compose(
        new THREE.Vector3(cx + (i < 0 ? 0 : Math.sin(ang) * 0.06), cy + along, 0),
        _q, new THREE.Vector3(s, s, s));
      buildNeedleSpray(g, _m, sp, leaf, sprayLen * (i < 0 ? 1 : s * 0.8), rng,
        rng.float() * 2 - 1, 0.72 + rng.float() * 0.28);
    }
  } else {
    // denser, smaller leaves: 14 leaves at ~44% tile span projected onto
    // 1-2m cards read as low-poly shards at eye level
    const n = 26 + rng.int(9);
    const leafScale = (2 * half) / (fol.leaf.len * 3.2);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const spread = 0.5 + t * 0.6;
      const ang = (rng.float() - 0.5) * 3.0 * spread;
      const r = (0.15 + t * 0.85) * half * (0.75 + rng.float() * 0.45);
      const px = cx + Math.sin(ang) * r;
      const py = cy - half * 0.82 + (t * 1.45 + rng.float() * 0.3) * half;
      _q.setFromAxisAngle(Z, ang * 0.8 + (rng.float() - 0.5) * 0.5);
      _q2.setFromAxisAngle(X, -Math.PI / 2 + 0.45 + (rng.float() - 0.3) * 0.7);
      _q.multiply(_q2);
      const s = leafScale * (0.75 + rng.float() * 0.5);
      _m.compose(new THREE.Vector3(px, py, (rng.float() - 0.5) * 0.05), _q, new THREE.Vector3(s, s, s));
      buildLeaf(g, _m, sp, fol.leaf, rng.float() * 2 - 1, 0.65 + rng.float() * 0.35);
    }
  }
}

// cluster cards at every anchor — 2×2 atlas tile per card, cross or lying
export function buildFoliageCards(g, anchors, opts, rng) {
  const right = new THREE.Vector3(), upL = new THREE.Vector3(), out = new THREE.Vector3();
  const p = new THREE.Vector3(), rowPos = new THREE.Vector3(), dirRow = new THREE.Vector3(), nrmRow = new THREE.Vector3();
  const bend = opts.bend || 0;
  const rows = bend !== 0 ? 3 : 1;
  for (const a of anchors) {
    const tile = rng.int(4);
    const u0 = (tile % 2) * 0.5, v0 = Math.floor(tile / 2) * 0.5;
    const s = a.scale * opts.sizeK;
    _q.copy(a.quat);
    _q2.setFromAxisAngle(Z, (rng.float() - 0.5) * 0.7);
    _q.multiply(_q2);
    right.set(1, 0, 0).applyQuaternion(_q);
    upL.set(0, 1, 0).applyQuaternion(_q);
    out.set(0, 0, 1).applyQuaternion(_q);
    const flex = 0.45 + rng.float() * 0.35;
    const phase = rng.float() * Math.PI * 2;
    // 'lying' fans get a smaller perpendicular fin too — a single quad
    // collapses to a razor slice seen edge-on at eye level
    const planes = opts.mode === 'flat' ? 1 : 2;
    const bendJ = bend * (0.75 + rng.float() * 0.5);
    const tintV = 1 - a.age * 0.25;
    const hueK = a.hue * 0.12;
    const cr = tintV * (1 + hueK), cg = tintV, cb = tintV * (1 - hueK);
    for (let pl = 0; pl < planes; pl++) {
      const sPl = opts.mode === 'lying' && pl === 1 ? s * 0.6 : s;
      const w = pl === 0 ? right : upL;
      const nrm = pl === 0 ? upL : right;
      const base = g.vertCount;
      rowPos.copy(a.pos).addScaledVector(out, -0.08 * sPl);
      for (let iv = 0; iv <= rows; iv++) {
        const t = iv / rows;
        const ang = bendJ * t;
        dirRow.copy(out).multiplyScalar(Math.cos(ang)).addScaledVector(nrm, -Math.sin(ang));
        nrmRow.copy(nrm).multiplyScalar(Math.cos(ang)).addScaledVector(out, Math.sin(ang));
        for (let iu = 0; iu <= 1; iu++) {
          p.copy(rowPos).addScaledVector(w, (iu - 0.5) * sPl);
          g.vertex(p.x, p.y, p.z, nrmRow.x, nrmRow.y, nrmRow.z,
            u0 + iu * 0.5, v0 + t * 0.5, cr, cg, cb, flex, phase);
        }
        if (iv < rows) rowPos.addScaledVector(dirRow, sPl / rows);
      }
      for (let iv = 0; iv < rows; iv++) {
        const r0 = base + iv * 2;
        g.quad(r0, r0 + 1, r0 + 3, r0 + 2);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Whole trees, understory pieces
// ---------------------------------------------------------------------------
export function buildTree(sp, seed) {
  const rng = makeRng(seed);
  const skel = growSkeleton(sp, rng);
  const bark = new MeshGrower();
  tubesForSkeleton(bark, skel, sp, rng, {
    lodK: sp.lodK ?? 0.7,
    maxLevel: sp.tubeMaxLevel ?? 1,
    stride: sp.tubeStride ?? 1,
  });
  bark.crownAO(skel.crownCenter, skel.crownRadius * 1.15, 0.28);
  const cards = new MeshGrower();
  if (sp.foliage) {
    buildFoliageCards(cards, skel.anchors, sp.foliage.card, rng);
    cards.bendNormals(skel.crownCenter, skel.crownRadius, sp.foliage.normalBend);
    cards.crownAO(skel.crownCenter, skel.crownRadius * 1.1, 0.45);
  }
  return { bark: bark.build(), cards: cards.build(), skel };
}

export function buildFern(seed) {
  const rng = makeRng(seed);
  const g = new MeshGrower();
  const fronds = 6 + rng.int(5);
  const anchors = [];
  const q = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < fronds; i++) {
    const az = (i / fronds) * Math.PI * 2 + rng.float() * 0.6;
    const pitch = 0.75 + rng.float() * 0.4;
    q.setFromAxisAngle(Y, az);
    qt.setFromAxisAngle(X, -(Math.PI / 2 - pitch));
    q.multiply(qt);
    anchors.push({
      pos: new THREE.Vector3(Math.cos(az) * 0.03, 0.02, Math.sin(az) * 0.03),
      quat: q.clone(), scale: 0.2 + rng.float() * 0.14,
      hue: rng.float() * 2 - 1, age: rng.float() * 0.4,
    });
  }
  // mostly FLAT arching fronds (a real frond is planar — full crosses made
  // the rosette read as a solid teepee); every third is crossed so the
  // silhouette stays full edge-on
  buildFoliageCards(g, anchors.filter((_, i) => i % 3 === 0), { mode: 'cross', sizeK: 2.4, bend: 1.0 }, rng);
  buildFoliageCards(g, anchors.filter((_, i) => i % 3 !== 0), { mode: 'flat', sizeK: 2.4, bend: 1.1 }, rng);
  return g.build();
}

export function buildLog(seed, decay) {
  const rng = makeRng(seed);
  const g = new MeshGrower();
  const len = 2.6 + rng.float() * 2.6;
  const r0 = 0.16 + rng.float() * 0.16;
  const segs = 9;
  const pts = [], radii = [], dirs = [];
  const wob = rng.float() * Math.PI * 2;
  const squish = decay === 'rotten' ? 0.72 : 1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(
      (t - 0.5) * len,
      (r0 * 0.82 - Math.sin(t * Math.PI) * 0.03 + Math.sin(t * 7 + wob) * 0.015) * squish,
      Math.sin(t * 2.2 + wob) * len * 0.035));
    const taper = decay === 'rotten' ? 0.88 : 0.94;
    radii.push(r0 * (1 - t * (1 - taper)) * (1 + Math.sin(t * 13 + wob) * 0.05));
    dirs.push(new THREE.Vector3(1, 0, Math.cos(t * 2.2 + wob) * 0.08).normalize());
  }
  const mossK = decay === 'fresh' ? 0.15 : decay === 'mossy' ? 0.8 : 1.0;
  // moss tint folded into vertex color: green shift on the upper hemisphere
  tubeForBranch(g, { level: 0, pts, radii, dirs, len, broken: true }, {
    ringSegs: 10, uRepeats: 3, vScale: 1, capBase: true,
    swayPhase: 0, swayFlexBase: 0, swayFlexTip: 0, tint: [1, 1, 1],
  }, rng);
  const col = g.col, nrm = g.nrm;
  for (let i = 0; i < g.vertCount; i++) {
    const up = Math.max(0, nrm[i * 3 + 1]);
    const moss = mossK * up * up;
    col[i * 3] *= 1 - moss * 0.55;
    col[i * 3 + 1] *= 1 - moss * 0.1;
    col[i * 3 + 2] *= 1 - moss * 0.62;
  }
  return { geometry: g.build(), length: len };
}

export function buildStump(seed) {
  const rng = makeRng(seed);
  const g = new MeshGrower();
  const h = 0.5 + rng.float() * 0.6;
  const r0 = 0.22 + rng.float() * 0.14;
  const segs = 5;
  const pts = [], radii = [], dirs = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3((rng.float() - 0.5) * 0.02, t * h, (rng.float() - 0.5) * 0.02));
    radii.push(r0 * (1 - t * 0.18));
    dirs.push(new THREE.Vector3(0, 1, 0));
  }
  tubeForBranch(g, { level: 0, pts, radii, dirs, len: h, broken: true }, {
    ringSegs: 10, uRepeats: 3, vScale: 1,
    flare: { amp: 0.85, height: h * 0.55, lobes: 5, phase: rng.float() * 6.28 },
    swayPhase: 0, swayFlexBase: 0, swayFlexTip: 0, tint: [1, 1, 1],
  }, rng);
  return { geometry: g.build(), length: h };
}

// glacial-erratic boulder: deformed icosphere, grey granite w/ moss cap
export function buildBoulder(seed) {
  const rng = makeRng(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const f1 = 1 + rng.float() * 0.6, f2 = 1 + rng.float() * 0.9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = 1 + 0.24 * Math.sin(x * 2.1 * f1 + 5 * rng.float() * 0) * Math.sin(z * 1.7 * f2 + y)
      + 0.13 * Math.sin(y * 4.2 + x * 2.7) + 0.07 * Math.sin(z * 6.1 - y * 3.3);
    pos.setXYZ(i, x * d, y * d * (0.62 + 0.2 * Math.abs(Math.sin(f1 * 3))), z * d);
  }
  geo.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = geo.attributes.normal.getY(i);
    const g0 = 0.52 + 0.14 * Math.sin(pos.getX(i) * 7.7 + pos.getZ(i) * 5.1);
    const moss = Math.max(0, ny) * Math.max(0, ny) * 0.7;
    col[i * 3] = g0 * (1 - moss * 0.5);
    col[i * 3 + 1] = g0 * (1 - moss * 0.12);
    col[i * 3 + 2] = g0 * (1 - moss * 0.55) * 0.98;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const wnd = new Float32Array(pos.count * 2);
  geo.setAttribute('aWind', new THREE.BufferAttribute(wnd, 2));
  return geo;
}

// ---------------------------------------------------------------------------
// Species presets — Vidzeme Upland flora (hemiboreal, as in the LAAS
// Estonian reference). Leaf/crown params from LAAS, heights from Latvian
// forestry ranges.
// ---------------------------------------------------------------------------
const LV = {}; // species registry

LV.spruce = { // egle — Picea abies
  id: 'spruce', kind: 'conifer', height: [18, 28], trunkRadiusK: 0.016,
  crown: 'cone', asym: 0.22,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 12, wander: 0.015, gravitropism: 0.05, droop: 0, tipCurl: 0, taper: 1.0 },
    { density: 2.4, whorl: 4, childStart: 0.1, childEnd: 0.985, angleBase: 1.78, angleTip: 0.55, lenRatio: 0.19, lenJitter: 0.2, radRatio: 0.32, segs: 5, wander: 0.06, gravitropism: -0.03, droop: 0.3, tipCurl: 0.28, taper: 1.05 },
    { density: 2.1, whorl: 0, childStart: 0.12, childEnd: 0.98, angleBase: 1.05, angleTip: 0.8, lenRatio: 0.26, lenJitter: 0.35, radRatio: 0.4, segs: 3, wander: 0.08, gravitropism: -0.05, droop: 0.45, tipCurl: 0.12, taper: 0.9, planar: 1 },
  ],
  foliage: {
    kind: 'needleSpray', anchorLevel: 2, spacing: 0.62, tStart: 0.05,
    scale: [0.4, 0.62], tilt: 0.5, normalBend: 0.62, planarLeaves: true,
    card: { mode: 'lying', sizeK: 3.4 },
    leaf: { len: 0.1, width: 0.024, shapePow: 1, fold: 0, curl: 0, needleCount: 30, brush: 0 },
  },
  flare: { amp: 0.5, height: 1.0, lobes: 5 },
  bark: 'spruce', barkRepeats: 5,
  foliageColor: { r: 0.115, g: 0.27, b: 0.125, hueVar: 0.24 },  // brightened: read near-black at noon
  brokenTop: 0, stubChance: 0.02, tubeMaxLevel: 1, lodK: 0.62,
};

LV.pine = { // priede — Pinus sylvestris: bare salmon trunk, high loose crown
  id: 'pine', kind: 'conifer', height: [16, 25], trunkRadiusK: 0.017,
  crown: 'dome', asym: 0.34,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 10, wander: 0.05, gravitropism: 0.03, droop: 0, tipCurl: 0, taper: 0.92 },
    { density: 1.3, whorl: 3, childStart: 0.55, childEnd: 0.97, angleBase: 1.5, angleTip: 0.55, lenRatio: 0.4, lenJitter: 0.32, radRatio: 0.4, segs: 6, wander: 0.14, gravitropism: 0.09, droop: 0.3, tipCurl: 0.32, taper: 0.85 },
    { density: 1.55, whorl: 0, childStart: 0.35, childEnd: 1.0, angleBase: 0.9, angleTip: 0.55, lenRatio: 0.34, lenJitter: 0.34, radRatio: 0.45, segs: 3, wander: 0.13, gravitropism: 0.07, droop: 0.16, tipCurl: 0.22, taper: 0.85 },
  ],
  foliage: {
    kind: 'needleSpray', anchorLevel: 2, spacing: 0.52, tStart: 0.3,
    scale: [0.46, 0.7], tilt: 0.55, normalBend: 0.66,
    card: { mode: 'cross', sizeK: 2.9 },
    leaf: { len: 0.21, width: 0.018, shapePow: 1, fold: 0, curl: 0, needleCount: 66, brush: 1 },
  },
  flare: { amp: 0.42, height: 0.8, lobes: 4 },
  bark: 'pine', barkRepeats: 4,
  foliageColor: { r: 0.125, g: 0.29, b: 0.13, hueVar: 0.22 },   // brightened: read near-black at noon
  brokenTop: 0, stubChance: 0.05, tubeMaxLevel: 1, lodK: 0.62,
};

LV.birch = { // bērzs — Betula pendula, weeping twig streamers
  id: 'birch', kind: 'broadleaf', height: [12, 20], trunkRadiusK: 0.013,
  crown: 'column', asym: 0.26,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 9, wander: 0.05, gravitropism: 0.045, droop: 0, tipCurl: 0, taper: 1.1 },
    { density: 1.7, whorl: 0, childStart: 0.34, childEnd: 0.96, angleBase: 0.95, angleTip: 0.45, lenRatio: 0.4, lenJitter: 0.3, radRatio: 0.42, segs: 5, wander: 0.11, gravitropism: 0.02, droop: 0.4, tipCurl: -0.04, taper: 0.95 },
    { density: 2.0, whorl: 0, childStart: 0.3, childEnd: 1.0, angleBase: 0.8, angleTip: 0.5, lenRatio: 0.44, lenJitter: 0.34, radRatio: 0.5, segs: 3, wander: 0.14, gravitropism: -0.16, droop: 0.6, tipCurl: -0.05, taper: 0.9, planar: 0.5 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 2, spacing: 0.38, tStart: 0.15,
    scale: [0.24, 0.38], tilt: 0.9, normalBend: 0.66, planarLeaves: true,
    card: { mode: 'cross', sizeK: 3.0 },
    leaf: { len: 1.0, width: 0.55, shapePow: 1.4, fold: 0.22, curl: 0.3, needleCount: 0, brush: 0 },
  },
  flare: { amp: 0.32, height: 0.7, lobes: 4 },
  bark: 'birch', barkRepeats: 3,
  foliageColor: { r: 0.17, g: 0.36, b: 0.08, hueVar: 0.34 },
  brokenTop: 0, stubChance: 0.03, tubeMaxLevel: 2, tubeStride: 3, lodK: 0.6,
};

LV.oak = { // ozols — Quercus robur: massive short trunk, vast crown
  id: 'oak', kind: 'broadleaf', height: [14, 22], trunkRadiusK: 0.03,
  crown: 'ellipsoid', asym: 0.32,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 7, wander: 0.09, gravitropism: 0.03, droop: 0, tipCurl: 0, taper: 1.35 },
    { density: 1.6, whorl: 0, childStart: 0.3, childEnd: 0.92, angleBase: 1.15, angleTip: 0.55, lenRatio: 0.58, lenJitter: 0.3, radRatio: 0.52, segs: 6, wander: 0.16, gravitropism: 0.09, droop: 0.2, tipCurl: 0.14, taper: 0.9 },
    { density: 1.7, whorl: 0, childStart: 0.22, childEnd: 0.97, angleBase: 0.95, angleTip: 0.55, lenRatio: 0.44, lenJitter: 0.34, radRatio: 0.52, segs: 4, wander: 0.2, gravitropism: 0.04, droop: 0.26, tipCurl: 0.1, taper: 0.9 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 2, spacing: 0.42, tStart: 0.1,
    scale: [0.3, 0.46], tilt: 1.0, normalBend: 0.7, planarLeaves: true,
    card: { mode: 'cross', sizeK: 2.9 },
    leaf: { len: 1.0, width: 0.42, shapePow: 1.15, fold: 0.32, curl: 0.22, needleCount: 0, brush: 0, lobes: 4 },
  },
  flare: { amp: 0.55, height: 1.2, lobes: 6 },
  bark: 'oak', barkRepeats: 4,
  foliageColor: { r: 0.12, g: 0.30, b: 0.07, hueVar: 0.3 },
  brokenTop: 0, stubChance: 0.03, tubeMaxLevel: 2, tubeStride: 3, lodK: 0.62,
};

LV.alder = { // melnalksnis — Alnus glutinosa: dark, narrow, riverside
  id: 'alder', kind: 'broadleaf', height: [9, 16], trunkRadiusK: 0.016,
  crown: 'column', asym: 0.3,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 8, wander: 0.08, gravitropism: 0.02, droop: 0, tipCurl: 0, taper: 1.05 },
    { density: 2.0, whorl: 0, childStart: 0.22, childEnd: 0.96, angleBase: 1.1, angleTip: 0.5, lenRatio: 0.4, lenJitter: 0.32, radRatio: 0.45, segs: 4, wander: 0.13, gravitropism: 0.03, droop: 0.32, tipCurl: 0.05, taper: 0.92 },
    { density: 2.0, whorl: 0, childStart: 0.25, childEnd: 1.0, angleBase: 0.85, angleTip: 0.5, lenRatio: 0.4, lenJitter: 0.36, radRatio: 0.5, segs: 3, wander: 0.15, gravitropism: -0.02, droop: 0.3, tipCurl: 0.02, taper: 0.9, planar: 0.4 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 2, spacing: 0.4, tStart: 0.12,
    scale: [0.24, 0.36], tilt: 0.95, normalBend: 0.66, planarLeaves: true,
    card: { mode: 'cross', sizeK: 2.9 },
    leaf: { len: 1.0, width: 0.62, shapePow: 1.1, fold: 0.26, curl: 0.16, needleCount: 0, brush: 0 },
  },
  flare: { amp: 0.4, height: 0.8, lobes: 5 },
  bark: 'alder', barkRepeats: 3,
  foliageColor: { r: 0.10, g: 0.26, b: 0.08, hueVar: 0.22 },
  brokenTop: 0, stubChance: 0.04, tubeMaxLevel: 2, tubeStride: 3, lodK: 0.58,
};

LV.linden = { // liepa — Tilia cordata: dense tall heart-leaf dome
  id: 'linden', kind: 'broadleaf', height: [14, 22], trunkRadiusK: 0.022,
  crown: 'ellipsoid', asym: 0.24,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 8, wander: 0.05, gravitropism: 0.05, droop: 0, tipCurl: 0, taper: 1.2 },
    { density: 1.8, whorl: 0, childStart: 0.26, childEnd: 0.95, angleBase: 1.0, angleTip: 0.5, lenRatio: 0.5, lenJitter: 0.26, radRatio: 0.5, segs: 5, wander: 0.1, gravitropism: 0.07, droop: 0.28, tipCurl: 0.1, taper: 0.95 },
    { density: 2.0, whorl: 0, childStart: 0.2, childEnd: 0.98, angleBase: 0.9, angleTip: 0.55, lenRatio: 0.4, lenJitter: 0.32, radRatio: 0.52, segs: 3, wander: 0.12, gravitropism: 0.0, droop: 0.32, tipCurl: 0.05, taper: 0.9, planar: 0.5 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 2, spacing: 0.36, tStart: 0.1,
    scale: [0.26, 0.4], tilt: 1.0, normalBend: 0.72, planarLeaves: true,
    card: { mode: 'cross', sizeK: 3.0 },
    leaf: { len: 1.0, width: 0.78, shapePow: 1.25, fold: 0.28, curl: 0.2, needleCount: 0, brush: 0 },
  },
  flare: { amp: 0.5, height: 1.0, lobes: 5 },
  bark: 'linden', barkRepeats: 4,
  foliageColor: { r: 0.13, g: 0.32, b: 0.08, hueVar: 0.28 },
  brokenTop: 0, stubChance: 0.02, tubeMaxLevel: 2, tubeStride: 3, lodK: 0.6,
};

LV.apple = { // ābele — low gnarled orchard dome
  id: 'apple', kind: 'broadleaf', height: [3.2, 4.6], trunkRadiusK: 0.04,
  crown: 'dome', asym: 0.4,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 6, wander: 0.24, gravitropism: -0.02, droop: 0, tipCurl: 0.06, taper: 0.85 },
    { density: 2.6, whorl: 0, childStart: 0.3, childEnd: 0.95, angleBase: 1.3, angleTip: 0.65, lenRatio: 0.6, lenJitter: 0.4, radRatio: 0.55, segs: 5, wander: 0.26, gravitropism: 0.05, droop: 0.32, tipCurl: 0.14, taper: 0.82 },
    { density: 2.6, whorl: 0, childStart: 0.22, childEnd: 1.0, angleBase: 0.95, angleTip: 0.6, lenRatio: 0.42, lenJitter: 0.42, radRatio: 0.55, segs: 3, wander: 0.26, gravitropism: 0.04, droop: 0.24, tipCurl: 0.08, taper: 0.85, planar: 0.3 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 2, spacing: 0.2, tStart: 0.12,
    scale: [0.14, 0.22], tilt: 0.9, normalBend: 0.68, planarLeaves: true,
    card: { mode: 'cross', sizeK: 2.7 },
    leaf: { len: 1.0, width: 0.55, shapePow: 1.2, fold: 0.3, curl: 0.22, needleCount: 0, brush: 0 },
  },
  flare: { amp: 0.7, height: 0.5, lobes: 6 },
  bark: 'oak', barkRepeats: 3,
  foliageColor: { r: 0.13, g: 0.28, b: 0.09, hueVar: 0.26 },
  brokenTop: 0, stubChance: 0.08, tubeMaxLevel: 2, lodK: 0.6,
};

LV.shrub = { // tundra dwarf birch / juniper heath clump
  id: 'shrub', kind: 'broadleaf', height: [0.7, 1.3], trunkRadiusK: 0.03,
  crown: 'dome', asym: 0.4,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 4, wander: 0.3, gravitropism: -0.06, droop: 0, tipCurl: 0.05, taper: 0.8 },
    { density: 5.0, whorl: 0, childStart: 0.05, childEnd: 1.0, angleBase: 1.35, angleTip: 0.7, lenRatio: 0.75, lenJitter: 0.45, radRatio: 0.6, segs: 3, wander: 0.3, gravitropism: 0.02, droop: 0.25, tipCurl: 0.12, taper: 0.8 },
  ],
  foliage: {
    kind: 'leafCluster', anchorLevel: 1, spacing: 0.22, tStart: 0.2,
    scale: [0.15, 0.24], tilt: 0.9, normalBend: 0.6, planarLeaves: false,
    card: { mode: 'cross', sizeK: 2.6 },
    leaf: { len: 1.0, width: 0.45, shapePow: 1.2, fold: 0.25, curl: 0.2, needleCount: 0, brush: 0 },
  },
  flare: { amp: 0.2, height: 0.3, lobes: 4 },
  bark: 'alder', barkRepeats: 2,
  foliageColor: { r: 0.18, g: 0.24, b: 0.10, hueVar: 0.3 },
  brokenTop: 0, stubChance: 0.05, tubeMaxLevel: 1, lodK: 0.5,
};

LV.snag = { // dead standing trunk — old-growth signature
  id: 'snag', kind: 'snag', height: [8, 15], trunkRadiusK: 0.02,
  crown: 'cone', asym: 0.3,
  levels: [
    { density: 0, whorl: 0, childStart: 0, childEnd: 0, angleBase: 0, angleTip: 0, lenRatio: 0, lenJitter: 0, radRatio: 0, segs: 10, wander: 0.06, gravitropism: 0.04, droop: 0, tipCurl: 0, taper: 0.9 },
    { density: 2.0, whorl: 0, childStart: 0.2, childEnd: 0.97, angleBase: 1.6, angleTip: 0.85, lenRatio: 0.38, lenJitter: 0.45, radRatio: 0.32, segs: 4, wander: 0.14, gravitropism: -0.1, droop: 0.6, tipCurl: 0.05, taper: 0.75 },
    { density: 1.6, whorl: 0, childStart: 0.2, childEnd: 1.0, angleBase: 1.1, angleTip: 0.7, lenRatio: 0.3, lenJitter: 0.5, radRatio: 0.4, segs: 2, wander: 0.2, gravitropism: -0.08, droop: 0.4, tipCurl: 0, taper: 0.7 },
  ],
  foliage: null,
  flare: { amp: 0.6, height: 0.9, lobes: 5 },
  bark: 'snag', barkRepeats: 4,
  foliageColor: { r: 0.1, g: 0.09, b: 0.07, hueVar: 0.1 },
  brokenTop: 0.62, stubChance: 0.28, tubeMaxLevel: 2, lodK: 0.6,
};

export const SPECIES = LV;
