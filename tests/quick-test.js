import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function testNameDisplay() {
  console.log('🧪 Testing name display on join...');
  
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
    await hostPage.type('#create-email', 'alice@test.com');
    await hostPage.click('#create-form button[type="submit"]');
    await hostPage.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
    
    const url = await hostPage.url();
    const sessionId = url.match(/\/(\d{9})/)[1];
    console.log(`✅ Session created: ${sessionId}`);
    
    // Wait a moment for host to be established
    await sleep(2000);
    
    // Check host players
    let hostPlayers = await hostPage.evaluate(() => {
      const cards = document.querySelectorAll('.player-card');
      return Array.from(cards).map(card => ({
        name: card.querySelector('.player-name')?.textContent,
        hasName: !!card.querySelector('.player-name')?.textContent
      }));
    });
    
    console.log('Host players before client join:', hostPlayers);
    
    // Create client
    const clientPage = await browser.newPage();
    clientPage.on('console', msg => console.log(`[Client] ${msg.type()}: ${msg.text()}`));
    await clientPage.goto('http://localhost:5173');
    
    // Join session
    await clientPage.type('#join-session', sessionId);
    await clientPage.type('#join-name', 'Bob');
    await clientPage.click('#join-form button[type="submit"]');
    await clientPage.waitForSelector('.game-page', { timeout: 10000 });
    
    console.log('✅ Client joined session');
    
    // Wait for connection to establish
    await sleep(3000);
    
    // Check client players immediately after join (before voting)
    const clientPlayers = await clientPage.evaluate(() => {
      const cards = document.querySelectorAll('.player-card');
      return Array.from(cards).map(card => ({
        name: card.querySelector('.player-name')?.textContent,
        hasName: !!card.querySelector('.player-name')?.textContent
      }));
    });
    
    console.log('Client players immediately after join:', clientPlayers);
    
    // Check host players after client joins
    hostPlayers = await hostPage.evaluate(() => {
      const cards = document.querySelectorAll('.player-card');
      return Array.from(cards).map(card => ({
        name: card.querySelector('.player-name')?.textContent,
        hasName: !!card.querySelector('.player-name')?.textContent
      }));
    });
    
    console.log('Host players after client joins:', hostPlayers);
    
    // Test name display
    const hasClientName = clientPlayers.some(p => p.name === 'Bob' && p.hasName);
    const hasHostName = hostPlayers.some(p => p.name === 'Alice' && p.hasName);
    
    if (hasClientName && hasHostName) {
      console.log('✅ Names displayed correctly on join');
      return true;
    } else {
      console.log('❌ Names not displayed:', { hasClientName, hasHostName });
      return false;
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }
}

// Run test
testNameDisplay().then(success => {
  process.exit(success ? 0 : 1);
});