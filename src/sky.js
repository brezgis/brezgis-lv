// Sky & sun. The dome is three.js's analytic Sky driven by the sun position;
// the directional light colour comes from a Rayleigh/Mie transmittance
// integral so light, fog and sky always agree — the atmosphere as the
// lighting rig (a LAAS design rule). One day-cycle loops in ~4 minutes across
// the long Baltic midsummer day at 57°N. Cumulus billboards carry a per-pixel
// fbm density field lit toward the sun (Beer-Powder-ish core, silver lining),
// stars rise at deep dusk, and a ring of far moraine silhouettes continues
// the Vidzeme upland past the DEM edge.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { canvasTexture, makeNoise, lerp, smoothstep, clamp } from './util.js';

const DAY_SECONDS = 900; // slow sun = smooth shadows; Rit still flows

// Shadow/fog altitude response is exported so the numerical path can be
// probed headlessly without constructing the canvas-backed sky ornaments.
export const SHADOW_BASE_RADIUS = 360;
export const SHADOW_MAX_RADIUS = SHADOW_BASE_RADIUS * 3.5;
export const SHADOW_RADIUS_HYSTERESIS = 0.12;
// 0.6 world units at R=360/map=2048 is 0.6/(720/2048)=1.7067 texels.
export const SHADOW_NORMAL_BIAS_TEXELS = 1.7;
export const SHADOW_DEPTH_BIAS = -0.0002;
export const FOG_BASE_NEAR = 420;
export const FOG_BASE_FAR = 7200;

function finiteAgl(agl) {
  return Number.isFinite(agl) ? clamp(agl, 0, 2000) : 0;
}

export function shadowRadiusForAgl(agl) {
  // Full ground resolution through 25m AGL, then a smooth 1x -> 3.5x
  // expansion through 350m AGL. smoothstep has zero slope at both joins.
  return SHADOW_BASE_RADIUS * (1 + 2.5 * smoothstep(25, 350, finiteAgl(agl)));
}

export function fogDensityFactorForAgl(agl) {
  // Full ground haze through 40m AGL, thinning smoothly to 45% by 500m.
  return 1 - 0.55 * smoothstep(40, 500, finiteAgl(agl));
}

export function updateShadowForAltitude(shadow, agl) {
  const target = shadowRadiusForAgl(agl);
  const oldRadius = Number.isFinite(shadow.camera.right) && shadow.camera.right > 0
    ? shadow.camera.right : SHADOW_BASE_RADIUS;
  const changed = Math.abs(target - oldRadius) > oldRadius * SHADOW_RADIUS_HYSTERESIS;
  // Promote the last upward step to the exact cap instead of getting stuck
  // just inside the 12% deadband below it.
  const radius = changed && SHADOW_MAX_RADIUS - target <= oldRadius * SHADOW_RADIUS_HYSTERESIS
    ? SHADOW_MAX_RADIUS : changed ? target : oldRadius;
  if (changed) {
    shadow.camera.left = -radius; shadow.camera.right = radius;
    shadow.camera.top = radius; shadow.camera.bottom = -radius;
    shadow.camera.updateProjectionMatrix();
  }
  const mapSize = Number.isFinite(shadow.mapSize.x) && shadow.mapSize.x > 0
    ? shadow.mapSize.x : 2048;
  // Keep normal offset constant in shadow texels as coverage/map size changes.
  shadow.normalBias = SHADOW_NORMAL_BIAS_TEXELS * (radius * 2 / mapSize);
  shadow.bias = SHADOW_DEPTH_BIAS;
  return changed;
}

export function updateFogForAltitude(fog, agl) {
  const densityFactor = fogDensityFactorForAgl(agl);
  // Scaling both linear-fog distances by 1/density is the linear-fog
  // equivalent of reducing a density coefficient, retaining horizon haze.
  fog.near = FOG_BASE_NEAR / densityFactor;
  fog.far = FOG_BASE_FAR / densityFactor;
  return densityFactor;
}

