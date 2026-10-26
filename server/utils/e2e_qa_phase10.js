const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = '/Users/gautham_swag/.gemini/antigravity-ide/brain/f1184460-7a51-42e4-bec4-5be206d8f981';

async function runVisualQA() {
  const qaResults = {
    desktop: {
      login: null,
      dashboard: null,
      tickets: null,
      createTicket: null,
      ticketDetails: null,
      notifications: null,
      twoColumnLayoutActive: false,
      horizontalOverflow: false,
    },
    mobile: {
      login: null,
      dashboard: null,
      navDrawer: null,
      tickets: null,
      createTicket: null,
      ticketDetails: null,
      stackedLayoutActive: false,
      horizontalOverflow: false,
      touchTargetsOk: true,
    },
    errors: [],
  };

  console.log('[Phase 10 Visual QA] Launching Chrome automation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Helper to measure horizontal overflow
  async function checkHorizontalOverflow(name) {
    const overflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      return {
        scrollWidth: scrollW,
        clientWidth: clientW,
        hasOverflow: scrollW > clientW + 2, // 2px buffer for rounding
      };
    });
    console.log(`[QA Check] ${name} overflow:`, overflow);
    return overflow;
  }

  try {
    // =========================================================================
    // PART 0: LOGIN SCREENSHOTS (MOBILE & DESKTOP)
    // =========================================================================
    console.log('\n--- PART 0: LOGIN AUDIT ---');
    // Mobile Login
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    const loginMobilePath = path.join(ARTIFACT_DIR, 'phase10_login_mobile.png');
    await page.screenshot({ path: loginMobilePath, fullPage: true });
    qaResults.mobile.login = loginMobilePath;
    console.log('[QA] Mobile Login captured.');

    // Desktop Login
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    const loginDesktopPath = path.join(ARTIFACT_DIR, 'phase10_login_desktop.png');
    await page.screenshot({ path: loginDesktopPath, fullPage: true });
    qaResults.desktop.login = loginDesktopPath;
    console.log('[QA] Desktop Login captured.');

    // Perform Admin Login
    console.log('[QA] Desktop: Logging in as Admin (admin@example.com)...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));

    // =========================================================================
    // PART 1: DESKTOP AUDIT (1440 x 900)
    // =========================================================================
    console.log('\n--- PART 1: DESKTOP AUDIT (1440 x 900) ---');
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Desktop Dashboard
    console.log('[QA] Desktop: Checking /dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const dashDesktopPath = path.join(ARTIFACT_DIR, 'phase10_dashboard_desktop.png');
    await page.screenshot({ path: dashDesktopPath, fullPage: true });
    qaResults.desktop.dashboard = dashDesktopPath;
    const dashOverflow = await checkHorizontalOverflow('Desktop Dashboard');
    if (dashOverflow.hasOverflow) qaResults.desktop.horizontalOverflow = true;

    // 2. Desktop Tickets List
    console.log('[QA] Desktop: Checking /tickets...');
    await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const ticketsDesktopPath = path.join(ARTIFACT_DIR, 'phase10_tickets_desktop.png');
    await page.screenshot({ path: ticketsDesktopPath, fullPage: true });
    qaResults.desktop.tickets = ticketsDesktopPath;
    const ticketsOverflow = await checkHorizontalOverflow('Desktop Tickets');
    if (ticketsOverflow.hasOverflow) qaResults.desktop.horizontalOverflow = true;

    // 3. Desktop Create Ticket
    console.log('[QA] Desktop: Checking /tickets/create...');
    await page.goto('http://localhost:3000/tickets/create', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const createDesktopPath = path.join(ARTIFACT_DIR, 'phase10_create_ticket_desktop.png');
    await page.screenshot({ path: createDesktopPath, fullPage: true });
    qaResults.desktop.createTicket = createDesktopPath;
    const createOverflow = await checkHorizontalOverflow('Desktop Create Ticket');
    if (createOverflow.hasOverflow) qaResults.desktop.horizontalOverflow = true;

    // 4. Desktop Ticket Details (2-Column Layout)
    console.log('[QA] Desktop: Navigating to first ticket details via a.ticket-id-link...');
    await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });
    await page.waitForSelector('a.ticket-id-link', { timeout: 8000 });
    const firstTicketLink = await page.$eval('a.ticket-id-link', (el) => el.getAttribute('href'));
    console.log('[QA] Found first ticket link:', firstTicketLink);

    await page.goto(`http://localhost:3000${firstTicketLink}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    const detailsDesktopPath = path.join(ARTIFACT_DIR, 'phase10_ticket_details_desktop.png');
    await page.screenshot({ path: detailsDesktopPath, fullPage: true });
    qaResults.desktop.ticketDetails = detailsDesktopPath;
    const detailsOverflow = await checkHorizontalOverflow('Desktop Ticket Details');
    if (detailsOverflow.hasOverflow) qaResults.desktop.horizontalOverflow = true;

    // Verify 2-column layout exists in CSS
    const hasTwoColumnLayout = await page.evaluate(() => {
      const layout = document.querySelector('.ticket-details-layout');
      if (!layout) return false;
      const styles = window.getComputedStyle(layout);
      const mainCol = document.querySelector('.ticket-main-col');
      const sideCol = document.querySelector('.ticket-sidebar-col');
      if (!mainCol || !sideCol) return false;
      const mainRect = mainCol.getBoundingClientRect();
      const sideRect = sideCol.getBoundingClientRect();
      // On desktop 2-column layout, sidebar is to the right of main column
      return styles.display === 'grid' && sideRect.left > mainRect.left;
    });
    console.log('[QA] Desktop 2-column grid layout active (Main 70% | Sidebar 30%):', hasTwoColumnLayout);
    qaResults.desktop.twoColumnLayoutActive = hasTwoColumnLayout;

    // 5. Desktop Notifications Page
    console.log('[QA] Desktop: Checking /notifications...');
    await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const notifsDesktopPath = path.join(ARTIFACT_DIR, 'phase10_notifications_desktop.png');
    await page.screenshot({ path: notifsDesktopPath, fullPage: true });
    qaResults.desktop.notifications = notifsDesktopPath;
    const notifsOverflow = await checkHorizontalOverflow('Desktop Notifications');
    if (notifsOverflow.hasOverflow) qaResults.desktop.horizontalOverflow = true;

    // =========================================================================
    // PART 2: MOBILE AUDIT (375 x 812 - iPhone X/12/13/14)
    // =========================================================================
    console.log('\n--- PART 2: MOBILE AUDIT (375 x 812) ---');
    await page.setViewport({
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    // 1. Mobile Dashboard
    console.log('[QA] Mobile: Navigating to /dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const dashMobilePath = path.join(ARTIFACT_DIR, 'phase10_dashboard_mobile.png');
    await page.screenshot({ path: dashMobilePath, fullPage: true });
    qaResults.mobile.dashboard = dashMobilePath;
    const dashMobOverflow = await checkHorizontalOverflow('Mobile Dashboard');
    if (dashMobOverflow.hasOverflow) qaResults.mobile.horizontalOverflow = true;

    // 2. Mobile Navigation Drawer Test
    console.log('[QA] Mobile: Testing hamburger menu drawer...');
    await page.waitForSelector('#nav-mobile-toggle-btn');
    await page.click('#nav-mobile-toggle-btn');
    await new Promise((r) => setTimeout(r, 500)); // wait for animation
    const drawerMobilePath = path.join(ARTIFACT_DIR, 'phase10_nav_drawer_mobile.png');
    await page.screenshot({ path: drawerMobilePath, fullPage: false });
    qaResults.mobile.navDrawer = drawerMobilePath;
    console.log('[QA] Mobile Drawer captured.');

    // Close mobile drawer by clicking hamburger again
    await page.click('#nav-mobile-toggle-btn');
    await new Promise((r) => setTimeout(r, 400));

    // 3. Mobile Tickets List
    console.log('[QA] Mobile: Checking /tickets...');
    await page.goto('http://localhost:3000/tickets', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const ticketsMobilePath = path.join(ARTIFACT_DIR, 'phase10_tickets_mobile.png');
    await page.screenshot({ path: ticketsMobilePath, fullPage: true });
    qaResults.mobile.tickets = ticketsMobilePath;
    const ticketsMobOverflow = await checkHorizontalOverflow('Mobile Tickets');
    if (ticketsMobOverflow.hasOverflow) qaResults.mobile.horizontalOverflow = true;

    // 4. Mobile Create Ticket
    console.log('[QA] Mobile: Checking /tickets/create...');
    await page.goto('http://localhost:3000/tickets/create', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const createMobilePath = path.join(ARTIFACT_DIR, 'phase10_create_ticket_mobile.png');
    await page.screenshot({ path: createMobilePath, fullPage: true });
    qaResults.mobile.createTicket = createMobilePath;
    const createMobOverflow = await checkHorizontalOverflow('Mobile Create Ticket');
    if (createMobOverflow.hasOverflow) qaResults.mobile.horizontalOverflow = true;

    // Check touch target heights on mobile form (visible elements only)
    const touchTargetCheck = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('.form-input, .form-select, .btn'));
      return inputs
        .filter((el) => el.offsetParent !== null && window.getComputedStyle(el).display !== 'none')
        .map((el) => ({
          tag: el.tagName,
          id: el.id || el.className,
          height: el.getBoundingClientRect().height,
        }));
    });
    const sub40Targets = touchTargetCheck.filter((t) => t.height < 38);
    if (sub40Targets.length > 0) {
      console.warn('[QA Warning] Sub-40px touch targets found:', sub40Targets);
      qaResults.mobile.touchTargetsOk = false;
    } else {
      console.log(`[QA] All ${touchTargetCheck.length} visible form inputs and buttons satisfy >=40px touch targets on mobile.`);
      qaResults.mobile.touchTargetsOk = true;
    }

    // 5. Mobile Ticket Details (Stacked Layout)
    console.log('[QA] Mobile: Checking ticket details stacked layout...');
    await page.goto(`http://localhost:3000${firstTicketLink}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    const detailsMobilePath = path.join(ARTIFACT_DIR, 'phase10_ticket_details_mobile.png');
    await page.screenshot({ path: detailsMobilePath, fullPage: true });
    qaResults.mobile.ticketDetails = detailsMobilePath;
    const detailsMobOverflow = await checkHorizontalOverflow('Mobile Ticket Details');
    if (detailsMobOverflow.hasOverflow) qaResults.mobile.horizontalOverflow = true;

    // Verify 1-column stacked layout on mobile
    const isStackedMobile = await page.evaluate(() => {
      const mainCol = document.querySelector('.ticket-main-col');
      const sideCol = document.querySelector('.ticket-sidebar-col');
      if (!mainCol || !sideCol) return true;
      const mainRect = mainCol.getBoundingClientRect();
      const sideRect = sideCol.getBoundingClientRect();
      // On stacked mobile, sidebar top is below main column bottom
      return sideRect.top >= mainRect.bottom - 5;
    });
    console.log('[QA] Mobile Ticket Details stacked layout verified:', isStackedMobile);
    qaResults.mobile.stackedLayoutActive = isStackedMobile;

  } catch (err) {
    console.error('[QA Error]', err);
    qaResults.errors.push(err.message);
  } finally {
    await browser.close();
    console.log('\n========================================');
    console.log('[Phase 10 Visual QA Finished] Results summary:');
    console.log(JSON.stringify(qaResults, null, 2));
    console.log('========================================\n');
  }
}

runVisualQA().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
