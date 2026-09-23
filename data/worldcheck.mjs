// Systemic world regression: chronology, mapped traffic, rendered-ground
// contact, and representative exposure through a full day.
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=960,540', '--no-sandbox', '--disable-dev-shm-usage'],
});
let failures = 0;
const fail = (message) => { failures++; console.log('FAIL', message); };
const pass = (message) => console.log('PASS', message);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2200));

  await page.evaluate(() => {
    const terrain = window.__scene.getObjectByName('terrain');
    const p = terrain.geometry.attributes.position;
    const n = Math.round(Math.sqrt(p.count));
    const x0 = p.getX(0), z0 = p.getZ(0);
    const sx = p.getX(1) - x0, sz = p.getZ(n) - z0;
    // the engine's own rendered height (the 2 m shore mesh replaces the
    // 17 m grid along every shore); the grid sampler is the fallback
    if (window.__meshHeightAt) { window.__meshGround = window.__meshHeightAt; return; }
    window.__meshGround = (x, z) => {
      const fx = Math.max(0, Math.min(n - 1.001, (x - x0) / sx));
      const fz = Math.max(0, Math.min(n - 1.001, (z - z0) / sz));
      const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r;
      const hA = p.getY(r * n + c), hB = p.getY(r * n + c + 1);
      const hC = p.getY((r + 1) * n + c), hD = p.getY((r + 1) * n + c + 1);
      return u + v <= 1
        ? hA + (hB - hA) * u + (hC - hA) * v
        : hD + (hC - hD) * (1 - u) + (hB - hD) * (1 - v);
    };
  });

  for (let era = 0; era <= 5; era++) {
    await page.evaluate((e) => window.__sim.era(e), era);
    await page.screenshot({ path: '/dev/null' }).catch(() => {});
    const info = await page.evaluate(() => {
      const byName = (name) => {
        let n = 0;
        window.__scene.traverse((o) => { if (o.name === name) n++; });
        return n;
      };
      const vehicles = [];
      window.__scene.traverse((o) => {
        if (!['horse-drawn-cart', 'interwar-motorcar', 'mapped-road-car'].includes(o.name)) return;
        let roadD = Infinity;
        window.__scene.traverse((road) => {
          if (!road.name?.startsWith('road-ribbon-') || !road.geometry?.attributes?.position) return;
          const p = road.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) roadD = Math.min(roadD, Math.hypot(o.position.x - p.getX(i), o.position.z - p.getZ(i)));
        });
        let roadY = null, roadYd = Infinity;
        window.__scene.traverse((road) => {
          if (!road.name?.startsWith('road-ribbon-') || !road.geometry?.attributes?.position) return;
          const p = road.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const d = Math.hypot(o.position.x - p.getX(i), o.position.z - p.getZ(i));
            if (d < roadYd) { roadYd = d; roadY = p.getY(i); }
          }
        });
        vehicles.push({
          name: o.name, roadD, roadY,
          groundError: o.position.y - window.__meshGround(o.position.x, o.position.z) + 0.08,
          belowRoad: roadY === null ? 0 : roadY - o.position.y,
        });
      });
      const litter = window.__scene.getObjectByName('micro:litter');
      let litterError = 0;
      if (litter?.count) {
        const a = litter.instanceMatrix.array;
        for (let i = 0; i < litter.count; i++) {
          const x = a[i * 16 + 12], y = a[i * 16 + 13], z = a[i * 16 + 14];
          litterError = Math.max(litterError, Math.abs(y - window.__meshGround(x, z) - 0.018));
        }
      }
      let gardenError = 0, gardenVertices = 0;
      window.__scene.traverse((o) => {
        if (!o.name?.startsWith('bg-prop-garden-era-')) return;
        const p = o.geometry.attributes.position;
        gardenVertices += p.count;
        for (let i = 0; i < p.count; i++) gardenError = Math.max(gardenError, Math.abs(p.getY(i) - window.__meshGround(p.getX(i), p.getZ(i)) - 0.035));
      });
      return {
        barrows: byName('barrow-mounds'),
        horseCarts: byName('horse-drawn-cart'),
        interwarCars: byName('interwar-motorcar'),
        modernCars: byName('mapped-road-car'),
        vehicles, litterError, gardenError, gardenVertices,
      };
    });
    const wantBarrows = era >= 2 ? 1 : 0;
    if (info.barrows !== wantBarrows) fail(`era ${era} barrow groups ${info.barrows}, expected ${wantBarrows}`);
    else pass(`era ${era} barrow chronology`);
    const expected = era === 3 ? [1, 0, 0] : era === 4 ? [1, 1, 0] : era === 5 ? [0, 0, 4] : [0, 0, 0];
    const actual = [info.horseCarts, info.interwarCars, info.modernCars];
    if (actual.some((n, i) => n !== expected[i])) fail(`era ${era} traffic ${actual}, expected ${expected}`);
    else pass(`era ${era} traffic chronology`);
    for (const v of info.vehicles) {
      if (v.roadD > 12) fail(`${v.name} is ${v.roadD.toFixed(1)}m from rendered road vertices`);
      if (v.name === 'horse-drawn-cart') {
        // parked on the verge: seated on the terrain, off the carriageway
        if (Math.abs(v.groundError) > 0.002) fail(`${v.name} ground error ${v.groundError.toFixed(3)}m`);
        // roadD is measured to the nearest ribbon VERTEX (the ribbon already
        // reaches 3.7 m off the centreline), so 1.2 m here means the cart is a
        // clear cart-width off the gravel — on the verge, not in the lane.
        if (v.roadD < 1.2) fail(`${v.name} is parked ${v.roadD.toFixed(1)}m from the carriageway`);
      } else if (v.belowRoad > 0.1) {
        // rolling stock rides the road SURFACE — terrain seating buried the wheels
        fail(`${v.name} sits ${v.belowRoad.toFixed(3)}m under the road surface`);
      }
    }
    if (info.litterError > 0.002) fail(`era ${era} litter anchor error ${info.litterError.toFixed(3)}m`);
    if (info.gardenVertices && info.gardenError > 0.002) fail(`era ${era} garden drape error ${info.gardenError.toFixed(3)}m`);
  }

  await page.evaluate(() => { window.__sim.era(4); window.__sim.jump('pagalms'); });
  const phases = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
  for (const phase of phases) {
    await page.evaluate((t) => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = t; }, phase);
    const png = PNG.sync.read(await page.screenshot({ encoding: 'binary' }));
    let luma = 0, clipped = 0;
    const pixels = png.width * png.height;
    for (let i = 0; i < png.data.length; i += 4) {
      const y = png.data[i] * 0.2126 + png.data[i + 1] * 0.7152 + png.data[i + 2] * 0.0722;
      luma += y;
      if (y > 252) clipped++;
    }
    const mean = luma / pixels, clipK = clipped / pixels;
    if (mean < 2 || mean > 245 || clipK > 0.55) fail(`day phase ${phase}: mean=${mean.toFixed(1)} clipped=${(clipK * 100).toFixed(1)}%`);
    else pass(`day phase ${phase}: mean=${mean.toFixed(1)} clipped=${(clipK * 100).toFixed(1)}%`);
  }

  await page.evaluate(() => window.__sim.jump('putns'));
  await page.screenshot({ path: '/dev/null' }).catch(() => {});
  const aerialFinite = await page.evaluate(() => {
    const p = window.__sim.camera.position;
    return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && p.y > 300;
  });
  if (aerialFinite) pass('aerial preset remains finite and above terrain');
  else fail('aerial preset produced an invalid camera');

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    window.__sim.era(5);
    window.__sim.jump('pagalms');
    window.__sim.sky.state.paused = true;
    window.__sim.sky.state.t = 0.5;
  });
  await new Promise((r) => setTimeout(r, 500));
  const mobile = PNG.sync.read(await page.screenshot({ path: '/tmp/village-mobile.png', encoding: 'binary' }));
  let mobileLuma = 0;
  for (let i = 0; i < mobile.data.length; i += 4) {
    mobileLuma += mobile.data[i] * 0.2126 + mobile.data[i + 1] * 0.7152 + mobile.data[i + 2] * 0.0722;
  }
  mobileLuma /= mobile.width * mobile.height;
  if (mobileLuma > 2 && mobileLuma < 245) pass(`mobile render ${mobile.width}x${mobile.height}, mean=${mobileLuma.toFixed(1)}`);
  else fail(`mobile render exposure mean=${mobileLuma.toFixed(1)}`);

  if (errors.length) fail(`browser errors: ${errors.slice(0, 3).join(' | ')}`);
  else pass('no browser errors');
} finally {
  await browser.close();
}

console.log(failures ? `FAILURES ${failures}` : 'ALL PASS');
process.exit(failures ? 1 : 0);
