import puppeteer from 'puppeteer';

// Configuration
const SITE_URL = 'https://lucascoelhof.github.io/RapidPlanning/';
const TIMEOUT = 30000; // 30 seconds timeout for operations
const DEBUG = process.env.DEBUG === 'true'; // Set DEBUG=true to see browser

describe('RapidPlanning Multiplayer Tests', () => {
  let browser1, browser2;
  let page1, page2;
  let sessionId;

  // Helper function to wait and get text content
  const getTextContent = async (page, selector) => {
    await page.waitForSelector(selector, { timeout: 10000 });
    return await page.$eval(selector, el => el.textContent);
  };

  // Helper function to type in input field
  const typeInField = async (page, selector, text) => {
    await page.waitForSelector(selector);
    await page.click(selector);
    await page.type(selector, text);
  };

  beforeAll(async () => {
    // Launch two browser instances
    const browserOptions = {
      headless: !DEBUG,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(DEBUG && { 
        devtools: true,
        slowMo: 100 
      })
    };

    browser1 = await puppeteer.launch(browserOptions);
    browser2 = await puppeteer.launch(browserOptions);

    page1 = await browser1.newPage();
    page2 = await browser2.newPage();

    // Set viewport
    await page1.setViewport({ width: 1280, height: 800 });
    await page2.setViewport({ width: 1280, height: 800 });

    // Enable console logging for debugging
    if (DEBUG) {
      page1.on('console', msg => console.log('Browser 1:', msg.text()));
      page2.on('console', msg => console.log('Browser 2:', msg.text()));
      
      page1.on('pageerror', error => console.error('Browser 1 Error:', error));
      page2.on('pageerror', error => console.error('Browser 2 Error:', error));
    }
  }, TIMEOUT);

  afterAll(async () => {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  });

  test('should load the homepage', async () => {
    await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
    
    // Check if the main title is present
    const title = await getTextContent(page1, 'h1');
    expect(title).toContain('RapidPlanning');
    
    // Check if create and join buttons exist
    await page1.waitForSelector('#create-identity');
    await page1.waitForSelector('#join-identity');
  }, TIMEOUT);

  test('Host should create a session', async () => {
    console.log('Creating session as host...');
    
    // Navigate to site
    await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
    
    // Enter name for host
    await typeInField(page1, '#create-identity', 'Host Player');
    
    // Click create session button
    await page1.click('#create-form button[type="submit"]');
    
    // Wait for session to be created and URL to update
    await page1.waitForFunction(
      () => window.location.search.includes('session='),
      { timeout: 15000 }
    );
    
    // Get the session ID from URL
    const url = await page1.url();
    const urlParams = new URLSearchParams(new URL(url).search);
    sessionId = urlParams.get('session');
    
    console.log('Session created with ID:', sessionId);
    expect(sessionId).toMatch(/^\d{9}$/);
    
    // Verify we're on the game page
    await page1.waitForSelector('.session-info');
    const sessionInfo = await getTextContent(page1, '.session-id');
    expect(sessionInfo).toContain(sessionId);
    
    // Check that host player is shown
    await page1.waitForSelector('.player-card');
    const playerName = await getTextContent(page1, '.player-name');
    expect(playerName).toContain('Host Player');
  }, TIMEOUT);

  test('Guest should join the session', async () => {
    console.log('Joining session as guest...');
    
    // Navigate to the session URL directly
    const sessionUrl = `${SITE_URL}?session=${sessionId}`;
    await page2.goto(sessionUrl, { waitUntil: 'networkidle2' });
    
    // Should see join prompt
    await page2.waitForSelector('#join-prompt-form');
    
    // Enter name for guest
    await typeInField(page2, '#join-prompt-identity', 'Guest Player');
    
    // Click join button
    await page2.click('#join-prompt-form button[type="submit"]');
    
    // Wait for game page to load
    await page2.waitForSelector('.session-info', { timeout: 15000 });
    
    // Verify session ID matches
    const sessionInfo = await getTextContent(page2, '.session-id');
    expect(sessionInfo).toContain(sessionId);
    
    // Wait for both players to appear
    await page2.waitForFunction(
      () => document.querySelectorAll('.player-card').length >= 2,
      { timeout: 15000 }
    );
    
    // Verify both players are visible on guest's screen
    const playerNames = await page2.$$eval('.player-name', 
      elements => elements.map(el => el.textContent)
    );
    expect(playerNames).toContain('Host Player');
    expect(playerNames).toContain('Guest Player');
    
    console.log('Guest successfully joined. Players:', playerNames);
  }, TIMEOUT);

  test('Both players should see each other', async () => {
    // Wait for host to see the guest
    await page1.waitForFunction(
      () => document.querySelectorAll('.player-card').length >= 2,
      { timeout: 15000 }
    );
    
    // Get player list from host's perspective
    const hostViewPlayers = await page1.$$eval('.player-name', 
      elements => elements.map(el => el.textContent)
    );
    
    // Get player list from guest's perspective
    const guestViewPlayers = await page2.$$eval('.player-name', 
      elements => elements.map(el => el.textContent)
    );
    
    console.log('Host sees players:', hostViewPlayers);
    console.log('Guest sees players:', guestViewPlayers);
    
    // Both should see both players
    expect(hostViewPlayers.length).toBe(2);
    expect(guestViewPlayers.length).toBe(2);
    expect(hostViewPlayers).toContain('Host Player');
    expect(hostViewPlayers).toContain('Guest Player');
    expect(guestViewPlayers).toContain('Host Player');
    expect(guestViewPlayers).toContain('Guest Player');
  }, TIMEOUT);

  test('Players should be able to vote', async () => {
    console.log('Testing voting functionality...');
    
    // Host votes 5
    await page1.waitForSelector('.vote-card');
    const hostVoteCards = await page1.$$('.vote-card');
    // Find and click the "5" card (should be at index 5)
    await hostVoteCards[5].click();
    
    // Verify host's vote is selected
    await page1.waitForSelector('.vote-card.selected');
    
    // Guest votes 8
    await page2.waitForSelector('.vote-card');
    const guestVoteCards = await page2.$$('.vote-card');
    // Find and click the "8" card (should be at index 6)
    await guestVoteCards[6].click();
    
    // Verify guest's vote is selected
    await page2.waitForSelector('.vote-card.selected');
    
    // Wait a moment for votes to sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that both players show as having voted
    const hostVotedPlayers = await page1.$$eval('.player-card.voted', 
      elements => elements.length
    );
    const guestVotedPlayers = await page2.$$eval('.player-card.voted', 
      elements => elements.length
    );
    
    expect(hostVotedPlayers).toBe(2);
    expect(guestVotedPlayers).toBe(2);
    
    console.log('Both players have voted successfully');
  }, TIMEOUT);

  test('Show votes should reveal all votes', async () => {
    console.log('Testing show votes functionality...');
    
    // Host clicks show votes
    await page1.click('#show-votes-btn');
    
    // Wait for votes to be revealed
    await page1.waitForSelector('.player-vote:not(.placeholder)', { timeout: 10000 });
    await page2.waitForSelector('.player-vote:not(.placeholder)', { timeout: 10000 });
    
    // Get revealed votes from both perspectives
    const hostViewVotes = await page1.$$eval('.player-vote:not(.placeholder)', 
      elements => elements.map(el => el.textContent.trim())
    );
    const guestViewVotes = await page2.$$eval('.player-vote:not(.placeholder)', 
      elements => elements.map(el => el.textContent.trim())
    );
    
    console.log('Host sees votes:', hostViewVotes);
    console.log('Guest sees votes:', guestViewVotes);
    
    // Both should see the votes
    expect(hostViewVotes).toContain('5');
    expect(hostViewVotes).toContain('8');
    expect(guestViewVotes).toContain('5');
    expect(guestViewVotes).toContain('8');
    
    // Check that stats are shown
    await page1.waitForSelector('.stats-section');
    await page2.waitForSelector('.stats-section');
  }, TIMEOUT);

  test('Clear votes should reset the round', async () => {
    console.log('Testing clear votes functionality...');
    
    // Host clicks clear votes
    await page1.click('#clear-votes-btn');
    
    // Wait for votes to be cleared
    await page1.waitForSelector('.player-vote.placeholder', { timeout: 10000 });
    await page2.waitForSelector('.player-vote.placeholder', { timeout: 10000 });
    
    // Verify no votes are selected
    const hostSelectedVotes = await page1.$$('.vote-card.selected');
    const guestSelectedVotes = await page2.$$('.vote-card.selected');
    
    expect(hostSelectedVotes.length).toBe(0);
    expect(guestSelectedVotes.length).toBe(0);
    
    // Verify stats are hidden
    const hostStatsVisible = await page1.$('.stats-section') !== null;
    const guestStatsVisible = await page2.$('.stats-section') !== null;
    
    expect(hostStatsVisible).toBe(false);
    expect(guestStatsVisible).toBe(false);
    
    console.log('Votes cleared successfully');
  }, TIMEOUT);

  test('Player disconnection should be handled', async () => {
    console.log('Testing disconnection handling...');
    
    // Close guest's page
    await page2.close();
    
    // Wait for host to detect disconnection
    await page1.waitForFunction(
      () => document.querySelectorAll('.player-card').length === 1,
      { timeout: 15000 }
    );
    
    // Verify only host remains
    const remainingPlayers = await page1.$$eval('.player-name', 
      elements => elements.map(el => el.textContent)
    );
    
    expect(remainingPlayers.length).toBe(1);
    expect(remainingPlayers).toContain('Host Player');
    expect(remainingPlayers).not.toContain('Guest Player');
    
    console.log('Disconnection handled correctly');
  }, TIMEOUT);
});

