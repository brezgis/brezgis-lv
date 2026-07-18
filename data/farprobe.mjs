// far-tier density probe: counts far-impostor instances near a point.
//   node data/farprobe.mjs <era> <x> <z> [x2 z2 ...]
import puppeteer from 'puppeteer-core';
const [,, era = '5', ...pts] = process.argv;
const points = [];
for (let i = 0; i + 1 < pts.length; i += 2) points.push([+pts[i], +pts[i + 1]]);
if (!points.length) points.push([-1450, -2050], [1000, 3000]);

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate((e) => window.__sim.era(+e), era);
  await new Promise((r) => setTimeout(r, 2000));
  const out = await page.evaluate((points) => {
    const res = points.map(() => ({ far: 0, near: 0 }));
    const R = 250;
    window.__scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.count) return;
      const inVeg = (() => { let p = o.parent; while (p) { if (p.name === 'vegetation') return true; p = p.parent; } return false; })();
      if (!inVeg) return;
      const arr = o.instanceMatrix.array;
      const isFar = o.material && o.material.isMeshBasicMaterial;   // impostors are MeshBasic
      for (let i = 0; i < o.count; i++) {
        const x = arr[i * 16 + 12], z = arr[i * 16 + 14];
        const sy = arr[i * 16 + 5];
        if (sy < 0.01) continue;                                    // demoted/zeroed instances
        for (let p = 0; p < points.length; p++) {
          const d = Math.hypot(x - points[p][0], z - points[p][1]);
          if (d < R) { if (isFar) res[p].far++; else res[p].near++; }
        }
      }
    });
    return res;
  }, points);
  points.forEach((p, i) => console.log(`(${p[0]}, ${p[1]}): far=${out[i].far} near=${out[i].near} (within 250m)`));
} finally {
  await browser.close();
}
