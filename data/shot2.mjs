// Screenshot harness v2: drives the sim via window.__sim
import puppeteer from 'puppeteer-core';
const [,, out = 'shot.png', script = ''] = process.argv;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
  await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
  if (process.env.PLAIN) await page.evaluate(() => { window.__plain = true; });
  await new Promise((r) => setTimeout(r, 2500));
  for (const step of script.split(';').filter(Boolean)) {
    const [cmd, arg] = step.split('=');
    if (cmd === 'era') await page.evaluate((a) => window.__sim.switchEra(+a), arg);
    if (cmd === 'view') await page.evaluate((a) => window.__sim.jump(a), arg);
    if (cmd === 'eraNow') await page.evaluate((a) => window.__sim.era(+a), arg);
    if (cmd === 'time') await page.evaluate((a) => { window.__sim.sky.state.paused = true; window.__sim.sky.state.t = +a; }, arg);
    if (cmd === 'wait') await new Promise((r) => setTimeout(r, +arg));
  }
  const pos = await page.evaluate(() => {
    const c = window.__sim.camera.position, t = window.__sim.controls.target;
    return `cam(${c.x.toFixed(0)},${c.y.toFixed(0)},${c.z.toFixed(0)}) -> tgt(${t.x.toFixed(0)},${t.y.toFixed(0)},${t.z.toFixed(0)})`;
  });
  console.log(pos);
  await page.screenshot({ path: out });
  console.log('saved', out);
} finally {
  await browser.close();
}
