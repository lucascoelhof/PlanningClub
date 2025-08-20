# Planning Poker

A serverless, peer-to-peer planning poker web application for agile teams. No server required - all communication happens directly between users through WebRTC.

## Features

- **Serverless**: No backend server needed, works entirely in the browser
- **Peer-to-Peer**: Direct communication between participants using WebRTC
- **Privacy-First**: No data is stored on any server
- **Gravatar Support**: User avatars from Gravatar with initials fallback
- **Real-time Voting**: Automatic vote reveal when everyone has voted
- **Emoji Reactions**: Express yourself with reactions next to your avatar
- **Mobile-Friendly**: Responsive design that works on all devices

## How It Works

1. **Create or Join**: Start a new session or join an existing one with a 9-digit session ID
2. **Vote**: Select from Fibonacci sequence cards (0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?)
3. **Reveal**: Votes are automatically revealed when everyone has voted
4. **React**: Use emoji reactions to communicate non-verbally
5. **Repeat**: Clear votes and start a new round

## Technology Stack

- **Frontend**: Vanilla JavaScript + Vite
- **P2P Communication**: PeerJS (WebRTC wrapper)
- **Styling**: Modern CSS with Flexbox/Grid
- **Deployment**: GitHub Pages
- **Build Tool**: Vite

## Architecture

### Communication Flow
1. **Session Host**: Creates a PeerJS room with ID `host-{sessionId}`
2. **Participants**: Connect to the host peer
3. **Mesh Network**: Host helps establish direct connections between all peers
4. **Data Sync**: Each peer maintains local state and broadcasts changes

### File Structure
```
src/
├── app.js           # Main application coordinator
├── router.js        # Client-side routing
├── peer-manager.js  # WebRTC/PeerJS communication
├── game-manager.js  # Game state and logic
├── ui-manager.js    # User interface management
├── style.css        # Styling
└── main.js          # Entry point
```

## Local Development

1. **Clone and install**:
   ```bash
   git clone <your-repo>
   cd planning-poker
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Deployment

### GitHub Pages (Automatic)
1. Push to `main` branch
2. GitHub Actions will automatically build and deploy
3. Access at `https://yourusername.github.io/planning-poker`

### Manual Deployment
1. Run `npm run build`
2. Upload `dist/` contents to any static hosting service

## Usage

### Creating a Session
1. Visit the home page
2. Enter your name and optionally your Gravatar email
3. Click "Create Session"
4. Share the session URL with participants

### Joining a Session
1. Get the session ID from the host
2. Visit the home page
3. Enter the session ID and your details
4. Click "Join Session"

### During the Session
- **Vote**: Click on a card to cast your vote
- **React**: Click emoji buttons to express reactions
- **Clear/Show**: Any participant can clear votes or manually show them

## Limitations

- Maximum ~50 concurrent users per session (PeerJS limitation)
- Requires modern browser with WebRTC support
- No session persistence (data lost when all users leave)
- May not work behind strict corporate firewalls

## Browser Support

- Chrome/Edge 60+
- Firefox 55+
- Safari 11+
- Mobile browsers with WebRTC support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this for your own teams!

## Privacy

- No data is collected or stored on any server
- Gravatar requests are made directly by your browser
- All communication is peer-to-peer encrypted via WebRTC
- Session data is temporary and destroyed when participants leave