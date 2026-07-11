import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  const info = await page.evaluate(() => {
    const out = [];
    window.__sim.camera.parent?.traverse?.(() => {});
    const scene = window.__sim.controls.object.parent; // not reliable; find via renderer
    // walk from any known object: use the sky dome's parent
    let root = null;
    window.__sim.controls; // eslint
    // find scene through camera parent chain is unreliable in three; instead we stored nothing. Use __sim.sky? it has no scene ref. Fallback: query all canvases? Let's attach scene in __sim if missing.
    if (window.__scene) root = window.__scene;
    if (!root) return ['no __scene handle'];
    root.traverse((o) => {
      if (o.name && ['gauja', 'pond', 'lake', 'Taurenes ezers', 'water', 'stream', 'Dzērbe'].some((n) => o.name === n || o.name.includes('ezers'))) {
        if (o.geometry) {
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          out.push(`${o.name}: visible=${o.visible} pos=(${o.position.x.toFixed(0)},${o.position.y.toFixed(0)},${o.position.z.toFixed(0)}) bbox y ${b.min.y.toFixed(1)}..${b.max.y.toFixed(1)} x ${b.min.x.toFixed(0)}..${b.max.x.toFixed(0)}`);
        } else {
          out.push(`${o.name}: group visible=${o.visible}`);
        }
      }
    });
    return out;
  });
  console.log(info.join('\n'));
} finally {
  await browser.close();
}
