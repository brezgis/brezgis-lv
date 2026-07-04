// Sky & sun. The dome is three.js's analytic Sky (Preetham-style) driven by
// the sun position; the directional light colour comes from a Rayleigh/Mie
// transmittance integral so light, fog and sky always agree — the atmosphere
// as the lighting rig (a LAAS design rule). One day-cycle loops in ~4 minutes
// across the long Baltic midsummer day at 57°N.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { canvasTexture, makeNoise, lerp, smoothstep, clamp } from './util.js';

const DAY_SECONDS = 240;

// ---- sun transmittance (drives the directional light colour) ---------------
const Rp = 6371e3, Ra = 6451e3, Hr = 8500, Hm = 1400;
const BR = [5.8e-6, 13.5e-6, 33.1e-6], BM = 8e-6;
function sunTransmittanceJS(sunY) {
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
  return [
    Math.exp(-(BR[0] * odR + BM * 1.1 * odM)),
    Math.exp(-(BR[1] * odR + BM * 1.1 * odM)),
    Math.exp(-(BR[2] * odR + BM * 1.1 * odM)),
  ];
}

function cloudTexture() {
  const n = makeNoise(31);
  return canvasTexture(256, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w - 0.5, v = y / h - 0.5;
      const r = Math.hypot(u * 1.6, v * 2.6);
      const d = n.fbm(u * 5 + 9, v * 8, 5) - r * 1.15;
      const a = clamp((d - 0.18) * 4, 0, 1);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 210;
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
  const SC = 360;
  sun.shadow.camera.left = -SC; sun.shadow.camera.right = SC;
  sun.shadow.camera.top = SC; sun.shadow.camera.bottom = -SC;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 2.2;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd4e8, 0x51603e, 0.75);
  scene.add(hemi);

  scene.fog = new THREE.Fog(0xcfe0e8, 600, 7200);

  // colour keys for fog/ambient across the day (t: 0 = 4:00, 1 = 23:00)
  const stops = [
    { t: 0.0, zen: 0x2e4a72, fog: 0xdec3a8, hemiI: 0.45 },
    { t: 0.12, zen: 0x3c6ba4, fog: 0xd5e0da, hemiI: 0.7 },
    { t: 0.35, zen: 0x3f6fa8, fog: 0xcfe0e8, hemiI: 0.85 },
    { t: 0.62, zen: 0x3f6fa8, fog: 0xd3e2e6, hemiI: 0.8 },
    { t: 0.82, zen: 0x35577f, fog: 0xe6cba6, hemiI: 0.6 },
    { t: 1.0, zen: 0x27395c, fog: 0xcfa084, hemiI: 0.4 },
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

  // drifting cumulus + a thin high cirrus veil
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.85, fog: false,
  });
  const clouds = new THREE.Group();
  const crng = makeNoise(55).rng;
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat.clone());
    const s = 420 + crng() * 700;
    const high = i > 13;
    m.scale.set(s * (high ? 1.5 : 1), s * (high ? 0.3 : 0.4), 1);
    m.material.opacity = high ? 0.14 : 0.55 + crng() * 0.3;
    m.position.set((crng() - 0.5) * 9000, high ? 2400 + crng() * 500 : 700 + crng() * 500, (crng() - 0.5) * 9000);
    m.userData.speed = (high ? 6 : 3) + crng() * 5;
    clouds.add(m);
  }
  scene.add(clouds);

  const state = { t: 0.3, hour: 4 + 0.3 * 19, sunLow: 0, paused: false };
  const fogSun = new THREE.Color();

  function update(dt, focus) {
    if (!state.paused) state.t = (state.t + dt / DAY_SECONDS) % 1;
    const t = state.t;
    state.hour = 4 + t * 19;
    const az = lerp(Math.PI * 0.25, Math.PI * 1.75, t);
    // sharpened arc: real 57°N midsummer feel — long shallow evenings,
    // sun ~4° at 21:40, setting ~22:20, glow (not night) at the loop ends
    const el = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 1.4) * 0.95 - 0.035;
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    sky.material.uniforms.sunPosition.value.copy(sd);
    state.sunLow = 1 - smoothstep(0.05, 0.28, el);
    sun.position.copy(sd).multiplyScalar(1600).add(focus);
    sun.target.position.copy(focus);

    // direct light: physically-reddened by transmittance
    const tr = sunTransmittanceJS(sd.y);
    sun.color.setRGB(tr[0], tr[1], tr[2]);
    sun.intensity = 3.0 * clamp((sd.y + 0.03) / 0.1, 0, 1) * (0.4 + 0.6 * clamp(sd.y * 3 + 0.2, 0, 1));

    // ambient + fog: colour keys, fog warmed toward the sun's colour at dusk
    stopLerp(t, 'zen', hemi.color);
    hemi.intensity = stopLerp(t, 'hemiI');
    stopLerp(t, 'fog', scene.fog.color);
    fogSun.setRGB(tr[0], tr[1], tr[2]);
    scene.fog.color.lerp(fogSun, state.sunLow * 0.35);

    sky.position.copy(focus);
    for (const m of clouds.children) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x > 4700) m.position.x = -4700;
      m.lookAt(focus.x, m.position.y, focus.z);
      const nite = clamp(sd.y * 6 + 0.3, 0.06, 1); // clouds go dark after sunset
      m.material.color.setRGB(
        (0.62 + tr[0] * 0.38) * nite,
        (0.62 + tr[1] * 0.38) * nite,
        (0.66 + tr[2] * 0.34) * nite
      );
    }
  }
  return { update, state, sun, hemi };
}