// Run the tests when executed directly
const runTests = async () => {
  console.log('Starting RapidPlanning Multiplayer Tests...');
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
    await page.click(selector);
    await page.type(selector, text);
  };
  
  try {
    // Setup
    console.log('Setting up browsers...');
    const browserOptions = {
      headless: !DEBUG,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(DEBUG && { 
        devtools: true,
        slowMo: 100 
      })
    };
    
    browser1 = await puppeteer.launch(browserOptions);
    browser2 = await puppeteer.launch(browserOptions);
    
    page1 = await browser1.newPage();
    page2 = await browser2.newPage();
    
    await page1.setViewport({ width: 1280, height: 800 });
    await page2.setViewport({ width: 1280, height: 800 });
    
    if (DEBUG) {
      page1.on('console', msg => console.log('Browser 1:', msg.text()));
      page2.on('console', msg => console.log('Browser 2:', msg.text()));
      page1.on('pageerror', error => console.error('Browser 1 Error:', error));
      page2.on('pageerror', error => console.error('Browser 2 Error:', error));
    }
    
    // Run tests
    await runTest('Homepage loads correctly', async () => {
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      const title = await getTextContent(page1, 'h1');
      expect(title).toContain('RapidPlanning');
      await page1.waitForSelector('#create-identity');
      await page1.waitForSelector('#join-identity');
    });
    
    await runTest('Host creates session', async () => {
      await page1.goto(SITE_URL, { waitUntil: 'networkidle2' });
      await typeInField(page1, '#create-identity', 'Host Player');
      await page1.click('#create-form button[type="submit"]');
      
      await page1.waitForFunction(
        () => window.location.search.includes('session='),
        { timeout: 15000 }
      );
      
      const url = await page1.url();
      const urlParams = new URLSearchParams(new URL(url).search);
      sessionId = urlParams.get('session');
      
      console.log('  Session ID:', sessionId);
      expect(sessionId).toMatch(/^\d{9}$/);
      
      await page1.waitForSelector('.session-info');
      const sessionInfo = await getTextContent(page1, '.session-id');
      expect(sessionInfo).toContain(sessionId);
    });
    
    await runTest('Guest joins session', async () => {
      const sessionUrl = `${SITE_URL}?session=${sessionId}`;
      await page2.goto(sessionUrl, { waitUntil: 'networkidle2' });
      
      await page2.waitForSelector('#join-prompt-form');
      await typeInField(page2, '#join-prompt-identity', 'Guest Player');
      await page2.click('#join-prompt-form button[type="submit"]');
      
      await page2.waitForSelector('.session-info', { timeout: 15000 });
      
      const sessionInfo = await getTextContent(page2, '.session-id');
      expect(sessionInfo).toContain(sessionId);
      
      await page2.waitForFunction(
        () => document.querySelectorAll('.player-card').length >= 2,
        { timeout: 15000 }
      );
    });
    
    await runTest('Both players see each other', async () => {
      await page1.waitForFunction(
        () => document.querySelectorAll('.player-card').length >= 2,
        { timeout: 15000 }
      );
      
      const hostViewPlayers = await page1.$$eval('.player-name', 
        elements => elements.map(el => el.textContent)
      );
      const guestViewPlayers = await page2.$$eval('.player-name', 
        elements => elements.map(el => el.textContent)
      );
      
      console.log('  Host sees:', hostViewPlayers);
      console.log('  Guest sees:', guestViewPlayers);
      
      expect(hostViewPlayers.length).toBe(2);
      expect(guestViewPlayers.length).toBe(2);
    });
    
  } catch (error) {
    console.error('Test suite error:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
    
    // Print results
    console.log('\n-----------------------------------');
    console.log('Test Results:');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\nFailed tests:');
      results.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }
    
    process.exit(results.failed > 0 ? 1 : 0);
  }
};

// Check if running as main module
import { fileURLToPath } from 'url';
import { argv } from 'process';

if (argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}