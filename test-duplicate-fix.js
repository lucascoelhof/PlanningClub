import puppeteer from 'puppeteer';

const SITE_URL = 'http://localhost:3000/RapidPlanning/';

const testDuplicatePlayersFix = async () => {
  console.log('🧪 Testing Duplicate Players Fix');
  console.log('Testing against:', SITE_URL);
  console.log('================================\n');

  let browser1, browser2, page1, page2;
  let sessionId;

  try {
    console.log('🚀 Setting up browsers...\n');
    
    browser1 = await puppeteer.launch({ headless: true });
    browser2 = await puppeteer.launch({ headless: true });
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();

    // Test 1: Create session with host
    console.log('📋 Testing: Create session and join');
    
    await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
    await page1.waitForSelector('#create-identity');
    await page1.type('#create-identity', 'Host Player');
    await page1.click('#create-form button[type="submit"]');
    
    await page1.waitForFunction(() => window.location.search.includes('session='));
    const url = await page1.url();
    sessionId = new URL(url).searchParams.get('session');
    console.log(`   Session created: ${sessionId}`);
    
    // Wait for host to appear in players list
    await page1.waitForSelector('.player-card', { timeout: 10000 });
    const hostPlayerCount = await page1.$$eval('.player-card', cards => cards.length);
    console.log(`   Host sees ${hostPlayerCount} player(s)`);
    
    // Guest joins
    await page2.goto(SITE_URL, { waitUntil: 'networkidle2' });
    await page2.waitForSelector('#join-session');
    await page2.type('#join-session', sessionId);
    await page2.type('#join-identity', 'Guest Player');
    await page2.click('#join-form button[type="submit"]');
    
    // Wait for both players to sync
    await page1.waitForFunction(() => document.querySelectorAll('.player-card').length === 2, { timeout: 15000 });
    await page2.waitForFunction(() => document.querySelectorAll('.player-card').length === 2, { timeout: 15000 });
    
    const hostPlayersAfterJoin = await page1.$$eval('.player-card', cards => cards.length);
    const guestPlayersAfterJoin = await page2.$$eval('.player-card', cards => cards.length);
    
    console.log(`   After join: Host sees ${hostPlayersAfterJoin}, Guest sees ${guestPlayersAfterJoin}`);
    
    if (hostPlayersAfterJoin !== 2 || guestPlayersAfterJoin !== 2) {
      throw new Error(`Expected both to see 2 players, but got host: ${hostPlayersAfterJoin}, guest: ${guestPlayersAfterJoin}`);
    }
    
    console.log('✅ PASSED: Session creation and joining\n');

    // Test 2: Refresh guest and check for duplicates
    console.log('📋 Testing: Guest refresh (critical test)');
    
    // Refresh guest browser
    await page2.reload({ waitUntil: 'networkidle2' });
    
    // Wait for page to fully load
    await page2.waitForSelector('.session-info', { timeout: 10000 });
    
    // Small delay to ensure all DOM updates are complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Count players in both browsers
    const hostPlayersAfterRefresh = await page1.$$eval('.player-card', cards => cards.length);
    const guestPlayersAfterRefresh = await page2.$$eval('.player-card', cards => cards.length);
    
    console.log(`   After guest refresh: Host sees ${hostPlayersAfterRefresh}, Guest sees ${guestPlayersAfterRefresh}`);
    
    // Get player names to check for duplicates
    const hostPlayerNames = await page1.$$eval('.player-name', 
      elements => elements.map(el => el.textContent.trim())
    );
    const guestPlayerNames = await page2.$$eval('.player-name', 
      elements => elements.map(el => el.textContent.trim())
    );
    
    console.log(`   Host sees players: ${hostPlayerNames.join(', ')}`);
    console.log(`   Guest sees players: ${guestPlayerNames.join(', ')}`);
    
    // Check for exact player count (should be 2)
    if (hostPlayersAfterRefresh !== 2) {
      throw new Error(`Host should see 2 players but sees ${hostPlayersAfterRefresh}`);
    }
    
    if (guestPlayersAfterRefresh !== 2) {
      throw new Error(`Guest should see 2 players but sees ${guestPlayersAfterRefresh} - DUPLICATE PLAYERS BUG!`);
    }
    
    // Check for no duplicate names
    const hostUniqueNames = [...new Set(hostPlayerNames)];
    const guestUniqueNames = [...new Set(guestPlayerNames)];
    
    if (hostUniqueNames.length !== hostPlayerNames.length) {
      throw new Error(`Host has duplicate player names: ${hostPlayerNames.join(', ')}`);
    }
    
    if (guestUniqueNames.length !== guestPlayerNames.length) {
      throw new Error(`Guest has duplicate player names: ${guestPlayerNames.join(', ')} - DUPLICATE PLAYERS BUG!`);
    }
    
    console.log('✅ PASSED: No duplicate players after refresh\n');

    // Test 3: Multiple refreshes
    console.log('📋 Testing: Multiple refreshes');
    
    for (let i = 0; i < 3; i++) {
      await page2.reload({ waitUntil: 'networkidle2' });
      await page2.waitForSelector('.session-info', { timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const playerCount = await page2.$$eval('.player-card', cards => cards.length);
      console.log(`   Refresh ${i + 1}: Guest sees ${playerCount} player(s)`);
      
      if (playerCount !== 2) {
        throw new Error(`After refresh ${i + 1}, expected 2 players but got ${playerCount}`);
      }
    }
    
    console.log('✅ PASSED: Multiple refreshes maintain correct player count\n');

  } catch (error) {
    console.error(`❌ FAILED: ${error.message}\n`);
    return false;
  } finally {
    console.log('🧹 Cleaning up...');
    if (page1) await page1.close();
    if (page2) await page2.close();
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }

  console.log('🎉 All duplicate player tests passed!');
  console.log('✅ The duplicate players bug has been fixed.');
  return true;
};

testDuplicatePlayersFix();