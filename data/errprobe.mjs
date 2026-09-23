// Find the exception that kills renderer.setAnimationLoop (three re-requests
// the frame AFTER the callback, so one throw freezes the world permanently).
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=960,540', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[CONSOLE]', m.text().slice(0, 400)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));

  const frames = () => page.evaluate(() => window.__renderer.info.render.frame);
  const alive = async (label) => {
    const a = await frames();
    await new Promise((r) => setTimeout(r, 700));
    const b = await frames();
    console.log(`${label}: frames ${a} -> ${b} ${b > a ? 'ALIVE' : '*** LOOP DEAD ***'}`);
    return b > a;
  };
  await alive('boot');
  for (const era of [0, 1, 2, 3, 4, 5]) {
    await page.evaluate((e) => window.__sim.era(e), era);
    if (!await alive(`after era ${era}`)) break;
  }
  // camera moves that previously preceded the freeze
  await page.evaluate(() => window.__sim.setCam(412 + 9, 194, 3485 + 9, 412, 191, 3485));
  await alive('after setCam to road');
  await page.evaluate(() => window.__sim.jump('putns'));
  await alive('after aerial preset');
  await page.evaluate(() => window.__sim.jump('upe'));
  await alive('after river preset');
  await page.evaluate(() => window.__sim.jump('pagalms'));
  await alive('after yard preset');
} finally {
  await browser.close();
}
