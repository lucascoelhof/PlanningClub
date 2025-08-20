import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

class ComprehensiveTest {
  constructor() {
    this.devServer = null;
    this.browser = null;
    this.pages = [];
  }

  async setup() {
    console.log('🚀 Starting development server...');
    
    // Start the dev server
    this.devServer = spawn('npm', ['run', 'dev'], { 
      stdio: 'pipe',
      env: { ...process.env }
    });

    await new Promise((resolve) => {
      this.devServer.stdout.on('data', (data) => {
        if (data.toString().includes('Local:')) {
          const match = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/);
          this.port = match ? match[1] : '5173';
          resolve();
        }
      });
    });

    console.log(`🔧 Server started on port ${this.port}`);
    console.log('🔧 Launching browser...');
    
    this.browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    await sleep(2000);
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
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
    
    page.on('console', (msg) => {
      console.log(`[${name}] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', (error) => {
      console.error(`[${name}] Page error:`, error.message);
    });

    await page.goto(`http://localhost:${this.port}`);
    await page.waitForSelector('#app', { timeout: 10000 });
    
    this.pages.push(page);
    return page;
  }

  async testNameDisplayOnJoin() {
    console.log('\n🧪 TEST 1: Name Display on Join');
    
    try {
      // Create host page
      const hostPage = await this.createPage('Host');
      
      // Host creates session
      console.log('👤 Host creating session...');
      await hostPage.type('#create-name', 'Alice');
      await hostPage.type('#create-email', 'alice@test.com');
      await hostPage.click('#create-form button[type="submit"]');
      await hostPage.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
      
      const url = await hostPage.url();
      const sessionId = url.match(/\/(\d{9})/)[1];
      console.log(`✅ Host session created: ${sessionId}`);
      
      // Wait for host to be fully established
      await sleep(3000);
      
      // Check host sees their own name
      const hostPlayers = await hostPage.evaluate(() => {
        return Array.from(document.querySelectorAll('.player-card')).map(card => ({
          name: card.querySelector('.player-name')?.textContent?.trim() || 'NO_NAME',
          hasValidName: card.querySelector('.player-name')?.textContent?.trim()?.length > 0
        }));
      });
      
      console.log('Host sees players:', hostPlayers);
      const hostSeesOwnName = hostPlayers.some(p => p.name === 'Alice' && p.hasValidName);
      
      if (!hostSeesOwnName) {
        console.log('❌ TEST 1 FAILED: Host cannot see their own name');
        return false;
      }
      
      // Create client page
      const clientPage = await this.createPage('Client');
      
      // Client joins session
      console.log('👤 Client joining session...');
      await clientPage.type('#join-session', sessionId);
      await clientPage.type('#join-name', 'Bob');
      await clientPage.type('#join-email', 'bob@test.com');
      await clientPage.click('#join-form button[type="submit"]');
      await clientPage.waitForSelector('.game-page', { timeout: 10000 });
      
      console.log('✅ Client joined session');
      
      // Wait for connection to establish
      await sleep(4000);
      
      // Check if client sees their own name immediately
      const clientPlayers = await clientPage.evaluate(() => {
        return Array.from(document.querySelectorAll('.player-card')).map(card => ({
          name: card.querySelector('.player-name')?.textContent?.trim() || 'NO_NAME',
          hasValidName: card.querySelector('.player-name')?.textContent?.trim()?.length > 0
        }));
      });
      
      console.log('Client sees players:', clientPlayers);
      
      // Check if host sees client
      const hostPlayersAfter = await hostPage.evaluate(() => {
        return Array.from(document.querySelectorAll('.player-card')).map(card => ({
          name: card.querySelector('.player-name')?.textContent?.trim() || 'NO_NAME',
          hasValidName: card.querySelector('.player-name')?.textContent?.trim()?.length > 0
        }));
      });
      
      console.log('Host sees players after client joins:', hostPlayersAfter);
      
      // Validation
      const clientSeesOwnName = clientPlayers.some(p => p.name === 'Bob' && p.hasValidName);
      const clientSeesHostName = clientPlayers.some(p => p.name === 'Alice' && p.hasValidName);
      const hostSeesClientName = hostPlayersAfter.some(p => p.name === 'Bob' && p.hasValidName);
      
      const results = {
        clientSeesOwnName,
        clientSeesHostName,
        hostSeesClientName
      };
      
      console.log('Name display results:', results);
      
      if (clientSeesOwnName && clientSeesHostName && hostSeesClientName) {
        console.log('✅ TEST 1 PASSED: All names displayed correctly');
        return true;
      } else {
        console.log('❌ TEST 1 FAILED: Some names not displayed');
        return false;
      }
      
    } catch (error) {
      console.error('❌ TEST 1 ERROR:', error.message);
      return false;
    }
  }

  async testReactionSwitching() {
    console.log('\n🧪 TEST 2: Reaction Switching');
    
    try {
      // Use the first page from previous test or create new one
      const hostPage = this.pages[0] || await this.createPage('Host');
      
      // If no session exists, create one
      const currentUrl = await hostPage.url();
      if (!currentUrl.match(/\/\d{9}/)) {
        console.log('👤 Creating session for reaction test...');
        await hostPage.goto(`http://localhost:${this.port}`);
        await hostPage.type('#create-name', 'ReactionTester');
        await hostPage.click('#create-form button[type="submit"]');
        await hostPage.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
        await sleep(2000);
      }
      
      console.log('🎭 Testing reaction switching...');
      
      // Test first reaction (👍)
      console.log('Step 1: Clicking 👍');
      await hostPage.click('[data-reaction="👍"]');
      await sleep(500);
      
      let reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      console.log('Reaction after clicking 👍:', reaction);
      
      if (reaction !== '👍') {
        console.log('❌ TEST 2 FAILED: First reaction (👍) not showing');
        return false;
      }
      
      // Test switching to second reaction (😄)  
      console.log('Step 2: Switching to 😄');
      await hostPage.click('[data-reaction="😄"]');
      await sleep(500);
      
      reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      console.log('Reaction after clicking 😄:', reaction);
      
      if (reaction !== '😄') {
        console.log('❌ TEST 2 FAILED: Cannot switch to second reaction (😄)');
        return false;
      }
      
      // Test switching to third reaction (🔥)
      console.log('Step 3: Switching to 🔥');
      await hostPage.click('[data-reaction="🔥"]');
      await sleep(500);
      
      reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      console.log('Reaction after clicking 🔥:', reaction);
      
      if (reaction !== '🔥') {
        console.log('❌ TEST 2 FAILED: Cannot switch to third reaction (🔥)');
        return false;
      }
      
      // Test clearing reaction by clicking same one
      console.log('Step 4: Clearing reaction by clicking 🔥 again');
      await hostPage.click('[data-reaction="🔥"]');
      await sleep(500);
      
      reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      console.log('Reaction after clicking 🔥 again:', reaction);
      
      if (reaction !== null) {
        console.log('❌ TEST 2 FAILED: Reaction not cleared when clicking same emoji');
        return false;
      }
      
      console.log('✅ TEST 2 PASSED: Reaction switching works correctly');
      return true;
      
    } catch (error) {
      console.error('❌ TEST 2 ERROR:', error.message);
      return false;
    }
  }

  async testReactionExpiration() {
    console.log('\n🧪 TEST 3: Reaction Expiration');
    
    try {
      const hostPage = this.pages[0] || await this.createPage('Host');
      
      // Set a reaction
      console.log('🎭 Setting reaction for expiration test...');
      await hostPage.click('[data-reaction="❤️"]');
      await sleep(500);
      
      let reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      if (reaction !== '❤️') {
        console.log('❌ TEST 3 FAILED: Initial reaction not set');
        return false;
      }
      
      console.log('⏱️ Waiting for expiration (6 seconds)...');
      await sleep(6000);
      
      reaction = await hostPage.evaluate(() => {
        const elem = document.querySelector('.player-reaction');
        return elem ? elem.textContent : null;
      });
      
      if (reaction !== null) {
        console.log('❌ TEST 3 FAILED: Reaction did not expire after 5 seconds');
        return false;
      }
      
      console.log('✅ TEST 3 PASSED: Reaction expired correctly');
      return true;
      
    } catch (error) {
      console.error('❌ TEST 3 ERROR:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Planning Club Tests\n');
    
    try {
      await this.setup();
      
      const results = {
        nameDisplay: await this.testNameDisplayOnJoin(),
        reactionSwitching: await this.testReactionSwitching(),
        reactionExpiration: await this.testReactionExpiration()
      };
      
      console.log('\n📊 Test Results Summary:');
      console.log('- Name Display on Join:', results.nameDisplay ? '✅ PASSED' : '❌ FAILED');
      console.log('- Reaction Switching:', results.reactionSwitching ? '✅ PASSED' : '❌ FAILED');
      console.log('- Reaction Expiration:', results.reactionExpiration ? '✅ PASSED' : '❌ FAILED');
      
      const allPassed = Object.values(results).every(Boolean);
      console.log('\n🎯 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
      
      // Tests completed
      
      return results;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests
const tester = new ComprehensiveTest();

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