// Brezgi / Taurene time machine — entry point.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initTextures } from './textures.js';
import { buildTerrain, paintEra, heightAt } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky } from './sky.js';
import { buildVegetation, WIND } from './vegetation.js';
import { buildGrass } from './grass.js';
import { buildEra, applySpawns } from './eras.js';
import { AnimalManager } from './animals.js';
import { Effects } from './effects.js';
import { Ambience } from './audio.js';
import { Rig } from './rig.js';
import { LOC } from './landuse.js';
import { RIVER_PTS, LAKES } from './geodata.js';
import { ERAS } from './content.js';

const S = LOC.STEAD;
const $ = (id) => document.getElementById(id);

let bootT0 = 0;
const progress = (msg) => {
  const now = performance.now();
  if (bootT0) console.log(`[boot] +${((now - bootT0) / 1000).toFixed(2)}s — ${msg}`);
  else bootT0 = now;
  const el = $('loader-status');
  if (el) el.textContent = msg;
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

async function boot() {
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // 1.75 cap: with 4x MSAA in the composer, full hi-DPI supersampling is
  // wasted fill — this keeps text-sharpness without doubling the pixel bill
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the sun crawls (4-min day): re-rendering the 7M-tri shadow pass every
  // frame is the single biggest waste — refresh it on a cadence instead
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 12000);
  const steadY = () => heightAt(S.x, S.z);

  await progress('Sculpting the Vidzeme Upland from real elevation data…');
  initTextures();
  const terrain = buildTerrain();
  scene.add(terrain);

  await progress('Filling the Gauja and Dabaru lake…');
  const water = buildWater();
  scene.add(water.group);

  await progress('Raising the sky…');
  const sky = buildSky(scene, renderer);

  await progress('Growing the forests — branches, twig atlases, impostors…');
  const veg = buildVegetation(scene, renderer);
  await progress('Sowing half a million blades of grass…');
  const grass = buildGrass(scene);

  // post chain: MSAA render target -> subtle bloom -> tone-mapped output
  const rtSamples = renderer.capabilities.isWebGL2 ? 4 : 0;
  const composerRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
    type: THREE.HalfFloatType, samples: rtSamples,
  });
  // No bloom: the analytic sky's radiance spans 1-100 and any bloom pass —
  // pre- or post-tonemap — smears it into a white wash facing the sun.
  // MSAA + HalfFloat + OutputPass give clean AA and filmic tone mapping.
  const composer = new EffectComposer(renderer, composerRT);
  // size the composer's targets by pixel ratio — without this the frame is
  // rendered at CSS resolution and upscaled, which reads as grainy on hi-DPI
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  // sky reflections for the water, refreshed occasionally
  const cubeRT = new THREE.WebGLCubeRenderTarget(128);
  const cubeCam = new THREE.CubeCamera(1, 6000, cubeRT);
  cubeCam.position.set(LOC.STEAD.x - 200, heightAt(LOC.STEAD.x - 200, LOC.STEAD.z) + 12, LOC.STEAD.z);
  water.applyEnvMap(cubeRT.texture);
  let envAge = 1e9;

  const effects = new Effects(scene);
  effects.setFireflyCenter(S.x - 40, steadY(), S.z + 30);
  const mistPts = [];
  for (let i = 4; i < RIVER_PTS.length - 4; i += 9) {
    const [x, z, y] = RIVER_PTS[i];
    mistPts.push([x, y, z]);
  }
  for (const lake of LAKES) {
    const cx = lake.poly.reduce((s, p) => s + p[0], 0) / lake.poly.length;
    const cz = lake.poly.reduce((s, p) => s + p[1], 0) / lake.poly.length;
    mistPts.push([cx, lake.level, cz], [cx - 90, lake.level, cz + 60]);
  }
  effects.addMistPatches(mistPts);

  const animals = new AnimalManager();
  scene.add(animals.group);

  const ambience = new Ambience();

  // camera start: from the south-east, farmstead in front, valley behind
  camera.position.set(S.x + 68, steadY() + 24, S.z + 88);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(S.x, steadY() + 4, S.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 6;
  controls.maxDistance = 4600;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.22;
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

  // walk / fly / orbit rig
  const rig = new Rig(camera, canvas);
  const hintEl = $('hint');
  rig.onModeChange = (mode) => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      // look at what we were looking at
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      controls.target.copy(camera.position).addScaledVector(fwd, 30);
      hintEl.textContent = 'drag to look · scroll to zoom · WASD/arrows to walk · 1–6 or [ ] travel in time';
    } else if (mode === 'fly') {
      hintEl.textContent = 'WASD/arrows fly · E/Q up & down · wheel = speed · V to walk · O orbit · [ ] travel in time';
    } else {
      hintEl.textContent = 'WASD/arrows walk · Shift sprint · Space jump · V to fly · O orbit · [ ] travel in time';
    }
  };
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => rig.setMode(b.dataset.mode)));

  // ------- era management -------
  const eraCache = new Map();
  let current = null, currentEra = -1, eraTicks = [];

  function activateEra(era) {
    if (era === currentEra) return;
    let built = eraCache.get(era);
    if (!built) {
      built = buildEra(era, { water });
      eraCache.set(era, built);
    }
    if (current) scene.remove(current.group);
    scene.add(built.group);
    current = built;
    currentEra = era;
    eraTicks = built.ticks;
    paintEra(era);
    veg.setEra(era);
    animals.clear();
    applySpawns(animals, built.spawns);
    effects.clearDynamic();
    for (const [x, y, z, o] of built.smokes) effects.addSmoke(x, y, z, o);
    for (const [x, y, z, o] of built.fires) effects.addFire(x, y, z, o);
    water.pond.visible = era === 3 || era === 4;
    water.setEra(era);
    effects.setAurora(era === 0);
    effects.setFireflies(era >= 1);
    ambience.setScene(era, sky.state.sunLow, built.fires.length > 0);
    // HUD
    document.querySelectorAll('.era-btn').forEach((b, i) => b.classList.toggle('active', i === era));
    $('era-title').textContent = ERAS[era].title;
    $('era-body').textContent = ERAS[era].body.replace(/\s+/g, ' ');
    $('era-facts').innerHTML = ERAS[era].facts.map((f) => `<span>${f}</span>`).join('');
  }

  // era switch with fade + year spin
  let switching = false;
  function switchEra(era) {
    if (era === currentEra || switching) return;
    switching = true;
    const fade = $('fade');
    const yearEl = $('year-spin');
    fade.classList.add('on');
    const fromYear = currentEra >= 0 ? ERAS[currentEra].year : ERAS[era].year;
    const toYear = ERAS[era].year;
    setTimeout(() => {
      activateEra(era);
      const t0 = performance.now();
      yearEl.style.opacity = 1;
      const spin = () => {
        const u = Math.min(1, (performance.now() - t0) / 1100);
        const e = u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
        const y = Math.round(fromYear + (toYear - fromYear) * e);
        yearEl.textContent = y < 0 ? `${(-y).toLocaleString('en')} BC` : `AD ${y}`;
        if (u < 1) requestAnimationFrame(spin);
        else setTimeout(() => { yearEl.style.opacity = 0; }, 600);
      };
      spin();
      fade.classList.remove('on');
      setTimeout(() => { switching = false; }, 700);
    }, 620);
  }

  // ------- camera presets -------
  const yAt = (x, z, h) => heightAt(x, z) + h;
  const riverW = LOC.STEAD.x - 210; // west-leg river x near the stead
  const riverPtNear = (z) => {
    let best = RIVER_PTS[0], bd = Infinity;
    for (const p of RIVER_PTS) {
      if (p[1] < -200) continue; // stay on the south (upstream) leg
      const d = Math.abs(p[1] - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const PRESETS = {
    seta: () => [[S.x + 68, yAt(S.x + 68, S.z + 88, 24), S.z + 88], [S.x, steadY() + 4, S.z]],
    pagalms: () => [[S.x + 26, steadY() + 4.5, S.z + 24], [S.x - 6, steadY() + 2.5, S.z - 8]],
    upe: () => {
      // over the water, looking downstream-to-upstream: Dabaru ezers and the
      // old fort hill rise to the south
      const a = riverPtNear(S.z - 70), b = riverPtNear(S.z + 560);
      return [[a[0], a[2] + 14, a[1]], [b[0], b[2] + 2, b[1]]];
    },
    muiza: () => [[LOC.MANOR.x + 55, yAt(LOC.MANOR.x + 55, LOC.MANOR.z + 110, 16), LOC.MANOR.z + 110], [LOC.MANOR.x, yAt(LOC.MANOR.x, LOC.MANOR.z, 5), LOC.MANOR.z]],
    ezers: () => [[LOC.LAKE_VIEW.x - 600, yAt(LOC.LAKE_VIEW.x - 600, LOC.LAKE_VIEW.z + 200, 70), LOC.LAKE_VIEW.z + 200], [LOC.LAKE_VIEW.x + 200, LAKES[0] ? LAKES[0].level : 180, LOC.LAKE_VIEW.z]],
    brezga: () => [[LOC.BREZGA.x - 210, yAt(LOC.BREZGA.x - 210, LOC.BREZGA.z + 260, 55), LOC.BREZGA.z + 260], [LOC.BREZGA.x, yAt(LOC.BREZGA.x, LOC.BREZGA.z, 8), LOC.BREZGA.z]],
    putns: () => [[S.x + 300, yAt(S.x, S.z, 780), S.z + 700], [S.x + 300, steadY(), S.z + 300]],
  };
  let camTween = null;
  function flyTo(name) {
    rig.setMode('orbit');
    const [pos, tgt] = PRESETS[name]();
    controls.autoRotate = false;
    controls.enabled = false;
    camTween = {
      t: 0,
      p0: camera.position.clone(), p1: new THREE.Vector3(...pos),
      t0: controls.target.clone(), t1: new THREE.Vector3(...tgt),
    };
  }

  // ------- HUD wiring -------
  window.__scene = scene;
  window.__rig = rig;
  window.__sim = {
    camera, controls, flyTo: (n) => flyTo(n), switchEra: (e) => switchEra(e), sky,
    jump: (n) => {
      const [pos, tgt] = PRESETS[n]();
      controls.autoRotate = false;
      camera.position.set(...pos);
      controls.target.set(...tgt);
    },
    era: (e) => { activateEra(e); },
  };
  document.querySelectorAll('.era-btn').forEach((b, i) => b.addEventListener('click', () => switchEra(i)));
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => flyTo(b.dataset.view)));
  // arrows belong to walking now — time travel lives on 1-6 and [ ] , .
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key >= '1' && e.key <= '6') switchEra(+e.key - 1);
    if (e.key === ']' || e.key === '.') switchEra(Math.min(ERAS.length - 1, currentEra + 1));
    if (e.key === '[' || e.key === ',') switchEra(Math.max(0, currentEra - 1));
  });
  $('sound-btn').addEventListener('click', () => {
    const on = ambience.toggle();
    $('sound-btn').textContent = on ? '🔊 skaņa' : '🔇 skaņa';
    ambience.setScene(currentEra, sky.state.sunLow, current?.fires.length > 0);
  });
  $('about-btn').addEventListener('click', () => $('about').classList.add('open'));
  $('about-close').addEventListener('click', () => $('about').classList.remove('open'));
  $('panel-toggle').addEventListener('click', () => $('panel').classList.toggle('closed'));
  const timeBtns = document.querySelectorAll('[data-time]');
  timeBtns.forEach((b) => b.addEventListener('click', () => {
    sky.state.paused = b.dataset.time !== 'flow';
    if (b.dataset.time === 'noon') sky.state.t = 0.42;
    if (b.dataset.time === 'evening') sky.state.t = 0.88;
    if (b.dataset.time === 'dawn') sky.state.t = 0.03;
    timeBtns.forEach((x) => x.classList.toggle('active', x === b));
  }));

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // high birds circling the valley
  const birds = new THREE.Group();
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1.1, 0, 0, 0, 0.18, 0.35, 0, 0, -0.25, 0, 0.18, 0.35, 1.1, 0, 0, 0, 0, -0.25], 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x22282c, side: THREE.DoubleSide });
  const birdSeeds = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(birdGeo, birdMat);
    b.scale.setScalar(1.6);
    birds.add(b);
    birdSeeds.push({ r: 180 + i * 90, h: 120 + i * 40, s: 0.05 + i * 0.012, p: i * 1.7 });
  }
  scene.add(birds);

  // ------- start -------
  await progress('Herding the aurochs…');
  activateEra(2);                       // begin in the Latgalian age
  console.log(`[boot] total ${((performance.now() - bootT0) / 1000).toFixed(2)}s`);
  $('loader').classList.add('done');
  setTimeout(() => $('loader').remove(), 900);

  const clock = new THREE.Clock();
  const wind = new THREE.Vector2(0.6, 0.25);

  // FPS governor: shed pixel ratio, shadow rate/size, then grass density —
  // never the trees. Kicks in early (below ~34fps) so it never feels laggy
  // for long.
  const gov = { acc: 0, frames: 0, level: 0, shadowEvery: 3, shadowTick: 0 };
  const GOV_STEPS = [
    { pr: Math.min(devicePixelRatio, 1.75), grass: 1, shadowEvery: 3, shadowMap: 4096 },
    { pr: Math.min(devicePixelRatio, 1.5), grass: 0.85, shadowEvery: 4, shadowMap: 4096 },
    { pr: 1.25, grass: 0.65, shadowEvery: 5, shadowMap: 2048 },
    { pr: 1.0, grass: 0.45, shadowEvery: 6, shadowMap: 2048 },
  ];
  function applyGov(s) {
    renderer.setPixelRatio(s.pr);
    composer.setPixelRatio(s.pr);
    composer.setSize(innerWidth, innerHeight);
    grass.setBudget(s.grass);
    gov.shadowEvery = s.shadowEvery;
    if (sky.sun.shadow.mapSize.x !== s.shadowMap) {
      sky.sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
      if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
    }
  }
  function govern(dt) {
    gov.acc += dt; gov.frames++;
    if (gov.acc < 3) return;
    const fps = gov.frames / gov.acc;
    gov.acc = 0; gov.frames = 0;
    if (fps < 34 && gov.level < GOV_STEPS.length - 1) {
      gov.level++;
      applyGov(GOV_STEPS[gov.level]);
    }
  }
  window.__gov = gov;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    govern(dt);
    if (rig.mode !== 'orbit') {
      rig.update(dt);
    } else if (camTween) {
      camTween.t += dt / 2.2;
      const u = Math.min(1, camTween.t);
      const e = u * u * (3 - 2 * u);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      controls.target.lerpVectors(camTween.t0, camTween.t1, e);
      if (u >= 1) { camTween = null; controls.enabled = true; }
    } else {
      controls.update();
      // keep the orbit camera out of the dirt
      const minY = heightAt(camera.position.x, camera.position.z) + 1.6;
      if (camera.position.y < minY) camera.position.y = minY;
    }

    const focus = rig.mode === 'orbit' ? controls.target : camera.position;
    sky.update(dt, focus);
    // shadow cadence: the pass costs as much as the main render — 20Hz is
    // visually identical for a slow-moving sun
    if (++gov.shadowTick >= gov.shadowEvery) {
      gov.shadowTick = 0;
      renderer.shadowMap.needsUpdate = true;
    }
    veg.tick(sky.state.sunColor, sky.state.ambient);
    water.tick(t);
    WIND.time.value = t;
    grass.update(focus, currentEra, camera.position);
    envAge += dt;
    if (envAge > 5) {
      envAge = 0;
      cubeCam.update(renderer, scene);
    }
    animals.tick(t, dt);
    effects.tick(t, dt, wind, sky.state.sunLow);
    for (const fn of eraTicks) fn(t, dt);
    for (let i = 0; i < birds.children.length; i++) {
      const b = birds.children[i], sd = birdSeeds[i];
      const a = t * sd.s + sd.p;
      b.position.set(S.x + Math.cos(a) * sd.r, steadY() + sd.h + Math.sin(t * 0.2 + sd.p) * 8, S.z + Math.sin(a) * sd.r * 0.8);
      b.rotation.y = -a - Math.PI / 2;
      b.rotation.z = Math.sin(t * 3 + sd.p) * 0.12;
    }
    const clockEl = $('day-clock');
    if (clockEl) {
      const h = Math.floor(sky.state.hour), m = Math.floor((sky.state.hour % 1) * 60);
      clockEl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    composer.render();
  });
}

boot().catch((err) => {
  const el = $('loader-status');
  if (el) el.textContent = 'Something broke while building the world: ' + err.message;
  console.error(err);
});
