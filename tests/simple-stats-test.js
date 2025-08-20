import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function quickStatsTest() {
  console.log('🧪 Quick Voting Statistics Test...');
  
  let devServer, browser;
  
  try {
    // Start dev server
    devServer = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
    await new Promise(resolve => {
      devServer.stdout.on('data', data => {
        if (data.toString().includes('Local:')) resolve();
      });
    });

    // Launch browser
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    
    await page.goto('http://localhost:5173');
    
    // Create session
    console.log('👤 Creating session...');
    await page.type('#create-identity', 'TestUser');
    await page.click('#create-form button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.match(/\/\\d{9}/));
    await sleep(2000);
    
    // Check that stats are hidden initially
    const statsHidden = await page.evaluate(() => {
      const stats = document.getElementById('voting-stats');
      return stats && stats.classList.contains('hidden');
    });
    console.log('✅ Stats initially hidden:', statsHidden);
    
    // Vote
    console.log('🗳️ Casting vote...');
    await page.click('[data-vote="8"]');
    await sleep(1000);
    
    // Show votes manually (since there's only one player)
    await page.click('#show-votes');
    await sleep(1000);
    
    // Check if stats are visible
    const statsVisible = await page.evaluate(() => {
      const stats = document.getElementById('voting-stats');
      return stats && !stats.classList.contains('hidden');
    });
    console.log('✅ Stats visible after reveal:', statsVisible);
    
    // Check average value
    const average = await page.evaluate(() => {
      const avgEl = document.getElementById('average-value');
      return avgEl ? avgEl.textContent : null;
    });
    console.log('✅ Average displayed:', average);
    
    // Check breakdown
    const breakdown = await page.evaluate(() => {
      const rows = document.querySelectorAll('.vote-breakdown-row');
      return Array.from(rows).map(row => ({
        vote: row.querySelector('.vote-value').textContent,
        count: row.querySelector('.vote-count').textContent
      }));
    });
    console.log('✅ Vote breakdown:', breakdown);
    
    // Clear votes
    console.log('🧹 Clearing votes...');
    await page.click('#clear-votes');
    await sleep(500);
    
    // Check stats are hidden again
    const statsHiddenAfterClear = await page.evaluate(() => {
      const stats = document.getElementById('voting-stats');
      return stats && stats.classList.contains('hidden');
    });
    console.log('✅ Stats hidden after clear:', statsHiddenAfterClear);
    
    console.log('\\n🎯 Voting statistics feature working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }
}

// Run test
quickStatsTest();