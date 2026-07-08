// Codex-sandbox-friendly variant of dbg.mjs: DevTools over PIPE (no
// websocket port) and crashpad/breakpad disabled (their sockets are what
// die under seccomp). Falls back to SwiftShader if the GPU is unreachable.
// Extra command vs dbg.mjs:  fauna=1  — dumps every animal's kind+position
// (call twice with a wait between to verify movement).
// node data/dbg2.mjs out.png "era=1;time=0.4;cam=x,y,z;tgt=x,y,z;fauna=1;wait=3000;fauna=1"
import puppeteer from 'puppeteer-core';
const [,, out = 'dbg.png', script = ''] = process.argv;
const base = ['--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage',
  '--disable-crashpad', '--disable-breakpad', '--disable-crash-reporter', '--no-first-run'];
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new', pipe: true,
    args: [...base, '--use-gl=angle', '--enable-gpu'],
  });
} catch (e) {
  console.log('[dbg2] GPU launch failed, SwiftShader fallback:', String(e).slice(0, 120));
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new', pipe: true,
    args: [...base, '--use-gl=swiftshader'],
  });
}
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().startsWith('[boot]')) console.log('[console]', m.text().slice(0, 300));
});
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
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
  if (cmd === 'fauna') console.log('[fauna]', await page.evaluate(() => {
    let g = null;
    window.__scene.traverse((o) => { if (o.name === 'animals' && !g) g = o; });
    if (!g) return '[]';
    return JSON.stringify(g.children.map((c) => ({
      kind: c.name || '?',
      x: +c.position.x.toFixed(1), y: +c.position.y.toFixed(1), z: +c.position.z.toFixed(1),
    })));
  }));
  if (cmd === 'wait') await new Promise((r) => setTimeout(r, +arg));
}
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
