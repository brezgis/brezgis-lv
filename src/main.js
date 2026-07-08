// Brezgi / Taurene time machine — entry point.
import * as THREE from 'three';
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

// ---------------- UI language (chrome only; the chronicle stays English) ----
const I18N = {
  lv: {
    seta: 'Sēta', pagalms: 'Pagalms', upe: 'Gauja', muiza: 'Muiža', ezers: 'Ezers',
    brezga: 'Brežģis', putns: 'Putns', fly: 'Lidot', walk: 'Iet',
    flow: 'Rit', dawn: 'Rīts', noon: 'Diena', evening: 'Vakars',
    lblView: 'Skats', lblMove: 'Kustība', lblTime: 'Diennakts',
    sound: 'skaņa', chronicle: 'Hronika un avoti', story: 'Stāsts / story', close: 'Aizvērt ✕',
    era0: 'Tundra', era1: 'Tauri', era2: 'Latgaļi', era3: 'Muiža', era4: 'Taurene', era5: 'Šodiena',
    hintCinema: 'klikšķini vai spied WASD, lai lidotu · 1–6 vai [ ] ceļo laikā',
    hintFly: 'WASD/bultiņas lido · Space augšup, Shift lejup — nolaidies zemē, lai ietu · ritenis = ātrums',
    hintWalk: 'WASD/bultiņas iet · Shift skrien · Space lec · dubult-Space = lidot',
  },
  en: {
    seta: 'Farmstead', pagalms: 'Yard', upe: 'Gauja', muiza: 'Manor', ezers: 'Lake',
    brezga: 'Brežģis hill', putns: "Bird's eye", fly: 'Fly', walk: 'Walk',
    flow: 'Flow', dawn: 'Dawn', noon: 'Noon', evening: 'Evening',
    lblView: 'View', lblMove: 'Move', lblTime: 'Time of day',
    sound: 'sound', chronicle: 'Chronicle & sources', story: 'Story', close: 'Close ✕',
    era0: 'Tundra', era1: 'Aurochs', era2: 'Latgalians', era3: 'Manor', era4: 'Taurene', era5: 'Today',
    hintCinema: 'click or press WASD to fly · 1–6 or [ ] travel in time',
    hintFly: 'WASD/arrows fly · Space up, Shift down — settle onto the ground to walk · wheel = speed',
    hintWalk: 'WASD/arrows walk · Shift sprint · Space jump · double-Space to fly',
  },
};
let lang = localStorage.getItem('brezgi-lang') || 'lv';

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
  camera.lookAt(S.x, steadY() + 4, S.z);

  // Minecraft-style rig: fly + walk only; 'cinema' idles until first input
  const rig = new Rig(camera, canvas);
  const cinema = { angle: Math.atan2(88, 68), r: 110, h: 26 };
  const hintEl = $('hint');
  const applyHints = () => {
    const L = I18N[lang];
    hintEl.textContent = rig.mode === 'cinema' ? L.hintCinema
      : rig.mode === 'fly' ? L.hintFly : L.hintWalk;
  };
  rig.onModeChange = (mode) => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    applyHints();
  };
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (rig.mode === 'cinema') rig.setMode('fly');
    rig.setMode(b.dataset.mode);
  }));

  // the player's body: invisible to the camera, real to the sun. Minecraft
  // says you have a shadow when you stand on the ground — you do now.
  const shadowProxy = (() => {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ colorWrite: false, depthWrite: false });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.95, 3, 8), mat);
    body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
    head.position.y = 1.62;
    g.add(body, head);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.visible = false;
    return g;
  })();
  scene.add(shadowProxy);

  // ------- collision: era buildings/fences as AABBs + tree trunks ---------
  const COLL = { cell: 14, map: new Map(), list: [] };
  const _box = new THREE.Box3();
  function rebuildColliders(group, era) {
    COLL.map.clear();
    COLL.list.length = 0;
    group.updateMatrixWorld(true);
    const _m = new THREE.Matrix4(), _ib = new THREE.Box3();
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.isInstancedMesh) {
        // per-instance AABBs (palisade posts, background walls, fences were
        // walk-through because instanced meshes were skipped wholesale)
        if (o.count > 900) return;                           // grass-scale stays cheap
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        for (let ii = 0; ii < o.count; ii++) {
          o.getMatrixAt(ii, _m);
          _m.premultiply(o.matrixWorld);
          _ib.copy(bb).applyMatrix4(_m);
          const w = _ib.max.x - _ib.min.x, d = _ib.max.z - _ib.min.z, h = _ib.max.y - _ib.min.y;
          if (!Number.isFinite(w) || w > 36 || d > 36) continue;
          // keep tall thin instances (palisade posts) that the prop filter
          // would drop — a chest-high stockade must not be walk-through
          if (h < 0.5 || (h < 1.2 && w < 0.26 && d < 0.26)) continue;
          COLL.list.push({ circ: false, x0: _ib.min.x, x1: _ib.max.x, z0: _ib.min.z, z1: _ib.max.z, y0: _ib.min.y, y1: _ib.max.y });
        }
        return;
      }
      _box.setFromObject(o);
      const w = _box.max.x - _box.min.x, d = _box.max.z - _box.min.z, h = _box.max.y - _box.min.y;
      if (!Number.isFinite(w) || w > 36 || d > 36) return;   // bridges, wires
      if (h < 0.5 || (w < 0.26 && d < 0.26)) return;         // props, twigs
      COLL.list.push({ circ: false, x0: _box.min.x, x1: _box.max.x, z0: _box.min.z, z1: _box.max.z, y0: _box.min.y, y1: _box.max.y });
    });
    for (const [x, z, r] of veg.getColliders(era)) {
      COLL.list.push({ circ: true, x, z, r });
    }
    COLL.list.forEach((c, idx) => {
      const x0 = c.circ ? c.x - c.r : c.x0, x1 = c.circ ? c.x + c.r : c.x1;
      const z0 = c.circ ? c.z - c.r : c.z0, z1 = c.circ ? c.z + c.r : c.z1;
      for (let ix = Math.floor(x0 / COLL.cell); ix <= Math.floor(x1 / COLL.cell); ix++) {
        for (let iz = Math.floor(z0 / COLL.cell); iz <= Math.floor(z1 / COLL.cell); iz++) {
          const k = ix + ':' + iz;
          let a = COLL.map.get(k);
          if (!a) COLL.map.set(k, a = []);
          a.push(idx);
        }
      }
    });
  }
  const R_PLAYER = 0.38;
  rig.collideFn = (px, pz, feetY) => {
    const cix = Math.floor(px / COLL.cell), ciz = Math.floor(pz / COLL.cell);
    for (let ix = cix - 1; ix <= cix + 1; ix++) {
      for (let iz = ciz - 1; iz <= ciz + 1; iz++) {
        const arr = COLL.map.get(ix + ':' + iz);
        if (!arr) continue;
        for (const idx of arr) {
          const c = COLL.list[idx];
          if (c.circ) {
            const dx = px - c.x, dz = pz - c.z, rr = c.r + R_PLAYER;
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr && d2 > 1e-8) {
              const d = Math.sqrt(d2);
              px = c.x + (dx / d) * rr;
              pz = c.z + (dz / d) * rr;
            }
          } else {
            if (c.y0 > feetY + 1.86 || c.y1 < feetY + 0.32) continue; // duck under (head clears 1.8) / step over
            const ex0 = c.x0 - R_PLAYER, ex1 = c.x1 + R_PLAYER;
            const ez0 = c.z0 - R_PLAYER, ez1 = c.z1 + R_PLAYER;
            if (px > ex0 && px < ex1 && pz > ez0 && pz < ez1) {
              const m = Math.min(px - ex0, ex1 - px, pz - ez0, ez1 - pz);
              if (m === px - ex0) px = ex0;
              else if (m === ex1 - px) px = ex1;
              else if (m === pz - ez0) pz = ez0;
              else pz = ez1;
            }
          }
        }
      }
    }
    return [px, pz];
  };

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
    rebuildColliders(built.group, era);
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
  // preset moves tween the camera, then hand control back in fly mode
  let camTween = null;
  const _lookT = new THREE.Vector3();
  function flyTo(name) {
    const [pos, tgt] = PRESETS[name]();
    // presets park the camera mid-air: hand control back in FLY regardless of
    // the old mode, or a walking player resumes walk physics in the sky
    if (rig.mode !== 'fly') rig.setMode('fly');
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    camTween = {
      t: 0,
      p0: camera.position.clone(), p1: new THREE.Vector3(...pos),
      t0: camera.position.clone().addScaledVector(fwd, 60), t1: new THREE.Vector3(...tgt),
    };
  }
  function jumpTo(pos, tgt) {
    if (rig.mode !== 'fly') rig.setMode('fly');
    camTween = null;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(tgt[0], tgt[1], tgt[2]);
    rig.adoptCamera();
    simControls.target.set(tgt[0], tgt[1], tgt[2]);
  }

  // ------- HUD wiring -------
  // harness compatibility stub (shot2/dbg read a controls.target)
  const simControls = { target: new THREE.Vector3(S.x, steadY() + 4, S.z), autoRotate: false, enabled: false };
  window.__scene = scene;
  window.__rig = rig;
  window.__sim = {
    camera, controls: simControls, flyTo: (n) => flyTo(n), switchEra: (e) => switchEra(e), sky,
    jump: (n) => {
      const [pos, tgt] = PRESETS[n]();
      jumpTo(pos, tgt);
    },
    setCam: (px, py, pz, tx, ty, tz) => jumpTo([px, py, pz], [tx, ty, tz]),
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
  // ------- language toggle -------
  let soundOn = false;
  function setLang(l) {
    lang = l;
    localStorage.setItem('brezgi-lang', l);
    const L = I18N[l];
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (L[key]) el.textContent = L[key];
    });
    $('sound-btn').textContent = (soundOn ? '🔊 ' : '🔇 ') + L.sound;
    $('lang-btn').textContent = l === 'lv' ? 'EN' : 'LV';
    applyHints();
  }
  $('lang-btn').addEventListener('click', () => setLang(lang === 'lv' ? 'en' : 'lv'));

  $('sound-btn').addEventListener('click', () => {
    soundOn = ambience.toggle();
    $('sound-btn').textContent = (soundOn ? '🔊 ' : '🔇 ') + I18N[lang].sound;
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
  setLang(lang);
  activateEra(2);                       // begin in the Latgalian age
  console.log(`[boot] total ${((performance.now() - bootT0) / 1000).toFixed(2)}s`);
  $('loader').classList.add('done');
  setTimeout(() => $('loader').remove(), 900);

  const clock = new THREE.Clock();
  const wind = new THREE.Vector2(0.6, 0.25);

  // FPS governor: shed pixel ratio, shadow rate/size, then grass density —
  // never the trees. Kicks in early (below ~34fps) so it never feels laggy
  // for long.
  const gov = { acc: 0, frames: 0, level: 0, shadowEvery: 2, shadowTick: 0 };
  const GOV_STEPS = [
    { pr: Math.min(devicePixelRatio, 1.75), grass: 1, shadowEvery: 2, shadowMap: 4096 },
    { pr: Math.min(devicePixelRatio, 1.5), grass: 0.85, shadowEvery: 3, shadowMap: 4096 },
    { pr: 1.25, grass: 0.65, shadowEvery: 4, shadowMap: 2048 },
    { pr: 1.0, grass: 0.45, shadowEvery: 5, shadowMap: 2048 },
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
    if (camTween) {
      camTween.t += dt / 2.2;
      const u = Math.min(1, camTween.t);
      const e = u * u * (3 - 2 * u);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      _lookT.lerpVectors(camTween.t0, camTween.t1, e);
      camera.lookAt(_lookT);
      if (u >= 1) {
        camTween = null;
        rig.adoptCamera();
      }
    } else if (rig.mode === 'cinema') {
      // intro: drift slowly around the farmstead until the first input
      cinema.angle += dt * 0.05;
      camera.position.set(
        S.x + Math.cos(cinema.angle) * cinema.r,
        steadY() + cinema.h,
        S.z + Math.sin(cinema.angle) * cinema.r);
      camera.lookAt(S.x, steadY() + 4, S.z);
    } else {
      rig.update(dt);
    }

    // player shadow: your body is real to the sun while you stand on earth
    {
      const wasVisible = shadowProxy.visible;
      if (rig.mode === 'walk') {
        shadowProxy.visible = true;
        shadowProxy.position.set(rig.basePos.x, rig.basePos.y - 1.7, rig.basePos.z);
        shadowProxy.rotation.y = rig.yaw;
      } else {
        shadowProxy.visible = false;
      }
      // appearing/vanishing must not wait for the cadence tick — a stale
      // shadow lingered mid-air after takeoff
      if (shadowProxy.visible !== wasVisible) gov.shadowTick = 1e9;
    }

    const focus = camera.position;
    // shadow cadence: the pass costs as much as the main render — 20Hz is
    // visually identical for a slow-moving sun. The shadow rig only MOVES on
    // refresh frames (sky.update) so matrix and map always agree.
    const shadowNow = ++gov.shadowTick >= gov.shadowEvery;
    if (shadowNow) {
      gov.shadowTick = 0;
      renderer.shadowMap.needsUpdate = true;
    }
    sky.update(dt, focus, shadowNow);
    veg.tick(sky.state.sunColor, sky.state.ambient);
    veg.promote(camera.position.x, camera.position.z);
    water.tick(t);
    WIND.time.value = t;
    grass.update(focus, currentEra, camera.position);
    envAge += dt;
    if (envAge > 5) {
      envAge = 0;
      cubeCam.update(renderer, scene);
    }
    animals.tick(t, dt, camera.position);
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
