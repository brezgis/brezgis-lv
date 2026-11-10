// Several debug screenshots from ONE page boot.
// node data/multishot.mjs OUTDIR "name|era|camx,camy,camz|tgtx,tgty,tgtz[|time]" ...
// y values are metres ABOVE THE GROUND at that point, so views survive terrain changes.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
const [,, outDir, ...specs] = process.argv;
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => { for (const el of document.querySelectorAll('body > *:not(canvas)')) el.style.display = 'none'; });
  let cur = -1;
  for (const spec of specs) {
    const [name, era, cam, tgt, time = '0.5'] = spec.split('|');
    if (+era !== cur) { await page.evaluate((a) => window.__sim.era(+a), era); cur = +era; await new Promise((r) => setTimeout(r, 6000)); }
    await page.evaluate((c, t, tm) => {
      const C = c.split(',').map(Number), T = t.split(',').map(Number);
      const g = (x, z) => window.__sim.groundAt ? window.__sim.groundAt(x, z) : 190;
      window.__sim.sky.state.paused = true; window.__sim.sky.state.t = +tm;
      window.__sim.setCam(C[0], g(C[0], C[2]) + C[1], C[2], T[0], g(T[0], T[2]) + T[1], T[2]);
    }, cam, tgt, time);
    await new Promise((r) => setTimeout(r, 3500));
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log('saved', name);
  }
} finally { await browser.close(); }
