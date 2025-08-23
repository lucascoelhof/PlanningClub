# Planning Club Tests

## Puppeteer Tests

The Puppeteer tests simulate multiple browsers connecting to the deployed GitHub Pages site to test the multiplayer functionality.

### Running Tests

```bash
# Basic tests (2 browsers)
npm run test:puppeteer
npm run test:puppeteer:debug

# Comprehensive tests (3 browsers) - RECOMMENDED
npm run test:puppeteer:comprehensive
npm run test:puppeteer:comprehensive:debug

# Shorthand for comprehensive tests
npm run test:github-pages
```

### Comprehensive Test Coverage

The comprehensive test suite covers all your requirements:

1. **Session Creation & URL Verification**
   - User creates session with correct URL format
   - URL contains proper session ID

2. **Multiple Join Methods**
   - Join via home page form (Session ID + Name)
   - Join via direct session URL with name prompt

3. **Persistence**
   - Refreshing tab doesn't require re-entering name
   - Session state is preserved

4. **Player Management**
   - No duplicate player names appear
   - All players see each other correctly

5. **Voting System**
   - Vote selection highlights correctly
   - Vote statistics appear after all users vote
   - Users can change votes while statistics are showing
   - Vote changes update statistics for all users

6. **Vote Management**
   - Clear votes removes highlighting for all users
   - Clear votes hides statistics for all users
   - System resets to initial state

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