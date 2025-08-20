import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

class PlanningClubsTester {
  constructor() {
    this.browser = null;
    this.devServer = null;
    this.pages = [];
  }

  async setup() {
    console.log('🚀 Starting development server...');
    
    // Start the dev server
    this.devServer = spawn('npm', ['run', 'dev'], { 
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to start
    await new Promise((resolve) => {
      this.devServer.stdout.on('data', (data) => {
        if (data.toString().includes('Local:')) {
          resolve();
        }
      });
    });

    // Launch browser
    console.log('🔧 Launching browser...');
    this.browser = await puppeteer.launch({ 
      headless: true, // Headless mode for faster testing
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    await sleep(2000);
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    // Close all pages
    for (const page of this.pages) {
      try {
        await page.close();
      } catch (e) {
        console.warn('Failed to close page:', e.message);
      }
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.devServer) {
      this.devServer.kill();
    }
  }

  async createPage(name = `User${this.pages.length + 1}`) {
    const page = await this.browser.newPage();
    
    // Set up console logging
    page.on('console', (msg) => {
      console.log(`[${name}] ${msg.type()}: ${msg.text()}`);
    });

    // Set up error logging
    page.on('pageerror', (error) => {
      console.error(`[${name}] Page error:`, error.message);
    });

    // Navigate to app
    await page.goto('http://localhost:5173');
    await page.waitForSelector('#app', { timeout: 10000 });
    
    this.pages.push(page);
    return page;
  }

  async createSession(page, name, email = '') {
    console.log(`👤 Creating session for ${name}...`);
    
    // Fill form
    await page.type('#create-name', name);
    if (email) {
      await page.type('#create-email', email);
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for session to be created and redirected
    await page.waitForFunction(
      () => window.location.pathname.match(/\/\d{9}/),
      { timeout: 10000 }
    );
    
    // Extract session ID from URL
    const url = await page.url();
    const sessionId = url.match(/\/(\d{9})/)[1];
    console.log(`✅ Session created: ${sessionId}`);
    
    return sessionId;
  }

  async joinSession(page, sessionId, name, email = '') {
    console.log(`👤 ${name} joining session ${sessionId}...`);
    
    // Fill join form
    await page.type('#join-session', sessionId);
    await page.type('#join-name', name);
    if (email) {
      await page.type('#join-email', email);
    }
    
    // Submit form
    await page.click('#join-form button[type="submit"]');
    
    // Wait for session to load
    await page.waitForSelector('.game-page', { timeout: 10000 });
    console.log(`✅ ${name} joined session`);
  }

  async getPlayers(page) {
    return await page.evaluate(() => {
      const playerCards = document.querySelectorAll('.player-card');
      return Array.from(playerCards).map(card => {
        const name = card.querySelector('.player-name')?.textContent;
        const hasVote = card.classList.contains('voted');
        const vote = card.querySelector('.player-vote')?.textContent;
        return { name, hasVote, vote };
      });
    });
  }

  async castVote(page, vote) {
    console.log(`🗳️ Casting vote: ${vote}`);
    await page.click(`[data-vote="${vote}"]`);
  }

  async clearVotes(page) {
    console.log('🧹 Clearing votes');
    await page.click('#clear-votes');
  }

  async showVotes(page) {
    console.log('👁️ Showing votes');
    await page.click('#show-votes');
  }

  async testDuplicationIssue() {
    console.log('\n🔍 Testing user duplication issue...');
    
    const page1 = await this.createPage('Host');
    
    // Create first session
    const sessionId1 = await this.createSession(page1, 'TestUser', 'test@example.com');
    await sleep(1000);
    
    let players = await this.getPlayers(page1);
    console.log('Players after first session:', players);
    
    // Navigate back to home
    console.log('🔄 Navigating back to home...');
    await page1.goto('http://localhost:5173');
    await page1.waitForSelector('#app');
    
    // Create second session
    console.log('🔄 Creating second session...');
    const sessionId2 = await this.createSession(page1, 'TestUser', 'test@example.com');
    await sleep(1000);
    
    players = await this.getPlayers(page1);
    console.log('Players after second session:', players);
    
    // Check for duplicates
    const names = players.map(p => p.name);
    const uniqueNames = [...new Set(names)];
    
    if (names.length !== uniqueNames.length) {
      console.error('❌ DUPLICATION DETECTED:', names);
      return false;
    } else {
      console.log('✅ No duplication detected');
      return true;
    }
  }

  async testBasicMultiUser() {
    console.log('\n🔍 Testing basic multi-user functionality...');
    
    try {
      // Create host
      const hostPage = await this.createPage('Host');
      const sessionId = await this.createSession(hostPage, 'Alice', 'alice@example.com');
      await sleep(2000);
      
      // Create client
      const clientPage = await this.createPage('Client');
      await this.joinSession(clientPage, sessionId, 'Bob', 'bob@example.com');
      await sleep(2000);
      
      // Check players on both pages
      const hostPlayers = await this.getPlayers(hostPage);
      const clientPlayers = await this.getPlayers(clientPage);
      
      console.log('Host sees players:', hostPlayers);
      console.log('Client sees players:', clientPlayers);
      
      // Test voting
      await this.castVote(hostPage, '5');
      await sleep(1000);
      await this.castVote(clientPage, '8');
      await sleep(2000);
      
      // Check votes
      const hostPlayersAfterVote = await this.getPlayers(hostPage);
      const clientPlayersAfterVote = await this.getPlayers(clientPage);
      
      console.log('Host sees after voting:', hostPlayersAfterVote);
      console.log('Client sees after voting:', clientPlayersAfterVote);
      
      return true;
    } catch (error) {
      console.error('❌ Multi-user test failed:', error.message);
      return false;
    }
  }

  async testConnectionErrors() {
    console.log('\n🔍 Testing connection error scenarios...');
    
    try {
      // Try to join non-existent session
      const page = await this.createPage('ErrorTester');
      
      console.log('Trying to join non-existent session...');
      await page.type('#join-session', '999999999');
      await page.type('#join-name', 'TestUser');
      await page.click('#join-form button[type="submit"]');
      
      // Wait a bit and check for errors
      await sleep(5000);
      
      // Check if we're still on home page or got an error
      const currentUrl = await page.url();
      if (currentUrl.includes('localhost:5173/') && !currentUrl.match(/\/\d{9}/)) {
        console.log('✅ Properly handled non-existent session');
        return true;
      } else {
        console.error('❌ Should have stayed on home page or shown error');
        return false;
      }
    } catch (error) {
      console.error('❌ Connection error test failed:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Planning Club E2E Tests\n');
    
    try {
      await this.setup();
      
      const results = {
        duplication: await this.testDuplicationIssue(),
        multiUser: await this.testBasicMultiUser(),
        connectionErrors: await this.testConnectionErrors()
      };
      
      console.log('\n📊 Test Results:');
      console.log('- Duplication Issue:', results.duplication ? '✅ PASSED' : '❌ FAILED');
      console.log('- Multi-user:', results.multiUser ? '✅ PASSED' : '❌ FAILED');
      console.log('- Connection Errors:', results.connectionErrors ? '✅ PASSED' : '❌ FAILED');
      
      const allPassed = Object.values(results).every(Boolean);
      console.log('\n🎯 Overall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
      
      return results;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PlanningClubsTester();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupting tests...');
    await tester.cleanup();
    process.exit(0);
  });
  
  tester.runAllTests()
    .then((results) => {
      const allPassed = Object.values(results).every(Boolean);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('🔥 Test suite failed:', error);
      process.exit(1);
    });
}

export default PlanningClubsTester;