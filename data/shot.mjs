import puppeteer from 'puppeteer-core';
const [,, out = 'shot.png', wait = '9000', actions = ''] = process.argv;
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--use-gl=angle', '--enable-gpu', '--window-size=1600,1000', '--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, +wait));
  for (const act of actions.split(',').filter(Boolean)) {
    const [kind, arg] = act.split(':');
    if (kind === 'key') await page.keyboard.press(arg);
    if (kind === 'click') await page.click(arg);
    if (kind === 'wait') await new Promise((r) => setTimeout(r, +arg));
  }
  await page.screenshot({ path: out });
  console.log('saved', out);
} finally {
  await browser.close();
}
