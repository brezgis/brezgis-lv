// Fauna audit harness: park the camera at every animal species in an era
// and screenshot each. One boot per era, fast in-session shots.
//   node data/animalshot.mjs <outdir> <era> [skip=fishPerch,fishPike,...]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const [,, outdir = '/tmp/animals', era = '2', skipArg = ''] = process.argv;
const SKIP = new Set((skipArg || 'fishPerch,fishPike,butterflyW,butterflyO,butterflyY,dragonfly').split(','));
mkdirSync(outdir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1400,900', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate((e) => { window.__sim.era(+e); window.__sim.sky.state.paused = true; window.__sim.sky.state.t = 0.42; }, era);
await new Promise((r) => setTimeout(r, 2500));

const kinds = await page.evaluate(() => {
  const out = new Map();
  window.__scene.traverse((o) => {
    if (o.parent && o.parent.name === 'animals' && o.name && !out.has(o.name)) {
      const p = o.getWorldPosition(new (o.position.constructor)());
      out.set(o.name, [p.x, p.y, p.z]);
    }
  });
  return [...out.entries()];
});
console.log(`era ${era}: ${kinds.length} species -`, kinds.map(([k]) => k).join(', '));

for (const [kind, [x, y, z]] of kinds) {
  if (SKIP.has(kind)) continue;
  const air = ['swallow', 'buzzard', 'crane'].includes(kind);
  const d = air ? 9 : ['aurochsBull', 'aurochsCow', 'elk', 'redDeer', 'horseBay', 'horseTarpan', 'horseKonik', 'cattleFarm', 'cattleIron', 'wolf', 'reindeer', 'boar'].includes(kind) ? 6 : 3.2;
  await page.evaluate(([px, py, pz, dd, isAir]) => {
    window.__sim.setCam(px + dd * 0.8, py + (isAir ? 1 : dd * 0.42), pz + dd * 0.8, px, py + (isAir ? 0 : 0.5), pz);
  }, [x, y, z, d, air]);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${outdir}/era${era}-${kind}.png` });
  console.log('shot', kind);
}
await browser.close();
console.log('done era', era);
