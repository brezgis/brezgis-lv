// screenshot the big parish map: open with M, wait for the bake, snap
import puppeteer from 'puppeteer-core';
const [,, out = 'map.png', era = '2'] = process.argv;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate((e) => window.__sim.era(+e), era);
  await new Promise((r) => setTimeout(r, 1500));
  await page.keyboard.press('m');
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: out });
  console.log('saved', out);
} finally {
  await browser.close();
}
