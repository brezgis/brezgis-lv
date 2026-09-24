// UI screenshots: node data/uishot.mjs <outdir>
import puppeteer from 'puppeteer-core';
const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const [name, w, h] of [['desk', 1440, 900], ['phone', 390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: name === 'phone' ? 2 : 1, isMobile: name === 'phone', hasTouch: name === 'phone' });
    // look like a person: the harness would otherwise skip the intro
    await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}/${name}-loading.png` });
    await page.waitForFunction('window.__sim !== undefined', { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: `${OUT}/${name}-intro-ready.png` });
    await page.click('#intro-enter');
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({ path: `${OUT}/${name}-start.png` });
    await page.evaluate(() => document.getElementById('more-btn').click());
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT}/${name}-more.png` });
    await page.evaluate(() => document.getElementById('dial-btn').click());
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT}/${name}-dial.png` });
    await page.evaluate(() => document.getElementById('dial-btn').click());
    await page.evaluate(() => document.getElementById('about-btn').click());
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT}/${name}-chronicle.png` });
    await page.evaluate(() => document.getElementById('about-close').click());
    if (name === 'phone') {
      await page.evaluate(() => document.getElementById('menu-btn').click());
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: `${OUT}/${name}-menu.png` });
      await page.evaluate(() => document.getElementById('menu-btn').click());
    }
    await page.keyboard.press('KeyM');
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}/${name}-map.png` });
    await page.keyboard.press('KeyM');
    await page.evaluate(() => window.__sim.era(4));
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({ path: `${OUT}/${name}-era4.png` });
    await page.close();
  }
} finally { await browser.close(); }
