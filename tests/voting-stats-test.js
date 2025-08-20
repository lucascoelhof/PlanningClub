import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

class VotingStatsTest {
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

  async testVotingStatistics() {
    console.log('\\n🧪 TEST: Voting Statistics Display');
    
    try {
      // Create two users
      const host = await this.createPage('Host');
      const client = await this.createPage('Client');
      
      // Host creates session
      console.log('👤 Host creating session...');
      await host.type('#create-identity', 'Alice');
      await host.click('#create-form button[type="submit"]');
      await host.waitForFunction(() => window.location.pathname.match(/\/\\d{9}/));
      
      const sessionUrl = await host.url();
      const sessionId = sessionUrl.split('/').pop();
      console.log(`📍 Session created: ${sessionId}`);
      
      await sleep(2000);
      
      // Client joins session
      console.log('👤 Client joining session...');
      await client.type('#join-session', sessionId);
      await client.type('#join-identity', 'Bob');
      await client.click('#join-form button[type="submit"]');
      await client.waitForFunction(() => window.location.pathname.match(/\/\\d{9}/));
      
      await sleep(3000);
      
      // Verify statistics are hidden initially
      const statsInitiallyHidden = await host.evaluate(() => {
        const statsEl = document.getElementById('voting-stats');
        return statsEl && statsEl.classList.contains('hidden');
      });
      
      console.log('Statistics initially hidden:', statsInitiallyHidden ? '✅' : '❌');
      
      if (!statsInitiallyHidden) {
        console.log('❌ TEST FAILED: Statistics should be hidden initially');
        return false;
      }
      
      // Both users vote
      console.log('🗳️ Host voting 8...');
      await host.click('[data-vote="8"]');
      await sleep(1000);
      
      console.log('🗳️ Client voting 13...');
      await client.click('[data-vote="13"]');
      
      // Wait for automatic vote reveal
      await sleep(2000);
      
      // Check if statistics are now visible on host
      const statsVisible = await host.evaluate(() => {
        const statsEl = document.getElementById('voting-stats');
        return statsEl && !statsEl.classList.contains('hidden');
      });
      
      console.log('Statistics visible after voting:', statsVisible ? '✅' : '❌');
      
      if (!statsVisible) {
        console.log('❌ TEST FAILED: Statistics should be visible after votes are revealed');
        return false;
      }
      
      // Check average calculation (8 + 13) / 2 = 10.5
      const averageValue = await host.evaluate(() => {
        const avgEl = document.getElementById('average-value');
        return avgEl ? avgEl.textContent.trim() : null;
      });
      
      console.log('Average value displayed:', averageValue);
      
      if (averageValue !== '10.5') {
        console.log(`❌ TEST FAILED: Expected average 10.5, got ${averageValue}`);
        return false;
      }
      
      // Check vote breakdown
      const voteBreakdown = await host.evaluate(() => {
        const rows = document.querySelectorAll('.vote-breakdown-row');
        const breakdown = {};
        rows.forEach(row => {
          const value = row.querySelector('.vote-value').textContent.trim();
          const count = row.querySelector('.vote-count').textContent.trim();
          breakdown[value] = count;
        });
        return breakdown;
      });
      
      console.log('Vote breakdown:', voteBreakdown);
      
      const expectedBreakdown = { '8': '1', '13': '1' };
      const breakdownMatches = Object.keys(expectedBreakdown).every(key => 
        voteBreakdown[key] === expectedBreakdown[key]
      );
      
      if (!breakdownMatches) {
        console.log('❌ TEST FAILED: Vote breakdown doesn\'t match expected values');
        console.log('Expected:', expectedBreakdown);
        console.log('Actual:', voteBreakdown);
        return false;
      }
      
      // Test clearing votes hides statistics
      console.log('🧹 Clearing votes...');
      await host.click('#clear-votes');
      await sleep(1000);
      
      const statsHiddenAfterClear = await host.evaluate(() => {
        const statsEl = document.getElementById('voting-stats');
        return statsEl && statsEl.classList.contains('hidden');
      });
      
      console.log('Statistics hidden after clear:', statsHiddenAfterClear ? '✅' : '❌');
      
      if (!statsHiddenAfterClear) {
        console.log('❌ TEST FAILED: Statistics should be hidden after clearing votes');
        return false;
      }
      
      console.log('✅ TEST PASSED: Voting statistics working correctly');
      return true;
      
    } catch (error) {
      console.error('❌ TEST ERROR:', error.message);
      return false;
    }
  }

