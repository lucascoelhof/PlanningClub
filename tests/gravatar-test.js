import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function testGravatarNameFetch() {
  console.log('🧪 Testing Gravatar Name Fetch...');
  
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
    browser = await puppeteer.launch({ headless: false }); // Keep visible to see the result
    const page = await browser.newPage();
    
    page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    
    await page.goto('http://localhost:5173');
    
    console.log('\n📧 Test 1: Testing with a known Gravatar email...');
    console.log('Using: beau@dentedreality.com.au (should have Gravatar profile)');
    
    // Test with a known Gravatar email (Beau Lebens from Automattic)
    await page.type('#create-identity', 'beau@dentedreality.com.au');
    
    // Wait a moment to see if Gravatar loads
    await sleep(1000);
    
    await page.click('#create-form button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
    
    // Wait for Gravatar profile to load
    await sleep(4000);
    
    // Check the displayed name
    const displayedName = await page.evaluate(() => {
      const nameEl = document.querySelector('.player-name');
      return nameEl ? nameEl.textContent.trim() : null;
    });
    
    console.log('Displayed name:', displayedName);
    
    // Check if avatar loaded
    const hasAvatar = await page.evaluate(() => {
      const img = document.querySelector('.player-avatar img');
      return img && img.src && !img.src.includes('blank');
    });
    
    console.log('Has Gravatar avatar:', hasAvatar ? '✅' : '❌');
    
    // Go back and test with non-Gravatar email
    await page.goto('http://localhost:5173');
    await sleep(1000);
    
    console.log('\n📧 Test 2: Testing with non-Gravatar email...');
    console.log('Using: test.user@nonexistent-domain-12345.com');
    
    await page.type('#create-identity', 'test.user@nonexistent-domain-12345.com');
    await page.click('#create-form button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
    
    await sleep(3000);
    
    const fallbackName = await page.evaluate(() => {
      const nameEl = document.querySelector('.player-name');
      return nameEl ? nameEl.textContent.trim() : null;
    });
    
    console.log('Fallback name (from email):', fallbackName);
    
    // Test with just a name
    await page.goto('http://localhost:5173');
    await sleep(1000);
    
    console.log('\n📝 Test 3: Testing with plain name (no email)...');
    console.log('Using: John Smith');
    
    await page.type('#create-identity', 'John Smith');
    await page.click('#create-form button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.match(/\/\d{9}/));
    
    await sleep(2000);
    
    const plainName = await page.evaluate(() => {
      const nameEl = document.querySelector('.player-name');
      return nameEl ? nameEl.textContent.trim() : null;
    });
    
    console.log('Plain name displayed:', plainName);
    
    console.log('\n✅ Test complete! Check the displayed names above.');
    console.log('Browser kept open for manual inspection. Press Ctrl+C to close.');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    if (browser) await browser.close();
    if (devServer) devServer.kill();
  }
}

// Run test
testGravatarNameFetch();