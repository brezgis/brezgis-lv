// Shared helpers: deterministic RNG, value noise, procedural canvas textures.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Deterministic 2D value noise with fbm
export function makeNoise(seed = 1) {
  const rng = mulberry32(seed);
  const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rng(); }
  for (let i = P - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[P + i] = perm[i];
  const at = (xi, yi) => vals[perm[perm[xi & 255] + (yi & 255)]];
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let f = 0, amp = 0.5, fr = 1;
    for (let i = 0; i < oct; i++) { f += amp * noise2(x * fr, y * fr); fr *= lac; amp *= gain; }
    return f;
  }
  return { noise2, fbm, rng };
}

export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

// Catmull-Rom sample over an array of [x, z(, y)] points, t in [0,1]
export function sampleSpline(pts, t) {
  const n = pts.length - 1;
  const f = clamp(t, 0, 0.99999) * n;
  const i = Math.floor(f), u = f - i;
  const p = (k) => pts[clamp(k, 0, n)];
  const c = (a, b, cc, d, uu) =>
    0.5 * ((2 * b) + (-a + cc) * uu + (2 * a - 5 * b + 4 * cc - d) * uu * uu + (-a + 3 * b - 3 * cc + d) * uu * uu * uu);
  const out = [];
  for (let k = 0; k < p(0).length; k++) out[k] = c(p(i - 1)[k], p(i)[k], p(i + 1)[k], p(i + 2)[k], u);
  return out;
}

// Arc-length-even spline sampling. sampleSpline's parameter is uniform per
// SEGMENT, so "N samples" cluster where source points cluster and leave
// 25-80m gaps across long segments — every consumer that stamped, splatted
// or measured along "fine" samples inherited those gaps.
export function sampleSplineEven(pts, step) {
  const N = Math.min(60000, pts.length * 40);
  let prev = sampleSpline(pts, 0), acc = 0;
  const out = [prev];
  for (let i = 1; i <= N; i++) {
    const p = sampleSpline(pts, i / N);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    if (acc >= step) { out.push(p); acc = 0; }
  }
  out.push(prev);
  return out;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToPolyline(x, z, pts) {
  let bd = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const vx = bx - ax, vz = bz - az;
    const L = vx * vx + vz * vz;
    const t = L ? clamp(((x - ax) * vx + (z - az) * vz) / L, 0, 1) : 0;
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
    if (d < bd) bd = d;
  }
  return bd;
}

export function splineLength(pts, samples = 200) {
  let len = 0, prev = sampleSpline(pts, 0);
  for (let i = 1; i <= samples; i++) {
    const cur = sampleSpline(pts, i / samples);
    len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    prev = cur;
  }
  return len;
}