  async testMixedVoteTypes() {
    console.log('\\n🧪 TEST: Mixed Vote Types (including ½ and ?)');
    
    try {
      const host = await this.createPage('Host2');
      
      // Create session
      await host.type('#create-identity', 'Tester');
      await host.click('#create-form button[type="submit"]');
      await host.waitForFunction(() => window.location.pathname.match(/\/\\d{9}/));
      await sleep(2000);
      
      // Simulate having players with mixed votes by directly manipulating the UI manager
      const testResult = await host.evaluate(() => {
        // Create mock players data
        const mockPlayers = [
          { name: 'Alice', vote: '½' },
          { name: 'Bob', vote: '8' },
          { name: 'Charlie', vote: '13' },
          { name: 'Dave', vote: '?' }
        ];
        
        // Access the UI manager instance
        if (window.app && window.app.uiManager) {
          window.app.uiManager.players = mockPlayers;
          window.app.uiManager.votesRevealed = true;
          window.app.uiManager.showVotingStats();
          
          // Check average (should be (0.5 + 8 + 13) / 3 = 7.2, excluding the '?')
          const avgEl = document.getElementById('average-value');
          const average = avgEl ? avgEl.textContent.trim() : null;
          
          // Check breakdown
          const rows = document.querySelectorAll('.vote-breakdown-row');
          const breakdown = {};
          rows.forEach(row => {
            const value = row.querySelector('.vote-value').textContent.trim();
            const count = row.querySelector('.vote-count').textContent.trim();
            breakdown[value] = count;
          });
          
          return { average, breakdown };
        }
        
        return { average: null, breakdown: {} };
      });
      
      console.log('Mixed votes test result:', testResult);
      
      // Expected average: (0.5 + 8 + 13) / 3 = 7.2
      if (testResult.average !== '7.2') {
        console.log(`❌ Mixed votes average test failed: expected 7.2, got ${testResult.average}`);
        return false;
      }
      
      // Check that all vote types are represented
      const expectedVotes = { '½': '1', '8': '1', '13': '1', '?': '1' };
      const allVotesPresent = Object.keys(expectedVotes).every(key => 
        testResult.breakdown[key] === expectedVotes[key]
      );
      
      if (!allVotesPresent) {
        console.log('❌ Mixed votes breakdown test failed');
        console.log('Expected:', expectedVotes);
        console.log('Actual:', testResult.breakdown);
        return false;
      }
      
      console.log('✅ TEST PASSED: Mixed vote types handled correctly');
      return true;
      
    } catch (error) {
      console.error('❌ Mixed votes TEST ERROR:', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Voting Statistics Tests\\n');
    
    try {
      await this.setup();
      
      const results = {
        basicStats: await this.testVotingStatistics(),
        mixedVotes: await this.testMixedVoteTypes()
      };
      
      console.log('\\n📊 Test Results:');
      console.log('- Basic Statistics:', results.basicStats ? '✅ PASSED' : '❌ FAILED');
      console.log('- Mixed Vote Types:', results.mixedVotes ? '✅ PASSED' : '❌ FAILED');
      
      const allPassed = Object.values(results).every(Boolean);
      console.log('\\n🎯 Overall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
      
      return results;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests
const tester = new VotingStatsTest();
tester.runAllTests()
  .then((results) => {
    const allPassed = Object.values(results).every(Boolean);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('🔥 Test suite failed:', error);
    process.exit(1);
  });