// ---- sun transmittance (drives the directional light colour) ---------------
const Rp = 6371e3, Ra = 6451e3, Hr = 8500, Hm = 1400;
const BR = [5.8e-6, 13.5e-6, 33.1e-6], BM = 8e-6;
function sunTransmittanceJS(sunY, out) {
  const sy = Math.max(sunY, -0.08), sxz = Math.sqrt(Math.max(0, 1 - sy * sy));
  const oy = Rp + 200;
  const b = oy * sy, c = oy * oy - Ra * Ra;
  const tMax = -b + Math.sqrt(b * b - c);
  const N = 10, seg = tMax / N;
  let odR = 0, odM = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) * seg;
    const h = Math.hypot(sxz * t, oy + sy * t) - Rp;
    odR += Math.exp(-h / Hr) * seg;
    odM += Math.exp(-h / Hm) * seg;
  }
  out[0] = Math.exp(-(BR[0] * odR + BM * 1.1 * odM));
  out[1] = Math.exp(-(BR[1] * odR + BM * 1.1 * odM));
  out[2] = Math.exp(-(BR[2] * odR + BM * 1.1 * odM));
  return out;
}

// ---- shader cumulus ---------------------------------------------------------
const cloudVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const cloudFrag = /* glsl */ `
varying vec2 vUv;
uniform float uT, uSeed, uOp, uAspect, uSharp;
uniform vec3 uSunL, uLitCol, uShadeCol;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.7; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect;
  float t = uT * 0.012 + uSeed * 9.0;
  vec2 bp = p * vec2(1.35, 2.4) + vec2(t * 1.6, uSeed * 7.0);
  float base = fbm(bp);
  float detail = fbm(p * vec2(4.2, 7.5) - vec2(t * 3.8, uSeed * 3.0));
  float env = 1.0 - length(vec2(p.x * 0.72, max(p.y, -0.12) * 1.5));
  float dens = clamp((env + base * 0.85 - 0.62 + (detail - 0.5) * 0.5
    - max(0.0, -p.y - 0.25) * 1.4) * uSharp, 0.0, 1.0);
  if (dens < 0.006) discard;
  vec2 gdir = normalize(uSunL.xy + vec2(1e-4, 0.0));
  float dSun = fbm(bp + gdir * 0.15);
  float lit = clamp(0.62 + (dSun - base) * 3.0, 0.0, 1.25);
  float powder = 1.0 - exp(-dens * 2.8);
  vec3 col = mix(uShadeCol, uLitCol, lit) * (1.0 - powder * 0.38);
  col *= 0.68 + 0.32 * smoothstep(-0.7, 0.55, p.y);
  float rim = smoothstep(0.4, 0.02, dens) * max(0.0, -uSunL.z);
  col += uLitCol * rim * 0.55;
  gl_FragColor = vec4(col, dens * uOp);
}`;

