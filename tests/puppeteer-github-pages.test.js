import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { argv } from 'process';

// Configuration
const SITE_URL = 'https://lucascoelhof.github.io/PlanningClub/';
const TIMEOUT = 30000; // 30 seconds timeout for operations
const DEBUG = process.env.DEBUG === 'true'; // Set DEBUG=true to see browser

// Main test function
const runTests = async () => {
  console.log('Starting Planning Club Multiplayer Tests...');
  console.log('Testing against:', SITE_URL);
  console.log('Debug mode:', DEBUG ? 'ON' : 'OFF');
  console.log('-----------------------------------\n');
  
  let browser1, browser2, page1, page2, sessionId;
  const results = { passed: 0, failed: 0, errors: [] };
  
  // Test runner
  const runTest = async (name, fn) => {
    console.log(`\nRunning: ${name}`);
    try {
      await fn();
      console.log(`✓ ${name}`);
      results.passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(error.message);
      results.failed++;
      results.errors.push({ test: name, error: error.message });
    }
  };
  
  // Mock expect functions
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
  
  // Helper functions
  const getTextContent = async (page, selector) => {
    await page.waitForSelector(selector, { timeout: 10000 });
    return await page.$eval(selector, el => el.textContent);
  };
  
  const typeInField = async (page, selector, text) => {
    await page.waitForSelector(selector);
    // Clear existing text first
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, text);
  };
  
  try {
    // Setup
    console.log('Setting up browsers...');
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
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    
    await page1.setViewport({ width: 1280, height: 800 });
    await page2.setViewport({ width: 1280, height: 800 });
    
    if (DEBUG) {
      page1.on('console', msg => console.log('[Browser 1]', msg.text()));
      page2.on('console', msg => console.log('[Browser 2]', msg.text()));
      page1.on('pageerror', error => console.error('[Browser 1 Error]', error.message));
      page2.on('pageerror', error => console.error('[Browser 2 Error]', error.message));
    }
    
    // Test 1: Homepage loads
    await runTest('Homepage loads correctly', async () => {
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      const title = await getTextContent(page1, 'h1');
      expect(title).toContain('Planning Club');
      await page1.waitForSelector('#create-identity');
      await page1.waitForSelector('#join-identity');
    });
    
    // Test 2: Host creates session
    await runTest('Host creates session', async () => {
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      await typeInField(page1, '#create-identity', 'Host Player');
      await page1.click('#create-form button[type="submit"]');
      
      // Wait for URL to update with session ID
      await page1.waitForFunction(
        () => window.location.search.includes('session='),
        { timeout: 15000 }
      );
      
      const url = await page1.url();
      const urlParams = new URLSearchParams(new URL(url).search);
      sessionId = urlParams.get('session');
      
      console.log(`  Created session: ${sessionId}`);
      expect(sessionId).toMatch(/^\d{9}$/);
      
      // Wait for game page to load
      await page1.waitForSelector('.session-info', { timeout: 10000 });
      const sessionInfo = await getTextContent(page1, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      // Check host player appears
      await page1.waitForSelector('.player-item');
      const playerName = await getTextContent(page1, '.player-name');
      expect(playerName).toContain('Host Player');
    });
    
    // Test 3: Guest joins session
    await runTest('Guest joins session', async () => {
      const sessionUrl = `${SITE_URL}?session=${sessionId}`;
      console.log(`  Joining session: ${sessionUrl}`);
      
      await page2.goto(sessionUrl, { waitUntil: 'networkidle2' });
      
      // Wait for join prompt
      await page2.waitForSelector('#join-prompt-form', { timeout: 10000 });
      await typeInField(page2, '#join-prompt-identity', 'Guest Player');
      await page2.click('#join-prompt-form button[type="submit"]');
      
      // Wait for game page to load
      await page2.waitForSelector('.session-info', { timeout: 15000 });
      
      // Verify session ID
      const sessionInfo = await getTextContent(page2, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      // Wait for players to appear
      await page2.waitForFunction(
        () => document.querySelectorAll('.player-item').length >= 2,
        { timeout: 20000 }
      );
      
      const playerCount = await page2.$$eval('.player-item', items => items.length);
      console.log(`  Guest sees ${playerCount} players`);
    });
    
    // Test 4: Both players see each other
    await runTest('Both players see each other', async () => {
      // Give some time for synchronization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Wait for host to see guest
      await page1.waitForFunction(
        () => document.querySelectorAll('.player-item').length >= 2,
        { timeout: 15000 }
      );
      
      const hostViewPlayers = await page1.$$eval('.player-name', 
        elements => elements.map(el => el.textContent.trim())
      );
      const guestViewPlayers = await page2.$$eval('.player-name', 
        elements => elements.map(el => el.textContent.trim())
      );
      
      console.log('  Host sees:', hostViewPlayers);
      console.log('  Guest sees:', guestViewPlayers);
      
      expect(hostViewPlayers.length).toBe(2);
      expect(guestViewPlayers.length).toBe(2);
      
      // Check both see both names
      expect(hostViewPlayers.some(p => p.includes('Host Player'))).toBe(true);
      expect(hostViewPlayers.some(p => p.includes('Guest Player'))).toBe(true);
      expect(guestViewPlayers.some(p => p.includes('Host Player'))).toBe(true);
      expect(guestViewPlayers.some(p => p.includes('Guest Player'))).toBe(true);
    });
    
    // Test 5: Voting works
    await runTest('Players can vote', async () => {
      // Host votes 5
      const hostVoteCards = await page1.$$('.vote-card');
      if (hostVoteCards.length > 5) {
        await hostVoteCards[5].click(); // Click the "5" card
        await page1.waitForSelector('.vote-card.selected');
      }
      
      // Guest votes 8  
      const guestVoteCards = await page2.$$('.vote-card');
      if (guestVoteCards.length > 6) {
        await guestVoteCards[6].click(); // Click the "8" card
        await page2.waitForSelector('.vote-card.selected');
      }
      
      // Wait for votes to sync
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check both show as voted
      const hostVoted = await page1.$$('.player-item.voted');
      const guestVoted = await page2.$$('.player-item.voted');
      
      console.log(`  Host sees ${hostVoted.length} players voted`);
      console.log(`  Guest sees ${guestVoted.length} players voted`);
      
      expect(hostVoted.length).toBe(2);
      expect(guestVoted.length).toBe(2);
    });
    
    // Test 6: Show votes
    await runTest('Show votes reveals all votes', async () => {
      // Host clicks show votes
      await page1.waitForSelector('#show-votes-btn');
      await page1.click('#show-votes-btn');
      
      // Wait for votes to be revealed
      await page1.waitForSelector('.player-vote:not(.placeholder)', { timeout: 10000 });
      await page2.waitForSelector('.player-vote:not(.placeholder)', { timeout: 10000 });
      
      // Get revealed votes
      const hostViewVotes = await page1.$$eval('.player-vote:not(.placeholder)', 
        elements => elements.map(el => el.textContent.trim())
      );
      const guestViewVotes = await page2.$$eval('.player-vote:not(.placeholder)', 
        elements => elements.map(el => el.textContent.trim())
      );
      
      console.log('  Host sees votes:', hostViewVotes);
      console.log('  Guest sees votes:', guestViewVotes);
      
      // Both should see both votes
      expect(hostViewVotes.some(v => v === '5')).toBe(true);
      expect(hostViewVotes.some(v => v === '8')).toBe(true);
      expect(guestViewVotes.some(v => v === '5')).toBe(true);
      expect(guestViewVotes.some(v => v === '8')).toBe(true);
    });
    
    // Test 7: Clear votes
    await runTest('Clear votes resets the round', async () => {
      // Host clicks clear votes
      await page1.waitForSelector('#clear-votes-btn');
      await page1.click('#clear-votes-btn');
      
      // Wait for votes to clear
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check votes are cleared
      await page1.waitForSelector('.player-vote.placeholder');
      await page2.waitForSelector('.player-vote.placeholder');
      
      const hostPlaceholders = await page1.$$('.player-vote.placeholder');
      const guestPlaceholders = await page2.$$('.player-vote.placeholder');
      
      expect(hostPlaceholders.length).toBe(2);
      expect(guestPlaceholders.length).toBe(2);
      
      // Check no cards selected
      const hostSelected = await page1.$$('.vote-card.selected');
      const guestSelected = await page2.$$('.vote-card.selected');
      
      expect(hostSelected.length).toBe(0);
      expect(guestSelected.length).toBe(0);
    });
    
  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    if (page1) await page1.close().catch(() => {});
    if (page2) await page2.close().catch(() => {});
    if (browser1) await browser1.close().catch(() => {});
    if (browser2) await browser2.close().catch(() => {});
    
    // Print results
    console.log('\n===================================');
    console.log('Test Results Summary:');
    console.log(`✓ Passed: ${results.passed}`);
    console.log(`✗ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\nFailed tests:');
      results.errors.forEach(({ test, error }) => {
        console.log(`  ✗ ${test}`);
        console.log(`    ${error}`);
      });
    }
    
    console.log('===================================\n');
    
    process.exit(results.failed > 0 ? 1 : 0);
  }
};

// Check if running as main module
if (argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default runTests;