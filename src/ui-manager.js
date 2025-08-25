// CryptoJS is loaded globally from CDN
const CryptoJS = window.CryptoJS;

export class UIManager {
  constructor(gameManager = null, connectionManager = null) {
    this.events = {}
    this.currentPage = null
    this.players = []
    this.selectedVote = null
    this.selectedReaction = null
    this.votesRevealed = false
    this.gameManager = gameManager
    this.connectionManager = connectionManager
    
    this.reactions = ['👍', '👎', '😄', '😕', '😲', '🤔', '🔥', '❤️']
    
    this.setupConnectionStatusUI()
    this.setupKeyboardNavigation()
  }

  setupKeyboardNavigation() {
    this.voteOptions = ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']
    this.keyBuffer = ''
    this.keyTimeout = null
    this.keyDelay = 500 // 0.5 second delay to prevent accidental voting
    
    document.addEventListener('keydown', (e) => {
      // Only handle keyboard navigation when on game page
      if (this.currentPage !== 'game') return
      
      // Don't handle keys when user is typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      this.handleKeyboardInput(e)
    })
  }

  handleKeyboardInput(e) {
    const key = e.key
    
    // Handle special keys
    switch (key) {
      case 'Escape':
        e.preventDefault()
        this.clearVotes()
        return
        
      case 'Enter':
        e.preventDefault()
        this.showVotes()
        return
        
      case '+':
      case '=': // Handle both + and = key
        e.preventDefault()
        this.navigateVote(1)
        return
        
      case '-':
      case '_': // Handle both - and _ key
        e.preventDefault()
        this.navigateVote(-1)
        return
    }
    
    // Handle number input for voting (including ½ and ? symbols)
    if (/^[0-9½?]$/.test(key) || key === '½' || key === '?') {
      e.preventDefault()
      this.handleNumberInput(key)
    }
  }

  handleNumberInput(key) {
    // Add to buffer
    this.keyBuffer += key
    
    // Clear existing timeout
    if (this.keyTimeout) {
      clearTimeout(this.keyTimeout)
    }
    
    // Set new timeout to process the vote
    this.keyTimeout = setTimeout(() => {
      this.processVoteFromKeyboard()
    }, this.keyDelay)
  }

  processVoteFromKeyboard() {
    if (!this.keyBuffer) return
    
    // Try to find exact match first
    let matchedVote = this.voteOptions.find(vote => vote === this.keyBuffer)
    
    // If no exact match, try partial matches for numbers
    if (!matchedVote && /^[0-9]+$/.test(this.keyBuffer)) {
      // For numeric input, try to find closest match
      const numValue = parseInt(this.keyBuffer)
      
      // Find closest vote option
      const numericOptions = this.voteOptions
        .filter(opt => /^[0-9]+$/.test(opt))
        .map(opt => parseInt(opt))
        .sort((a, b) => a - b)
      
      let closest = numericOptions[0]
      for (let option of numericOptions) {
        if (Math.abs(option - numValue) < Math.abs(closest - numValue)) {
          closest = option
        }
      }
      
      matchedVote = closest.toString()
    }
    
    if (matchedVote) {
      // For keyboard input, always select the vote (don't toggle)
      this.selectedVote = matchedVote
      this.renderVoteCards()
      this.emit('vote', matchedVote)
    }
    
    // Clear buffer
    this.keyBuffer = ''
    this.keyTimeout = null
  }

  navigateVote(direction) {
    if (!this.selectedVote) {
      // No vote selected, select first or last option
      const index = direction > 0 ? 0 : this.voteOptions.length - 1
      this.selectedVote = this.voteOptions[index]
      this.renderVoteCards()
      this.emit('vote', this.selectedVote)
      return
    }
    
    const currentIndex = this.voteOptions.indexOf(this.selectedVote)
    if (currentIndex === -1) return
    
    const newIndex = currentIndex + direction
    if (newIndex >= 0 && newIndex < this.voteOptions.length) {
      this.selectedVote = this.voteOptions[newIndex]
      this.renderVoteCards()
      this.emit('vote', this.selectedVote)
    }
  }