function cirrusTexture() {
  const n = makeNoise(31);
  return canvasTexture(256, 96, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5, v = y / h - 0.5;
      const d = n.fbm(u * 8 + 9, v * 3, 4) - Math.abs(v) * 2.4 - 0.28;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      // fade the u edges too or the quad ends show as hard vertical seams
      const edge = smoothstep(0.5, 0.4, Math.abs(u));
      img.data[i + 3] = clamp(d * 3.2, 0, 1) * 110 * edge;
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function buildSky(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(9400);
  sky.material.uniforms.turbidity.value = 4.2;
  sky.material.uniforms.rayleigh.value = 1.35;
  sky.material.uniforms.mieCoefficient.value = 0.004;
  sky.material.uniforms.mieDirectionalG.value = 0.8;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const SC = SHADOW_BASE_RADIUS;
  sun.shadow.camera.left = -SC; sun.shadow.camera.right = SC;
  sun.shadow.camera.top = SC; sun.shadow.camera.bottom = -SC;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2600;
  sun.shadow.bias = SHADOW_DEPTH_BIAS;
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS_TEXELS * (SC * 2 / sun.shadow.mapSize.x);
  sun.shadow.radius = 2.2;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd4e8, 0x51603e, 0.75);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xcfe0e8, FOG_BASE_NEAR, FOG_BASE_FAR);

  // colour keys for fog/ambient across the day (t: 0 = 4:00, 1 = 23:00)
  // dusk/dawn ambient raised so the land never falls far behind the
  // sky-reflecting water (grazing-bright rivers vs near-black meadow read
  // as glare, not evening)
  const stops = [
    { t: 0.0, zen: 0x2e4a72, fog: 0xb99a84, hemiI: 0.64 },
    { t: 0.12, zen: 0x3c6ba4, fog: 0xd5e0da, hemiI: 0.84 },
    { t: 0.35, zen: 0x3f6fa8, fog: 0xcfe0e8, hemiI: 1.02 },
    { t: 0.62, zen: 0x3f6fa8, fog: 0xd3e2e6, hemiI: 0.96 },
    { t: 0.82, zen: 0x35577f, fog: 0xe6cba6, hemiI: 0.78 },
    { t: 1.0, zen: 0x27395c, fog: 0x9a7660, hemiI: 0.6 },
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function stopLerp(t, key, target) {
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1].t < t) i++;
    const a = stops[i], b = stops[i + 1];
    const u = clamp((t - a.t) / (b.t - a.t), 0, 1);
    if (key === 'hemiI') return lerp(a.hemiI, b.hemiI, u);
    cA.set(a[key]); cB.set(b[key]);
    return target.copy(cA).lerp(cB, u);
  }

  // ---- cumulus fleet (shared lit/shade uniforms, per-cloud sun-local dir)
  const uLitCol = { value: new THREE.Color(1, 1, 1) };
  const uShadeCol = { value: new THREE.Color(0.6, 0.66, 0.74) };
  const uTime = { value: 0 };
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const crng = makeNoise(55).rng;
  for (let i = 0; i < 14; i++) {
    const aspect = 2.0 + crng() * 1.6;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: {
        uT: uTime, uLitCol, uShadeCol,
        uSeed: { value: crng() * 10 },
        uOp: { value: 0.6 + crng() * 0.3 },
        uAspect: { value: aspect },
        uSharp: { value: 2.2 + crng() * 1.4 },
        uSunL: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: cloudVert, fragmentShader: cloudFrag,
    });
    const s = 520 + crng() * 780;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.scale.set(s * aspect * 0.5, s * 0.42, 1);
    m.position.set((crng() - 0.5) * 9000, 750 + crng() * 700, (crng() - 0.5) * 9000);
    m.userData.speed = 4 + crng() * 6;
    m.userData.baseOp = mat.uniforms.uOp.value;
    m.renderOrder = 2;
    clouds.add(m);
  }
  // thin high cirrus veil
  const cirrusMat = new THREE.MeshBasicMaterial({
    map: cirrusTexture(), transparent: true, depthWrite: false, opacity: 0.5, fog: false,
  });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cirrusMat.clone());
    m.scale.set(2600 + crng() * 1400, 420 + crng() * 200, 1);
    m.position.set((crng() - 0.5) * 8000, 2500 + crng() * 600, (crng() - 0.5) * 8000);
    m.userData.speed = 9 + crng() * 6;
    m.userData.cirrus = true;
    m.renderOrder = 1;
    clouds.add(m);
  }
  scene.add(clouds);

  // ---- stars (deep-dusk only; faint milky-way band)
  const stars = (() => {
    const srng = makeNoise(77).rng;
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const cols = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const inBand = i > N * 0.55;
      let x, y, z;
      do {
        x = srng() * 2 - 1; y = srng(); z = srng() * 2 - 1;
        if (inBand) {
          // cluster along one great circle, tilted like the summer Milky Way
          const a = srng() * Math.PI * 2;
          const off = (srng() - 0.5) * 0.3;
          x = Math.cos(a); z = Math.sin(a) * 0.4 + off;
          y = Math.abs(Math.sin(a) * 0.85 + off * 0.5);
        }
      } while (Math.hypot(x, y, z) < 0.2 || y < 0.03);
      const l = Math.hypot(x, y, z);
      pos[i * 3] = (x / l) * 8600; pos[i * 3 + 1] = (y / l) * 8600; pos[i * 3 + 2] = (z / l) * 8600;
      const mag = inBand ? 0.25 + srng() * 0.4 : 0.4 + srng() * 0.7;
      const warm = srng();
      cols[i * 3] = mag * (0.85 + warm * 0.15);
      cols[i * 3 + 1] = mag * (0.88 + warm * 0.06);
      cols[i * 3 + 2] = mag * (1.0 - warm * 0.18);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 0;
    return pts;
  })();
  stars.name = 'stars';
  scene.add(stars);

  // ---- sun disc + glow
  const sunGlow = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    let g = ctx.createRadialGradient(64, 64, 2, 64, 64, 14);
    g.addColorStop(0, 'rgba(255,252,240,1)');
    g.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,240,200,0.55)');
    g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false,
    }));
    spr.scale.setScalar(1350);
    spr.renderOrder = 1;
    return spr;
  })();
  sunGlow.name = 'sunglow';
  scene.add(sunGlow);

  // ---- far moraine silhouettes: the upland continues past the DEM edge
  const horizon = (() => {
    const group = new THREE.Group();
    const hn = makeNoise(929);
    const mk = (radius, base, amp, seedOff, col) => {
      const SEGS = 220;
      const pos = [], idx = [], colArr = [];
      const cTop = new THREE.Color(col).multiplyScalar(1.12);
      const cBot = new THREE.Color(col).multiplyScalar(0.9);
      for (let i = 0; i <= SEGS; i++) {
        const a = (i / SEGS) * Math.PI * 2;
        const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        const h = base + hn.fbm(Math.cos(a) * 3 + seedOff, Math.sin(a) * 3, 4) * amp
          + hn.noise2(Math.cos(a) * 9 + seedOff, Math.sin(a) * 9) * amp * 0.3;
        pos.push(x, -60, z, x, h, z);
        colArr.push(cBot.r, cBot.g, cBot.b, cTop.r, cTop.g, cTop.b);
        if (i < SEGS) {
          const b = i * 2;
          idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        vertexColors: true, fog: true, side: THREE.DoubleSide,
      }));
      m.frustumCulled = false;
      return m;
    };
    // two ridgelines for layered depth; heights in m ASL (terrain ~165-259)
    group.add(mk(6100, 186, 90, 3.7, 0x323e32));
    group.add(mk(4900, 172, 66, 9.2, 0x3a4635));
    return group;
  })();
  horizon.name = 'horizon';
  scene.add(horizon);

  const state = { t: 0.3, hour: 4 + 0.3 * 19, sunLow: 0, paused: false, sunColor: new THREE.Color(), ambient: 0.8 };
  const fogSun = new THREE.Color();
  const _snapFocus = new THREE.Vector3();
  const sd = new THREE.Vector3();
  const tr = [0, 0, 0];
  const sunWorld = new THREE.Vector3();
  const qInv = new THREE.Quaternion();
  const sunLocal = new THREE.Vector3();
  const shadowInfo = {
    R: SC, agl: 0, mapSize: sun.shadow.mapSize.x,
    texel: SC * 2 / sun.shadow.mapSize.x,
    normalBias: sun.shadow.normalBias, fogDensityFactor: 1,
  };

  function update(dt, focus, shadowNow = true, agl = 0) {
    agl = finiteAgl(agl);
    if (!state.paused) state.t = (state.t + dt / DAY_SECONDS) % 1;
    const t = state.t;
    state.hour = 4 + t * 19;
    const az = lerp(Math.PI * 0.25, Math.PI * 1.75, t);
    // sharpened arc: real 57°N midsummer feel — long shallow evenings,
    // sun ~4° at 21:40, setting ~22:20, glow (not night) at the loop ends
    const el = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 1.4) * 0.95 - 0.035;
    sd.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sky.material.uniforms.sunPosition.value.copy(sd);
    state.sunLow = 1 - smoothstep(0.05, 0.28, el);
    // reposition the shadow rig ONLY on map-refresh frames: sampling a stale
    // map through a fresh light matrix made every shadow jitter and snap
    // while walking. Snapping follows the current shadow texel size.
    if (shadowNow) {
      // Extent changes share the existing refresh cadence. The 12% gate
      // prevents tiny altitude changes from dirtying a large shadow map.
      if (updateShadowForAltitude(sun.shadow, agl)) renderer.shadowMap.needsUpdate = true;
      // snap to SHADOW TEXELS (not half-metres): coarse snapping made the
      // whole shadow field step visibly as you walked
      const texel = (sun.shadow.camera.right * 2) / sun.shadow.mapSize.x;
      _snapFocus.set(
        Math.round(focus.x / texel) * texel,
        Math.round(focus.y / texel) * texel,
        Math.round(focus.z / texel) * texel);
      sun.position.copy(sd).multiplyScalar(1600).add(_snapFocus);
      sun.target.position.copy(_snapFocus);
    }

    // direct light: physically-reddened by transmittance
    sunTransmittanceJS(sd.y, tr);
    sun.color.setRGB(tr[0], tr[1], tr[2]);
    sun.intensity = 3.0 * clamp((sd.y + 0.03) / 0.1, 0, 1) * (0.4 + 0.6 * clamp(sd.y * 3 + 0.2, 0, 1));
    state.sunColor.copy(sun.color);

    // ambient + fog: colour keys, fog warmed toward the sun's colour at dusk
    stopLerp(t, 'zen', hemi.color);
    hemi.intensity = stopLerp(t, 'hemiI');
    state.ambient = hemi.intensity;
    stopLerp(t, 'fog', scene.fog.color);
    fogSun.setRGB(tr[0], tr[1], tr[2]);
    scene.fog.color.lerp(fogSun, state.sunLow * 0.35);
    // fog is scattered SUNLIGHT: after the sun goes it must darken with the
    // sky or the horizon glows all night
    scene.fog.color.multiplyScalar(0.09 + 0.91 * clamp(sd.y * 5 + 0.42, 0.05, 1));
    shadowInfo.fogDensityFactor = updateFogForAltitude(scene.fog, agl);

    shadowInfo.R = sun.shadow.camera.right;
    shadowInfo.agl = agl;
    shadowInfo.mapSize = sun.shadow.mapSize.x;
    shadowInfo.texel = sun.shadow.camera.right * 2 / sun.shadow.mapSize.x;
    shadowInfo.normalBias = sun.shadow.normalBias;

    sky.position.copy(focus);
    horizon.position.set(focus.x, 0, focus.z);
    // from altitude the ring's flat top reads as a grey plateau — fade out
    horizon.visible = focus.y < 330;
    sunWorld.copy(sd).multiplyScalar(8800).add(focus);
    sunGlow.position.copy(sunWorld);
    sunGlow.material.opacity = clamp((sd.y + 0.06) * 6, 0, 1) * 0.9;

    // stars & aurora darkness gate
    const dark = clamp(-sd.y * 9 + 0.25, 0, 1) * 0.9 + state.sunLow * 0.12;
    state.dark = dark;              // effects gate on true night vs twilight
    stars.material.opacity = clamp(dark, 0, 0.95);
    stars.position.set(focus.x, 0, focus.z);

    // cloud lighting: shared lit/shade colours, per-cloud sun-local dirs
    const nite = clamp(sd.y * 6 + 0.3, 0.05, 1);
    uTime.value += dt;
    uLitCol.value.setRGB(
      (0.72 + tr[0] * 0.5) * nite, (0.72 + tr[1] * 0.48) * nite, (0.74 + tr[2] * 0.44) * nite);
    uShadeCol.value.copy(hemi.color).multiplyScalar(0.36 * nite + 0.1);
    for (const m of clouds.children) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x - focus.x > 4700) m.position.x -= 9400;
      if (m.position.x - focus.x < -4700) m.position.x += 9400;
      m.lookAt(focus.x, m.position.y, focus.z);
      // A billboard only reads as a cloud from below. Climb to its own deck —
      // the 780 m "bird" view does — and it flattens into a pale smear lying
      // across the parish, so dissolve each cloud as the camera reaches it.
      const near = 1 - smoothstep(m.position.y - 380, m.position.y - 90, focus.y);
      if (m.userData.cirrus) {
        m.material.opacity = 0.5 * near;
        m.material.color.setRGB(
          (0.62 + tr[0] * 0.38) * nite, (0.62 + tr[1] * 0.38) * nite, (0.66 + tr[2] * 0.34) * nite);
      } else {
        m.material.uniforms.uOp.value = m.userData.baseOp * near;
        qInv.copy(m.quaternion).invert();
        sunLocal.copy(sd).applyQuaternion(qInv);
        m.material.uniforms.uSunL.value.copy(sunLocal);
      }
    }
  }
  // The reflection camera needs only the sky, clouds and distant horizon.
  // Keep layer 0 for the main view, and reserve layer 1 for sky capture.
  for (const object of [sky, clouds, stars, sunGlow, horizon]) {
    object.traverse((o) => o.layers.enable(1));
  }
  return { update, state, sun, hemi, shadowInfo };
}
