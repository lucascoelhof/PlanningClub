import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { argv } from 'process';

// Configuration
const SITE_URL = 'https://lucascoelhof.github.io/PlanningClub/';
const TIMEOUT = 600000; // Increased to 10 minutes (600 seconds)
const DEBUG = process.env.DEBUG === 'true';

// Main test function
const runTests = async () => {
  console.log('🧪 Planning Club Comprehensive Test Suite');
  console.log('Testing against:', SITE_URL);
  console.log('Debug mode:', DEBUG ? 'ON' : 'OFF');
  console.log('=========================================\n');
  
  let browser1, browser2, browser3;
  let page1, page2, page3;
  let sessionId;
  const results = { passed: 0, failed: 0, errors: [] };
  
  // Test runner
  const runTest = async (name, fn) => {
    console.log(`\n📋 Testing: ${name}`);
    try {
      await fn();
      console.log(`✅ PASSED: ${name}`);
      results.passed++;
    } catch (error) {
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      results.failed++;
      results.errors.push({ test: name, error: error.message });
      
      // Take screenshots on failure if in debug mode
      if (DEBUG && page1) {
        try {
          await page1.screenshot({ path: `test-failure-${Date.now()}-page1.png` });
          await page2?.screenshot({ path: `test-failure-${Date.now()}-page2.png` });
          console.log('   Screenshots saved');
        } catch (e) {}
      }
    }
  };
  
  // Helper functions
  const expect = (value) => ({
    toContain: (expected) => {
      if (Array.isArray(value)) {
        if (!value.includes(expected)) {
          throw new Error(`Expected array to contain "${expected}", but got: ${JSON.stringify(value)}`);
        }
      } else if (typeof value === 'string') {
        if (!value.includes(expected)) {
          throw new Error(`Expected "${value}" to contain "${expected}"`);
        }
      }
    },
    toMatch: (pattern) => {
      if (!pattern.test(value)) {
        throw new Error(`Expected "${value}" to match ${pattern}`);
      }
    },
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${value} to be ${expected}`);
      }
    },
    toBeTruthy: () => {
      if (!value) {
        throw new Error(`Expected ${value} to be truthy`);
      }
    },
    toBeFalsy: () => {
      if (value) {
        throw new Error(`Expected ${value} to be falsy`);
      }
    },
    not: {
      toContain: (expected) => {
        if (Array.isArray(value)) {
          if (value.includes(expected)) {
            throw new Error(`Expected array not to contain "${expected}"`);
          }
        } else if (typeof value === 'string') {
          if (value.includes(expected)) {
            throw new Error(`Expected "${value}" not to contain "${expected}"`);
          }
        }
      }
    }
  });
  
  const getTextContent = async (page, selector) => {
    await page.waitForSelector(selector, { timeout: 30000 });
    return await page.$eval(selector, el => el.textContent);
  };
  
  const typeInField = async (page, selector, text) => {
    await page.waitForSelector(selector, { timeout: 30000 });
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, text);
  };
  
  const waitForPlayerCount = async (page, count) => {
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.player-card').length === expectedCount,
      { timeout: 45000 },
      count
    );
  };
  
  const getPlayerNames = async (page) => {
    return await page.$$eval('.player-name', 
      elements => elements.map(el => el.textContent.trim())
    );
  };
  
  try {
    // Setup browsers
    console.log('🚀 Setting up browsers...\n');
    const browserOptions = {
      headless: !DEBUG,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(DEBUG && { 
        devtools: false,
        slowMo: 50 
      })
    };
    
    browser1 = await puppeteer.launch(browserOptions);
    browser2 = await puppeteer.launch(browserOptions);
    browser3 = await puppeteer.launch(browserOptions);
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    page3 = await browser3.newPage();
    
    await page1.setViewport({ width: 1280, height: 800 });
    await page2.setViewport({ width: 1280, height: 800 });
    await page3.setViewport({ width: 1280, height: 800 });
    
    if (DEBUG) {
      [page1, page2, page3].forEach((page, i) => {
        page.on('console', msg => console.log(`[Browser ${i+1}]`, msg.text()));
        page.on('pageerror', error => console.error(`[Browser ${i+1} Error]`, error.message));
      });
    }
    
    // Test 1: Session creation and URL verification
    await runTest('Session creation has correct URL format', async () => {
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      
      // Create session
      await typeInField(page1, '#create-identity', 'Host Player');
      await page1.click('#create-form button[type="submit"]');
      
      // Wait for URL to update
      await page1.waitForFunction(
        () => window.location.search.includes('session='),
        { timeout: 15000 }
      );
      
      // Verify URL format
      const url = await page1.url();
      expect(url).toContain(SITE_URL);
      expect(url).toContain('?session=');
      
      // Extract and validate session ID
      const urlParams = new URLSearchParams(new URL(url).search);
      sessionId = urlParams.get('session');
      expect(sessionId).toMatch(/^\d{9}$/);
      
      console.log(`   Session created: ${sessionId}`);
      console.log(`   Full URL: ${url}`);
      
      // Verify game page loaded
      await page1.waitForSelector('.session-info');
      const sessionInfo = await getTextContent(page1, '.session-id');
      expect(sessionInfo).toContain(sessionId);
    });
    
    // Test 2: Join via home page form
    await runTest('User can join session via home page form', async () => {
      await page2.goto(SITE_URL, { waitUntil: 'networkidle2' });
      
      // Fill join form
      await typeInField(page2, '#join-session', sessionId);
      await typeInField(page2, '#join-identity', 'Guest Player');
      await page2.click('#join-form button[type="submit"]');
      
      // Wait for game page to load
      await page2.waitForSelector('.session-info', { timeout: 15000 });
      
      // Verify correct session
      const sessionInfo = await getTextContent(page2, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      // Verify URL updated
      const url = await page2.url();
      expect(url).toContain(`?session=${sessionId}`);
      
      console.log(`   Guest joined via form, URL: ${url}`);
    });
    
    // Test 3: Join via direct URL
    await runTest('User can join session via direct URL', async () => {
      const sessionUrl = `${SITE_URL}?session=${sessionId}`;
      await page3.goto(sessionUrl, { waitUntil: 'networkidle2' });
      
      // Should see join prompt
      await page3.waitForSelector('#join-prompt-form');
      await typeInField(page3, '#join-prompt-identity', 'Third Player');
      await page3.click('#join-prompt-form button[type="submit"]');
      
      // Wait for game page
      await page3.waitForSelector('.session-info', { timeout: 15000 });
      
      // Verify session
      const sessionInfo = await getTextContent(page3, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      console.log(`   Third player joined via URL`);
    });
    
    // Test 4: No duplicate names
    await runTest('No duplicate player names appear', async () => {
      // Wait for all players to sync
      await waitForPlayerCount(page1, 3);
      await waitForPlayerCount(page2, 3);
      await waitForPlayerCount(page3, 3);
      
      // Get player names from all perspectives
      const host_view = await getPlayerNames(page1);
      const guest_view = await getPlayerNames(page2);
      const third_view = await getPlayerNames(page3);
      
      console.log(`   Host sees: ${host_view}`);
      console.log(`   Guest sees: ${guest_view}`);
      console.log(`   Third sees: ${third_view}`);
      
      // Check no duplicates in each view
      const checkNoDuplicates = (names) => {
        const uniqueNames = [...new Set(names)];
        expect(names.length).toBe(uniqueNames.length);
      };
      
      checkNoDuplicates(host_view);
      checkNoDuplicates(guest_view);
      checkNoDuplicates(third_view);
      
      // All should see all 3 players
      expect(host_view.length).toBe(3);
      expect(guest_view.length).toBe(3);
      expect(third_view.length).toBe(3);
    });
    
    // Test 5: Refresh persistence
    await runTest('Refreshing tab persists login state', async () => {
      // Refresh page 2
      await page2.reload({ waitUntil: 'networkidle2' });
      
      // Should go directly to game (no login required)
      await page2.waitForSelector('.session-info', { timeout: 10000 });
      
      // Verify still in correct session
      const sessionInfo = await getTextContent(page2, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      // Should still see all players
      await waitForPlayerCount(page2, 3);
      const players = await getPlayerNames(page2);
      expect(players.length).toBe(3);
      
      console.log(`   After refresh, guest still sees: ${players}`);
    });
    
    // Test 6: Vote persistence after refresh
    await runTest('Vote selection persists after refresh', async () => {
      // Host votes for "5"
      await page1.waitForSelector('.vote-card');
      const hostCards = await page1.$$('.vote-card');
      await hostCards[5].click(); // "5" is typically at index 5
      
      // Verify vote is selected
      const selectedVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(selectedVote).toBe('5');
      
      // Refresh host page
      await page1.reload({ waitUntil: 'networkidle2' });
      
      // Should still be in session and vote should be restored
      await page1.waitForSelector('.session-info', { timeout: 10000 });
      await page1.waitForSelector('.vote-card.selected', { timeout: 5000 });
      
      const restoredVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(restoredVote).toBe('5');
      
      console.log(`   Vote selection restored after refresh: ${restoredVote}`);
    });
    
    // Test 7: Vote highlighting
    await runTest('Vote selection highlights correctly', async () => {
      // Host already voted for "5" in previous test, verify it's still selected
      await page1.waitForSelector('.vote-card.selected');
      const selectedCards = await page1.$$('.vote-card.selected');
      expect(selectedCards.length).toBe(1);
      
      // Get selected vote text
      const selectedVote = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(selectedVote).toBe('5');
      
      // Guest votes for "8"
      const guestCards = await page2.$$('.vote-card');
      await guestCards[6].click(); // "8" is typically at index 6
      
      await page2.waitForSelector('.vote-card.selected');
      const guestSelected = await page2.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(guestSelected).toBe('8');
      
      // Third player votes for "3"
      const thirdCards = await page3.$$('.vote-card');
      await thirdCards[4].click(); // "3" is typically at index 4
      
      await page3.waitForSelector('.vote-card.selected');
      const thirdSelected = await page3.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(thirdSelected).toBe('3');
      
      console.log(`   Host voted: ${selectedVote}, Guest voted: ${guestSelected}, Third voted: ${thirdSelected}`);
    });
    
    // Test 8: Voting statistics appear after all vote
    await runTest('Voting statistics appear for all users after everyone votes', async () => {
      // Wait for all votes to sync
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check that all players show as voted
      await page1.waitForFunction(
        () => document.querySelectorAll('.player-card.voted').length === 3,
        { timeout: 10000 }
      );
      
      // Host shows votes
      await page1.click('#show-votes');
      
      // Wait longer for vote revealing to sync to all players
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // All pages should now show revealed votes
      const checkVotesRevealed = async (page, pageName) => {
        await page.waitForSelector('.player-vote', { timeout: 15000 });
        
        // Get all player-vote elements with debug info
        const allVoteElements = await page.$$eval('.player-vote', 
          els => els.map(el => ({
            text: el.textContent.trim(),
            visible: window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden'
          }))
        );
        console.log(`   ${pageName} all vote elements:`, allVoteElements);
        
        const votes = allVoteElements
          .filter(el => el.visible && el.text && el.text !== '✓')
          .map(el => el.text);
        
        console.log(`   ${pageName} sees revealed votes: ${votes}`);
        
        expect(votes.length).toBe(3);
        expect(votes).toContain('5');
        expect(votes).toContain('8');
        expect(votes).toContain('3');
        return votes;
      };
      
      await checkVotesRevealed(page1, 'Host');
      await checkVotesRevealed(page2, 'Guest');
      await checkVotesRevealed(page3, 'Third');
      
      // Check statistics section appears
      await page1.waitForSelector('.voting-stats-section');
      await page2.waitForSelector('.voting-stats-section');
      await page3.waitForSelector('.voting-stats-section');
    });
    
    // Test 9: Vote changes update statistics for all users
    await runTest('Changing vote updates statistics for all users', async () => {
      // Host changes vote from "5" to "13"
      const hostCards = await page1.$$('.vote-card');
      await hostCards[7].click(); // "13" is typically at index 7
      
      // Wait for new selection
      await page1.waitForSelector('.vote-card.selected');
      const newSelection = await page1.$eval('.vote-card.selected', el => el.textContent.trim());
      expect(newSelection).toBe('13');
      
      // Wait for votes to sync and update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check all pages show updated votes
      const checkUpdatedVotes = async (page, pageName) => {
        const votes = await page.$$eval('.player-vote', 
          els => els.map(el => el.textContent.trim()).filter(vote => vote && vote !== '✓')
        );
        expect(votes.length).toBe(3);
        expect(votes).toContain('13'); // Host's new vote
        expect(votes).toContain('8');  // Guest's vote unchanged
        expect(votes).toContain('3');  // Third's vote unchanged
        expect(votes).not.toContain('5'); // Host's old vote should be gone
        console.log(`   ${pageName} sees updated votes: ${votes}`);
      };
      
      await checkUpdatedVotes(page1, 'Host');
      await checkUpdatedVotes(page2, 'Guest');
      await checkUpdatedVotes(page3, 'Third');
    });
    
    // Test 10: Clear votes functionality
    await runTest('Clear votes removes highlighting and statistics for all users', async () => {
      // Host clears votes
      await page1.click('#clear-votes');
      
      // Wait for clear to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check all pages have cleared votes
      const checkVotesCleared = async (page, pageName) => {
        // Wait for votes to be cleared (should have no .player-vote elements with actual votes)
        await page.waitForFunction(
          () => {
            const playerItems = document.querySelectorAll('.player-card');
            // Check that no player shows a vote (neither ✓ nor actual vote)
            for (let item of playerItems) {
              const voteElement = item.querySelector('.player-vote');
              if (voteElement && voteElement.textContent.trim()) {
                return false;
              }
            }
            return true;
          },
          { timeout: 10000 }
        );
        
        // No cards should be selected
        const selectedCards = await page.$$('.vote-card.selected');
        expect(selectedCards.length).toBe(0);
        
        // Stats content should be hidden
        const statsContent = await page.$('.stats-content');
        const isHidden = await statsContent?.evaluate(el => el.style.display === 'none');
        expect(isHidden).toBeTruthy();
        
        console.log(`   ${pageName} votes cleared successfully`);
      };
      
      await checkVotesCleared(page1, 'Host');
      await checkVotesCleared(page2, 'Guest');
      await checkVotesCleared(page3, 'Third');
    });
    
  } catch (error) {
    console.error('\n💥 Test suite error:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    const cleanup = async (browser, name) => {
      if (browser) {
        try {
          await browser.close();
          console.log(`   ${name} browser closed`);
        } catch (e) {
          console.log(`   ${name} browser cleanup failed`);
        }
      }
    };
    
    await cleanup(browser1, 'Browser 1');
    await cleanup(browser2, 'Browser 2');
    await cleanup(browser3, 'Browser 3');
    
    // Print final results
    console.log('\n=========================================');
    console.log('🏁 TEST RESULTS SUMMARY');
    console.log('=========================================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total:  ${results.passed + results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\n📋 FAILED TESTS:');
      results.errors.forEach(({ test, error }, index) => {
        console.log(`${index + 1}. ${test}`);
        console.log(`   💡 ${error}\n`);
      });
    }
    
    if (results.failed === 0) {
      console.log('\n🎉 All tests passed! Planning Club is working correctly.');
    } else {
      console.log(`\n⚠️  ${results.failed} test(s) failed. Check the errors above.`);
    }
    
    console.log('=========================================\n');
    
    process.exit(results.failed > 0 ? 1 : 0);
  }
};

// Check if running as main module
if (argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export default runTests;