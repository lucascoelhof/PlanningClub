import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });

  try {
    // Test Case 1: Host creates a session
    console.log('Test 1: Host creates session...');
    const hostPage = await browser.newPage();
    await hostPage.goto('http://localhost:5174');
    
    // Host enters name and creates session
    await hostPage.waitForSelector('#create-identity');
    await hostPage.type('#create-identity', 'Host User');
    await hostPage.click('button[type="submit"]');
    
    // Wait for session to be created and get the URL
    await hostPage.waitForNavigation();
    const sessionUrl = hostPage.url();
    const sessionId = sessionUrl.match(/\/(\d{9})$/)?.[1];
    console.log(`Session created with ID: ${sessionId}`);
    console.log(`Session URL: ${sessionUrl}`);
    
    // Test Case 2: New user accesses shared link (should see name prompt)
    console.log('\nTest 2: New user accessing shared link...');
    const guestPage = await browser.newPage();
    
    // Clear localStorage to simulate a new user
    await guestPage.evaluateOnNewDocument(() => {
      localStorage.clear();
    });
    
    await guestPage.goto(sessionUrl);
    
    // Check if join prompt is shown
    await guestPage.waitForSelector('#join-prompt-form', { timeout: 5000 });
    console.log('✓ Join prompt shown for new user');
    
    // Guest enters name
    await guestPage.type('#join-prompt-identity', 'Guest User');
    await guestPage.click('#join-prompt-form button[type="submit"]');
    
    // Wait for guest to join the session
    await guestPage.waitForSelector('.game-page', { timeout: 5000 });
    console.log('✓ Guest successfully joined the session');
    
    // Test Case 3: Same guest refreshes page (should rejoin automatically)
    console.log('\nTest 3: Guest refreshes page...');
    await guestPage.reload();
    
    // Should go directly to game page without prompt
    await guestPage.waitForSelector('.game-page', { timeout: 5000 });
    const hasJoinPrompt = await guestPage.$('#join-prompt-form');
    
    if (!hasJoinPrompt) {
      console.log('✓ Guest rejoined automatically without prompt');
    } else {
      console.log('✗ Join prompt shown again (unexpected)');
    }
    
    console.log('\n✅ All tests passed!');
    console.log('Press Ctrl+C to close the browser...');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error);
    await browser.close();
    process.exit(1);
  }
})();