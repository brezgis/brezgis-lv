// Sky, sun and the long Baltic midsummer day. One full day-cycle loops in
// ~4 minutes, running dawn (4:00) to late dusk (23:00) — Jāņi-season light
// at 57°N, where true night barely happens.
import * as THREE from 'three';
import { canvasTexture, makeNoise, lerp, smoothstep, clamp } from './util.js';

const DAY_SECONDS = 240;

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  vec3 col = mix(horizon, zenith, pow(h, 0.62));
  float s = clamp(dot(normalize(vDir), normalize(sunDir)), 0.0, 1.0);
  col += sunColor * (pow(s, 900.0) * 1.4 + pow(s, 18.0) * 0.28);
  gl_FragColor = vec4(col, 1.0);
}`;

function cloudTexture() {
  const n = makeNoise(31);
  return canvasTexture(256, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5, v = y / h - 0.5;
      const r = Math.hypot(u * 1.6, v * 2.6);
      const d = n.fbm(u * 5 + 9, v * 8, 4) - r * 1.15;
      const a = clamp((d - 0.18) * 4, 0, 1);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 210;
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function buildSky(scene, renderer) {
  const uniforms = {
    zenith: { value: new THREE.Color(0x3f6fa8) },
    horizon: { value: new THREE.Color(0xcfe0e8) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color(0xfff2d0) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6200, 32, 18),
    new THREE.ShaderMaterial({ uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false })
  );
  dome.name = 'sky';
  scene.add(dome);

  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const SC = 340;
  sun.shadow.camera.left = -SC; sun.shadow.camera.right = SC;
  sun.shadow.camera.top = SC; sun.shadow.camera.bottom = -SC;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd4e8, 0x51603e, 0.75);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xcfe0e8, 500, 4300);

  // drifting cumulus billboards
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.85, fog: false,
  });
  const clouds = new THREE.Group();
  const crng = makeNoise(55).rng;
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
    const s = 420 + crng() * 700;
    m.scale.set(s, s * 0.4, 1);
    m.position.set((crng() - 0.5) * 8000, 650 + crng() * 500, (crng() - 0.5) * 8000);
    m.userData.speed = 3 + crng() * 5;
    clouds.add(m);
  }
  scene.add(clouds);

  // key colours over the day (t: 0 = 4:00, 1 = 23:00)
  const stops = [
    { t: 0.0, zen: 0x2e4a72, hor: 0xe8b98a, sun: 0xffb37a, sunI: 0.9, hemiI: 0.45, fog: 0xdec3a8 },
    { t: 0.12, zen: 0x3c6ba4, hor: 0xd9e2d8, sun: 0xffd9a0, sunI: 2.0, hemiI: 0.7, fog: 0xd5e0da },
    { t: 0.35, zen: 0x3f6fa8, hor: 0xcfe0e8, sun: 0xfff4d8, sunI: 2.7, hemiI: 0.85, fog: 0xcfe0e8 },
    { t: 0.62, zen: 0x3f6fa8, hor: 0xd3e2e6, sun: 0xfff0c8, sunI: 2.5, hemiI: 0.8, fog: 0xd3e2e6 },
    { t: 0.82, zen: 0x35577f, hor: 0xf0c390, sun: 0xffc077, sunI: 1.5, hemiI: 0.6, fog: 0xe6cba6 },
    { t: 1.0, zen: 0x27395c, hor: 0xd98d5f, sun: 0xff9a55, sunI: 0.55, hemiI: 0.4, fog: 0xcfa084 },
  ];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function stopLerp(t, key, target) {
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1].t < t) i++;
    const a = stops[i], b = stops[i + 1];
    const u = clamp((t - a.t) / (b.t - a.t), 0, 1);
    if (typeof a[key] === 'number' && key !== 'sunI' && key !== 'hemiI') {
      cA.set(a[key]); cB.set(b[key]);
      target.copy(cA).lerp(cB, u);
      return target;
    }
    return lerp(a[key], b[key], u);
  }

  const state = { t: 0.3, hour: 4 + 0.3 * 19, sunLow: 0, paused: false };

  function update(dt, focus) {
    if (!state.paused) state.t = (state.t + dt / DAY_SECONDS) % 1;
    const t = state.t;
    state.hour = 4 + t * 19;
    // sun path: rises NE, high S at noon, sets NW (57°N midsummer)
    const az = lerp(Math.PI * 0.25, Math.PI * 1.75, t);            // from NE around S to NW
    const el = Math.sin(t * Math.PI) * 0.92 + 0.045;                // max ~56°
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    uniforms.sunDir.value.copy(sd);
    state.sunLow = 1 - smoothstep(0.05, 0.28, el);
    sun.position.copy(sd).multiplyScalar(1600).add(focus);
    sun.target.position.copy(focus);
    stopLerp(t, 'zen', uniforms.zenith.value);
    stopLerp(t, 'hor', uniforms.horizon.value);
    stopLerp(t, 'sun', uniforms.sunColor.value);
    sun.color.copy(uniforms.sunColor.value).lerp(new THREE.Color(0xffffff), 0.35);
    sun.intensity = stopLerp(t, 'sunI');
    hemi.intensity = stopLerp(t, 'hemiI');
    stopLerp(t, 'fog', scene.fog.color);
    dome.position.copy(focus);
    for (const m of clouds.children) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x > 4200) m.position.x = -4200;
      m.lookAt(focus.x, m.position.y, focus.z);
    }
  }
  return { update, state, sun, uniforms };
}
