// One walk-height look at every era from the same spot on the terrace, plus
// the tundra and the manor. Cheap sanity sweep for the whole timeline.
import puppeteer from 'puppeteer-core';

const OUT = '/tmp/claude-1002/-home-anna-projects-village/1ddddc0a-f950-4449-8896-2b4ef65cfbe7/scratchpad';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1120,630', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1120, height: 630 });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[CONSOLE]', m.text().slice(0, 200)); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    document.querySelectorAll('#panel, #keys, #mini, .era-bar, #eras').forEach((el) => { el.style.display = 'none'; });
  });
  for (const era of [0, 1, 2, 3, 4, 5]) {
    await page.evaluate((e) => { window.__sim.era(e); window.__sim.sky.state.paused = true; window.__sim.sky.state.t = e === 0 ? 0.9 : 0.36; }, era);
    await page.evaluate(() => window.__sim.jump('seta'));
    await new Promise((r) => setTimeout(r, 3200));
    await page.screenshot({ path: `${OUT}/era${era}.png` });
    console.log('era', era);
  }
} finally {
  await browser.close();
}
