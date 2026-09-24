// Audit shot set: one boot, many looks. HUD hidden, sun parked, generous
// settle time so the time-sliced grass rings finish filling before capture.
import puppeteer from 'puppeteer-core';

const tag = process.argv[2] || 'after';
const OUT = process.env.OUT_DIR || (await import('node:os')).tmpdir();

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1280,720', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message, (e.stack || '').split('\n')[1] || ''));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[CONSOLE]', m.text().slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    for (const id of ['panel', 'keys', 'hud', 'mini', 'topbar', 'era-bar']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    document.querySelectorAll('.panel, .era-bar, #mini, #keys, #eras, header, footer').forEach((el) => { el.style.display = 'none'; });
  });

  const shot = async (name, era, cam, tgt, time = 0.36, settle = 3500) => {
    await page.evaluate((e) => window.__sim.era(e), era);
    await page.evaluate(([c, t, tm]) => {
      window.__sim.sky.state.paused = true;
      window.__sim.sky.state.t = tm;
      window.__sim.setCam(c[0], c[1], c[2], t[0], t[1], t[2]);
    }, [cam, tgt, time]);
    await new Promise((r) => setTimeout(r, settle));
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
    console.log('shot', name);
  };

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

  // 1 · the barrow cemetery (era 2) — the fix under test
  const bx = -39.5, bz = 280, by = await g(bx, bz);
  await shot('barrows', 2, [bx + 17, by + 5.2, bz + 20], [bx, by + 0.6, bz], 0.22);
  // 2 · walk-height meadow: judge the grass honestly
  const my = await g(bx + 60, bz - 40);
  await shot('meadow', 2, [bx + 60, my + 1.7, bz - 40], [bx + 130, my + 2.2, bz - 10], 0.42);
  // 3 · the river at eye level from the bank
  await page.evaluate(() => window.__sim.jump('upe'));
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: `${OUT}/river-${tag}.png` });
  console.log('shot river');
  // 4 · the 1935 farmstead yard
  await page.evaluate((e) => window.__sim.era(e), 4);
  await page.evaluate(() => { window.__sim.sky.state.t = 0.34; window.__sim.jump('pagalms'); });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: `${OUT}/yard-${tag}.png` });
  console.log('shot yard');
  // 5 · era-5 road traffic, and whether it moves
  const before = await page.evaluate(() => {
    window.__sim.era(5);
    const out = [];
    window.__scene.traverse((o) => { if (o.name === 'mapped-road-car') out.push([o.position.x, o.position.z]); });
    return out;
  });
  await new Promise((r) => setTimeout(r, 2500));
  const after = await page.evaluate(() => {
    const out = [];
    window.__scene.traverse((o) => { if (o.name === 'mapped-road-car') out.push([o.position.x, o.position.z]); });
    return out;
  });
  console.log('car travel (m):', before.map((b, i) => (after[i] ? Math.hypot(after[i][0] - b[0], after[i][1] - b[1]).toFixed(1) : 'gone')).join(', '));
  if (after[0]) {
    const cy = await g(after[0][0], after[0][1]);
    await shot('traffic', 5, [after[0][0] + 11, cy + 3.2, after[0][1] + 11], [after[0][0], cy + 1.0, after[0][1]], 0.4, 1200);
  }
  // 6 · aerial over the parish (era 4)
  await page.evaluate((e) => window.__sim.era(e), 4);
  await page.evaluate(() => { window.__sim.sky.state.t = 0.3; window.__sim.jump('putns'); });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: `${OUT}/aerial-${tag}.png` });
  console.log('shot aerial');
} finally {
  await browser.close();
}
