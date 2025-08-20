import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function testReactionExpiration() {
  console.log('🧪 Testing reaction expiration...');
  
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
    
    // Create host
    const hostPage = await browser.newPage();
    hostPage.on('console', msg => console.log(`[Host] ${msg.type()}: ${msg.text()}`));
    await hostPage.goto('http://localhost:5173');
    
    // Create session
    await hostPage.type('#create-name', 'Alice');
    await hostPage.click('#create-form button[type="submit"]');
    await hostPage.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
    
    console.log('✅ Session created');
    await sleep(2000);
    
    // Add reaction
    console.log('🎭 Adding reaction...');
    await hostPage.click('[data-reaction="👍"]');
    await sleep(500);
    
    // Check if reaction is visible
    let hasReaction = await hostPage.evaluate(() => {
      const reaction = document.querySelector('.player-reaction');
      return reaction && reaction.textContent === '👍';
    });
    
    console.log('Reaction visible immediately:', hasReaction ? '✅' : '❌');
    
    if (!hasReaction) {
      console.log('❌ Reaction not showing immediately - test failed');
      return false;
    }
    
    // Wait 3 seconds (reaction should still be there)
    console.log('⏱️ Waiting 3 seconds...');
    await sleep(3000);
    
    hasReaction = await hostPage.evaluate(() => {
      const reaction = document.querySelector('.player-reaction');
      return reaction && reaction.textContent === '👍';
    });
    
    console.log('Reaction visible after 3s:', hasReaction ? '✅' : '❌');
    
    if (!hasReaction) {
      console.log('❌ Reaction disappeared too early - test failed');
      return false;
    }
    
    // Wait 3 more seconds (total 6s, reaction should expire after 5s)
    console.log('⏱️ Waiting 3 more seconds (total 6s)...');
    await sleep(3000);
    
    hasReaction = await hostPage.evaluate(() => {
      const reaction = document.querySelector('.player-reaction');
      return reaction && reaction.textContent === '👍';
    });
    
    console.log('Reaction visible after 6s:', hasReaction ? '❌ (should expire)' : '✅ (expired correctly)');
    
    if (hasReaction) {
      console.log('❌ Reaction did not expire after 5 seconds - test failed');
      return false;
    }
    
    console.log('✅ Reaction expiration test passed!');
    return true;
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }
}

// Run test
testReactionExpiration().then(success => {
  process.exit(success ? 0 : 1);
});