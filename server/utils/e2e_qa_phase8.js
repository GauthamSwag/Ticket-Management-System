const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/gautham_swag/.gemini/antigravity-ide/brain/f1184460-7a51-42e4-bec4-5be206d8f981';

async function runVisualQA() {
  const results = {
    loginSuccess: false,
    navbarChecks: {},
    userManagementChecks: {},
    agentManagementChecks: {},
    consoleErrors: [],
    screenshots: [],
  };

  console.log('[QA] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Monitor console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
      console.error('[BROWSER CONSOLE ERROR]:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    results.consoleErrors.push(err.toString());
    console.error('[PAGE ERROR]:', err.toString());
  });

  try {
    // 1. Login
    console.log('[QA] Navigating to http://localhost:3000/login ...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    // Click Demo Admin button or type credentials
    const demoAdminBtn = await page.$('button[type="button"]');
    // Let's type credentials directly for certainty
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    console.log('[QA] Submitted login, waiting for dashboard navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    
    const currentUrl = page.url();
    results.loginSuccess = currentUrl.includes('/dashboard');
    console.log('[QA] Current URL after login:', currentUrl);

    // 2. Check Navbar for Admin Links
    console.log('[QA] Checking Navbar elements...');
    const usersLink = await page.$('a[href="/admin/users"]');
    const agentsLink = await page.$('a[href="/admin/agents"]');
    results.navbarChecks.hasUsersLink = !!usersLink;
    results.navbarChecks.hasAgentsLink = !!agentsLink;

    // Check navbar overflow
    const navMetrics = await page.evaluate(() => {
      const nav = document.querySelector('.navbar');
      const navLinks = document.querySelector('.nav-links');
      return {
        navWidth: nav ? nav.clientWidth : 0,
        navScrollWidth: nav ? nav.scrollWidth : 0,
        linksWidth: navLinks ? navLinks.clientWidth : 0,
        isOverflowing: nav ? nav.scrollWidth > nav.clientWidth : false,
      };
    });
    results.navbarChecks.metrics = navMetrics;
    console.log('[QA] Navbar metrics:', navMetrics);

    // 3. User Management Page
    console.log('[QA] Navigating to http://localhost:3000/admin/users ...');
    await page.goto('http://localhost:3000/admin/users', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.table', { timeout: 8000 });

    // Check table overflow
    const userTableMetrics = await page.evaluate(() => {
      const container = document.querySelector('.table-container');
      const table = document.querySelector('.table');
      return {
        containerWidth: container ? container.clientWidth : 0,
        containerScrollWidth: container ? container.scrollWidth : 0,
        tableWidth: table ? table.clientWidth : 0,
        hasHorizontalOverflow: container ? container.scrollWidth > container.clientWidth : false,
      };
    });
    results.userManagementChecks.tableMetrics = userTableMetrics;

    // Take screenshot of User Management
    const userScreenshotPath = path.join(ARTIFACT_DIR, 'admin_users_page.png');
    await page.screenshot({ path: userScreenshotPath, fullPage: false });
    results.screenshots.push(userScreenshotPath);
    console.log('[QA] Saved screenshot to:', userScreenshotPath);

    // 4. E2E Clicks on User Management: Change role & toggle status
    console.log('[QA] Testing role update dropdown on user row...');
    const userRowSelect = await page.evaluate(() => {
      // Find row for user@example.com or any non-self row
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));
      for (const row of rows) {
        const emailDiv = row.querySelector('td:first-child div div:nth-child(2)');
        if (emailDiv && emailDiv.textContent.includes('user@example.com')) {
          const select = row.querySelector('select');
          if (select) {
            select.value = 'agent';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { found: true, email: 'user@example.com' };
          }
        }
      }
      return { found: false };
    });

    results.userManagementChecks.roleDropdownInteraction = userRowSelect;
    console.log('[QA] Role dropdown interaction:', userRowSelect);

    // Wait for alert banner
    await page.waitForSelector('.alert, .alert-success', { timeout: 4000 }).catch(() => {});
    const alertText = await page.evaluate(() => {
      const el = document.querySelector('.alert');
      return el ? el.textContent.trim() : null;
    });
    results.userManagementChecks.roleChangeAlert = alertText;
    console.log('[QA] Role change alert text:', alertText);

    // Test Deactivate button click
    console.log('[QA] Testing Deactivate button click on user row...');
    const deactivateClicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));
      for (const row of rows) {
        const emailDiv = row.querySelector('td:first-child div div:nth-child(2)');
        if (emailDiv && emailDiv.textContent.includes('user@example.com')) {
          const btn = row.querySelector('button');
          if (btn && btn.textContent.includes('Deactivate')) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    results.userManagementChecks.deactivateClicked = deactivateClicked;

    // Wait 1 second for status update
    await new Promise((r) => setTimeout(r, 1200));

    // Verify status button changed to 'Activate'
    const newStatusState = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));
      for (const row of rows) {
        const emailDiv = row.querySelector('td:first-child div div:nth-child(2)');
        if (emailDiv && emailDiv.textContent.includes('user@example.com')) {
          const btn = row.querySelector('button');
          const badge = row.querySelector('td:nth-child(4)');
          return {
            buttonText: btn ? btn.textContent.trim() : '',
            statusBadgeText: badge ? badge.textContent.trim() : '',
          };
        }
      }
      return null;
    });
    results.userManagementChecks.statusAfterDeactivate = newStatusState;
    console.log('[QA] Status after deactivate:', newStatusState);

    // Reactivate account
    console.log('[QA] Reactivating user account...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));
      for (const row of rows) {
        const emailDiv = row.querySelector('td:first-child div div:nth-child(2)');
        if (emailDiv && emailDiv.textContent.includes('user@example.com')) {
          const btn = row.querySelector('button');
          if (btn && btn.textContent.includes('Activate')) {
            btn.click();
          }
        }
      }
    });

    await new Promise((r) => setTimeout(r, 1200));

    const restoredStatusState = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));
      for (const row of rows) {
        const emailDiv = row.querySelector('td:first-child div div:nth-child(2)');
        if (emailDiv && emailDiv.textContent.includes('user@example.com')) {
          const btn = row.querySelector('button');
          const badge = row.querySelector('td:nth-child(4)');
          return {
            buttonText: btn ? btn.textContent.trim() : '',
            statusBadgeText: badge ? badge.textContent.trim() : '',
          };
        }
      }
      return null;
    });
    results.userManagementChecks.statusAfterReactivate = restoredStatusState;
    console.log('[QA] Status after reactivate:', restoredStatusState);

    // Save screenshot after interactions
    const userUpdatedScreenshotPath = path.join(ARTIFACT_DIR, 'admin_users_updated_page.png');
    await page.screenshot({ path: userUpdatedScreenshotPath, fullPage: false });
    results.screenshots.push(userUpdatedScreenshotPath);

    // 5. Agent Management Page
    console.log('[QA] Navigating to http://localhost:3000/admin/agents ...');
    await page.goto('http://localhost:3000/admin/agents', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.table', { timeout: 8000 });

    // Check KPI cards
    const agentKpiMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.card'));
      const table = document.querySelector('.table');
      const container = document.querySelector('.table-container');
      const rows = Array.from(document.querySelectorAll('.table tbody tr'));

      return {
        cardCount: cards.length,
        hasTable: !!table,
        agentRowCount: rows.length,
        isTableOverflowing: container ? container.scrollWidth > container.clientWidth : false,
      };
    });
    results.agentManagementChecks = agentKpiMetrics;
    console.log('[QA] Agent management metrics:', agentKpiMetrics);

    // Save screenshot of Agent Management
    const agentScreenshotPath = path.join(ARTIFACT_DIR, 'admin_agents_page.png');
    await page.screenshot({ path: agentScreenshotPath, fullPage: false });
    results.screenshots.push(agentScreenshotPath);
    console.log('[QA] Saved screenshot to:', agentScreenshotPath);

  } catch (err) {
    console.error('[QA RUNTIME ERROR]:', err);
    results.error = err.message;
  } finally {
    await browser.close();
    console.log('[QA] Browser closed. Complete results:');
    console.log(JSON.stringify(results, null, 2));
  }
}

runVisualQA();
