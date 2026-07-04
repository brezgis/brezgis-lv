// Living-world effects: hearth smoke, fire glow, dawn mist, dusk fireflies.
import * as THREE from 'three';
import { makeNoise } from './util.js';

const rng = makeNoise(303).rng;

function softBlobTexture(inner = 'rgba(255,255,255,0.9)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

const smokeVert = /* glsl */ `
attribute float aSize; attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (620.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const smokeFrag = /* glsl */ `
uniform sampler2D map; uniform vec3 color;
varying float vAlpha;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(color, t.a * vAlpha);
}`;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.blob = softBlobTexture();
    this.smokes = [];
    this.fires = [];
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);

    // fireflies (shared; shown at dusk near the meadow around the stage)
    const N = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this.fireflySeed = [];
    for (let i = 0; i < N; i++) {
      this.fireflySeed.push({ a: rng() * 6.3, r: 20 + rng() * 160, h: 0.4 + rng() * 2.2, s: 0.3 + rng() * 0.8, p: rng() * 6.3 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      size: 0.5, map: this.blob, transparent: true, opacity: 0,
      color: 0xd8ff9a, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
    this.fireflyCenter = new THREE.Vector3();

    // mist patches (shown at dawn/dusk over the water)
    this.mistMat = new THREE.SpriteMaterial({ map: this.blob, color: 0xe8eef2, transparent: true, opacity: 0, depthWrite: false });
    this.mists = [];

    // aurora borealis — glacial-era dusk only
    this.aurora = new THREE.Group();
    const aMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uOp: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uOp;
        void main(){
          float bands = sin(vUv.x * 26.0 + uT * 0.6) * 0.5 + sin(vUv.x * 61.0 - uT * 0.9) * 0.3;
          float body = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
          float a = body * (0.55 + bands * 0.45) * uOp;
          vec3 col = mix(vec3(0.25, 1.0, 0.55), vec3(0.55, 0.35, 0.9), vUv.y);
          gl_FragColor = vec4(col, a * 0.55);
        }`,
    });
    this.auroraMat = aMat;
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7000, 1400, 64, 4), aMat);
      m.position.set(500 - i * 900, 1500 + i * 380, -3500 - i * 700);
      m.rotation.y = 0.15 * (i - 1);
      const posA = m.geometry.attributes.position;
      for (let v = 0; v < posA.count; v++) {
        posA.setZ(v, Math.sin(posA.getX(v) * 0.0016 + i * 2.1) * 320);
      }
      this.aurora.add(m);
    }
    this.aurora.visible = false;
    this.group.add(this.aurora);
    this.auroraOn = false;
  }

  setAurora(on) { this.auroraOn = on; }
  setFireflies(on) { this.fireflyOn = on; }

  setFireflyCenter(x, y, z) { this.fireflyCenter.set(x, y, z); }

  addMistPatches(points) {
    for (const m of this.mists) this.group.remove(m);
    this.mists = [];
    for (const [x, y, z] of points) {
      const s = new THREE.Sprite(this.mistMat.clone());
      s.position.set(x, y + 2.2, z);
      s.scale.set(60 + rng() * 60, 10 + rng() * 6, 1);
      s.userData = { baseX: x, phase: rng() * 6.3 };
      this.group.add(s);
      this.mists.push(s);
    }
  }

  addSmoke(x, y, z, { rate = 1, gray = 0.82 } = {}) {
    const N = 34;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.blob }, color: { value: new THREE.Color(gray, gray, gray) } },
      vertexShader: smokeVert, fragmentShader: smokeFrag,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    const parts = [];
    for (let i = 0; i < N; i++) parts.push({ age: (i / N) * 9 / rate, drift: rng() * 6.3 });
    this.smokes.push({ x, y, z, pts, parts, rate, life: 9 / rate });
    return pts;
  }

  addFire(x, y, z, { intensity = 5, dist = 26, duskOnly = false, scale = 1 } = {}) {
    const light = new THREE.PointLight(0xff7a28, intensity, dist, 1.8);
    light.position.set(x, y + 0.7, z);
    this.group.add(light);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.blob, color: 0xffa030, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flame.position.set(x, y + 0.55 * scale, z);
    flame.scale.set(0.9 * scale, 1.3 * scale, 1);
    this.group.add(flame);
    this.fires.push({ light, flame, base: intensity, phase: rng() * 9, duskOnly, scale });
    return light;
  }

  clearDynamic() {
    for (const s of this.smokes) this.group.remove(s.pts);
    for (const f of this.fires) { this.group.remove(f.light); this.group.remove(f.flame); }
    this.smokes = [];
    this.fires = [];
  }

  tick(t, dt, wind, sunLow) {
    // smoke columns
    for (const s of this.smokes) {
      const pos = s.pts.geometry.attributes.position;
      const size = s.pts.geometry.attributes.aSize;
      const alpha = s.pts.geometry.attributes.aAlpha;
      s.parts.forEach((p, i) => {
        p.age += dt;
        if (p.age > s.life) { p.age = 0; p.drift = rng() * 6.3; }
        const u = p.age / s.life;
        const rise = u * 11;
        const sway = Math.sin(p.age * 1.3 + p.drift) * 1.1 * u + Math.sin(p.drift * 3 + u * 9) * 0.6 * u;
        pos.setXYZ(i,
          s.x + sway + wind.x * u * u * 14,
          s.y + rise,
          s.z + Math.cos(p.age * 1.1 + p.drift) * 1.0 * u + Math.cos(p.drift * 5 + u * 7) * 0.5 * u + wind.y * u * u * 14);
        size.setX(i, 0.5 + u * 3.6 + Math.sin(p.drift) * 0.3);
        alpha.setX(i, 0.09 * Math.sin(Math.min(u * 2.6, Math.PI)) * (1 - u * 0.45));
      });
      pos.needsUpdate = true; size.needsUpdate = true; alpha.needsUpdate = true;
    }
    // fire flicker
    for (const f of this.fires) {
      const n = Math.sin(t * 11 + f.phase) * 0.3 + Math.sin(t * 23 + f.phase * 2) * 0.2;
      const gate = f.duskOnly ? Math.max(0, sunLow - 0.35) * 1.6 : 1; // Jāņi fires wake at dusk
      f.light.intensity = f.base * (1 + n * 0.45) * (0.55 + sunLow * 0.8) * gate;
      f.flame.material.opacity = (0.5 + n * 0.2 + sunLow * 0.25) * Math.min(1, gate);
      f.flame.scale.set((0.8 + n * 0.15) * f.scale, (1.2 + n * 0.3) * f.scale, 1);
    }
    // fireflies: emerge when the sun is low (not on the tundra)
    const fo = this.fireflyOn === false ? 0 : Math.max(0, sunLow - 0.45) * 1.6;
    this.fireflyMat.opacity = Math.min(0.9, fo);
    if (fo > 0.01) {
      const pos = this.fireflies.geometry.attributes.position;
      this.fireflySeed.forEach((p, i) => {
        const a = p.a + t * 0.05 * p.s;
        pos.setXYZ(i,
          this.fireflyCenter.x + Math.cos(a) * p.r + Math.sin(t * p.s * 2 + p.p) * 3,
          this.fireflyCenter.y + p.h + Math.sin(t * p.s * 3 + p.p) * 0.8,
          this.fireflyCenter.z + Math.sin(a) * p.r * 0.8 + Math.cos(t * p.s * 1.7 + p.p) * 3);
      });
      pos.needsUpdate = true;
      this.fireflyMat.size = 0.4 + Math.sin(t * 6) * 0.12;
    }
    // mist
    for (const m of this.mists) {
      m.material.opacity = sunLow * 0.34;
      m.position.x = m.userData.baseX + Math.sin(t * 0.05 + m.userData.phase) * 8;
    }
    // aurora fades in with deep dusk
    const auroraOp = this.auroraOn ? Math.max(0, sunLow - 0.55) * 2.2 : 0;
    this.aurora.visible = auroraOp > 0.01;
    if (this.aurora.visible) {
      this.auroraMat.uniforms.uT.value = t;
      this.auroraMat.uniforms.uOp.value = Math.min(1, auroraOp);
    }
  }
}
