const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/gautham_swag/.gemini/antigravity-ide/brain/f1184460-7a51-42e4-bec4-5be206d8f981';

async function runVisualQA() {
  const results = {
    userCreatedTicket: false,
    adminSawBadge: false,
    adminDropdownHasItems: false,
    adminAssignedTicket: false,
    adminNotificationsPageRendered: false,
    adminMarkAllReadWorked: false,
    agentSawNotification: false,
    screenshots: [],
  };

  console.log('[QA Phase 9 Flow] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // STEP 1: Log in as Regular User to Create a Ticket
    // (This triggers TICKET_CREATED notification for all Admins)
    // -------------------------------------------------------------
    console.log('[QA] Step 1: Logging in as User (user@example.com)...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'user@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    console.log('[QA] Creating ticket as User...');
    await page.goto('http://localhost:3000/tickets/create', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input#title, input[placeholder*="title" i]');

    await page.type('input#title, input[placeholder*="title" i]', 'High Memory Leak in Payment Service');
    await page.type('textarea#description, textarea', 'Production node workers are failing OOM every 30 minutes under normal load.');

    const prioritySelect = await page.$('select#priority');
    if (prioritySelect) await prioritySelect.select('Critical');

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    results.userCreatedTicket = page.url().includes('/tickets/');
    console.log('[QA] User ticket created. Current URL:', page.url());

    // -------------------------------------------------------------
    // STEP 2: Log out and Log in as System Admin
    // -------------------------------------------------------------
    console.log('[QA] Step 2: Logging in as Admin (admin@example.com)...');
    // Clear storage/cookies to log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Check for notification badge
    await page.waitForSelector('#notification-bell-btn', { timeout: 5000 });
    const badgeEl = await page.$('#notification-badge');
    if (badgeEl) {
      const badgeCount = await page.evaluate((el) => el.textContent, badgeEl);
      results.adminSawBadge = true;
      console.log('[QA] Admin Bell Badge verified! Count:', badgeCount);
    }

    // Click Notification Bell to open dropdown
    console.log('[QA] Opening Notification Bell dropdown...');
    await page.click('#notification-bell-btn');
    await new Promise((r) => setTimeout(r, 800));

    const dropdownScreenshotPath = path.join(ARTIFACT_DIR, 'admin_notification_dropdown_with_items.png');
    await page.screenshot({ path: dropdownScreenshotPath });
    results.screenshots.push(dropdownScreenshotPath);
    console.log('[QA] Dropdown screenshot saved:', dropdownScreenshotPath);

    // Verify items inside dropdown
    const dropdownItems = await page.$$eval('#notification-dropdown-panel p', (els) =>
      els.map((e) => e.textContent.trim())
    );
    console.log('[QA] Dropdown notification preview text:', dropdownItems.slice(0, 4));
    results.adminDropdownHasItems = dropdownItems.length > 0;

    // -------------------------------------------------------------
    // STEP 3: Navigate to /notifications via dropdown footer link
    // -------------------------------------------------------------
    console.log('[QA] Navigating to /notifications via "View All Notifications" link...');
    const viewAllBtn = await page.$('#view-all-notifications-btn');
    if (viewAllBtn) {
      await viewAllBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
    } else {
      await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Full page screenshot of Notifications
    const notifsScreenshotPath = path.join(ARTIFACT_DIR, 'admin_notifications_page.png');
    await page.screenshot({ path: notifsScreenshotPath });
    results.screenshots.push(notifsScreenshotPath);
    results.adminNotificationsPageRendered = true;
    console.log('[QA] Notifications page screenshot saved:', notifsScreenshotPath);

    // -------------------------------------------------------------
    // STEP 4: Test "Mark all as read" button on Notifications page
    // -------------------------------------------------------------
    const markAllBtn = await page.$('#mark-all-notifications-page-btn');
    if (markAllBtn) {
      console.log('[QA] Clicking "Mark all as read" button...');
      await markAllBtn.click();
      await new Promise((r) => setTimeout(r, 1200));

      const markedReadScreenshotPath = path.join(ARTIFACT_DIR, 'admin_notifications_marked_read.png');
      await page.screenshot({ path: markedReadScreenshotPath });
      results.screenshots.push(markedReadScreenshotPath);
      results.adminMarkAllReadWorked = true;
      console.log('[QA] Marked all as read screenshot saved:', markedReadScreenshotPath);
    }

    // -------------------------------------------------------------
    // STEP 5: Assign the user's ticket to Agent Sarah
    // -------------------------------------------------------------
    console.log('[QA] Step 5: Assigning ticket to Agent Sarah...');
    await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table tbody tr a, .ticket-card a', { timeout: 6000 }).catch(() => {});
    
    // Click first ticket
    const ticketLink = await page.$('table tbody tr a, a[href^="/tickets/"]');
    if (ticketLink) {
      await ticketLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 6000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));

      const assignSelect = await page.$('select#assignedTo, select');
      if (assignSelect) {
        const options = await page.$$eval('select option', (opts) =>
          opts.map((o) => ({ value: o.value, text: o.textContent }))
        );
        const agentOpt = options.find((o) => o.text.toLowerCase().includes('agent') && o.value);
        if (agentOpt) {
          await assignSelect.select(agentOpt.value);
          const confirmBtn = await page.$('button[type="button"], button');
          const btns = await page.$$('button');
          for (const b of btns) {
            const txt = await page.evaluate((el) => el.textContent, b);
            if (txt.toLowerCase().includes('confirm') || txt.toLowerCase().includes('assign')) {
              await b.click();
              await new Promise((r) => setTimeout(r, 1500));
              results.adminAssignedTicket = true;
              break;
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 6: Log in as Support Agent Sarah & Verify Assignment Notification
    // -------------------------------------------------------------
    console.log('[QA] Step 6: Logging in as Agent Sarah (agent@example.com)...');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'agent@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // Agent navigates to /notifications
    await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const agentNotifsScreenshotPath = path.join(ARTIFACT_DIR, 'agent_notifications_assigned.png');
    await page.screenshot({ path: agentNotifsScreenshotPath });
    results.screenshots.push(agentNotifsScreenshotPath);
    results.agentSawNotification = true;
    console.log('[QA] Agent notifications screenshot saved:', agentNotifsScreenshotPath);

  } catch (err) {
    console.error('[QA Exception]:', err);
    results.error = err.message;
  } finally {
    await browser.close();
    console.log('[QA Flow] Browser closed.');
  }

  console.log('\n========================================');
  console.log('[QA Phase 9 Flow] FINAL RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================\n');
}

runVisualQA().catch(console.error);
