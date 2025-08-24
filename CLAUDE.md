# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planning Club is a serverless, peer-to-peer planning estimation web application built with vanilla JavaScript and PeerJS. It uses WebRTC for direct browser-to-browser communication without requiring a backend server.

## Development Commands

```bash
# Start development server (Vite)
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages (automatic build included)
npm run deploy

# Run comprehensive tests (3 browsers, recommended)
npm run test:puppeteer:comprehensive

# Run tests with visible browsers for debugging
npm run test:puppeteer:comprehensive:debug

# Run basic tests (2 browsers)
npm run test:puppeteer
```

## Important Development Notes

- **GitHub Pages Deployment**: The app is configured for GitHub Pages deployment with base path `/PlanningClub/`. Changes must be committed and pushed to test against the live site since tests run against the deployed GitHub Pages URL.

- **CDN Dependencies**: The app uses CDN versions of PeerJS and CryptoJS loaded via script tags in `index.html` rather than npm imports, making it compatible with GitHub Pages static hosting without a build step for dependencies.

- **Test Strategy**: Puppeteer tests run against the live GitHub Pages deployment, simulating real multiplayer scenarios with multiple browsers. Always wait 1-2 minutes after pushing changes before running tests to allow GitHub Pages to deploy.

## Architecture Overview

The application follows a modular architecture with clear separation of concerns:

### Core Components

- **`app.js`** - Main coordinator that orchestrates all other managers and handles the application lifecycle
- **`peer-manager.js`** - Manages WebRTC/PeerJS connections, handles peer-to-peer communication
- **`game-manager.js`** - Manages game state, voting logic, and player data synchronization
- **`ui-manager.js`** - Handles all DOM manipulation, page rendering, and user interactions
- **`router.js`** - Client-side routing using query parameters (`?session=123456789`)

### Communication Flow

1. **Session Creation**: Host creates a PeerJS peer with ID `host-{sessionId}` 
2. **Joining**: Participants connect directly to the host peer
3. **Mesh Network**: Host facilitates direct peer-to-peer connections between all participants
4. **State Sync**: Each peer maintains local state and broadcasts changes to all other peers
5. **Event Flow**: UI events → App coordinator → Game/Peer managers → Network broadcast → Remote peers

### Data Flow Patterns

- **Player Management**: Local player data is stored in `game-manager`, remote players are synced via peer messages
- **Voting State**: Vote selections are local until broadcast, voting completion triggers automatic reveal
- **Session Persistence**: localStorage maintains session data for refresh persistence
- **Connection Handling**: Duplicate connections are prevented by checking existing peer state before creating new connections

### Key Technical Constraints

- **Static Hosting**: No server-side code, everything runs in the browser
- **Peer Limits**: PeerJS cloud service limits ~50 concurrent connections per session
- **GitHub Pages**: Routing uses query parameters since GitHub Pages doesn't support client-side routing with paths
- **Browser Compatibility**: Requires WebRTC support (Chrome 60+, Firefox 55+, Safari 11+)

## Testing Strategy

The comprehensive Puppeteer test suite simulates real multiplayer scenarios:

- **Multi-browser Testing**: Tests use 2-3 browser instances to verify peer-to-peer functionality
- **Live Deployment Testing**: Tests run against GitHub Pages to catch deployment-specific issues
- **Complete User Flows**: Tests cover session creation, joining, voting, statistics, and disconnection
- **Timeout Configuration**: Tests use 10-minute timeouts due to potential connection delays

## Known Issues & Considerations

- **Connection Timing**: PeerJS connections may take several seconds to establish, especially on first load
- **Firewall Sensitivity**: Corporate firewalls may block WebRTC connections
- **State Synchronization**: Race conditions can occur during rapid state changes; the app includes safeguards to prevent duplicate connections and infinite loops
- **Mobile Testing**: Touch interactions and viewport considerations are important for mobile users

## Critical Files for Debugging

- **`index.html`** - Contains CDN script imports that must load before ES modules
- **`peer-manager.js`** - Connection establishment and data synchronization logic
- **`game-manager.js`** - Player state and voting logic that drives the core functionality
- **`tests/puppeteer-comprehensive.test.js`** - Full end-to-end test scenarios that validate all requirements