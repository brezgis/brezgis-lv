// The parish map — "Novada karte". One map, six ages: the SAME landmarks
// are pinned in every era (filled diamond = standing, hollow = the site
// before/after its time), so travelling the timeline reads as the same
// country changing. The base is baked from the sim's own truth per era:
// real DEM hypsometry, the era's forestDensity pattern, its road network,
// its fields, the real water — and for 2025, the actual Sentinel-2 image.
// M toggles the big map; the corner widget shows the whole world at a
// glance with the player's arrow. Clicking the big map flies you there.
import { HM_SPAN, HM_OFF_X, HM_OFF_Z } from './heightmap.js';
import { heightAt } from './terrain.js';
import { LOC, roadsForEra, fieldsForEra, forestDensity } from './landuse.js';
import { LAKE_SHORES, RIVER, STREAM_CHANNELS } from './riverzone.js';
import { ROADS_OSM } from './geodata-osm.js';
import { SAT_JPEG_B64 } from './sat2025.js';
import { clamp, lerp } from './util.js';

const W = 768;                                   // baked map resolution
const X0 = HM_OFF_X - HM_SPAN / 2, Z0 = HM_OFF_Z - HM_SPAN / 2;
const toPx = (x) => ((x - X0) / HM_SPAN) * W;
const toPy = (z) => ((z - Z0) / HM_SPAN) * W;    // north = low z = top

// --- the landmarks: constant positions, era-gated presence -----------------
// present[era] truthy = filled diamond; falsy = hollow "site" diamond.
const LANDMARKS = [
  { key: 'stead', x: () => LOC.STEAD.x, z: () => LOC.STEAD.z, lv: 'Brezgi', en: 'Brezgi farm', present: [0, 0, 1, 1, 1, 1], view: 'seta', dy: 0 },
  { key: 'manor', x: () => LOC.MANOR.x, z: () => LOC.MANOR.z, lv: 'Nēķena muiža', en: 'Nēķens manor', present: [0, 0, 0, 1, 1, 1], view: 'muiza', dy: -14 },
  { key: 'brezga', x: () => LOC.BREZGA.x, z: () => LOC.BREZGA.z, lv: 'Brežģa kalns', en: 'Brežģis hill', present: [1, 1, 1, 1, 1, 1], view: 'brezga', dy: 0 },
  { key: 'krogs', x: () => LOC.KROGS.x, z: () => LOC.KROGS.z, lv: 'Brežģa krogs', en: 'Brežģis inn', present: [0, 0, 0, 1, 1, 0], dy: 14 },
  { key: 'fort', x: () => LOC.HILLFORT.x, z: () => LOC.HILLFORT.z, lv: 'Pilskalns', en: 'Hillfort', present: [0, 0, 1, 0, 0, 0], dy: 0 },
  { key: 'lake', x: () => LOC.LAKE_VIEW.x + 200, z: () => LOC.LAKE_VIEW.z, lv: 'Taurenes ezers', en: 'Lake Taurene', present: [1, 1, 1, 1, 1, 1], view: 'ezers', dy: 0 },
  { key: 'oak', x: () => LOC.OAK.x, z: () => LOC.OAK.z, lv: 'Vecais ozols', en: 'The old oak', present: [0, 0, 1, 1, 1, 0], dy: -15 },
  { key: 'barrows', x: () => LOC.BARROWS.x, z: () => LOC.BARROWS.z, lv: 'Kapu uzkalniņi', en: 'Barrow graves', present: [0, 0, 1, 1, 1, 1], dy: 15 },
  { key: 'church', x: () => LOC.CHURCH.x, z: () => LOC.CHURCH.z, lv: 'Dzērbenes baznīca', en: 'Dzērbene church', present: [0, 0, 0, 1, 1, 1], dy: 0 },
];
const ERA_YEARS = ['10 800 pr.Kr.', '~50', '~950', '1860', '1935', '2025'];

// --- per-era base bake ------------------------------------------------------
const bakes = new Map();
let satImg = null, satLoading = false;

