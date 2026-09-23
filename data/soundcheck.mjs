import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  let errs = 0;
  page.on('pageerror', (e) => { errs++; console.log('[pageerror]', e.message.slice(0, 300)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('sound-btn').click());
  await new Promise((r) => setTimeout(r, 2500));
  const label = await page.evaluate(() => document.getElementById('sound-btn').textContent);
  await page.evaluate(() => document.getElementById('sound-btn').click());
  await page.evaluate(() => document.getElementById('about-btn').click());
  const aboutOpen = await page.evaluate(() => document.getElementById('about').classList.contains('open'));
  await page.evaluate(() => window.__sim.switchEra(3));
  await new Promise((r) => setTimeout(r, 2000));
  console.log('sound label after toggle:', label, '| about opens:', aboutOpen, '| pageerrors:', errs);
} finally {
  await browser.close();
}
