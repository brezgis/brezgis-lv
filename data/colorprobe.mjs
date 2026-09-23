// Prints painted ground colours (shore mesh vs coarse grid) near a point.
// node data/colorprobe.mjs era x z
import puppeteer from 'puppeteer-core';
const [,, era = '4', X = '-384', Z = '38'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await page.evaluate((e) => window.__sim.era(+e), era);
  await new Promise((r) => setTimeout(r, 2000));
  console.log(await page.evaluate(([x0, z0]) => {
    const out = [];
    window.__scene.traverse((o) => {
      if (o.name !== 'terrain:shore' && o.name !== 'terrain') return;
      const p = o.geometry.attributes.position, c = o.geometry.attributes.color, R = o.geometry.userData.rec;
      for (let i = 0; i < p.count; i++) {
        const dx = p.getX(i) - x0, dz = p.getZ(i) - z0;
        if (dx * dx + dz * dz > (o.name === 'terrain' ? 400 : 16)) continue;
        out.push(`${o.name} (${p.getX(i).toFixed(0)},${p.getZ(i).toFixed(0)}) y=${p.getY(i).toFixed(2)} rgb=${[c.getX(i), c.getY(i), c.getZ(i)].map((v) => v.toFixed(2))} rec=${R ? Array.from(R.slice(i * 10, i * 10 + 5)).map((v) => v.toFixed(2)) : '-'}`);
      }
    });
    return out.slice(0, 20).join('\n');
  }, [+X, +Z]));
} finally { await browser.close(); }
