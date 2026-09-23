// Facade probe: doors and windows are laid out by hand, in numbers, in every
// building builder. buildings.js registers each opening on its wall and logs
// an [openings] error when two collide; this boots every era and fails if any
// were logged.
//
//   node data/openingcheck.mjs
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=800,450', '--no-sandbox', '--disable-dev-shm-usage'],
});
const hits = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.text().includes('[openings]')) hits.push(m.text()); });
  page.on('pageerror', (e) => hits.push(`PAGEERROR ${e.message}`));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  for (const era of [0, 1, 2, 3, 4, 5]) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await new Promise((r) => setTimeout(r, 900));
  }
} finally {
  await browser.close();
}
const uniq = [...new Set(hits)];
for (const h of uniq) console.log('FAIL', h);
console.log(uniq.length ? `\n${uniq.length} colliding opening(s)` : 'ALL PASS — no colliding openings in any era');
process.exit(uniq.length ? 1 : 0);
