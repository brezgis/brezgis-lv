// Era × preset tour: node data/tour.mjs <outdir> [tag] [eras=0,1,2,3,4,5] [presets=...]
// One boot, every era through the app's own camera presets, settled on the
// real GPU; writes <outdir>/<tag>-e<era>-<preset>.png.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
const [,, OUT = 'tour', tag = 't', erasArg = '0,1,2,3,4,5', presetsArg = 'seta,pagalms,upe,muiza,ezers,brezga,putns'] = process.argv;
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1280,720', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await page.evaluate(() => document.querySelectorAll('body > *:not(canvas)').forEach((el) => { el.style.display = 'none'; }));
  for (const era of erasArg.split(',').map(Number)) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await new Promise((r) => setTimeout(r, 1500));
    for (const p of presetsArg.split(',')) {
      await page.evaluate((p) => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.38; window.__sim.jump(p); }, p);
      await new Promise((r) => setTimeout(r, 3500));
      await page.screenshot({ path: `${OUT}/${tag}-e${era}-${p}.png` });
    }
    console.log('era', era, 'done');
  }
} finally { await browser.close(); }
