import puppeteer from 'puppeteer';

const SITE_URL = 'https://lucascoelhof.github.io/PlanningClub/';

const runDebugTest = async () => {
  console.log('🔍 Debug Test: PeerJS Connection');
  console.log('================================\n');
  
  let browser1, browser2;
  let page1, page2;
  
  try {
    // Launch browsers with visible UI
    const browserOptions = {
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 100
    };
    
    browser1 = await puppeteer.launch(browserOptions);
    browser2 = await puppeteer.launch(browserOptions);
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    
    // Enable console logging
    page1.on('console', msg => {
      const text = msg.text();
      if (text.includes('peer') || text.includes('connection') || text.includes('Connection')) {
        console.log('[Host Console]', text);
      }
    });
    
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('peer') || text.includes('connection') || text.includes('Connection')) {
        console.log('[Guest Console]', text);
      }
    });
    
    page1.on('pageerror', error => console.error('[Host Error]', error.message));
    page2.on('pageerror', error => console.error('[Guest Error]', error.message));
    
    // Step 1: Host creates session
    console.log('Step 1: Host creating session...');
    await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
    
    await page1.waitForSelector('#create-identity');
    await page1.type('#create-identity', 'Host');
    await page1.click('#create-form button[type="submit"]');
    
    // Wait for session creation
    await page1.waitForFunction(
      () => window.location.search.includes('session='),
      { timeout: 15000 }
    );
    
    const url = await page1.url();
    const urlParams = new URLSearchParams(new URL(url).search);
    const sessionId = urlParams.get('session');
    console.log(`✓ Session created: ${sessionId}\n`);
    
    // Wait a bit for PeerJS to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Guest joins session
    console.log('Step 2: Guest joining session...');
    await page2.goto(`${SITE_URL}?session=${sessionId}`, { waitUntil: 'networkidle2' });
    
    await page2.waitForSelector('#join-prompt-identity');
    await page2.type('#join-prompt-identity', 'Guest');
    await page2.click('#join-prompt-form button[type="submit"]');
    
    // Wait for game page
    await page2.waitForSelector('.session-info', { timeout: 15000 });
    console.log('✓ Guest joined session\n');
    
    // Wait for connection
    console.log('Step 3: Waiting for peer connection...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check player count on both sides - wait for them to appear first
    try {
      await page1.waitForSelector('.player-item', { timeout: 5000 });
      await page2.waitForSelector('.player-item', { timeout: 5000 });
    } catch (e) {
      console.log('Players not rendered yet');
    }
    
    const hostPlayerCount = await page1.$$eval('.player-item', items => items.length);
    const guestPlayerCount = await page2.$$eval('.player-item', items => items.length);
    
    console.log(`Host sees ${hostPlayerCount} player(s)`);
    console.log(`Guest sees ${guestPlayerCount} player(s)`);
    
    if (hostPlayerCount === 2 && guestPlayerCount === 2) {
      console.log('✅ Connection successful!');
    } else {
      console.log('❌ Connection failed - players not synced');
      
      // Try to get more debug info
      const hostPlayers = await page1.$$eval('.player-name', els => els.map(el => el.textContent));
      const guestPlayers = await page2.$$eval('.player-name', els => els.map(el => el.textContent));
      
      console.log('Host sees players:', hostPlayers);
      console.log('Guest sees players:', guestPlayers);
    }
    
    // Keep browsers open for manual inspection
    console.log('\n⏸ Keeping browsers open for 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
};

runDebugTest();