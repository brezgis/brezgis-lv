import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await page.goto('file:///home/anna/projects/village/artifact/brezgi-taurene.html', { waitUntil: 'load' });
await page.waitForFunction('window.__sim !== undefined', { timeout: 30000 });
await page.evaluate(() => {
  window.__sim.era(3);
  window.__sim.jump('pagalms');
  window.__rig.setMode('walk');
  window.__rig.yaw = 2.2; window.__rig.pitch = 0.02;
});
// simulate holding W for a while: rAF is throttled headless, so step manually via screenshots
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => { window.__rig.keys.add('KeyW'); });
  await page.screenshot({ path: '/dev/null' }).catch(() => {});
}
await page.evaluate(() => window.__rig.keys.delete('KeyW'));
const pose = await page.evaluate(() => {
  const c = window.__sim.camera.position;
  return `walk cam(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}) grounded=${window.__rig.grounded}`;
});
console.log(pose);
await page.screenshot({ path: process.argv[2] });
await browser.close();
console.log('saved');
