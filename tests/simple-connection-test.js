import puppeteer from 'puppeteer';

const SITE_URL = 'https://lucascoelhof.github.io/PlanningClub/';

const simpleTest = async () => {
  console.log('Simple Connection Test');
  console.log('=====================\n');
  
  let browser1, browser2;
  
  try {
    // Launch browsers
    browser1 = await puppeteer.launch({ headless: true });
    browser2 = await puppeteer.launch({ headless: true });
    
    const page1 = await browser1.newPage();
    const page2 = await browser2.newPage();
    
    // Test 1: Create session
    console.log('1. Creating session...');
    await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
    await page1.waitForSelector('#create-identity', { timeout: 10000 });
    await page1.type('#create-identity', 'Host');
    await page1.click('#create-form button[type="submit"]');
    
    // Wait for URL change
    await page1.waitForFunction(
      () => window.location.search.includes('session='),
      { timeout: 15000 }
    );
    
    const url = await page1.url();
    const sessionId = new URL(url).searchParams.get('session');
    console.log(`   ✓ Session created: ${sessionId}`);
    
    // Test 2: Join via form
    console.log('2. Joining via form...');
    await page2.goto(SITE_URL, { waitUntil: 'networkidle2' });
    await page2.waitForSelector('#join-session', { timeout: 10000 });
    await page2.type('#join-session', sessionId);
    await page2.type('#join-identity', 'Guest');
    await page2.click('#join-form button[type="submit"]');
    
    // Check if URL updated
    await new Promise(resolve => setTimeout(resolve, 5000));
    const guestUrl = await page2.url();
    
    if (guestUrl.includes(`session=${sessionId}`)) {
      console.log(`   ✓ Guest joined successfully`);
    } else {
      console.log(`   ✗ Guest URL didn't update: ${guestUrl}`);
    }
    
    // Test 3: Check players
    console.log('3. Checking player sync...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const hostPlayers = await page1.$$eval('.player-name', 
      els => els.map(el => el.textContent.trim())
    ).catch(() => []);
    
    const guestPlayers = await page2.$$eval('.player-name', 
      els => els.map(el => el.textContent.trim())
    ).catch(() => []);
    
    console.log(`   Host sees: ${JSON.stringify(hostPlayers)}`);
    console.log(`   Guest sees: ${JSON.stringify(guestPlayers)}`);
    
    if (hostPlayers.length === 2 && guestPlayers.length === 2) {
      console.log('   ✓ Players synced!');
    } else {
      console.log('   ✗ Players not synced');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
};

simpleTest();