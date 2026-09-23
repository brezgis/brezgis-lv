// LOD fade probe: are promotion cross-fades settling? Prints, per instanced
// mesh carrying aLodFade, how many live instances sit mid-fade.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1200,800', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await page.evaluate(() => { window.__sim.era(5); window.__sim.setCam(560, 185, -380, 640, 184, -510); });
  for (const wait of [2000, 6000, 12000]) {
    await new Promise((r) => setTimeout(r, wait));
    const r = await page.evaluate(() => {
      const out = [];
      window.__scene.traverse((o) => {
        const a = o.geometry?.attributes?.aLodFade;
        if (!o.isInstancedMesh || !a) return;
        let mid = 0, one = 0, n = Math.min(o.count, a.count);
        for (let i = 0; i < n; i++) { const v = a.getX(i); if (v > 0.01 && v < 0.99) mid++; else if (v >= 0.99) one++; }
        if (mid || one) out.push(`${o.name} count=${o.count} mid=${mid} one=${one}`);
      });
      return { frame: window.__renderer.info.render.frame, out };
    });
    console.log('after', wait, 'frame', r.frame, '\n ' + r.out.join('\n '));
  }
} finally { await browser.close(); }
