// Debug screenshot harness: place the camera anywhere, hide named groups.
// node data/dbg.mjs out.png "era=1;time=0.42;hide=clouds,horizon;cam=-410,200,-16;tgt=-730,187,715;wait=900"
//
// GOTCHA — GRASS AFTER A TELEPORT. cam=/tgt= jump the camera, and the grass
// rings are camera-follow and refilled by a time-sliced queue (one chunk per
// frame, far band LAST by priority). Headless Chrome throttles rAF to ~11 fps,
// so for several seconds after a jump the far band still holds the ring built
// around the PREVIOUS centre — its wide, sun-bleached tufts then appear a few
// metres from the camera and read as pale cards scattered over the meadow.
// That is the harness, not the world: `grassstate` prints each band's ring
// centre and the queue depth, and once `queued` reaches 0 the shot is honest.
// Budget 20-30 s of wait before trusting any screenshot of ground cover.
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
    // grassstate: where each band ring is actually centred vs the camera.
    // Camera-follow systems can silently lag a teleport, and a screenshot
    // taken in that state misrepresents the ground cover badly.
    if (cmd === 'grassstate') console.log('[grass]', JSON.stringify(await page.evaluate(() => ({
      cam: window.__sim.camera.position.toArray().map((v) => Math.round(v)),
      queued: window.__grass.debugQueue(),
      bands: window.__grass.bands.map((b) => ({
        key: b.key, at: [Math.round(b.lastX), Math.round(b.lastZ)],
        on: b.on, altK: +b.altK.toFixed(2), count: b.mesh.count,
      })),
    }))));
    // find=<substring> prints world positions of matching meshes (and, for
    // instanced ones, the first few instance origins) so a shot can be aimed
    // at a thing by name instead of by guesswork
    if (cmd === 'find') console.log('[find]', JSON.stringify(await page.evaluate((needle) => {
      const out = [];
      window.__scene.traverse((o) => {
        if (!o.name || !o.name.includes(needle) || out.length > 6) return;
        const e = o.matrixWorld.elements;    // no Vector3 needed in page scope
        const rec = { name: o.name, at: [Math.round(e[12]), Math.round(e[13]), Math.round(e[14])] };
        if (o.isInstancedMesh) {
          const m = o.instanceMatrix.array;
          rec.count = o.count;
          rec.first = [];
          for (let i = 0; i < Math.min(3, o.count); i++) {
            rec.first.push([Math.round(m[i * 16 + 12]), Math.round(m[i * 16 + 13]), Math.round(m[i * 16 + 14])]);
          }
        }
        out.push(rec);
      });
      return out;
    }, arg)));
    // ui=off strips the HUD so a shot shows only the world
    if (cmd === 'ui' && arg === 'off') await page.evaluate(() => {
      for (const el of document.querySelectorAll('body > *:not(canvas)')) el.style.display = 'none';
    });
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
