// Scan every mesh in each era for NaN / absurd vertex or instance transforms —
// a single NaN turns into a screen-crossing garbage triangle.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=800,450', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  for (const era of [2, 3, 4, 5]) {
    const bad = await page.evaluate((e) => {
      window.__sim.era(e);
      const out = [];
      window.__scene.traverse((o) => {
        if (!o.isMesh && !o.isLine && !o.isPoints) return;
        const p = o.geometry?.attributes?.position;
        if (p) {
          let nan = 0, huge = 0;
          const a = p.array;
          for (let i = 0; i < a.length; i++) {
            if (!Number.isFinite(a[i])) nan++;
            else if (Math.abs(a[i]) > 40000) huge++;
          }
          if (nan || huge) out.push({ name: o.name || o.type, parent: o.parent?.name || '', nan, huge, kind: 'geometry' });
        }
        if (o.isInstancedMesh) {
          const a = o.instanceMatrix.array;
          let nan = 0, huge = 0;
          for (let i = 0; i < Math.min(a.length, o.count * 16); i++) {
            if (!Number.isFinite(a[i])) nan++;
            else if (Math.abs(a[i]) > 40000) huge++;
          }
          if (nan || huge) out.push({ name: o.name || o.type, parent: o.parent?.name || '', nan, huge, count: o.count, kind: 'instances' });
        }
      });
      return out;
    }, era);
    console.log(`era ${era}:`, bad.length ? JSON.stringify(bad.slice(0, 8)) : 'clean');
  }
} finally { await browser.close(); }
