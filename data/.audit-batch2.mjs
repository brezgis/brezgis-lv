// Batch 2: instance-count dump + targeted close-ups of individual trees
import puppeteer from 'puppeteer-core';

const OUT = '/tmp/claude-1002/-home-anna-projects-village/8ce52bd6-2012-41d8-9a38-2c512e1e1885/scratchpad/audit/';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

const S = await page.evaluate(() => {
  const t = window.__sim.controls.target;
  return { x: t.x, z: t.z };
});

await page.evaluate(() => {
  for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.display = 'none';
  window.__veg = null;
  window.__scene.traverse((o) => { if (o.name === 'vegetation' && !window.__veg) window.__veg = o; });
  window.__ground = (x, z) => {
    const r = window.__rig;
    const prevMode = r.mode; const prevPos = r.basePos.clone();
    if (r.mode === 'cinema') r.mode = 'fly'; else r.setMode('fly');
    r.basePos.set(x, -10000, z);
    r.setMode('walk');
    const y = r.basePos.y - 1.7;
    r.mode = prevMode === 'cinema' ? 'cinema' : prevMode;
    r.basePos.copy(prevPos);
    return y;
  };
  window.__nearest = (childIdx, x, z, minD = 0) => {
    const m = window.__veg.children[childIdx];
    if (!m || !m.isInstancedMesh) return null;
    const arr = m.instanceMatrix.array;
    let best = null, bd = 1e12;
    for (let i = 0; i < m.count; i++) {
      const px = arr[i * 16 + 12], py = arr[i * 16 + 13], pz = arr[i * 16 + 14];
      const d = Math.hypot(px - x, pz - z);
      if (d < bd && d >= minD) { bd = d; best = [px, py, pz, d, i]; }
    }
    return best;
  };
});

await page.evaluate(() => window.__sim.era(1));
await page.evaluate(() => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.42; });
await new Promise((r) => setTimeout(r, 3000));

const dump = await page.evaluate(() => window.__veg.children.map((o, i) => ({
  i, mat: o.material ? o.material.type : '?', cap: o.instanceMatrix ? o.instanceMatrix.count : -1,
  n: o.count, at: o.material && o.material.alphaTest ? o.material.alphaTest : 0,
})));
console.log('ERA1 veg children:', JSON.stringify(dump));

async function shot(name, cx, cy, cz, tx, ty, tz) {
  await page.evaluate(({ cx, cy, cz, tx, ty, tz }) => {
    window.__sim.setCam(cx, cy, cz, tx, ty, tz);
    window.__rig.mode = 'cinema';
  }, { cx, cy, cz, tx, ty, tz });
  await new Promise((r) => setTimeout(r, 850));
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('saved', name);
}

// --- nearest full-tier spruce to the stead-forest and 3 angles around it
const sp = await page.evaluate(({ x, z }) => window.__nearest(8, x, z) || window.__nearest(10, x, z), { x: S.x + 205, z: S.z - 70 });
console.log('nearest full spruce:', JSON.stringify(sp));
if (sp) {
  const [px, py, pz] = sp;
  const g = await page.evaluate(({ px, pz }) => window.__ground(px, pz), { px, pz });
  for (const [name, ang] of [['spruceA_S', 0], ['spruceA_E', Math.PI / 2], ['spruceA_NW', Math.PI * 1.25]]) {
    await shot('e1_' + name, px + Math.sin(ang) * 9, g + 1.7, pz + Math.cos(ang) * 9, px, py + 5, pz);
  }
}
// --- nearest full-tier pine
const pn = await page.evaluate(({ x, z }) => window.__nearest(12, x, z) || window.__nearest(14, x, z), { x: S.x + 205, z: S.z - 70 });
console.log('nearest full pine:', JSON.stringify(pn));
if (pn) {
  const [px, py, pz] = pn;
  const g = await page.evaluate(({ px, pz }) => window.__ground(px, pz), { px, pz });
  for (const [name, ang] of [['pineA_S', 0], ['pineA_E', Math.PI / 2]]) {
    await shot('e1_' + name, px + Math.sin(ang) * 10, g + 1.7, pz + Math.cos(ang) * 10, px, py + 8, pz);
  }
}
// --- nearest far impostor (spruce child 0, pine child 1) to a walkable spot far from POIs
const impS = await page.evaluate(() => window.__nearest(0, 1728, 4600));
const impP = await page.evaluate(() => window.__nearest(1, 1728, 4600));
console.log('nearest far spruce impostor:', JSON.stringify(impS));
console.log('nearest far pine impostor:', JSON.stringify(impP));
for (const [tag, imp] of [['impSpruce', impS], ['impPine', impP]]) {
  if (!imp) continue;
  const [px, py, pz] = imp;
  const g = await page.evaluate(({ px, pz }) => window.__ground(px, pz), { px, pz });
  await shot('e1_' + tag + '_ground', px + 3, g + 1.7, pz + 12, px, py + 7, pz);
  await shot('e1_' + tag + '_diag', px + 9, g + 6, pz + 9, px, py + 9, pz);
  await shot('e1_' + tag + '_top', px + 2, py + 42, pz + 2, px, py + 10, pz);
}
// --- understory close-ups: nearest log (43..45) and a fern-dense floor
const lg = await page.evaluate(({ x, z }) => window.__nearest(43, x, z) || window.__nearest(44, x, z) || window.__nearest(45, x, z), { x: S.x + 205, z: S.z - 70 });
console.log('nearest log:', JSON.stringify(lg));
if (lg) {
  const [px, py, pz] = lg;
  const g = await page.evaluate(({ px, pz }) => window.__ground(px, pz), { px, pz });
  await shot('e1_log_close', px + 4, g + 1.5, pz + 4, px, py + 0.3, pz);
}
const fn = await page.evaluate(({ x, z }) => window.__nearest(42, x, z), { x: S.x + 205, z: S.z - 70 });
console.log('nearest fern:', JSON.stringify(fn));
if (fn) {
  const [px, py, pz] = fn;
  const g = await page.evaluate(({ px, pz }) => window.__ground(px, pz), { px, pz });
  await shot('e1_fern_close', px + 3, g + 1.4, pz + 3, px, py + 0.4, pz);
}

await browser.close();
console.log('done');
