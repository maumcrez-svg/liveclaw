const puppeteer = require('puppeteer-core');

const CHROMIUM_PATH = '/usr/bin/chromium-browser';
const AGENT_CONFIG = JSON.parse(process.env.AGENT_CONFIG || '{}');

async function main() {
  console.log('[BrowserAgent] Launching Chromium...');

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--display=:99',
      '--start-maximized',
      '--window-size=1920,1080',
    ],
    env: { ...process.env, DISPLAY: ':99' },
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Default browsing behavior - visit websites
  const sites = AGENT_CONFIG.sites || [
    'https://en.wikipedia.org/wiki/Special:Random',
    'https://news.ycombinator.com',
    'https://www.reddit.com/r/artificial',
    'https://github.com/trending',
  ];

  let siteIndex = 0;

  async function browseNext() {
    const url = sites[siteIndex % sites.length];
    console.log(`[BrowserAgent] Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Simulate scrolling
      await new Promise(r => setTimeout(r, 5000));
      await page.evaluate(() => window.scrollBy(0, 300));
      await new Promise(r => setTimeout(r, 3000));
      await page.evaluate(() => window.scrollBy(0, 300));
      await new Promise(r => setTimeout(r, 5000));

      // Click random links sometimes
      if (Math.random() > 0.5) {
        const links = await page.$$('a[href]');
        if (links.length > 0) {
          const randomLink = links[Math.floor(Math.random() * Math.min(links.length, 20))];
          try {
            await randomLink.click();
            await new Promise(r => setTimeout(r, 8000));
          } catch {
            // Link might have navigated away, that's ok
          }
        }
      }
    } catch (err) {
      console.log(`[BrowserAgent] Error navigating: ${err.message}`);
    }

    siteIndex++;

    // Wait 10-30 seconds before next action
    const delay = 10000 + Math.random() * 20000;
    setTimeout(browseNext, delay);
  }

  browseNext();
}

main().catch((err) => {
  console.error('[BrowserAgent] Fatal error:', err);
  process.exit(1);
});