  clearVotes() {
    this.selectedVote = null
    this.renderVoteCards()
    this.emit('clearVotes')
  }

  showVotes() {
    this.emit('showVotes')
  }

  setupConnectionStatusUI() {
    if (!this.connectionManager) return
    
    // Listen for connection status changes
    this.connectionManager.on('statusChange', (status) => {
      this.updateConnectionStatus(status)
    })
    
    this.connectionManager.on('connectionLost', () => {
      // Connection lost - handled silently
    })
    
    this.connectionManager.on('connectionRestored', () => {
      // Connection restored - handled silently  
    })
    
    this.connectionManager.on('reconnectionFailed', () => {
      // Reconnection failed - handled silently
    })
  }

  init() {
    this.appContainer = document.getElementById('app')
    this.createConnectionStatusElements()
  }

  createConnectionStatusElements() {
    // Create top-right status bar
    const statusBar = document.createElement('div')
    statusBar.id = 'status-bar'
    statusBar.className = 'status-bar'
    
    // Connection status indicator (initially hidden)
    const statusIndicator = document.createElement('div')
    statusIndicator.id = 'connection-status'
    statusIndicator.className = 'connection-status'
    statusIndicator.style.display = 'none' // Start hidden
    statusIndicator.innerHTML = `
      <div class="connection-indicator">
        <span class="connection-icon"></span>
        <span class="connection-text"></span>
      </div>
    `
    statusBar.appendChild(statusIndicator)
    
    document.body.appendChild(statusBar)
    
    // Trigger initial connection status update
    this.updateConnectionStatus()
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status')
    if (!statusElement) return
    
    const statusMessage = this.connectionManager?.getStatusMessage()
    
    // Hide status when connection is good (statusMessage is null)
    if (!statusMessage) {
      statusElement.style.display = 'none'
      return
    }
    
    // Show status element when there's an issue
    statusElement.style.display = 'block'
    
    const indicator = statusElement.querySelector('.connection-indicator')
    if (indicator) {
      indicator.className = `connection-indicator ${statusMessage.type}`
      indicator.querySelector('.connection-icon').textContent = statusMessage.icon
      indicator.querySelector('.connection-text').textContent = statusMessage.message
    }
  }


  showOfflineMessage() {
    // Offline message - handled silently
  }

  showErrorToast(errorMessage) {
    // Error toast - use modal instead
    this.showErrorModal(errorMessage)
  }

