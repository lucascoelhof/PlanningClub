# Planning Club Tests

## Puppeteer Tests

The Puppeteer tests simulate multiple browsers connecting to the deployed GitHub Pages site to test the multiplayer functionality.

### Running Tests

```bash
# Run tests in headless mode
npm run test:puppeteer

# Run tests with browser visible (debug mode)
npm run test:puppeteer:debug

# Alternative: run against GitHub Pages
npm run test:github-pages
```

### Test Coverage

The tests cover:
1. Homepage loading
2. Session creation by host
3. Guest joining session via URL
4. Both players seeing each other
5. Voting functionality
6. Show votes feature
7. Clear votes feature
8. Player disconnection handling

### Requirements

- Node.js 18+
- Puppeteer (installed via npm)
- Internet connection (tests run against live GitHub Pages site)

### Troubleshooting

If tests fail:
1. Check that GitHub Pages is deployed and accessible
2. Verify the site URL in the test file
3. Run in debug mode to see browser interactions
4. Check browser console for errors
5. Ensure PeerJS connections are working

### Configuration

- `SITE_URL`: The GitHub Pages URL to test against
- `TIMEOUT`: Maximum time for operations (default: 30 seconds)
- `DEBUG`: Set to `true` to see browsers and console output