// UI flow check: intro → EN → era switch → moment glide → citation tooltip
import puppeteer from 'puppeteer-core';
const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 180000,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto(new URL('../artifact/brezgi-taurene.html', import.meta.url).href, { waitUntil: 'load', timeout: 90000 });
  await page.click('#intro-lang');                         // switch language on the intro card
  await page.waitForSelector('#intro-enter:not([hidden])', { timeout: 90000 });
  const introBtn = await page.$eval('#intro-enter', (b) => b.textContent);
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 1500));
  const s1 = await page.evaluate(() => ({ title: document.getElementById('era-title').textContent, cap: document.getElementById('era-caption').textContent,
    yr: document.querySelector('.era-btn .yr').textContent, lang: document.getElementById('lang-btn').textContent }));
  await page.click('.era-btn:nth-child(5)');
  await new Promise((r) => setTimeout(r, 2500));
  const s2 = await page.evaluate(() => ({ title: document.getElementById('era-title').textContent, moments: [...document.querySelectorAll('.moment')].map((m) => m.textContent), panelOpen: !document.getElementById('panel').classList.contains('closed') }));
  const cam0 = await page.evaluate(() => window.__sim.camera.position.toArray().map(Math.round));
  await page.click('.moment:nth-child(2)');
  await new Promise((r) => setTimeout(r, 3500));
  const cam1 = await page.evaluate(() => window.__sim.camera.position.toArray().map(Math.round));
  await page.hover('#era-lead sup a');
  await new Promise((r) => setTimeout(r, 300));
  const tip = await page.$eval('#cite-tip', (t) => [t.classList.contains('on'), t.textContent.slice(0, 60)]);
  await page.keyboard.down('KeyW'); await new Promise((r) => setTimeout(r, 400)); await page.keyboard.up('KeyW');
  await new Promise((r) => setTimeout(r, 400));
  const folded = await page.evaluate(() => document.getElementById('panel').classList.contains('closed'));
  await page.screenshot({ path: `${OUT}/flow.png` });
  console.log(JSON.stringify({ introBtn, s1, s2, cam0, cam1, tip, foldedAfterMoving: folded, errors }, null, 1));
} finally { await browser.close(); }