  showErrorModal(errorMessage) {
    // Create modal backdrop
    const modal = document.createElement('div')
    modal.className = 'error-modal-backdrop'
    modal.innerHTML = `
      <div class="error-modal">
        <div class="error-modal-header">
          <h3>${errorMessage.title}</h3>
        </div>
        <div class="error-modal-body">
          <p>${errorMessage.message}</p>
        </div>
        <div class="error-modal-footer">
          <button class="btn btn-secondary" id="error-modal-dismiss">
            Dismiss
          </button>
          ${errorMessage.action && errorMessage.action !== 'dismiss' ? `
            <button class="btn btn-primary" id="error-modal-action">
              <span class="text">${this.getActionButtonText(errorMessage.action)}</span>
            </button>
          ` : ''}
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Bind events
    modal.querySelector('#error-modal-dismiss').onclick = () => {
      modal.remove()
    }
    
    const actionBtn = modal.querySelector('#error-modal-action')
    if (actionBtn) {
      actionBtn.onclick = () => {
        this.handleErrorToastAction(errorMessage.action)
        modal.remove()
      }
    }
    
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    }
    
    return modal
  }

  getActionButtonText(action) {
    switch (action) {
      case 'retry': return 'Retry'
      case 'refresh': return 'Refresh Page'
      case 'auto_refresh': return 'Refreshing...'
      case 'clear_data': return 'Clear Data'
      default: return 'OK'
    }
  }


  handleErrorToastAction(action) {
    switch (action) {
      case 'retry':
        // Emit retry event that the app can listen to
        this.emit('errorAction', { action: 'retry' })
        break
      case 'refresh':
        window.location.reload()
        break
      case 'clear_data':
        if (confirm('This will clear all stored data and you may need to rejoin your session. Continue?')) {
          this.clearStoredData()
          window.location.reload()
        }
        break
    }
  }

  clearStoredData() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('rapidPlanning')) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('Could not clear localStorage:', e)
    }
  }

  showHomePage() {
    this.currentPage = 'home'
    this.ensureAppContainer()
    this.appContainer.innerHTML = this.getHomePageHTML()
    this.bindHomePageEvents()
  }

  showGamePage(sessionId) {
    this.currentPage = 'game'
    this.ensureAppContainer()
    this.appContainer.innerHTML = this.getGamePageHTML(sessionId)
    this.bindGamePageEvents()
  }

  showAboutPage() {
    this.currentPage = 'about'
    this.ensureAppContainer()
    this.appContainer.innerHTML = this.getAboutPageHTML()
    this.bindAboutPageEvents()
  }

  showJoinPrompt(sessionId) {
    this.currentPage = 'join-prompt'
    this.ensureAppContainer()
    this.appContainer.innerHTML = this.getJoinPromptHTML(sessionId)
    this.bindJoinPromptEvents(sessionId)
  }

  ensureAppContainer() {
    if (!this.appContainer) {
      this.appContainer = document.getElementById('app')
      if (!this.appContainer) {
        throw new Error('App container element not found')
      }
    }
  }

  getJoinPromptHTML(sessionId) {
    return `
      <div class="home-page">
        <div class="home-content">
          <h1>⚡ RapidPlanning ⚡</h1>
          <div class="home-actions">
            <div class="card" style="max-width: 400px; margin: 0 auto;">
              <h2>Join Session ${sessionId}</h2>
              <p style="color: #666; margin-bottom: 1.5rem;">
                Enter your name to join this planning session
              </p>
              <form id="join-prompt-form">
                <div class="form-group">
                  <label for="join-prompt-identity">
                    Your Name or Email
                  </label>
                  <input type="text" id="join-prompt-identity" required maxlength="70" 
                         placeholder="John Doe or john@example.com" autofocus>
                  <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                    Enter your name or email address (for Gravatar)
                  </small>
                </div>
                <button type="submit" class="btn">
                  Join Session
                </button>
              </form>
            </div>
          </div>
          
          <div id="error-message" class="error hidden"></div>
          <div id="loading-message" class="loading hidden">Connecting...</div>
        </div>
        
        <footer class="site-footer">
          <div class="footer-content">
            <span>Created by <a href="https://github.com/lucascoelhof" target="_blank" rel="noopener noreferrer">Lucas Coelho Figueiredo</a></span>
            <span class="footer-separator">•</span>
            <a href="/about" id="terms-link">Terms of Use</a>
          </div>
        </footer>
      </div>
    `
  }

  getHomePageHTML() {
    return `
      <div class="home-page">
        <div class="home-content">
          <h1>⚡ RapidPlanning ⚡</h1>
          <div class="home-actions">
            <div class="card">
              <h2>Create Session</h2>
              <form id="create-form">
                <div class="form-group">
                  <label for="create-identity">
                    Your Name or Email
                  </label>
                  <input type="text" id="create-identity" required maxlength="70" 
                         placeholder="John Doe or john@example.com">
                  <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                    Enter your name or email address (for Gravatar)
                  </small>
                </div>
                <button type="submit" class="btn">
                  Create Session
                </button>
              </form>
            </div>
            
            <div class="card">
              <h2>Join Session</h2>
              <form id="join-form">
                <div class="form-group">
                  <label for="join-session">
                    Session ID
                  </label>
                  <input type="text" id="join-session" required pattern="\\d{9}" maxlength="9" placeholder="123456789">
                </div>
                <div class="form-group">
                  <label for="join-identity">
                    Your Name or Email
                  </label>
                  <input type="text" id="join-identity" required maxlength="70" 
                         placeholder="Jane Doe or jane@example.com">
                  <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                    Enter your name or email address (for Gravatar)
                  </small>
                </div>
                <button type="submit" class="btn">
                  Join Session
                </button>
              </form>
            </div>
          </div>
          
          <div id="error-message" class="error hidden"></div>
          <div id="loading-message" class="loading hidden">Connecting...</div>
        </div>
        
        <footer class="site-footer">
          <div class="footer-content">
            <span>Created by <a href="https://github.com/lucascoelhof" target="_blank" rel="noopener noreferrer">Lucas Coelho Figueiredo</a></span>
            <span class="footer-separator">•</span>
            <a href="/about" id="terms-link">Terms of Use</a>
          </div>
        </footer>
      </div>
    `
  }

  getGamePageHTML(sessionId) {
    return `
      <div class="game-page">
        <div class="game-header">
          <div class="session-info">
            <h2>⚡ RapidPlanning ⚡</h2>
            <div class="session-id">Session: ${sessionId}</div>
          </div>
        </div>
        
        <div class="game-content">
          <div class="players-section">
            <h3>Players</h3>
            <div id="players-grid" class="players-grid">
              <!-- Players will be rendered here -->
            </div>
          </div>
        </div>
        
        <div class="voting-section">
          <div class="voting-cards-section">
            <h3>Cast Your Vote</h3>
            <div id="voting-cards" class="voting-cards">
              <!-- Vote cards will be rendered here -->
            </div>
          </div>
          
          <div class="voting-stats-section">
            <h3>Voting Statistics</h3>
            <div class="stats-actions">
              <button id="clear-votes" class="btn btn-secondary btn-small">
                Clear Votes
              </button>
              <button id="show-votes" class="btn btn-secondary btn-small">
                Show Votes
              </button>
            </div>
            <div id="voting-stats" class="stats-content">
              <div class="consensus-section">
                <div id="consensus-indicator" class="consensus-indicator">
                  <!-- Consensus status will be rendered here -->
                </div>
              </div>
              <div class="average-section">
                <strong>Average:</strong>
                <div class="average-value" id="average-value">-</div>
              </div>
              <div class="votes-breakdown">
                <div class="breakdown-header">
                  <span><strong>Points</strong></span>
                  <span><strong>Votes</strong></span>
                </div>
                <div id="votes-breakdown-content">
                  <!-- Vote breakdown will be rendered here -->
                </div>
              </div>
            </div>
          </div>
          
          <div class="reactions-section">
            <h3>Reactions</h3>
            <div id="reaction-buttons" class="reaction-buttons">
              <!-- Reaction buttons will be rendered here -->
            </div>
          </div>
          
          <div class="keyboard-shortcuts-section">
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcuts-grid">
              <div class="shortcut-item">
                <kbd>0-9, ½, ?</kbd>
                <span>Vote (0.5s delay)</span>
              </div>
              <div class="shortcut-item">
                <kbd>+ / =</kbd>
                <span>Next vote option</span>
              </div>
              <div class="shortcut-item">
                <kbd>- / _</kbd>
                <span>Previous vote option</span>
              </div>
              <div class="shortcut-item">
                <kbd>Enter</kbd>
                <span>Show votes</span>
              </div>
              <div class="shortcut-item">
                <kbd>Esc</kbd>
                <span>Clear votes</span>
              </div>
            </div>
          </div>
        </div>
        
        <footer class="site-footer">
          <div class="footer-content">
            <span>Created by <a href="https://github.com/lucascoelhof" target="_blank" rel="noopener noreferrer">Lucas Coelho Figueiredo</a></span>
            <span class="footer-separator">•</span>
            <a href="/about" id="game-terms-link">Terms of Use</a>
          </div>
        </footer>
      </div>
    `
  }

  bindHomePageEvents() {
    const createForm = document.getElementById('create-form')
    const joinForm = document.getElementById('join-form')

    createForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const identity = document.getElementById('create-identity').value.trim()
      
      if (identity) {
        this.showLoading(true)
        // Clear any previous state before creating new session
        this.selectedVote = null
        this.selectedReaction = null
        this.votesRevealed = false
        this.players = []
        const { name, email } = this.parseIdentity(identity)
        const playerData = await this.createPlayerData(name, email)
        this.emit('createSession', playerData)
      }
    })

    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const sessionId = document.getElementById('join-session').value.trim()
      const identity = document.getElementById('join-identity').value.trim()
      
      if (sessionId && identity && sessionId.match(/^\d{9}$/)) {
        this.showLoading(true)
        const { name, email } = this.parseIdentity(identity)
        const playerData = await this.createPlayerData(name, email)
        this.emit('joinSession', sessionId, playerData)
      }
    })
    
    // Bind footer link events
    const termsLink = document.getElementById('terms-link')
    if (termsLink) {
      termsLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.emit('navigate', '/about')
      })
    }
  }

  bindJoinPromptEvents(sessionId) {
    const joinPromptForm = document.getElementById('join-prompt-form')
    
    joinPromptForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const identity = document.getElementById('join-prompt-identity').value.trim()
      
      if (identity) {
        this.showLoading(true)
        // Clear any previous state before joining session
        this.selectedVote = null
        this.selectedReaction = null
        this.votesRevealed = false
        this.players = []
        const { name, email } = this.parseIdentity(identity)
        const playerData = await this.createPlayerData(name, email)
        this.emit('joinSession', sessionId, playerData)
      }
    })
    
    // Bind footer link events
    const termsLink = document.getElementById('terms-link')
    if (termsLink) {
      termsLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.emit('navigate', '/about')
      })
    }
  }

  getAboutPageHTML() {
    return `
      <div class="about-page">
        <div class="about-header">
          <h1>⚡ RapidPlanning ⚡</h1>
          <nav class="about-nav">
            <a href="/" id="home-link">← Back to Home</a>
          </nav>
        </div>
        
        <div class="about-content">
          <section class="terms-section">
            <h2>Terms of Use</h2>
            <div class="terms-content">
              <p><strong>Last updated:</strong> ${new Date().toLocaleDateString()}</p>
              
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing and using RapidPlanning, you agree to be bound by these Terms of Use and all applicable laws and regulations.</p>
              
              <h3>2. Description of Service</h3>
              <p>RapidPlanning is a web-based planning poker application that allows teams to estimate effort for tasks collaboratively. The service is provided "as is" without warranty of any kind.</p>
              
              <h3>3. Privacy and Data</h3>
              <p>We collect minimal anonymous usage data to improve the service. No personal information is stored permanently. Session data is temporary and automatically deleted when sessions end.</p>
              
              <h3>4. User Conduct</h3>
              <p>Users agree to use the service responsibly and not to engage in any activity that could harm the service or other users.</p>
              
              <h3>5. Limitation of Liability</h3>
              <p>RapidPlanning is provided free of charge. We shall not be liable for any damages arising from the use or inability to use this service.</p>
              
              <h3>6. Changes to Terms</h3>
              <p>We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.</p>
            </div>
          </section>
          
          <section class="tech-section">
            <h2>This Website</h2>
            <div class="tech-content">
              <p>RapidPlanning is built using modern web technologies to provide a fast, reliable, and user-friendly experience.</p>
              
              <h3>Technologies Used:</h3>
              <ul>
                <li><strong>Frontend:</strong> Vanilla JavaScript, HTML5, CSS3</li>
                <li><strong>Build Tool:</strong> Vite</li>
                <li><strong>Peer-to-Peer:</strong> PeerJS for real-time communication</li>
                <li><strong>Analytics:</strong> GoatCounter (privacy-focused)</li>
                <li><strong>Hosting:</strong> GitHub Pages</li>
                <li><strong>Avatars:</strong> Gravatar integration</li>
              </ul>
              
              <h3>Open Source</h3>
              <p>This project is open source and available on GitHub. Feel free to contribute, report issues, or fork the project for your own use.</p>
              <p><a href="https://github.com/lucascoelhof/RapidPlanning" target="_blank" rel="noopener noreferrer" class="github-link">View on GitHub →</a></p>
            </div>
          </section>
        </div>
        
        <footer class="site-footer">
          <div class="footer-content">
            <span>Created by <a href="https://github.com/lucascoelhof" target="_blank" rel="noopener noreferrer">Lucas Coelho Figueiredo</a></span>
          </div>
        </footer>
      </div>
    `
  }

  bindAboutPageEvents() {
    const homeLink = document.getElementById('home-link')
    if (homeLink) {
      homeLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.emit('navigate', '/')
      })
    }
  }

  bindGamePageEvents() {
    this.renderVoteCards()
    this.renderReactionButtons()
    this.bindVotingStatsEvents()
    
    // Initially hide the stats content
    const statsContent = document.querySelector('.stats-content')
    if (statsContent) {
      statsContent.style.display = 'none'
    }
    
    // Bind footer link events
    const gameTermsLink = document.getElementById('game-terms-link')
    if (gameTermsLink) {
      gameTermsLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.emit('navigate', '/about')
      })
    }
  }

  bindVotingStatsEvents() {
    const clearBtn = document.getElementById('clear-votes')
    const showBtn = document.getElementById('show-votes')

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.hideVotingStats()
        this.votesRevealed = false
        this.clearVoteSelection()
        this.emit('clearVotes')
      })
    }

    if (showBtn) {
      showBtn.addEventListener('click', () => {
        this.emit('showVotes')
      })
    }
  }

  renderVoteCards() {
    const container = document.getElementById('voting-cards')
    const voteCards = ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']
    
    container.innerHTML = voteCards.map(card => `
      <div class="vote-card ${this.selectedVote === card ? 'selected' : ''}" data-vote="${card}">
        ${card}
      </div>
    `).join('')

    // Remove existing listeners and add a single click handler
    if (this.voteClickHandler) {
      container.removeEventListener('click', this.voteClickHandler)
    }
    this.voteClickHandler = (e) => {
      if (e.target.classList.contains('vote-card')) {
        const vote = e.target.dataset.vote
        this.selectVote(vote)
      }
    }
    container.addEventListener('click', this.voteClickHandler)
  }

  renderReactionButtons() {
    const container = document.getElementById('reaction-buttons')
    
    container.innerHTML = this.reactions.map(reaction => `
      <button class="reaction-btn ${this.selectedReaction === reaction ? 'active' : ''}" 
              data-reaction="${reaction}">
        ${reaction}
      </button>
    `).join('')

    // Remove existing listeners to avoid duplicates
    container.removeEventListener('click', this.reactionClickHandler)
    
    // Create bound handler to avoid duplicates
    this.reactionClickHandler = (e) => {
      if (e.target.classList.contains('reaction-btn')) {
        const reaction = e.target.dataset.reaction
        this.selectReaction(reaction)
        // Emit the selected reaction (which may be null if toggled off)
        this.emit('reaction', this.selectedReaction)
      }
    }
    
    container.addEventListener('click', this.reactionClickHandler)
  }

  selectVote(vote) {
    this.selectedVote = this.selectedVote === vote ? null : vote
    this.renderVoteCards()
    this.emit('vote', this.selectedVote)
  }

  selectReaction(reaction) {
    // Clear previous reaction and set new one, or toggle off if same
    this.selectedReaction = this.selectedReaction === reaction ? null : reaction
    this.renderReactionButtons()
  }

  clearReactionSelection() {
    this.selectedReaction = null
    this.renderReactionButtons()
  }

  updatePlayers(players) {
    this.players = players
    this.renderPlayers()
    
    // Check if all votes have been cleared
    const hasAnyVotes = players.some(player => player.vote !== null)
    if (!hasAnyVotes && this.selectedVote !== null) {
      // All votes were cleared, clear local selection
      this.selectedVote = null
      this.renderVoteCards()
      this.votesRevealed = false
      this.hideVotingStats()
    }
    
    // Update stats if votes are revealed
    if (this.votesRevealed) {
      this.showVotingStats()
    }
  }

  renderPlayers() {
    if (this.currentPage !== 'game') return

    const container = document.getElementById('players-grid')
    if (!container) return
    
    container.innerHTML = this.players.map(player => `
      <div class="player-card ${player.vote ? 'voted' : ''} ${this.votesRevealed && player.vote ? 'revealed' : ''}">
        <div class="player-avatar">
          ${player.avatar ? 
            `<img src="${player.avatar}" alt="${player.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <span style="display: none;">${this.getInitials(player.name)}</span>` : 
            `<span>${this.getInitials(player.name)}</span>`
          }
          ${player.reaction ? `<div class="player-reaction">${player.reaction}</div>` : ''}
        </div>
        <div class="player-name">${player.name}</div>
        ${this.votesRevealed && player.vote ? 
          `<div class="player-vote">${player.vote}</div>` : 
          (player.vote ? '<div class="player-vote">✓</div>' : '')
        }
      </div>
    `).join('')
  }

  revealVotes() {
    this.votesRevealed = true
    this.renderPlayers()
    this.showVotingStats()
  }

  parseIdentity(identity) {
    // Check if it's an email (contains @ and looks like email)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (emailPattern.test(identity)) {
      // It's an email, we'll fetch the real name from Gravatar later
      // For now, extract a temporary name from local part
      const localPart = identity.split('@')[0]
      const tempName = localPart.replace(/[._-]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
      
      return {
        name: tempName || identity.split('@')[0], // temporary fallback name
        email: identity,
        shouldFetchGravatar: true
      }
    } else {
      // It's a name
      return {
        name: identity,
        email: null,
        shouldFetchGravatar: false
      }
    }
  }

  async createPlayerData(name, email) {
    let avatar = null
    let displayName = name
    
    if (email) {
      const hash = CryptoJS.MD5(email.toLowerCase().trim()).toString()
      avatar = `https://www.gravatar.com/avatar/${hash}?d=blank&s=120`
      
      // Try to fetch Gravatar profile using JSONP to avoid CORS
      try {
        displayName = await this.fetchGravatarName(hash, name)
      } catch (error) {
        console.log('Could not fetch Gravatar profile, using fallback name')
      }
    }
    
