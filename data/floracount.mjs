// How much of each plant is actually standing, per era? Instance counts read
// off the live scene — the placement rules are a stack of gates and it is very
// easy for a new pass to be silently eaten by one of them.
//
//   node data/floracount.mjs [era ...]
import puppeteer from 'puppeteer-core';

const eras = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n));
const ERAS = eras.length ? eras : [0, 1, 2, 3, 4, 5];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=800,450', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2500));
  for (const era of ERAS) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await new Promise((r) => setTimeout(r, 1500));
    const rows = await page.evaluate(() => {
      const veg = window.__scene.getObjectByName('vegetation');
      const by = {};
      if (veg) {
        veg.traverse((o) => {
          if (!o.isInstancedMesh || !o.count || !o.name) return;
          // near:<species>:<variant>:<cell>:bark | far:<species> | <scatter>
          if (/cards$/.test(o.name)) return;            // don't double-count foliage
          const m = /^near:([a-z]+):/.exec(o.name);
          const key = m ? `${m[1]} (near)` : o.name.split(':')[0];
          by[key] = (by[key] || 0) + o.count;
        });
      }
      // The far impostor tier and the promotion pool are unnamed, so ask the
      // sim for the placement lists instead of guessing from mesh names.
      if (window.__veg && window.__veg.counts) Object.assign(by, window.__veg.counts());
      return by;
    });
    const total = Object.values(rows).reduce((a, b) => a + b, 0);
    const shown = Object.entries(rows).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`).join('  ');
    console.log(`era ${era}: ${total} instances\n         ${shown}`);
  }
} finally {
  await browser.close();
}
