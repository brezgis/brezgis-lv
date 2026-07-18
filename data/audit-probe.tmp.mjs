// Audit probe: flower determinism, hiOff aerial logic, instance-cap saturation.
import puppeteer from 'puppeteer-core';
const OUT = '/tmp/village-scratch/audit';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[boot]')) console.log('[console]', m.text().slice(0, 200)); });
await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// helpers injected in page
await page.evaluate(() => {
  window.__flowerSnap = () => {
    // flower meshes: scene-root InstancedMesh, capacity exactly 1400
    const out = [];
    window.__scene.children.forEach((o) => {
      if (o.isInstancedMesh && o.instanceMatrix.count === 1400) {
        const a = o.instanceMatrix.array;
        const pts = [];
        for (let i = 0; i < o.count; i++) pts.push([a[i * 16 + 12], a[i * 16 + 14]]);
        out.push(pts);
      }
    });
    return out;
  };
  window.__bandSnap = () => {
    const out = [];
    window.__scene.children.forEach((o) => {
      if (o.isInstancedMesh) out.push({ cap: o.instanceMatrix.count, count: o.count });
    });
    return out;
  };
  window.__vegSnap = () => {
    const out = [];
    window.__scene.traverse((o) => {
      if (o.name === 'vegetation') {
        o.children.forEach((c) => {
          if (c.isInstancedMesh) out.push({ cap: c.instanceMatrix.count, count: c.count });
        });
      }
    });
    return out;
  };
});

// ---------- 1. flower determinism (era 1, open terrace near stead) ----------
await page.evaluate(() => window.__sim.era(1));
await page.evaluate(() => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.4; });
await wait(1500);
const P = { x: -243, z: 80 };
const snapAt = async (x, z) => {
  await page.evaluate((x, z) => window.__sim.setCam(x, 210, z, x, 190, z + 10), x, z);
  await wait(700); // several frames -> grass.update regen
  return page.evaluate(() => window.__flowerSnap());
};
const A = await snapAt(P.x, P.z);
const B = await snapAt(P.x, P.z + 30);
const A2 = await snapAt(P.x, P.z);

function keySet(snap, cx, cz, r0, r1, cx2, cz2) {
  const s = new Set();
  for (const pts of snap) for (const [x, z] of pts) {
    const dA = Math.hypot(x - cx, z - cz);
    const dB = Math.hypot(x - cx2, z - cz2);
    if (dA >= r0 && dA <= r1 && dB >= r0 && dB <= r1) s.add(x.toFixed(2) + ',' + z.toFixed(2));
  }
  return s;
}
// overlap zone: well inside [3,125] of BOTH focus A and focus B
const sA = keySet(A, P.x, P.z, 3.5, 88, P.x, P.z + 30);
const sB = keySet(B, P.x, P.z, 3.5, 88, P.x, P.z + 30);
const sA2full = new Set();
for (const pts of A2) for (const [x, z] of pts) sA2full.add(x.toFixed(2) + ',' + z.toFixed(2));
const sAfull = new Set();
for (const pts of A) for (const [x, z] of pts) sAfull.add(x.toFixed(2) + ',' + z.toFixed(2));
const onlyA = [...sA].filter((k) => !sB.has(k));
const onlyB = [...sB].filter((k) => !sA.has(k));
const aVsA2 = [...sAfull].filter((k) => !sA2full.has(k));
console.log('FLOWERS overlap-zone counts A/B:', sA.size, sB.size);
console.log('FLOWERS in A not in B:', onlyA.length, onlyA.slice(0, 12));
console.log('FLOWERS in B not in A:', onlyB.length, onlyB.slice(0, 12));
console.log('FLOWERS A vs A2 (same focus) mismatches:', aVsA2.length);

// which of the mismatches are within 9m of A focus (the d<3 hole shift)?
const nearA = onlyA.concat(onlyB).filter((k) => {
  const [x, z] = k.split(',').map(Number);
  return Math.hypot(x - P.x, z - P.z) < 12;
});
console.log('FLOWER mismatches within 12m of focus A:', nearA.length, nearA.slice(0, 8));

// ---------- 2. hiOff aerial logic (era 4, camera ~800m up) ----------
await page.evaluate(() => window.__sim.era(4));
await wait(1200);
await page.evaluate(() => window.__sim.setCam(117, 990, 740, 117, 189, 340));
await wait(900);
const bandsHigh = await page.evaluate(() => window.__bandSnap());
console.log('BANDS at 800m altitude:', JSON.stringify(bandsHigh));
await page.screenshot({ path: OUT + '/aerial-era4.png' });

// ---------- 3. cap saturation per era ----------
for (const e of [1, 2, 3, 4]) {
  await page.evaluate((e) => window.__sim.era(e), e);
  await wait(1500);
  const veg = await page.evaluate(() => window.__vegSnap());
  const sat = veg.filter((v) => v.count >= v.cap && v.cap > 0);
  console.log(`VEG era ${e}: meshes=${veg.length} saturated=${JSON.stringify(sat)}`);
  console.log(`VEG era ${e} all:`, JSON.stringify(veg.filter((v) => v.count > 0)));
}

// ---------- 4. manor view era 4 (orphan orchards) ----------
await page.evaluate(() => window.__sim.era(4));
await wait(1000);
await page.evaluate(() => window.__sim.setCam(-40 + 55, 220, -180 + 110, -40, 195, -180));
await wait(900);
await page.screenshot({ path: OUT + '/manor-era4.png' });

await browser.close();
console.log('done');