    return {
      name: displayName,
      email: email || null,
      avatar
    }
  }

  fetchGravatarName(hash, fallbackName) {
    return new Promise((resolve) => {
      // Create a unique callback name
      const callbackName = `gravatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Set timeout in case Gravatar doesn't respond
      const timeout = setTimeout(() => {
        delete window[callbackName]
        resolve(fallbackName)
      }, 3000)
      
      // Define the callback function
      window[callbackName] = (data) => {
        clearTimeout(timeout)
        delete window[callbackName]
        
        if (data && data.entry && data.entry[0]) {
          const profile = data.entry[0]
          const gravatarName = profile.displayName || 
                              profile.name?.formatted || 
                              profile.preferredUsername || 
                              fallbackName
          console.log('Gravatar profile found, using name:', gravatarName)
          resolve(gravatarName)
        } else {
          resolve(fallbackName)
        }
        
        // Clean up the script tag
        const script = document.querySelector(`script[src*="${callbackName}"]`)
        if (script) script.remove()
      }
      
      // Create and append the script tag for JSONP
      const script = document.createElement('script')
      script.src = `https://gravatar.com/${hash}.json?callback=${callbackName}`
      script.onerror = () => {
        clearTimeout(timeout)
        delete window[callbackName]
        resolve(fallbackName)
      }
      document.head.appendChild(script)
    })
  }

  getInitials(name) {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  showError(message) {
    this.hideLoading()
    console.error('RapidPlanning Error:', message)
    
    if (this.currentPage === 'home') {
      const errorEl = document.getElementById('error-message')
      if (errorEl) {
        errorEl.textContent = message
        errorEl.classList.remove('hidden')
        
        setTimeout(() => {
          errorEl.classList.add('hidden')
        }, 8000) // Show longer for better visibility
      }
    } else {
      // Add error display for game page instead of alert
      this.showGameError(message)
    }
  }

  showGameError(message) {
    // Remove any existing error
    const existingError = document.getElementById('game-error')
    if (existingError) {
      existingError.remove()
    }
    
    // Create new error element
    const errorDiv = document.createElement('div')
    errorDiv.id = 'game-error'
    errorDiv.className = 'error'
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;'
    errorDiv.innerHTML = `
      <strong>Connection Error:</strong> ${message}
      <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
    `
    
    document.body.appendChild(errorDiv)
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove()
      }
    }, 10000)
  }

  showSuccess(message) {
    this.hideLoading()
    // Could implement success notifications here
  }

  showLoading(show = true) {
    if (this.currentPage === 'home') {
      const loadingEl = document.getElementById('loading-message')
      if (loadingEl) {
        if (show) {
          loadingEl.classList.remove('hidden')
        } else {
          loadingEl.classList.add('hidden')
        }
      }
    }
  }

  hideLoading() {
    this.showLoading(false)
  }

  showVotingStats() {
    if (this.currentPage !== 'game') return

    const averageEl = document.getElementById('average-value')
    const breakdownEl = document.getElementById('votes-breakdown-content')
    const consensusEl = document.getElementById('consensus-indicator')
    const statsContent = document.querySelector('.stats-content')
    
    if (!averageEl || !breakdownEl || !consensusEl || !statsContent) return

    // Get statistics from GameManager if available, otherwise calculate locally
    const votingSummary = this.gameManager ? this.gameManager.getVotingSummary() : this.calculateVotingSummary()
    
    if (votingSummary.total === 0) {
      // Hide just the content, not the whole section
      statsContent.style.display = 'none'
      return
    }

    // Show the content
    statsContent.style.display = 'flex'

    // Show consensus indicator
    if (votingSummary.consensus) {
      const consensus = votingSummary.consensus
      consensusEl.innerHTML = `
        <div class="consensus-message ${consensus.type} ${consensus.highlight ? 'highlight' : ''}">
          ${consensus.message}
        </div>
      `
      consensusEl.style.display = 'block'
    } else {
      consensusEl.style.display = 'none'
    }

    // Show average
    if (votingSummary.average !== null) {
      averageEl.textContent = votingSummary.average
    } else {
      averageEl.textContent = 'N/A'
    }

    // Show vote breakdown
    const sortedVotes = Object.entries(votingSummary.votes)
      .sort(([a], [b]) => {
        // Sort by numeric value, handling special cases
        const numA = this.getNumericValue(a)
        const numB = this.getNumericValue(b)
        if (numA === null && numB === null) return a.localeCompare(b)
        if (numA === null) return 1
        if (numB === null) return -1
        return numA - numB
      })

    breakdownEl.innerHTML = sortedVotes.map(([vote, count]) => `
      <div class="vote-breakdown-row">
        <span class="vote-value">${vote}</span>
        <span class="vote-count">${count}</span>
      </div>
    `).join('')
  }

  hideVotingStats() {
    const statsContent = document.querySelector('.stats-content')
    if (statsContent) {
      statsContent.style.display = 'none'
    }
  }
  
  clearVoteSelection() {
    this.selectedVote = null
    this.renderVoteCards()
  }

  calculateVotingSummary() {
    const votes = this.players
      .filter(p => p.vote !== null)
      .map(p => p.vote)
    
    const voteCount = {}
    votes.forEach(vote => {
      voteCount[vote] = (voteCount[vote] || 0) + 1
    })
    
    return {
      votes: voteCount,
      total: votes.length,
      average: this.calculateAverage(votes)
    }
  }

  calculateAverage(votes) {
    const numericVotes = votes.filter(v => !isNaN(parseFloat(v.replace('½', '0.5'))))
    if (numericVotes.length === 0) return null
    
    const sum = numericVotes.reduce((acc, vote) => {
      return acc + parseFloat(vote.replace('½', '0.5'))
    }, 0)
    
    return (sum / numericVotes.length).toFixed(1)
  }

  getNumericValue(vote) {
    if (vote === '½') return 0.5
    if (vote === '?') return null
    const num = parseFloat(vote)
    return isNaN(num) ? null : num
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(...args))
    }
  }
}