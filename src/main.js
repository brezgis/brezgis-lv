// Brezgi / Taurene time machine — entry point.
import { waterLevelAt } from './riverzone.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { initTextures } from './textures.js';
import { buildTerrain, paintEra, meshHeightAt } from './terrain.js';
import { buildWater } from './water.js';
import { buildSky } from './sky.js';
import { buildVegetation, WIND } from './vegetation.js';
import { buildGrass } from './grass.js';
import { buildEra, applySpawns } from './eras.js';
import { AnimalManager } from './animals.js';
import { Effects } from './effects.js';
import { Ambience } from './audio.js';
import { Rig } from './rig.js';
import { buildMinimap } from './minimap.js';
import { LOC } from './landuse.js';
import { RIVER_PTS, LAKES } from './geodata.js';
import { ERAS, SOURCES, INTRO, eraText } from './content.js';

const S = LOC.STEAD;
const $ = (id) => document.getElementById(id);

// ---------------- UI language: everything but the long Chronicle ------------
const I18N = {
  lv: {
    fly: 'Lidot', walk: 'Iet', toFly: 'Pārslēgt uz lidošanu', toWalk: 'Pārslēgt uz iešanu',
    flow: '▶ Laiks rit', dawn: 'Ausma', noon: 'Diena', evening: 'Vakars', timeOfDay: 'Diennakts laiks',
    karte: 'Karte · M', soundOn: 'Skaņa ieslēgta', soundOff: 'Skaņa izslēgta', lang: 'Valoda latviešu',
    chronicle: 'Hronika un avoti', story: 'Stāsts', close: 'Aizvērt ✕', menu: 'Izvēlne',
    lookHere: 'Apskatīt', more: 'Lasīt vairāk ▾', less: 'Mazāk ▴', source: 'avots',
  },
  en: {
    fly: 'Fly', walk: 'Walk', toFly: 'Switch to flying', toWalk: 'Switch to walking',
    flow: '▶ Time flows', dawn: 'Dawn', noon: 'Noon', evening: 'Evening', timeOfDay: 'Time of day',
    karte: 'Map · M', soundOn: 'Sound on', soundOff: 'Sound off', lang: 'Language English',
    chronicle: 'Chronicle & sources', story: 'Story', close: 'Close ✕', menu: 'Menu',
    lookHere: 'Look here', more: 'Read more ▾', less: 'Less ▴', source: 'source',
  },
};
const ICONS = {
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  fly: '<svg viewBox="0 0 24 24"><path d="M1.5 11.5c3.2-2.6 6.3-2.4 10.5 1.2 4.2-3.6 7.3-3.8 10.5-1.2-3.9-.6-6.9.6-10.5 4.3-3.6-3.7-6.6-4.9-10.5-4.3z" fill="currentColor"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.2" r="2.1" fill="currentColor"/><path d="M12.5 8.2l-2.6 5.1 2.9 2.6-1.4 5.8M12.5 8.2l2.3 4.4 3.3 1.3M9.9 13.3l-3.2 2.4M12.8 15.9l3.9 5.8" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// compact keycap chips per mode — the old prose hint line read as a manual
const KEYCHIPS = {
  lv: {
    cinema: [['Klikšķis / WASD', 'lidot'], ['1–6', 'laikmeti'], ['M', 'karte']],
    fly: [['WASD', 'lidot'], ['Space · Shift', 'augšup · lejup'], ['W W', 'ātri'], ['Ritenis', 'ātrums'], ['Space ×2', 'iet'], ['M', 'karte']],
    walk: [['WASD', 'iet'], ['Shift', 'skriet'], ['Space', 'lēkt'], ['Space ×2', 'lidot'], ['1–6', 'laikmeti'], ['M', 'karte']],
  },
  en: {
    cinema: [['Click / WASD', 'fly'], ['1–6', 'eras'], ['M', 'map']],
    fly: [['WASD', 'fly'], ['Space · Shift', 'up · down'], ['W W', 'boost'], ['Wheel', 'speed'], ['Space ×2', 'walk'], ['M', 'map']],
    walk: [['WASD', 'walk'], ['Shift', 'sprint'], ['Space', 'jump'], ['Space ×2', 'fly'], ['1–6', 'eras'], ['M', 'map']],
  },
};
let lang = 'lv';
try { lang = localStorage.getItem('brezgi-lang') === 'en' ? 'en' : 'lv'; } catch { /* storage may be unavailable for local files */ }

// The welcome card: context to read while the landscape builds; once it is
// built, "Step in" (or Enter) dismisses it. Automated browsers skip it.
function renderIntro() {
  const T = INTRO[lang];
  const k = $('intro-kicker'), tx = $('intro-text'), how = $('intro-how'), en = $('intro-enter'), lb = $('intro-lang');
  if (!tx) return;
  k.textContent = T.kicker;
  tx.innerHTML = T.paras.map((p) => `<p>${p}</p>`).join('');
  how.textContent = T.how;
  en.textContent = T.enter + ' →';
  lb.textContent = lang === 'lv' ? 'EN' : 'LV';
}
renderIntro();
$('intro-lang')?.addEventListener('click', () => {
  lang = lang === 'lv' ? 'en' : 'lv';
  try { localStorage.setItem('brezgi-lang', lang); } catch { /* optional */ }
  renderIntro();
  window.__applyLang?.(lang);
});

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
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
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 12000);

  await progress('Sculpting the Vidzeme Upland from real elevation data…');
  initTextures();
  const terrain = buildTerrain();
  scene.add(terrain);
  const steadY = meshHeightAt(S.x, S.z);

  await progress('Filling the Gauja and Dabaru lake…');
  const water = buildWater();
  scene.add(water.group);

  await progress('Raising the sky…');
  const sky = buildSky(scene, renderer);

  await progress('Growing the forests, branch by branch…');
  const veg = buildVegetation(scene, renderer);
  window.__veg = veg;                    // debug hook for data/floracount.mjs
  window.__water = (x, z) => waterLevelAt(x, z, currentEra);   // debug hook: shot harnesses stay above water
  window.__waterSys = water;                                    // debug hook: shader uniforms, reflector
  window.__meshHeightAt = meshHeightAt;                         // debug hook: the RENDERED ground (2 m shore mesh included)
  await progress('Sowing half a million blades of grass…');
  const grass = buildGrass(scene);
  window.__grass = grass;                // debug hook for data/dbg.mjs grassstate

  // post chain: MSAA render target -> subtle bloom -> tone-mapped output
  const rtSamples = Math.min(4, renderer.capabilities.maxSamples);
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
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(1, 12000, cubeRT);
  cubeCam.layers.set(1);
  cubeCam.children.forEach((c) => c.layers.set(1));
  cubeCam.position.set(LOC.STEAD.x - 200, meshHeightAt(LOC.STEAD.x - 200, LOC.STEAD.z) + 12, LOC.STEAD.z);
  water.applyEnvMap(cubeRT.texture);
  let envAge = 1e9, envT = -1;

  const effects = new Effects(scene);
  // left out of the water's mirror: grass is sub-pixel at half resolution,
  // and cloud billboards seen from below are dark smudges, not clouds
  const reflHide = [...grass.meshes, effects.group, scene.getObjectByName('clouds')].filter(Boolean);
  effects.setFireflyCenter(S.x - 40, steadY, S.z + 30);
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
  camera.position.set(S.x + 68, steadY + 24, S.z + 88);
  camera.lookAt(S.x, steadY + 4, S.z);

  // Minecraft-style rig: fly + walk only; 'cinema' idles until first input
  const rig = new Rig(camera, canvas);
  const cinema = { angle: Math.atan2(88, 68), r: 110, h: 26 };
  const keysEl = $('keys');
  let keysDimT = null;
  const renderKeys = () => {
    const chips = KEYCHIPS[lang][rig.mode] || KEYCHIPS[lang].fly;
    keysEl.innerHTML = chips.map(([k, l]) => `<span class="kc"><kbd>${k}</kbd><span class="kl">${l}</span></span>`).join('');
    keysEl.classList.remove('dim');
    clearTimeout(keysDimT);
    keysDimT = setTimeout(() => keysEl.classList.add('dim'), 9000);
  };
  // one toggle: shows how you are moving now, click to switch
  const renderMode = () => {
    const m = rig.mode === 'walk' ? 'walk' : 'fly';
    const b = $('mode-btn');
    b.innerHTML = ICONS[m] + `<span class="lab">${I18N[lang][m]}</span>`;
    b.title = I18N[lang][m === 'walk' ? 'toFly' : 'toWalk'];
    b.setAttribute('aria-label', b.title);
  };
  rig.onModeChange = () => { renderMode(); renderKeys(); };
  $('mode-btn').addEventListener('click', () => {
    if (rig.mode === 'cinema') rig.setMode('fly');
    rig.setMode(rig.mode === 'walk' ? 'fly' : 'walk');
  });

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
  const COLL = { cell: 14, map: new Map(), list: [], ix0: 0, ix1: -1, iz0: 0, iz1: -1, offX: 0, offZ: 0, w: 0 };
  const _box = new THREE.Box3();
  function rebuildColliders(group, era) {
    COLL.map.clear();
    COLL.list.length = 0;
    group.updateMatrixWorld(true);
    const _m = new THREE.Matrix4(), _ib = new THREE.Box3();
    // things you walk over or through (barrow mounds, moving traffic) opt out:
    // an AABB frozen at build time is either a wall around a knee-high mound
    // or a ghost box left where a vehicle used to be
    const opensOut = (o) => {
      for (let p = o; p && p !== group; p = p.parent) if (p.userData.noCollide) return true;
      return false;
    };
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (opensOut(o)) return;
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
    if (!COLL.list.length) { COLL.ix0 = COLL.iz0 = 0; COLL.ix1 = COLL.iz1 = -1; COLL.w = 0; return; }
    let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity;
    COLL.list.forEach((c) => {
      const x0 = c.circ ? c.x - c.r : c.x0, x1 = c.circ ? c.x + c.r : c.x1;
      const z0 = c.circ ? c.z - c.r : c.z0, z1 = c.circ ? c.z + c.r : c.z1;
      ix0 = Math.min(ix0, Math.floor(x0 / COLL.cell)); ix1 = Math.max(ix1, Math.floor(x1 / COLL.cell));
      iz0 = Math.min(iz0, Math.floor(z0 / COLL.cell)); iz1 = Math.max(iz1, Math.floor(z1 / COLL.cell));
    });
    COLL.ix0 = ix0; COLL.ix1 = ix1; COLL.iz0 = iz0; COLL.iz1 = iz1;
    COLL.offX = -ix0; COLL.offZ = -iz0; COLL.w = iz1 - iz0 + 1;
    COLL.list.forEach((c, idx) => {
      const x0 = c.circ ? c.x - c.r : c.x0, x1 = c.circ ? c.x + c.r : c.x1;
      const z0 = c.circ ? c.z - c.r : c.z0, z1 = c.circ ? c.z + c.r : c.z1;
      for (let ix = Math.floor(x0 / COLL.cell); ix <= Math.floor(x1 / COLL.cell); ix++) {
        for (let iz = Math.floor(z0 / COLL.cell); iz <= Math.floor(z1 / COLL.cell); iz++) {
          const k = (ix + COLL.offX) * COLL.w + iz + COLL.offZ;
          let a = COLL.map.get(k);
          if (!a) COLL.map.set(k, a = []);
          a.push(idx);
        }
      }
    });
  }
  const R_PLAYER = 0.38;
  const _collHit = [0, 0];
  rig.collideFn = (px, pz, feetY) => {
    const cix = Math.floor(px / COLL.cell), ciz = Math.floor(pz / COLL.cell);
    for (let ix = cix - 1; ix <= cix + 1; ix++) {
      for (let iz = ciz - 1; iz <= ciz + 1; iz++) {
        if (ix < COLL.ix0 || ix > COLL.ix1 || iz < COLL.iz0 || iz > COLL.iz1) continue;
        const arr = COLL.map.get((ix + COLL.offX) * COLL.w + iz + COLL.offZ);
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
    _collHit[0] = px; _collHit[1] = pz;
    return _collHit;
  };

  // ------- era management -------
  const eraCache = new Map();
  let current = null, currentEra = -1, eraTicks = [];
  let minimap = null;                    // assigned once the presets exist

  function activateEra(era) {
    if (!Number.isInteger(era) || !ERAS[era]) return;
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
    renderer.shadowMap.needsUpdate = true;
    envAge = 1e9;
    rig.era = era;                       // wading rules follow the century
    if (minimap) minimap.onEra();
    effects.setAurora(era === 0);
    effects.setFireflies(era >= 1);
    ambience.setScene(era, sky.state.sunLow, built.fires.length > 0);
    rebuildColliders(built.group, era);
    // HUD
    document.querySelectorAll('.era-btn').forEach((b, i) => {
      b.classList.toggle('active', i === era);
      b.setAttribute('aria-pressed', String(i === era));
    });
    renderEraText(era);
  }

  // ------- the story panel -------
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // runs of [n][m] become one superscript, "n, m", each number a link
  const citeHTML = (t) => esc(t).replace(/\s?((?:\[\d+\])+)/g, (m, run) => {
    const links = [...run.matchAll(/\d+/g)].map(([n]) => {
      const src = SOURCES.find((q) => q.n === +n);
      return src ? `<a href="${src.u}" target="_blank" rel="noopener" data-cite="${n}">${n}</a>` : '';
    }).filter(Boolean);
    return links.length ? `<sup>${links.join(',')}</sup>` : '';
  });
  let moreOpen = false;
  function renderEraText(era) {
    if (era < 0) return;
    const T = eraText(era, lang), L = I18N[lang];
    $('era-title').innerHTML = `${esc(T.title)} <span class="yr">${esc(T.year)}</span>`;
    $('era-lead').innerHTML = citeHTML(T.lead);
    $('era-body').innerHTML = citeHTML(T.more);
    $('era-more').hidden = !moreOpen;
    $('more-btn').textContent = moreOpen ? L.less : L.more;
    $('era-evidence').textContent = T.evidence;
    const row = document.querySelector('#era-moments .row');
    row.innerHTML = '';
    for (const m of MOMENTS[era] || []) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'moment'; b.textContent = m[lang];
      b.addEventListener('click', () => goMoment(m));
      row.appendChild(b);
    }
    // timeline: localized years and names
    document.querySelectorAll('.era-btn').forEach((btn, i) => {
      const E = eraText(i, lang);
      btn.querySelector('.yr').textContent = E.year;
      btn.querySelector('.nm').textContent = E.name;
      btn.setAttribute('aria-label', `${E.year} — ${E.name}`);
    });
  }
  $('more-btn').addEventListener('click', () => { moreOpen = !moreOpen; renderEraText(currentEra); });
  // citation tooltips: the source, one hover away; click opens it
  const tip = $('cite-tip');
  $('panel').addEventListener('mouseover', (e) => {
    const a = e.target.closest?.('a[data-cite]');
    if (!a) return;
    const src = SOURCES.find((q) => q.n === +a.dataset.cite);
    tip.textContent = `[${src.n}] ${src.t}`;
    const r = a.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - 316, r.right + 8)}px`;
    tip.style.top = `${Math.max(8, r.top - 8)}px`;
    tip.classList.add('on');
  });
  $('panel').addEventListener('mouseout', (e) => { if (e.target.closest?.('a[data-cite]')) tip.classList.remove('on'); });
  // the story folds itself away once you start moving, and comes back with
  // each new era — read it, then walk
  let panelShownAt = 0;
  const showPanel = (on) => {
    $('panel').classList.toggle('closed', !on);
    if (on) panelShownAt = performance.now();
  };
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  addEventListener('keydown', (e) => {
    if (!MOVE_KEYS.has(e.code) || $('panel').classList.contains('closed')) return;
    if (performance.now() - panelShownAt < 1500) return;
    if (matchMedia('(max-width: 760px)').matches) return;
    showPanel(false);
  });

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
    const labelEl = $('era-label');
    setTimeout(() => {
      activateEra(era);
      if (!matchMedia('(max-width: 760px)').matches) showPanel(true);
      const t0 = performance.now();
      yearEl.style.opacity = 1;
      labelEl.textContent = eraText(era, lang).name;
      labelEl.style.opacity = 1;
      const spin = () => {
        const u = Math.min(1, (performance.now() - t0) / 1100);
        const e = u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
        const y = Math.round(fromYear + (toYear - fromYear) * e);
        yearEl.textContent = lang === 'lv'
          ? (y < 0 ? `${(-y).toLocaleString('lv')} p. m. ē.` : `${Math.max(1, y)}. g.`)
          : (y < 0 ? `${(-y).toLocaleString('en')} BC` : `AD ${Math.max(1, y)}`);
        if (u < 1) requestAnimationFrame(spin);
        else setTimeout(() => { yearEl.style.opacity = 0; labelEl.style.opacity = 0; }, 600);
      };
      spin();
      // hold the parchment a beat — the gold sweep and the emblem deserve
      // to be SEEN, and the new era loading its meshes hides behind it
      setTimeout(() => fade.classList.remove('on'), 480);
      setTimeout(() => { switching = false; }, 1150);
    }, 620);
  }

  // ------- camera presets -------
  const yAt = (x, z, h) => meshHeightAt(x, z) + h;
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
    seta: () => [[S.x + 68, yAt(S.x + 68, S.z + 88, 24), S.z + 88], [S.x, steadY + 4, S.z]],
    pagalms: () => [[S.x + 26, steadY + 4.5, S.z + 24], [S.x - 6, steadY + 2.5, S.z - 8]],
    upe: () => {
      // over the water, looking downstream-to-upstream: Dabaru ezers and the
      // old fort hill rise to the south
      const a = riverPtNear(S.z - 70), b = riverPtNear(S.z + 560);
      return [[a[0], a[2] + 14, a[1]], [b[0], b[2] + 2, b[1]]];
    },
    muiza: () => [[LOC.MANOR.x + 55, yAt(LOC.MANOR.x + 55, LOC.MANOR.z + 110, 16), LOC.MANOR.z + 110], [LOC.MANOR.x, yAt(LOC.MANOR.x, LOC.MANOR.z, 5), LOC.MANOR.z]],
    ezers: () => [[LOC.LAKE_VIEW.x - 600, yAt(LOC.LAKE_VIEW.x - 600, LOC.LAKE_VIEW.z + 200, 70), LOC.LAKE_VIEW.z + 200], [LOC.LAKE_VIEW.x + 200, LAKES[0] ? LAKES[0].level : 180, LOC.LAKE_VIEW.z]],
    brezga: () => [[LOC.BREZGA.x - 210, yAt(LOC.BREZGA.x - 210, LOC.BREZGA.z + 260, 55), LOC.BREZGA.z + 260], [LOC.BREZGA.x, yAt(LOC.BREZGA.x, LOC.BREZGA.z, 8), LOC.BREZGA.z]],
    putns: () => [[S.x + 300, yAt(S.x, S.z, 780), S.z + 700], [S.x + 300, steadY, S.z + 300]],
  };
  // preset moves tween the camera, then hand control back in fly mode
  let camTween = null;
  const _lookT = new THREE.Vector3();
  function tweenTo(pos, tgt) {
    // hand control back in FLY regardless of the old mode, or a walking
    // player resumes walk physics in the sky
    if (rig.mode !== 'fly') rig.setMode('fly');
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    camTween = {
      t: 0,
      p0: camera.position.clone(), p1: new THREE.Vector3(...pos),
      t0: camera.position.clone().addScaledVector(fwd, 60), t1: new THREE.Vector3(...tgt),
    };
  }
  function flyTo(name) {
    const [pos, tgt] = PRESETS[name]();
    tweenTo(pos, tgt);
  }
  // map click: swoop to any point, approaching from the south-east like the
  // presets so the light reads well on arrival
  function flyToPoint(x, z, alt = 250) {
    const gy = meshHeightAt(x, z);
    tweenTo([x + alt * 0.55, gy + alt, z + alt * 0.7], [x, gy + 4, z]);
  }
  // "Look here": a few places per era worth gliding to. [x, z, alt] or a
  // preset name; t sets the time of day on arrival.
  const MOMENTS = [
    [{ lv: 'Ziemeļbriežu bars', en: 'The reindeer band', at: [S.x - 60, S.z + 120, 30] },
     { lv: 'Kūstošais ledus ezera ieplakā', en: 'Dead ice melting in a lake hollow', at: [1780, -280, 160] },
     { lv: 'Ziemeļblāzma', en: 'The northern lights', at: [S.x, S.z + 200, 60], t: 0.0 }],
    [{ lv: 'Mednieku nometne', en: 'The hunters’ camp', at: [LOC.CAMP.x, LOC.CAMP.z, 16] },
     { lv: 'Tauru bars', en: 'The aurochs herd', at: [S.x - 20, S.z + 30, 30] },
     { lv: 'Gauja', en: 'The Gauja', preset: 'upe' }],
    [{ lv: 'Sēta', en: 'The farmstead', preset: 'pagalms' },
     { lv: 'Līdums', en: 'A burn-cleared field', at: [-89, -15, 40] },
     { lv: 'Lejstupu pilskalns', en: 'Lejstupu hillfort', at: [LOC.HILLFORT.x, LOC.HILLFORT.z, 70] }],
    [{ lv: 'Nēķena muiža', en: 'Nēķene manor', preset: 'muiza' },
     { lv: 'Dzirnavu dambis', en: 'The mill weir', at: [LOC.DAM.x, LOC.DAM.z, 28] },
     { lv: 'Brežģa krogs', en: 'Brežģa tavern', at: [LOC.KROGS.x, LOC.KROGS.z, 60] }],
    [{ lv: 'Sēta', en: 'The farmstead', preset: 'pagalms' },
     { lv: 'Dzirnavu dīķis', en: 'The mill pond', at: [LOC.DAM.x - 60, LOC.DAM.z + 40, 90] },
     { lv: 'Jāņu uguns uz Brežģa kalna', en: 'The Jāņi fire on Brežģa kalns', preset: 'brezga', t: 0.9 }],
    [{ lv: 'Brežģa skatu tornis', en: 'The Brežģa tower', preset: 'brezga' },
     { lv: 'Konik zirgi', en: 'The Konik horses', at: [101, -374, 30] },
     { lv: 'Taurenes ezers', en: 'Lake Taurene', preset: 'ezers' }],
  ];
  function goMoment(m) {
    if (m.preset) flyTo(m.preset); else flyToPoint(m.at[0], m.at[1], m.at[2]);
    if (m.t !== undefined) setTime(null, m.t);
  }
  function jumpTo(pos, tgt) {
    if (rig.mode !== 'fly') rig.setMode('fly');
    camTween = null;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(tgt[0], tgt[1], tgt[2]);
    rig.adoptCamera();
    simControls.target.set(tgt[0], tgt[1], tgt[2]);
  }

  // the parish map: same landmarks in every era, M to open
  minimap = buildMinimap({
    camera, rig,
    getEra: () => currentEra,
    getLang: () => lang,
    flyToPoint,
    flyToView: flyTo,
  });

  // ------- HUD wiring -------
  // harness compatibility stub (shot2/dbg read a controls.target)
  const simControls = { target: new THREE.Vector3(S.x, steadY + 4, S.z), autoRotate: false, enabled: false };
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
  // arrows belong to walking now — time travel lives on 1-6 and [ ] , .
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target?.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)
      || document.querySelector('#about.open, #mapwrap.open')) return;
    if (e.key >= '1' && e.key <= '6') switchEra(+e.key - 1);
    if (e.key === ']' || e.key === '.') switchEra(Math.min(ERAS.length - 1, currentEra + 1));
    if (e.key === '[' || e.key === ',') switchEra(Math.max(0, currentEra - 1));
  });
  // ------- language toggle -------
  let soundOn = false;
  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    try { localStorage.setItem('brezgi-lang', l); } catch { /* optional preference */ }
    const L = I18N[l];
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (L[key]) el.textContent = L[key];
    });
    renderSound();
    $('lang-btn').textContent = l === 'lv' ? 'EN' : 'LV';
    $('lang-btn').title = L.lang;
    $('menu-btn').setAttribute('aria-label', L.menu);
    $('dial-btn').title = L.timeOfDay;
    renderKeys();
    renderMode();
    renderEraText(currentEra);
    renderIntro();
    if (minimap) minimap.onLang();
  }
  window.__applyLang = setLang;
  $('lang-btn').addEventListener('click', () => setLang(lang === 'lv' ? 'en' : 'lv'));
  const renderSound = () => {
    const b = $('sound-btn'), lab = I18N[lang][soundOn ? 'soundOn' : 'soundOff'];
    b.innerHTML = ICONS[soundOn ? 'soundOn' : 'soundOff'] + `<span class="lab">${lab}</span>`;
    b.title = lab; b.setAttribute('aria-label', lab);
    b.classList.toggle('on', soundOn);
  };
  $('sound-btn').addEventListener('click', () => {
    soundOn = ambience.toggle();
    renderSound();
    ambience.setScene(currentEra, sky.state.sunLow, current?.fires.length > 0);
  });
  // phone: the controls fold into one menu button
  $('menu-btn').addEventListener('click', () => {
    const open = $('ctl-bar').classList.toggle('open');
    $('menu-btn').setAttribute('aria-expanded', String(open));
  });
  // the sun dial: the clock, and the time-of-day choices one tap away
  const timePop = $('time-pop');
  $('dial-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    timePop.hidden = !timePop.hidden;
    $('dial-btn').setAttribute('aria-expanded', String(!timePop.hidden));
  });
  addEventListener('click', (e) => { if (!timePop.hidden && !e.target.closest('#dial')) timePop.hidden = true; });
  addEventListener('keydown', (e) => { if (e.code === 'Escape') { timePop.hidden = true; $('ctl-bar').classList.remove('open'); } });
  const closeAbout = () => { $('about').classList.remove('open'); $('about-btn').focus(); };
  $('about-btn').addEventListener('click', () => {
    rig.keys.clear(); rig.vel.set(0, 0, 0); rig.sprint = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $('about').classList.add('open'); $('about-close').focus();
  });
  $('about-close').addEventListener('click', closeAbout);
  $('about-btn-m').addEventListener('click', () => { $('ctl-bar').classList.remove('open'); $('about-btn').click(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && $('about').classList.contains('open')) closeAbout();
  });
  $('panel-toggle').addEventListener('click', () => showPanel($('panel').classList.contains('closed')));
  $('panel-close').addEventListener('click', () => showPanel(false));
  const timeBtns = document.querySelectorAll('[data-time]');
  const TIMES = { noon: 0.42, evening: 0.88, dawn: 0.03 };
  function setTime(key, t) {
    if (key === 'flow') sky.state.paused = false;
    else { sky.state.paused = true; sky.state.t = t ?? TIMES[key]; }
    if (t !== undefined && key === 'flow') sky.state.t = t;
    timeBtns.forEach((x) => x.classList.toggle('active', x.dataset.time === (key || '')));
  }
  timeBtns.forEach((b) => b.addEventListener('click', () => { setTime(b.dataset.time); timePop.hidden = true; }));

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // (the old hard-triangle "high birds" circling on rails are gone — the
  // animal system's buzzards with their wing-flap rig own the sky now)

  // ------- start -------
  await progress('Herding the aurochs…');
  setLang(lang);
  activateEra(2);                       // begin in the Latgalian age
  if (matchMedia('(max-width: 760px)').matches) $('panel').classList.add('closed');
  console.log(`[boot] total ${((performance.now() - bootT0) / 1000).toFixed(2)}s`);
  let introOpen = true;
  const enterWorld = () => {
    if (!introOpen) return;
    introOpen = false;
    $('loader').classList.add('done');
    setTimeout(() => $('loader')?.remove(), 900);
    canvas.focus?.();
  };
  if (navigator.webdriver) enterWorld();
  else {
    $('loader-status').textContent = '';
    document.querySelector('#loader .band').style.display = 'none';
    const btn = $('intro-enter');
    btn.hidden = false;
    btn.addEventListener('click', enterWorld);
    btn.focus({ preventScroll: true });
    addEventListener('keydown', (e) => { if (introOpen && (e.code === 'Enter' || e.code === 'Escape')) enterWorld(); });
  }

  const clock = new THREE.Clock();
  const wind = new THREE.Vector2(0.6, 0.25);
  let clockText = '', clockTextEl = null;

  // FPS governor: shed pixel ratio, shadow rate/size, then grass density —
  // never the trees. Kicks in early (below ~34fps) so it never feels laggy
  // for long.
  const HEADROOM_SHADOW_MAP = renderer.capabilities.maxTextureSize >= 5120 ? 5120 : 4096;
  const gov = {
    acc: 0, frames: 0, level: 1, shadowEvery: 2, shadowTick: 0,
    fps: 0, highSamples: 0, upgradeCooldown: 0,
  };
  const GOV_STEPS = [
    // A high-FPS-only rung: 5120 is 1.56x the texel memory of the 4096
    // default, and is never selected when the GPU's texture limit is lower.
    // refl: the water mirror's resolution as a fraction of the frame
    { pr: Math.min(devicePixelRatio, 1.75), grass: 1, shadowEvery: 2, shadowMap: HEADROOM_SHADOW_MAP, refl: 0.5 },
    { pr: Math.min(devicePixelRatio, 1.75), grass: 1, shadowEvery: 2, shadowMap: 4096, refl: 0.5 },
    { pr: Math.min(devicePixelRatio, 1.5), grass: 0.85, shadowEvery: 3, shadowMap: 4096, refl: 0.4 },
    { pr: Math.min(devicePixelRatio, 1.25), grass: 0.65, shadowEvery: 4, shadowMap: 2048, refl: 0.33 },
    { pr: Math.min(devicePixelRatio, 1), grass: 0.45, shadowEvery: 5, shadowMap: 2048, refl: 0.25 },
  ];
  function applyGov(s) {
    renderer.setPixelRatio(s.pr);
    composer.setPixelRatio(s.pr);
    composer.setSize(innerWidth, innerHeight);
    grass.setBudget(s.grass);
    water.setReflectionScale(s.refl);
    gov.shadowEvery = s.shadowEvery;
    if (sky.sun.shadow.mapSize.x !== s.shadowMap) {
      sky.sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
      if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
      // Rebuild the resized map on this cadence-controlled frame.
      gov.shadowTick = 1e9;
    }
  }
  function govern(dt) {
    gov.acc += dt; gov.frames++;
    if (gov.acc < 3) return;
    const fps = gov.frames / gov.acc;
    gov.fps = fps;
    gov.upgradeCooldown = Math.max(0, gov.upgradeCooldown - gov.acc);
    gov.acc = 0; gov.frames = 0;
    if (fps < 34 && gov.level < GOV_STEPS.length - 1) {
      gov.level++;
      gov.highSamples = 0;
      gov.upgradeCooldown = 30;
      applyGov(GOV_STEPS[gov.level]);
    } else if (fps >= 55 && gov.level > 0 && gov.upgradeCooldown === 0) {
      // Four comfortable samples (12s) plus a 30s post-change cooldown keep
      // the optional map-size rung from oscillating around a single sample.
      if (++gov.highSamples >= 4) {
        gov.level--;
        gov.highSamples = 0;
        gov.upgradeCooldown = 30;
        applyGov(GOV_STEPS[gov.level]);
      }
    } else {
      gov.highSamples = 0;
    }
  }
  window.__gov = gov;
  window.__renderer = renderer;
  window.__shadow = sky.shadowInfo;

  // three's WebGLAnimation requests the NEXT frame after this callback
  // returns, so a single uncaught throw in here stops the world for good —
  // the canvas holds its last frame while the HUD carries on answering keys.
  // One bad tick must never cost the whole session: log the first failure,
  // keep the picture moving.
  const frameErrors = [];
  window.__frameErrors = frameErrors;
  renderer.setAnimationLoop(() => {
    try {
      frame();
    } catch (err) {
      if (!frameErrors.length) console.error('[frame]', err);
      if (frameErrors.length < 20) frameErrors.push(String(err && err.message ? err.message : err));
      try { composer.render(); } catch { /* the renderer itself is gone */ }
    }
  });

  function frame() {
    renderer.info.reset();
    const elapsed = clock.getDelta();
    const dt = Math.min(elapsed, 0.05);
    const t = clock.elapsedTime;
    if (!document.hidden && elapsed < 10) govern(elapsed);
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
        steadY + cinema.h,
        S.z + Math.sin(cinema.angle) * cinema.r);
      camera.lookAt(S.x, steadY + 4, S.z);
    } else if (!document.querySelector('#about.open, #mapwrap.open')) {
      rig.update(dt);
    } else {
      rig.keys.clear(); rig.vel.set(0, 0, 0); rig.sprint = false;
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
    const terrainY = meshHeightAt(focus.x, focus.z);
    // Clamp bad/underwater terrain samples and teleports before they reach
    // the altitude curves; a failed sample conservatively keeps ground LOD.
    const agl = Number.isFinite(focus.y) && Number.isFinite(terrainY)
      ? Math.min(2000, Math.max(0, focus.y - terrainY)) : 0;
    // shadow cadence: the pass costs as much as the main render — 20Hz is
    // visually identical for a slow-moving sun. The shadow rig only MOVES on
    // refresh frames (sky.update) so matrix and map always agree.
    const shadowNow = ++gov.shadowTick >= gov.shadowEvery;
    if (shadowNow) {
      gov.shadowTick = 0;
      renderer.shadowMap.needsUpdate = true;
    }
    sky.update(dt, focus, shadowNow, agl);
    veg.tick(sky.state.sunColor, sky.state.ambient);
    veg.promoteTransitions(dt);
    veg.promote(camera.position.x, camera.position.z);
    water.tick(t, camera.position, dt);
    WIND.time.value = t;
    grass.update(focus, currentEra, camera.position);
    envAge += dt;
    // a time-of-day jump (the noon/evening/dawn buttons, a harness) must not
    // leave the water mirroring the old sky for up to 5 s: at night that
    // lit the gaps between waterside leaves up like lamps
    if (envAge > 5 || Math.abs(sky.state.t - envT) > 0.004) {
      envAge = 0;
      envT = sky.state.t;
      cubeCam.position.copy(focus);
      // Capture the sky without consuming a pending main-view shadow update.
      const shadowEnabled = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false;
      try { cubeCam.update(renderer, scene); }
      finally { renderer.shadowMap.enabled = shadowEnabled; }
    }
    animals.tick(t, dt, camera.position);
    minimap.tick(dt);
    effects.tick(t, dt, wind, sky.state.sunLow, sky.state.dark || 0, camera.position);
    for (const fn of eraTicks) fn(t, dt);
    const clockEl = $('day-clock');
    if (clockEl) {
      const h = Math.floor(sky.state.hour), m = Math.floor((sky.state.hour % 1) * 60);
      const text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (text !== clockText || clockEl !== clockTextEl) { clockEl.textContent = text; clockText = text; clockTextEl = clockEl; }
    }
    // the water's planar mirror (grass is sub-pixel in a half-res reflection)
    water.updateReflection(renderer, scene, camera, reflHide, dt);
    composer.render();
  }
}

boot().catch((err) => {
  const el = $('loader-status');
  if (el) el.textContent = 'Something broke while building the world. ' + err.message;
  console.error(err);
});
