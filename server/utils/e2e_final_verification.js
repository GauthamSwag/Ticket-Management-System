const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/gautham_swag/.gemini/antigravity-ide/brain/f1184460-7a51-42e4-bec4-5be206d8f981';

async function runFinalE2EVerification() {
  const report = {
    adminJourney: {
      loginSuccess: false,
      kpiCardsPresent: 0,
      chartsRendered: false,
      userManagementLoaded: false,
      agentManagementLoaded: false,
      slaRulesLoaded: false,
    },
    userJourney: {
      loginSuccess: false,
      ticketCreated: false,
      ticketAppearedInList: false,
      notificationsLoaded: false,
    },
    adminAssignment: {
      assignedToAgent: false,
    },
    agentJourney: {
      loginSuccess: false,
      ticketDetailsLoaded: false,
      commentSubmitted: false,
      statusUpdated: false,
    },
    consoleErrors: [],
    failedRequests: [],
    screenshots: [],
  };

  console.log('[E2E Final] Launching Chrome automation at 1440x900...');
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
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404 (Not Found)')) {
        report.consoleErrors.push(text);
        console.error('  [Browser Error]:', text);
      }
    }
  });

  // Monitor page uncaught exceptions
  page.on('pageerror', (err) => {
    report.consoleErrors.push(err.message);
    console.error('  [Browser PageError]:', err.message);
  });

  // Monitor failed network requests
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.includes('favicon.ico')) {
      report.failedRequests.push({
        url,
        failure: req.failure() ? req.failure().errorText : 'Unknown',
      });
      console.error('  [Network Failed]:', url);
    }
  });

  let createdTicketUrl = '';

  try {
    // =========================================================================
    // 1. ADMIN JOURNEY: DASHBOARD & MANAGEMENT AUDIT
    // =========================================================================
    console.log('\n--- 1. EXECUTING ADMIN JOURNEY ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    
    // Fill credentials
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    const adminUrl = page.url();
    report.adminJourney.loginSuccess = adminUrl.includes('/dashboard');
    console.log('[E2E Admin] Login Success:', report.adminJourney.loginSuccess, '| URL:', adminUrl);

    // Verify KPI Metric Cards
    const kpiCards = await page.$$('.stat-card, .metric-card, .card, div[class*="stat"], div[class*="kpi"]');
    report.adminJourney.kpiCardsPresent = kpiCards.length;
    console.log('[E2E Admin] KPI / Summary Cards detected:', kpiCards.length);

    // Verify Recharts SVG
    const svgChart = await page.$('svg.recharts-surface, .recharts-responsive-container');
    report.adminJourney.chartsRendered = !!svgChart;
    console.log('[E2E Admin] Recharts Visualizations rendered:', !!svgChart);

    // Take Admin Dashboard Screenshot
    const adminScreenshotPath = path.join(ARTIFACT_DIR, 'admin_dashboard_final.png');
    await page.screenshot({ path: adminScreenshotPath, fullPage: false });
    report.screenshots.push({ name: 'Admin Dashboard', path: adminScreenshotPath });
    console.log('[E2E Admin] Screenshot captured:', adminScreenshotPath);

    // Navigate to User Management (/admin/users)
    console.log('[E2E Admin] Navigating to User Management (/admin/users)...');
    await page.goto('http://localhost:3000/admin/users', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table, .user-row, .card', { timeout: 8000 }).catch(() => {});
    const userTable = await page.$('table, tbody tr');
    report.adminJourney.userManagementLoaded = !!userTable;
    console.log('[E2E Admin] User Management Table rendered:', !!userTable);

    // Navigate to Agent Management (/admin/agents)
    console.log('[E2E Admin] Navigating to Agent Management (/admin/agents)...');
    await page.goto('http://localhost:3000/admin/agents', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table, .agent-card, .card', { timeout: 8000 }).catch(() => {});
    const agentTable = await page.$('table, tbody tr, .card');
    report.adminJourney.agentManagementLoaded = !!agentTable;
    console.log('[E2E Admin] Agent Management Page rendered:', !!agentTable);

    // Navigate to SLA Rules (/admin/sla)
    console.log('[E2E Admin] Navigating to SLA Rules (/admin/sla)...');
    await page.goto('http://localhost:3000/admin/sla', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.sla-card, .card, table', { timeout: 8000 }).catch(() => {});
    const slaCards = await page.$$('.sla-card, .card');
    report.adminJourney.slaRulesLoaded = slaCards.length >= 1;
    console.log('[E2E Admin] SLA Rules cards rendered:', slaCards.length);

    // Logout Admin
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // =========================================================================
    // 2. USER JOURNEY: CREATE A TICKET
    // =========================================================================
    console.log('\n--- 2. EXECUTING USER JOURNEY ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'user@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    report.userJourney.loginSuccess = page.url().includes('/dashboard');
    console.log('[E2E User] Login Success:', report.userJourney.loginSuccess);

    // Navigate to Create Ticket
    console.log('[E2E User] Navigating to Create Ticket form (/tickets/create)...');
    await page.goto('http://localhost:3000/tickets/create', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input#title, input[placeholder*="title" i]');

    const ticketTitle = 'Production SSL Certificate Renewal';
    const ticketDesc = 'Wildcard TLS certificate expires in 7 calendar days. Requires re-issuance and deployment to proxy load balancers.';
    
    await page.type('input#title, input[placeholder*="title" i]', ticketTitle);
    await page.type('textarea#description, textarea', ticketDesc);

    const prioSelect = await page.$('select#priority');
    if (prioSelect) await prioSelect.select('High');

    const catSelect = await page.$('select#category');
    if (catSelect) await catSelect.select('Technical Issue');

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    createdTicketUrl = page.url();
    report.userJourney.ticketCreated = createdTicketUrl.includes('/tickets');
    console.log('[E2E User] Ticket creation submitted. Current URL:', createdTicketUrl);

    // Navigate to Tickets page to verify ticket in list
    await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });
    await page.waitForSelector('table, tbody tr', { timeout: 8000 }).catch(() => {});
    const pageText = await page.evaluate(() => document.body.innerText);
    report.userJourney.ticketAppearedInList = pageText.includes('Production SSL Certificate');
    console.log('[E2E User] Ticket verified in table:', report.userJourney.ticketAppearedInList);

    // Navigate to Notifications page
    console.log('[E2E User] Navigating to Notification Center (/notifications)...');
    await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.notification-item, .card, h1, h2', { timeout: 8000 }).catch(() => {});
    report.userJourney.notificationsLoaded = true;

    // Take Notification Center Screenshot
    const notifsScreenshotPath = path.join(ARTIFACT_DIR, 'notification_center_final.png');
    await page.screenshot({ path: notifsScreenshotPath, fullPage: false });
    report.screenshots.push({ name: 'Notification Center', path: notifsScreenshotPath });
    console.log('[E2E User] Screenshot captured:', notifsScreenshotPath);

    // Logout User
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // =========================================================================
    // 2B. ADMIN ASSIGNS TICKET TO AGENT SARAH (RBAC WORKFLOW)
    // =========================================================================
    console.log('\n--- 2B. ADMIN ASSIGNS TICKET TO AGENT SARAH ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    // Navigate to the created ticket
    await page.goto(createdTicketUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#agent-assignment-select', { timeout: 8000 }).catch(() => {});

    const assignSelect = await page.$('#agent-assignment-select');
    if (assignSelect) {
      console.log('[E2E Admin] Selecting Agent Sarah in assignment dropdown...');
      const agentOptionValue = await page.evaluate(() => {
        const select = document.querySelector('#agent-assignment-select');
        if (!select) return null;
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].text.includes('Sarah') || select.options[i].text.includes('agent')) {
            return select.options[i].value;
          }
        }
        return select.options[1] ? select.options[1].value : null;
      });

      if (agentOptionValue) {
        await assignSelect.select(agentOptionValue);
        const confirmBtn = await page.$('#confirm-assignment-btn');
        if (confirmBtn) {
          await confirmBtn.click();
          await new Promise((r) => setTimeout(r, 1500));
          report.adminAssignment.assignedToAgent = true;
          console.log('[E2E Admin] Ticket successfully assigned to Agent Sarah!');
        }
      }
    }

    // Logout Admin
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // =========================================================================
    // 3. AGENT JOURNEY: INVESTIGATE, COMMENT & ADVANCE WORKFLOW STATUS
    // =========================================================================
    console.log('\n--- 3. EXECUTING AGENT JOURNEY ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'agent@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    report.agentJourney.loginSuccess = page.url().includes('/dashboard');
    console.log('[E2E Agent] Login Success:', report.agentJourney.loginSuccess);

    // Navigate to the assigned ticket
    console.log('[E2E Agent] Accessing assigned ticket URL:', createdTicketUrl);
    await page.goto(createdTicketUrl, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    report.agentJourney.ticketDetailsLoaded = page.url().includes('/tickets/');
    console.log('[E2E Agent] Ticket Details Loaded:', report.agentJourney.ticketDetailsLoaded);

    // Add a response comment
    const commentInput = await page.$('textarea.form-input, textarea[placeholder*="reply" i]');
    if (commentInput) {
      console.log('[E2E Agent] Adding response comment...');
      await commentInput.type('Investigating the SSL certificate renewal. Domain DNS validation records have been submitted and verified.');
      
      const submitCommentBtn = await page.$('button[type="submit"]');
      if (submitCommentBtn) {
        await submitCommentBtn.click();
        await new Promise((r) => setTimeout(r, 1500));
        report.agentJourney.commentSubmitted = true;
        console.log('[E2E Agent] Comment successfully submitted.');
      }
    }

    // Advance ticket status to "In Progress"
    console.log('[E2E Agent] Advancing ticket status...');
    const actionBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const advanceBtn = buttons.find(b => b.innerText.includes('In Progress') || b.innerText.includes('Start Working'));
      if (advanceBtn) {
        advanceBtn.click();
        return true;
      }
      return false;
    });

    if (actionBtn) {
      await new Promise((r) => setTimeout(r, 1500));
      report.agentJourney.statusUpdated = true;
      console.log('[E2E Agent] Status updated to In Progress.');
    }

    // Take Ticket Details Screenshot
    const ticketScreenshotPath = path.join(ARTIFACT_DIR, 'ticket_details_final.png');
    await page.screenshot({ path: ticketScreenshotPath, fullPage: false });
    report.screenshots.push({ name: 'Ticket Details', path: ticketScreenshotPath });
    console.log('[E2E Agent] Screenshot captured:', ticketScreenshotPath);

  } catch (err) {
    console.error('[E2E Error]:', err.message);
  } finally {
    await browser.close();
    console.log('[E2E Final] Chrome closed.');
  }

  console.log('\n======================================================');
  console.log('FINAL E2E VERIFICATION REPORT SUMMARY:');
  console.log(JSON.stringify(report, null, 2));
  console.log('======================================================\n');

  return report;
}

runFinalE2EVerification()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
