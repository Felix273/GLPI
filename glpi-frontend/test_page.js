const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => consoleMessages.push(`PAGE ERROR: ${error.message}`));
  page.on('requestfailed', req => consoleMessages.push(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  
  try {
    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('Page loaded');
    console.log('Console messages:', consoleMessages);
    
    // Check if sidebarNav has content
    const sidebarHTML = await page.evaluate(() => {
      const nav = document.getElementById('sidebarNav');
      return nav ? nav.innerHTML.substring(0, 500) : 'sidebarNav NOT FOUND';
    });
    console.log('Sidebar HTML:', sidebarHTML);
    
    // Try clicking settings nav item
    await page.click('a.nav-item[data-view="settings"]');
    console.log('Clicked settings nav item');
    
    await page.waitForTimeout(2000);
    
    const settingsViewActive = await page.evaluate(() => {
      const view = document.getElementById('settingsView');
      return view ? view.classList.contains('active') : 'settingsView NOT FOUND';
    });
    console.log('Settings view active:', settingsViewActive);
    
    const settingsContent = await page.evaluate(() => {
      const content = document.getElementById('settingsContent');
      return content ? (content.hidden ? 'HIDDEN' : 'VISIBLE') : 'settingsContent NOT FOUND';
    });
    console.log('Settings content:', settingsContent);
    
    const errorBoundary = await page.evaluate(() => {
      const el = document.getElementById('settingsError');
      return el ? (el.hidden ? 'hidden' : 'visible') : 'settingsError NOT FOUND';
    });
    console.log('Error boundary:', errorBoundary);
    
    const accessMessage = await page.evaluate(() => {
      const el = document.getElementById('settingsAccessMessage');
      return el ? (el.hidden ? 'hidden' : 'visible') : 'settingsAccessMessage NOT FOUND';
    });
    console.log('Access message:', accessMessage);

    console.log('All console messages:', consoleMessages);
    
  } catch (error) {
    console.log('Error:', error.message);
    console.log('Console messages:', consoleMessages);
  } finally {
    await browser.close();
  }
})();