function bakeBase(era) {
  if (bakes.has(era)) return bakes.get(era);
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const ctx = c.getContext('2d');

  if (era === 5 && satImg) {
    ctx.drawImage(satImg, 0, 0, W, W);
    // gentle wash so overlay ink stays readable on the imagery
    ctx.fillStyle = 'rgba(18,15,10,0.16)';
    ctx.fillRect(0, 0, W, W);
  } else {
    // hypsometric tint + the era's forest pattern, in ONE ImageData pass —
    // per-cell fillRect stippling anti-aliased into a dot lattice; blending
    // in pixel space gives solid woods with soft clearings. The forest is
    // what visibly CHANGES between the ages.
    const G = 192;
    const img = ctx.createImageData(G, G);
    const ramp = era === 0
      ? [[0.30, [122, 114, 96]], [0.62, [156, 148, 124]], [1, [206, 199, 180]]]
      : [[0.28, [104, 124, 74]], [0.62, [138, 148, 94]], [1, [188, 182, 150]]];
    const forestC = era === 0 ? [98, 96, 76] : [42, 64, 34];
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const x = X0 + ((gx + 0.5) / G) * HM_SPAN, z = Z0 + ((gy + 0.5) / G) * HM_SPAN;
      const h = heightAt(x, z);
      const t = clamp((h - 172) / (260 - 172), 0, 1);
      let col = ramp[ramp.length - 1][1];
      for (let i = 0; i < ramp.length; i++) {
        if (t <= ramp[i][0]) {
          const lo = i === 0 ? [0, ramp[0][1]] : ramp[i - 1];
          const u = (t - lo[0]) / Math.max(1e-6, ramp[i][0] - lo[0]);
          col = lo[1].map((v, k) => lerp(v, ramp[i][1][k], u));
          break;
        }
      }
      const fd = forestDensity(era, x, z, h);
      const fk = clamp((fd - 0.32) / 0.4, 0, 1) * 0.85;
      const p = (gy * G + gx) * 4;
      img.data[p] = lerp(col[0], forestC[0], fk);
      img.data[p + 1] = lerp(col[1], forestC[1], fk);
      img.data[p + 2] = lerp(col[2], forestC[2], fk);
      img.data[p + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = G;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, W, W);

    // fields in pale gold
    if (era >= 2) {
      ctx.fillStyle = 'rgba(196,176,110,0.55)';
      for (const f of fieldsForEra(era)) {
        ctx.save();
        ctx.translate(toPx(f.cx), toPy(f.cz));
        ctx.rotate(f.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, (f.rx / HM_SPAN) * W, (f.rz / HM_SPAN) * W, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // water — always on top of the base (the constant the eyes anchor to)
  const WATER = era === 0 ? 'rgba(150,178,182,0.95)' : 'rgba(66,96,110,0.95)';
  ctx.fillStyle = WATER;
  for (const lake of LAKE_SHORES) {
    ctx.beginPath();
    lake.poly.forEach(([x, z], i) => (i ? ctx.lineTo(toPx(x), toPy(z)) : ctx.moveTo(toPx(x), toPy(z))));
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = WATER;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.6, (22 / HM_SPAN) * W);
  ctx.beginPath();
  RIVER.samples.forEach((p, i) => (i ? ctx.lineTo(toPx(p[0]), toPy(p[1])) : ctx.moveTo(toPx(p[0]), toPy(p[1]))));
  ctx.stroke();
  ctx.lineWidth = 1.1;
  for (const s of STREAM_CHANNELS) {
    ctx.beginPath();
    s.samples.forEach((p, i) => (i ? ctx.lineTo(toPx(p[0]), toPy(p[1])) : ctx.moveTo(toPx(p[0]), toPy(p[1]))));
    ctx.stroke();
  }

  // roads for THIS era (hand-laid diorama roads + the OSM network)
  if (era >= 2) {
    const draw = (pts, wpx, style) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = wpx;
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(toPx(x), toPy(z)) : ctx.moveTo(toPx(x), toPy(z))));
      ctx.stroke();
    };
    for (const r of roadsForEra(era)) draw(r.pts, 1.4, 'rgba(150,124,84,0.9)');
    if (era >= 3) {
      for (const r of ROADS_OSM) {
        if (era === 3 && r.c === 2) continue;
        const main = r.c <= 1;
        draw(r.pts, main ? 1.8 : 0.9, main
          ? (era === 5 ? 'rgba(70,66,62,0.95)' : 'rgba(150,124,84,0.95)')
          : 'rgba(150,124,84,0.55)');
      }
    }
  }
  bakes.set(era, c);
  return c;
}

// invalidate era-5 once the satellite arrives
function ensureSat(onReady) {
  if (satImg || satLoading) return;
  satLoading = true;
  const img = new Image();
  img.onload = () => { satImg = img; bakes.delete(5); onReady(); };
  img.src = 'data:image/jpeg;base64,' + SAT_JPEG_B64;
}

// --- widget + overlay -------------------------------------------------------
// host DOM is created here so page.html stays declarative-minimal
export function buildMinimap({ camera, rig, getEra, getLang, flyToPoint, flyToView }) {
  const mini = document.getElementById('mini');
  const miniCv = document.getElementById('mini-canvas');
  const wrap = document.getElementById('mapwrap');
  const bigCv = document.getElementById('map-canvas');
  const title = document.getElementById('map-title');
  const sub = document.getElementById('map-sub');
  const mctx = miniCv.getContext('2d');
  const bctx = bigCv.getContext('2d');
  let open = false;
  let hoverLm = null;

  const L = () => (getLang() === 'lv'
    ? { title: 'Novada karte', sub: 'tie paši orientieri cauri laikiem — klikšķini, lai lidotu', site: 'vieta', you: 'tu' }
    : { title: 'Parish map', sub: 'the same landmarks through the ages — click to fly', site: 'site', you: 'you' });

  function diamond(ctx2, px, py, r, filled, hot) {
    ctx2.save();
    ctx2.translate(px, py);
    ctx2.rotate(Math.PI / 4);
    ctx2.lineWidth = hot ? 2.4 : 1.4;
    ctx2.strokeStyle = hot ? '#e8b95a' : '#c9963f';
    if (filled) { ctx2.fillStyle = hot ? '#e8b95a' : '#c9963f'; ctx2.fillRect(-r, -r, 2 * r, 2 * r); }
    ctx2.strokeRect(-r, -r, 2 * r, 2 * r);
    ctx2.restore();
  }
  function playerArrow(ctx2, px, py, yaw, s) {
    ctx2.save();
    ctx2.translate(px, py);
    // rig yaw 0 faces -z (map up); canvas rotation is clockwise-positive
    ctx2.rotate(-yaw);
    ctx2.fillStyle = '#eadfbe';
    ctx2.strokeStyle = 'rgba(18,15,10,0.85)';
    ctx2.lineWidth = s * 0.28;
    ctx2.beginPath();
    ctx2.moveTo(0, -s);
    ctx2.lineTo(s * 0.72, s);
    ctx2.lineTo(0, s * 0.45);
    ctx2.lineTo(-s * 0.72, s);
    ctx2.closePath();
    ctx2.stroke();
    ctx2.fill();
    ctx2.restore();
  }

  function drawBig() {
    const era = getEra();
    const base = bakeBase(era);
    const S2 = bigCv.width;
    bctx.clearRect(0, 0, S2, S2);
    bctx.drawImage(base, 0, 0, S2, S2);
    const k = S2 / W;
    // landmarks + labels
    bctx.font = '600 12px -apple-system, "Segoe UI", system-ui, sans-serif';
    bctx.textBaseline = 'middle';
    for (const lm of LANDMARKS) {
      const px = toPx(lm.x()) * k, py = toPy(lm.z()) * k;
      const filled = !!lm.present[era];
      diamond(bctx, px, py, hoverLm === lm ? 6 : 4.6, filled, hoverLm === lm);
      const name = getLang() === 'lv' ? lm.lv : lm.en;
      const label = filled ? name : `(${name})`;
      bctx.fillStyle = 'rgba(18,15,10,0.72)';
      const tw = bctx.measureText(label).width;
      // label side flips near the right edge; dy staggers the tight cluster
      // around the farmstead so names never sit on each other
      const ly = py + (lm.dy || 0) * (S2 / 820);
      const lx = px + 9 + tw > S2 - 6 ? px - 9 - tw : px + 9;
      bctx.fillRect(lx - 3, ly - 8, tw + 6, 16);
      bctx.fillStyle = filled ? '#e8e2d2' : 'rgba(232,226,210,0.6)';
      bctx.fillText(label, lx, ly + 0.5);
    }
    // player
    playerArrow(bctx, toPx(camera.position.x) * k, toPy(camera.position.z) * k, rig.yaw, 8);
    // north + scale bar
    bctx.fillStyle = 'rgba(232,226,210,0.8)';
    bctx.font = '700 13px serif';
    bctx.fillText('Z', 12, 18);                    // ziemeļi — Latvian north
    const km = (1000 / HM_SPAN) * S2;
    bctx.strokeStyle = 'rgba(232,226,210,0.8)';
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.moveTo(14, S2 - 16); bctx.lineTo(14 + km, S2 - 16);
    bctx.stroke();
    bctx.font = '10px sans-serif';
    bctx.fillText('1 km', 16, S2 - 26);
  }

  function drawMini() {
    const era = getEra();
    const base = bakeBase(era);
    const S2 = miniCv.width;
    mctx.clearRect(0, 0, S2, S2);
    mctx.drawImage(base, 0, 0, S2, S2);
    const k = S2 / W;
    for (const lm of LANDMARKS) {
      if (!lm.present[era]) continue;
      diamond(mctx, toPx(lm.x()) * k, toPy(lm.z()) * k, 2.1, true, false);
    }
    playerArrow(mctx, toPx(camera.position.x) * k, toPy(camera.position.z) * k, rig.yaw, 4.5);
  }

  function setOpen(v) {
    open = v;
    wrap.classList.toggle('open', open);
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      const side = Math.min(innerWidth, innerHeight) * 0.78;
      bigCv.width = bigCv.height = Math.round(Math.min(820, side) * Math.min(devicePixelRatio, 2));
      bigCv.style.width = bigCv.style.height = Math.round(Math.min(820, side)) + 'px';
      title.textContent = `${L().title} · ${ERA_YEARS[getEra()]}`;
      sub.textContent = L().sub;
      drawBig();
    }
  }

  // input
  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyM') setOpen(!open);
    if (e.code === 'Escape' && open) setOpen(false);
  });
  mini.addEventListener('click', () => setOpen(true));
  document.getElementById('map-close').addEventListener('click', () => setOpen(false));
  wrap.addEventListener('click', (e) => { if (e.target === wrap) setOpen(false); });

  const pick = (e) => {
    const r = bigCv.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * W;
    let best = null, bd = 18 * 18;              // px picking radius on the bake
    for (const lm of LANDMARKS) {
      const dx = toPx(lm.x()) - mx, dz = toPy(lm.z()) - my;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = lm; }
    }
    return { lm: best, x: X0 + (mx / W) * HM_SPAN, z: Z0 + (my / W) * HM_SPAN };
  };
  bigCv.addEventListener('mousemove', (e) => {
    const p = pick(e);
    if (p.lm !== hoverLm) { hoverLm = p.lm; drawBig(); }
    bigCv.style.cursor = p.lm ? 'pointer' : 'crosshair';
  });
  bigCv.addEventListener('click', (e) => {
    const p = pick(e);
    setOpen(false);
    if (p.lm && p.lm.view) flyToView(p.lm.view);
    else if (p.lm) flyToPoint(p.lm.x(), p.lm.z(), 140);
    else flyToPoint(p.x, p.z, 320);
  });

  ensureSat(() => { if (open && getEra() === 5) drawBig(); drawMini(); });

  let acc = 0, lastEra = -1;
  return {
    tick(dt) {
      acc += dt;
      if (open) { drawBig(); return; }         // live arrow while reading
      if (acc > 0.25 || lastEra !== getEra()) { // widget refresh is cheap+lazy
        acc = 0; lastEra = getEra();
        drawMini();
      }
    },
    onEra() { if (open) { title.textContent = `${L().title} · ${ERA_YEARS[getEra()]}`; drawBig(); } },
    onLang() { if (open) { title.textContent = `${L().title} · ${ERA_YEARS[getEra()]}`; sub.textContent = L().sub; drawBig(); } },
    isOpen: () => open,
  };
}
