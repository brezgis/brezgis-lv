// Debug screenshot harness: place the camera anywhere, hide named groups.
// node data/dbg.mjs out.png "era=1;time=0.42;hide=clouds,horizon;cam=-410,200,-16;tgt=-730,187,715;wait=900"
import puppeteer from 'puppeteer-core';
const [,, out = 'dbg.png', script = ''] = process.argv;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().startsWith('[boot]')) console.log('[console]', m.text().slice(0, 300));
  });
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 40000 });
  await new Promise((r) => setTimeout(r, 2500));
  for (const step of script.split(';').filter(Boolean)) {
    const [cmd, arg] = step.split('=');
    if (cmd === 'era') await page.evaluate((a) => window.__sim.era(+a), arg);
    if (cmd === 'time') await page.evaluate((a) => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = +a; }, arg);
    if (cmd === 'hide') await page.evaluate((names) => {
      const set = new Set(names.split(','));
      window.__scene.traverse((o) => { if (set.has(o.name)) o.visible = false; });
    }, arg);
    if (cmd === 'cam') await page.evaluate((a) => { window.__dbgCam = a.split(',').map(Number); }, arg);
    if (cmd === 'tgt') await page.evaluate((a) => {
      const t = a.split(',').map(Number);
      const c = window.__dbgCam || [t[0] + 50, t[1] + 20, t[2] + 50];
      window.__sim.setCam(c[0], c[1], c[2], t[0], t[1], t[2]);
    }, arg);
    if (cmd === 'nofog') await page.evaluate(() => { window.__scene.fog.near = 88888; window.__scene.fog.far = 99999; });
    if (cmd === 'probe') console.log(await page.evaluate(() => {
      const s = window.__sim.sky;
      const out = {
        sunI: s.sun.intensity, sunCol: s.sun.color.getHexString(), sunPos: s.sun.position.toArray().map((v) => v | 0),
        hemiI: s.hemi.intensity, fog: [window.__scene.fog.near, window.__scene.fog.far, window.__scene.fog.color.getHexString()],
        castShadow: s.sun.castShadow,
      };
      let veg = null;
      window.__scene.traverse((o) => { if (o.name === 'vegetation' && !veg) veg = o.children.length; });
      out.vegChildren = veg;
      return JSON.stringify(out);
    }));
    if (cmd === 'wait') await new Promise((r) => setTimeout(r, +arg));
  }
  await page.screenshot({ path: out });
  console.log('saved', out);
} finally {
  await browser.close();
}
