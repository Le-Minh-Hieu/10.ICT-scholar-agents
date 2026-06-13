import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const extensionPath = path.resolve('extension');
  const userDataDir = path.resolve('playwright-profile');

  console.log('Launching browser with extension...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const page = await context.newPage();
  console.log('Navigating to TradingView chart...');
  await page.goto('https://www.tradingview.com/chart/dlinZR0L/?symbol=EURUSD&interval=1M');

  console.log('Waiting for chart page to load...');
  await page.waitForTimeout(10000);

  console.log('Searching for the capture button...');
  const captureButton = page.locator('#capture-all-tf-btn');
  
  if (await captureButton.count() > 0) {
    console.log('Clicking the "📸 Capture Intelligence" button...');
    await captureButton.click();
  } else {
    console.log('Button not found, triggering via sendMessage directly in the page...');
    await page.evaluate(() => {
      chrome.runtime.sendMessage({ action: 'startCapture' });
    });
  }

  // Wait long enough for the client side update failure to occur, log it, and flush it to the server (around 15-20 seconds)
  console.log('Waiting for capture pipeline to run and logs to flush...');
  await page.waitForTimeout(25000);

  console.log('Closing browser...');
  await context.close();
  console.log('Done.');
}

main().catch(console.error);
