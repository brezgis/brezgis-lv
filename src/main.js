// Brezgi / Taurene time machine — entry point.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initTextures } from './textures.js';
import { buildTerrain, paintEra, heightAt } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky } from './sky.js';
import { buildVegetation } from './vegetation.js';
import { buildEra, applySpawns } from './eras.js';
import { AnimalManager } from './animals.js';
import { Effects } from './effects.js';
import { Ambience } from './audio.js';
import { LOC } from './landuse.js';
import { RIVER_PTS, LAKES } from './geodata.js';
import { ERAS } from './content.js';

const S = LOC.STEAD;
const $ = (id) => document.getElementById(id);

const progress = (msg) => {
  const el = $('loader-status');
  if (el) el.textContent = msg;
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
};

async function boot() {
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

  await progress('Planting the forests…');
  const veg = buildVegetation(scene);

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
  controls.maxDistance = 2800;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.22;
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

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
    for (const [x, y, z] of built.fires) effects.addFire(x, y, z);
    water.pond.visible = era >= 2;
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
        yearEl.textContent = y < 0 ? `${-y} BC` : `AD ${y}`;
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
      const a = riverPtNear(S.z + 300), b = riverPtNear(S.z - 80);
      return [[a[0], a[2] + 13, a[1]], [b[0], b[2] + 1.5, b[1]]];
    },
    muiza: () => [[LOC.MANOR.x + 55, yAt(LOC.MANOR.x + 55, LOC.MANOR.z + 110, 16), LOC.MANOR.z + 110], [LOC.MANOR.x, yAt(LOC.MANOR.x, LOC.MANOR.z, 5), LOC.MANOR.z]],
    ezers: () => [[LOC.LAKE_VIEW.x - 600, yAt(LOC.LAKE_VIEW.x - 600, LOC.LAKE_VIEW.z + 200, 70), LOC.LAKE_VIEW.z + 200], [LOC.LAKE_VIEW.x + 200, LAKES[0] ? LAKES[0].level : 180, LOC.LAKE_VIEW.z]],
    putns: () => [[S.x + 300, yAt(S.x, S.z, 640), S.z + 500], [S.x, steadY(), S.z - 200]],
  };
  let camTween = null;
  function flyTo(name) {
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
  addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '4') switchEra(+e.key - 1);
    if (e.key === 'ArrowRight') switchEra(Math.min(3, currentEra + 1));
    if (e.key === 'ArrowLeft') switchEra(Math.max(0, currentEra - 1));
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
  activateEra(1);                       // begin in the Latgalian age
  $('loader').classList.add('done');
  setTimeout(() => $('loader').remove(), 900);

  const clock = new THREE.Clock();
  const wind = new THREE.Vector2(0.6, 0.25);
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (camTween) {
      camTween.t += dt / 2.2;
      const u = Math.min(1, camTween.t);
      const e = u * u * (3 - 2 * u);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      controls.target.lerpVectors(camTween.t0, camTween.t1, e);
      if (u >= 1) { camTween = null; controls.enabled = true; }
    } else {
      controls.update();
    }
    // keep the camera out of the dirt
    const minY = heightAt(camera.position.x, camera.position.z) + 1.6;
    if (camera.position.y < minY) camera.position.y = minY;

    sky.update(dt, controls.target);
    water.tick(t);
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
    renderer.render(scene, camera);
  });
}

boot().catch((err) => {
  const el = $('loader-status');
  if (el) el.textContent = 'Something broke while building the world: ' + err.message;
  console.error(err);
});
