import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

class FinalFixesTest {
  constructor() {
    this.devServer = null;
    this.browser = null;
    this.pages = [];
  }

  async setup() {
    console.log('🚀 Starting dev server...');
    
    this.devServer = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
    await new Promise(resolve => {
      this.devServer.stdout.on('data', data => {
        if (data.toString().includes('Local:')) {
          const match = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/);
          this.port = match ? match[1] : '5173';
          resolve();
        }
      });
    });

    console.log('🔧 Launching browser...');
    this.browser = await puppeteer.launch({ headless: true });
    await sleep(1000);
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    for (const page of this.pages) {
      try {
        await page.close();
      } catch (e) {}
    }
    
    if (this.browser) await this.browser.close();
    if (this.devServer) this.devServer.kill();
  }

  async createPage(name = `User${this.pages.length + 1}`) {
    const page = await this.browser.newPage();
    
    page.on('console', (msg) => {
      console.log(`[${name}] ${msg.type()}: ${msg.text()}`);
    });

    await page.goto(`http://localhost:${this.port}`);
    await page.waitForSelector('#app', { timeout: 10000 });
    
    this.pages.push(page);
    return page;
  }

  async testReactionButtonClearingOnExpiration() {
    console.log('\n🧪 TEST 1: Reaction Button Clearing on Expiration');
    
    try {
      const page = await this.createPage('Host');
      
      // Create session using the single identity field
      console.log('👤 Creating session with single field...');
      await page.type('#create-identity', 'TestUser');
      await page.click('#create-form button[type="submit"]');
      await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
      
      console.log('✅ Session created');
      await sleep(2000);
      
      // Click a reaction button
      console.log('🎭 Clicking 👍 reaction...');
      await page.click('[data-reaction="👍"]');
      await sleep(500);
      
      // Check if button is selected (has 'active' class)
      let isActive = await page.evaluate(() => {
        const btn = document.querySelector('[data-reaction="👍"]');
        return btn && btn.classList.contains('active');
      });
      
      console.log('Button active after click:', isActive ? '✅' : '❌');
      
      if (!isActive) {
        console.log('❌ TEST 1 FAILED: Button not active after click');
        return false;
      }
      
      // Wait for expiration (6 seconds)
      console.log('⏱️ Waiting for reaction to expire (6s)...');
      await sleep(6000);
      
      // Check if button selection is cleared
      isActive = await page.evaluate(() => {
        const btn = document.querySelector('[data-reaction="👍"]');
        return btn && btn.classList.contains('active');
      });
      
      console.log('Button active after expiration:', isActive ? '❌ (should be cleared)' : '✅ (cleared correctly)');
      
      if (isActive) {
        console.log('❌ TEST 1 FAILED: Button selection not cleared after expiration');
        return false;
      }
      
      console.log('✅ TEST 1 PASSED: Button selection cleared on expiration');
      return true;
      
    } catch (error) {
      console.error('❌ TEST 1 ERROR:', error.message);
      return false;
    }
  }

  async testSingleIdentityField() {
    console.log('\n🧪 TEST 2: Single Identity Field');
    
    try {
      const page = await this.createPage('TestUser');
      
      // Test 1: Name only
      console.log('📝 Test 2a: Name only input...');
      await page.type('#create-identity', 'Alice Smith');
      await page.click('#create-form button[type="submit"]');
      await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
      
      await sleep(2000);
      
      // Check if name appears in player list
      let playerName = await page.evaluate(() => {
        const nameEl = document.querySelector('.player-name');
        return nameEl ? nameEl.textContent.trim() : null;
      });
      
      console.log('Player name from "Alice Smith":', playerName);
      
      if (playerName !== 'Alice Smith') {
        console.log('❌ TEST 2a FAILED: Name not processed correctly');
        return false;
      }
      
      // Go back and test email input
      await page.goto(`http://localhost:${this.port}`);
      await sleep(1000);
      
      console.log('📝 Test 2b: Email input...');
      await page.type('#create-identity', 'john.doe@example.com');
      await page.click('#create-form button[type="submit"]');
      await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
      
      await sleep(2000);
      
      // Check if name is derived from email
      playerName = await page.evaluate(() => {
        const nameEl = document.querySelector('.player-name');
        return nameEl ? nameEl.textContent.trim() : null;
      });
      
      console.log('Player name from "john.doe@example.com":', playerName);
      
      // Should be something like "John Doe" (derived from email local part)
      if (!playerName || playerName.length === 0) {
        console.log('❌ TEST 2b FAILED: Name not derived from email');
        return false;
      }
      
      console.log('✅ TEST 2 PASSED: Single identity field works for both name and email');
      return true;
      
    } catch (error) {
      console.error('❌ TEST 2 ERROR:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Final Fixes Tests\n');
    
    try {
      await this.setup();
      
      const results = {
        reactionButtonClearing: await this.testReactionButtonClearingOnExpiration(),
        singleIdentityField: await this.testSingleIdentityField()
      };
      
      console.log('\n📊 Test Results:');
      console.log('- Reaction Button Clearing:', results.reactionButtonClearing ? '✅ PASSED' : '❌ FAILED');
      console.log('- Single Identity Field:', results.singleIdentityField ? '✅ PASSED' : '❌ FAILED');
      
      const allPassed = Object.values(results).every(Boolean);
      console.log('\n🎯 Overall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
      
      return results;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests
const tester = new FinalFixesTest();
tester.runAllTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('🔥 Test suite failed:', error);
    process.exit(1);
  });