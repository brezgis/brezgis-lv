// Frame-rate probe: node data/fpsprobe.mjs [artifact] — frames rendered in
// 8 s at a few fixed views (headless: compare builds, not absolute fps).
import puppeteer from 'puppeteer-core';
import { resolve } from 'path';
const art = process.argv[2] || new URL('../artifact/brezgi-taurene.html', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1200,800', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file://' + resolve(art), { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  const views = [['river', 4, [-360, 190, 40], [-395, 185, 5]], ['lake', 3, [-560, 215, 3170], [-640, 186, 3240]], ['aerial', 4, 'putns']];
  for (const [name, era, c, t] of views) {
    await page.evaluate(([e, c, t]) => { window.__sim.era(e); if (c === 'putns') window.__sim.jump('putns'); else window.__sim.setCam(...c, ...t); }, [era, c, t]);
    await new Promise((r) => setTimeout(r, 5000));
    const f0 = await page.evaluate(() => window.__renderer.info.render.frame);
    await new Promise((r) => setTimeout(r, 8000));
    const f1 = await page.evaluate(() => window.__renderer.info.render.frame);
    console.log(name, ((f1 - f0) / 8).toFixed(1), 'fps');
  }
} finally { await browser.close(); }
