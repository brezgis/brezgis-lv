// Water comparison shots: node data/watershots.mjs <outdir> [tag] [artifactPath] [only=name,name]
// Same camera set every run so before/after water work can be compared 1:1.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
const [,, OUT = 'watershots', tag = 'x', art = new URL('../artifact/brezgi-taurene.html', import.meta.url).pathname, only = ''] = process.argv;
mkdirSync(OUT, { recursive: true });
const pick = only ? new Set(only.split(',')) : null;
// [name, era, time, cam [x,z,agl], target [x,z,dy]]
const VIEWS = [
  ['bend-eye', 4, 0.38, [-352, 62, 1.7], [-400, -10, -1]],
  ['bank-close', 4, 0.36, [-360, 40, 4], [-395, 5, -1.5]],
  ['bend-low', 1, 0.33, [-330, 110, 6], [-400, 0, -2]],
  ['river-aerial', 4, 0.4, [-200, 250, 180], [-390, -40, -20]],
  ['gauja-south', 5, 0.42, [560, -380, 2.2], [640, -510, -1]],
  ['taurenes-shore', 5, 0.4, [1440, -210, 2.5], [1800, -300, -3]],
  ['taurenes-aerial', 2, 0.36, [1300, 150, 220], [1780, -300, -30]],
  ['dzerbe-mouth', 4, 0.4, [1470, -500, 3], [1500, -560, -1]],
  ['brenkuzis', 3, 0.4, [-500, 2700, 4], [-700, 2950, -2]],
  ['brenkuzis-inlet', 4, 0.4, [-560, 3170, 30], [-640, 3240, -2]],
  ['pisla', 4, 0.38, [-1560, 3240, 3], [-1500, 3150, -1]],
  ['dabaru', 1, 0.35, [-640, 700, 5], [-760, 850, -2]],
  ['tundra-lake', 0, 0.4, [1440, -210, 3], [1800, -300, -3]],
  ['tundra-river', 0, 0.36, [-330, 110, 12], [-400, 0, -2]],
  ['era5-river', 5, 0.4, [-340, 90, 8], [-400, 0, -2]],
  ['dusk-lake', 3, 0.72, [-560, 3170, 6], [-700, 3000, -2]],
  ['bridge-manor', 4, 0.4, [25, -480, 4], [-20, -433, 0]],
  ['bridge-2025', 5, 0.45, [25, -480, 4], [-20, -433, 0]],
  ['pond', 3, 0.4, [-110, -250, 5], [-200, -230, -1]],
  ['taurenes-inlet', 4, 0.42, [1430, -400, 45], [1530, -480, -2]],
  ['pond-aerial', 4, 0.4, [-60, -250, 110], [-230, -120, -2]],
  ['mill', 3, 0.38, [-130, -370, 5], [-145, -330, 0]],
  ['mill-far', 4, 0.4, [-190, -390, 14], [-140, -325, -1]],
  ['manor-road', 3, 0.4, [-112, -318, 4], [-172, -345, 2]],
  ['fish-bank', 4, 0.4, [-374, 31, 2.2], [-392, 44, -1.2]],
  ['fish-reach', 2, 0.36, [-360, 20, 9], [-400, 60, -1]],
  ['fish-top', 4, 0.4, [-381, 38, 60], [-380, 36, -1]],
  ['field-1860', 3, 0.36, [-120, -5, 1.7], [-50, -60, -1]],
  ['field-1935', 4, 0.36, [-120, -5, 1.7], [-50, -60, -1]],
  ['field-1935b', 4, 0.4, [-150, 150, 2], [-90, 190, -1]],
  ['evening-lake', 3, 0.86, [-560, 3170, 4], [-700, 3000, -2]],
  ['night-river', 4, 0.02, [-360, 20, 6], [-400, 60, -1]],
  ['dawn-river', 2, 0.24, [-360, 20, 6], [-400, 60, -1]],
  ['lilies', 4, 0.4, [-560, 3175, 4], [-640, 3120, -1]],
  ['lilies-top', 3, 0.4, [-640, 3140, 30], [-640, 3100, -1]],
  ['lilies-close', 4, 0.4, [-628, 2872, 2.2], [-645, 2888, -0.5]],
  ['lilies-over', 4, 0.4, [-640, 2878, 12], [-643, 2886, -0.5]],
  ['pisla-top', 4, 0.4, [-1545, 3205, 45], [-1544, 3195, -2]],
];
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1400,850', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 850 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[boot]')) console.log('[console]', t.slice(0, 400)); });
  await page.goto('file://' + resolve(art), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    document.querySelectorAll('body > *:not(canvas)').forEach((el) => { el.style.display = 'none'; });
  });
  const g = (x, z) => page.evaluate(([px, pz]) => {
    const t = window.__scene.getObjectByName('terrain');
    const p = t.geometry.attributes.position;
    const n = Math.round(Math.sqrt(p.count));
    const x0 = p.getX(0), z0 = p.getZ(0);
    const sx = p.getX(1) - x0, sz = p.getZ(n) - z0;
    const fx = Math.max(0, Math.min(n - 1.001, (px - x0) / sx));
    const fz = Math.max(0, Math.min(n - 1.001, (pz - z0) / sz));
    const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r;
    const hA = p.getY(r * n + c), hB = p.getY(r * n + c + 1);
    const hC = p.getY((r + 1) * n + c), hD = p.getY((r + 1) * n + c + 1);
    return u + v <= 1 ? hA + (hB - hA) * u + (hC - hA) * v : hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
  }, [x, z]);
  let cur = -1;
  for (const [name, era, time, c, t] of VIEWS) {
    if (pick && !pick.has(name)) continue;
    if (era !== cur) { await page.evaluate((e) => window.__sim.era(e), era); cur = era; await new Promise((r) => setTimeout(r, 1500)); }
    const cy = Math.max(await g(c[0], c[1]), await page.evaluate(([x, z]) => (window.__water ? window.__water(x, z) : -1e9), [c[0], c[1]])) + c[2];
    const ty = (await g(t[0], t[1])) + t[2];
    await page.evaluate(([cc, tt, tm]) => {
      window.__sim.sky.state.paused = true; window.__sim.sky.state.t = tm;
      window.__sim.setCam(cc[0], cc[1], cc[2], tt[0], tt[1], tt[2]);
    }, [[c[0], cy, c[1]], [t[0], ty, t[1]], time]);
    if (process.env.HIDE) await page.evaluate((names) => {
      const set = new Set(names.split(','));
      window.__scene.traverse((o) => { if (set.has(o.name) || [...set].some((n) => n.endsWith('*') && o.name.startsWith(n.slice(0, -1)))) o.visible = false; });
    }, process.env.HIDE);
    if (process.env.EVAL) await page.evaluate(process.env.EVAL);
    await new Promise((r) => setTimeout(r, +(process.env.SETTLE || 9000)));
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
    console.log('shot', name);
  }
} finally {
  await browser.close();
}
