import puppeteer from 'puppeteer';

const SITE_URL = process.env.LOCAL_TEST === 'true' ? 'http://localhost:3000/RapidPlanning/' : 'https://lucascoelhof.github.io/RapidPlanning/';
const DEBUG = process.env.DEBUG === 'true';

const refreshPersistenceTest = async () => {
  console.log('🧪 Refresh Persistence Test Suite');
  console.log('Testing against:', SITE_URL);
  console.log('Debug mode:', DEBUG ? 'ON' : 'OFF');
  console.log('================================\n');

  let browser1, browser2, page1, page2;
  let sessionId;
  let testsPassed = 0;
  let testsFailed = 0;

  const runTest = async (testName, testFn) => {
    console.log(`📋 Testing: ${testName}`);
    try {
      await testFn();
      console.log(`✅ PASSED: ${testName}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      console.log(`   💡 ${error.message}\n`);
      testsFailed++;
    }
  };

  const expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    }
  });

  const getPlayerNames = async (page) => {
    return await page.$$eval('.player-name', 
      elements => elements.map(el => el.textContent.trim())
    ).catch(() => []);
  };

  const getTextContent = async (page, selector) => {
    return await page.$eval(selector, el => el.textContent.trim()).catch(() => '');
  };

  const waitForPlayerCount = async (page, count, timeout = 15000) => {
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.player-card').length === expectedCount,
      { timeout },
      count
    );
  };

  try {
    console.log('🚀 Setting up browsers...\n');

    const browserOptions = DEBUG 
      ? { headless: false, devtools: true, slowMo: 100 }
      : { headless: true };

    browser1 = await puppeteer.launch(browserOptions);
    browser2 = await puppeteer.launch(browserOptions);
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    
    if (DEBUG) {
      page1.on('console', msg => console.log('[Browser 1]', msg.text()));
      page2.on('console', msg => console.log('[Browser 2]', msg.text()));
    }

    // Test 1: Create session and join
    await runTest('Session creation and joining', async () => {
      // Host creates session
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      await page1.waitForSelector('#create-identity');
      await page1.type('#create-identity', 'Host Player');
      await page1.click('#create-form button[type="submit"]');
      
      await page1.waitForFunction(() => window.location.search.includes('session='));
      const url = await page1.url();
      sessionId = new URL(url).searchParams.get('session');
      console.log(`   Session created: ${sessionId}`);
      
      // Guest joins
      await page2.goto(SITE_URL, { waitUntil: 'networkidle2' });
      await page2.waitForSelector('#join-session');
      await page2.type('#join-session', sessionId);
      await page2.type('#join-identity', 'Guest Player');
      await page2.click('#join-form button[type="submit"]');
      
      // Wait for both to sync
      await waitForPlayerCount(page1, 2);
      await waitForPlayerCount(page2, 2);
    });

    // Test 2: Vote persistence on refresh
    await runTest('Vote selection persists after refresh', async () => {
      // Host votes
      await page1.waitForSelector('.vote-card');
      const hostCards = await page1.$$('.vote-card');
      await hostCards[5].click(); // "5" is at index 5
      
      // Verify vote is selected
      const selectedVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(selectedVote).toBe('5');
      
      // Refresh host page
      await page1.reload({ waitUntil: 'networkidle2' });
      
      // Should still be in session
      await page1.waitForSelector('.session-info', { timeout: 10000 });
      const sessionInfo = await getTextContent(page1, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      // Vote selection should be restored
      await page1.waitForSelector('.vote-card.selected', { timeout: 5000 });
      const restoredVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(restoredVote).toBe('5');
      
      console.log('   ✓ Vote selection restored after refresh');
    });

    // Test 3: Vote reveal state persistence
    await runTest('Vote reveal state persists after refresh', async () => {
      // Guest votes to trigger reveal
      await page2.waitForSelector('.vote-card');
      const guestCards = await page2.$$('.vote-card');
      await guestCards[6].click(); // "8"
      
      // Wait for auto-reveal
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check votes are revealed on both pages
      await page1.waitForSelector('.player-vote', { timeout: 10000 });
      await page2.waitForSelector('.player-vote', { timeout: 10000 });
      
      const hostVotes = await page1.$$eval('.player-vote', 
        els => els.map(el => el.textContent.trim()).filter(v => v && v !== '✓')
      );
      const guestVotes = await page2.$$eval('.player-vote', 
        els => els.map(el => el.textContent.trim()).filter(v => v && v !== '✓')
      );
      
      expect(hostVotes.length).toBe(2);
      expect(guestVotes.length).toBe(2);
      console.log('   Host sees votes:', hostVotes);
      console.log('   Guest sees votes:', guestVotes);
      
      // Refresh guest page
      await page2.reload({ waitUntil: 'networkidle2' });
      
      // Should still be in session and votes should be revealed
      await page2.waitForSelector('.session-info', { timeout: 10000 });
      await page2.waitForSelector('.player-vote', { timeout: 10000 });
      
      const restoredVotes = await page2.$$eval('.player-vote', 
        els => els.map(el => el.textContent.trim()).filter(v => v && v !== '✓')
      );
      
      expect(restoredVotes.length).toBe(2);
      console.log('   ✓ Vote reveal state restored after refresh');
    });

    // Test 4: Reaction persistence  
    await runTest('Reaction persists after refresh', async () => {
      // Host sets reaction
      await page1.waitForSelector('.reaction-btn');
      const reactionBtns = await page1.$$('.reaction-btn');
      await reactionBtns[0].click(); // First reaction emoji
      
      // Verify reaction is selected
      const selectedReaction = await page1.$('.reaction-btn.active');
      expect(selectedReaction).toBeTruthy;
      
      const reactionText = await selectedReaction.evaluate(el => el.textContent.trim());
      console.log('   Host selected reaction:', reactionText);
      
      // Refresh host page
      await page1.reload({ waitUntil: 'networkidle2' });
      
      // Should still be in session
      await page1.waitForSelector('.session-info', { timeout: 10000 });
      
      // Reaction should be restored
      await page1.waitForSelector('.reaction-btn.active', { timeout: 5000 });
      const restoredReaction = await page1.$eval('.reaction-btn.active', el => el.textContent.trim());
      expect(restoredReaction).toBe(reactionText);
      
      console.log('   ✓ Reaction restored after refresh');
    });

    // Test 5: Clear votes state persistence
    await runTest('Clear votes state persists after refresh', async () => {
      // Clear votes
      await page1.waitForSelector('#clear-votes');
      await page1.click('#clear-votes');
      
      // Wait for votes to be cleared
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify no votes are selected
      const selectedCards = await page1.$$('.vote-card.selected');
      expect(selectedCards.length).toBe(0);
      
      const playerVotes = await page1.$$('.player-vote');
      expect(playerVotes.length).toBe(0);
      
      // Refresh host page
      await page1.reload({ waitUntil: 'networkidle2' });
      
      // Should still be in session
      await page1.waitForSelector('.session-info', { timeout: 10000 });
      
      // No votes should be selected
      const restoredSelectedCards = await page1.$$('.vote-card.selected');
      expect(restoredSelectedCards.length).toBe(0);
      
      const restoredPlayerVotes = await page1.$$('.player-vote');
      expect(restoredPlayerVotes.length).toBe(0);
      
      console.log('   ✓ Clear votes state restored after refresh');
    });

    // Test 6: Multiple refresh cycles
    await runTest('Multiple refresh cycles maintain consistency', async () => {
      // Vote again
      await page1.waitForSelector('.vote-card');
      const hostCards = await page1.$$('.vote-card');
      await hostCards[7].click(); // "13"
      
      // Refresh multiple times
      for (let i = 0; i < 3; i++) {
        await page1.reload({ waitUntil: 'networkidle2' });
        await page1.waitForSelector('.session-info', { timeout: 10000 });
        
        const selectedVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
        expect(selectedVote).toBe('13');
      }
      
      console.log('   ✓ State consistent across multiple refreshes');
    });

  } catch (error) {
    console.error('Setup error:', error.message);
    testsFailed++;
  } finally {
    console.log('🧹 Cleaning up...');
    if (page1) await page1.close();
    if (page2) await page2.close();
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }

  console.log('\n=========================================');
  console.log('🏁 REFRESH PERSISTENCE TEST RESULTS');
  console.log('=========================================');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total:  ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n🎉 All refresh persistence tests passed!');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed.`);
    process.exit(1);
  }
};

refreshPersistenceTest();