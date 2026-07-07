// Audit probe 2: far-impostor truncation cutoff + top-down era 1/2 shots.
import puppeteer from 'puppeteer-core';
const OUT = '/tmp/claude-1002/-home-anna-projects-village/8ce52bd6-2012-41d8-9a38-2c512e1e1885/scratchpad/audit';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const era of [1, 2]) {
  await page.evaluate((e) => window.__sim.era(e), era);
  await wait(1500);
  const info = await page.evaluate(() => {
    const out = [];
    window.__scene.traverse((o) => {
      if (o.name === 'vegetation') {
        o.children.forEach((c) => {
          if (c.isInstancedMesh && c.instanceMatrix.count >= 40000) {
            const a = c.instanceMatrix.array;
            const n = c.count;
            // min/max z among ALL instances + z of the last-filled instance
            let zmin = 1e9, zmax = -1e9;
            for (let i = 0; i < n; i++) {
              const z = a[i * 16 + 14];
              if (z < zmin) zmin = z;
              if (z > zmax) zmax = z;
            }
            out.push({
              cap: c.instanceMatrix.count, count: n,
              lastZ: n ? Math.round(a[(n - 1) * 16 + 14]) : null,
              zmin: Math.round(zmin), zmax: Math.round(zmax),
            });
          }
        });
      }
    });
    return out;
  });
  console.log(`ERA ${era} far meshes:`, JSON.stringify(info));
}

// top-down shots, era 1, fog off
await page.evaluate(() => window.__sim.era(1));
await page.evaluate(() => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.42; });
await page.evaluate(() => { window.__scene.fog.near = 88888; window.__scene.fog.far = 99999; });
await wait(1200);
await page.evaluate(() => window.__sim.setCam(500, 5200, 1700, 500, 190, 1950));
await wait(900);
await page.screenshot({ path: OUT + '/topdown-era1.png' });
await page.evaluate(() => window.__sim.era(4));
await wait(1500);
await page.evaluate(() => { window.__scene.fog.near = 88888; window.__scene.fog.far = 99999; });
await page.evaluate(() => window.__sim.setCam(500, 5200, 1700, 500, 190, 1950));
await wait(900);
await page.screenshot({ path: OUT + '/topdown-era4.png' });
await browser.close();
console.log('done');
