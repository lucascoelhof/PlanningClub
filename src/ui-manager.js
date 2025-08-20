import CryptoJS from 'crypto-js'

export class UIManager {
  constructor() {
    this.events = {}
    this.currentPage = null
    this.players = []
    this.selectedVote = null
    this.selectedReaction = null
    this.votesRevealed = false
    
    this.reactions = ['👍', '👎', '😄', '😕', '😲', '🤔', '🔥', '❤️']
  }

  init() {
    this.appContainer = document.getElementById('app')
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

  ensureAppContainer() {
    if (!this.appContainer) {
      this.appContainer = document.getElementById('app')
      if (!this.appContainer) {
        throw new Error('App container element not found')
      }
    }
  }

  getHomePageHTML() {
    return `
      <div class="home-page">
        <h1>Planning Poker</h1>
        <div class="home-actions">
          <div class="card">
            <h2>Create Session</h2>
            <form id="create-form">
              <div class="form-group">
                <label for="create-identity">Your Name or Email</label>
                <input type="text" id="create-identity" required maxlength="70" 
                       placeholder="John Doe or john@example.com">
                <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                  Enter your name or email address (for Gravatar)
                </small>
              </div>
              <button type="submit" class="btn">Create Session</button>
            </form>
          </div>
          
          <div class="card">
            <h2>Join Session</h2>
            <form id="join-form">
              <div class="form-group">
                <label for="join-session">Session ID</label>
                <input type="text" id="join-session" required pattern="\\d{9}" maxlength="9" placeholder="123456789">
              </div>
              <div class="form-group">
                <label for="join-identity">Your Name or Email</label>
                <input type="text" id="join-identity" required maxlength="70" 
                       placeholder="Jane Doe or jane@example.com">
                <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                  Enter your name or email address (for Gravatar)
                </small>
              </div>
              <button type="submit" class="btn">Join Session</button>
            </form>
          </div>
        </div>
        
        <div id="error-message" class="error hidden"></div>
        <div id="loading-message" class="loading hidden">Connecting...</div>
      </div>
    `
  }

  getGamePageHTML(sessionId) {
    return `
      <div class="game-page">
        <div class="game-header">
          <div class="session-info">
            <h2>Planning Poker</h2>
            <div class="session-id">Session: ${sessionId}</div>
          </div>
          <div class="game-actions">
            <button id="clear-votes" class="btn btn-secondary">Clear Votes</button>
            <button id="show-votes" class="btn btn-secondary">Show Votes</button>
          </div>
        </div>
        
        <div class="game-content">
          <div class="players-section">
            <h3>Players</h3>
            <div id="players-grid" class="players-grid">
              <!-- Players will be rendered here -->
            </div>
          </div>
          
          <div class="voting-section">
            <h3>Cast Your Vote</h3>
            <div id="voting-cards" class="voting-cards">
              <!-- Vote cards will be rendered here -->
            </div>
            
            <div id="voting-stats" class="voting-stats hidden">
              <h3>Voting Statistics</h3>
              <div class="stats-content">
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
          </div>
        </div>
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
  }

  bindGamePageEvents() {
    const clearBtn = document.getElementById('clear-votes')
    const showBtn = document.getElementById('show-votes')

    clearBtn.addEventListener('click', () => {
      this.hideVotingStats()
      this.votesRevealed = false
      this.emit('clearVotes')
    })

    showBtn.addEventListener('click', () => {
      this.emit('showVotes')
    })

    this.renderVoteCards()
    this.renderReactionButtons()
  }

  renderVoteCards() {
    const container = document.getElementById('voting-cards')
    const voteCards = ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']
    
    container.innerHTML = voteCards.map(card => `
      <div class="vote-card ${this.selectedVote === card ? 'selected' : ''}" data-vote="${card}">
        ${card}
      </div>
    `).join('')

    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('vote-card')) {
        const vote = e.target.dataset.vote
        this.selectVote(vote)
        this.emit('vote', vote)
      }
    })
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
    console.error('Planning Poker Error:', message)
    
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

    const statsContainer = document.getElementById('voting-stats')
    const averageEl = document.getElementById('average-value')
    const breakdownEl = document.getElementById('votes-breakdown-content')
    
    if (!statsContainer || !averageEl || !breakdownEl) return

    // Calculate statistics from current players
    const votingSummary = this.calculateVotingSummary()
    
    if (votingSummary.total === 0) {
      this.hideVotingStats()
      return
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

    // Show the stats container
    statsContainer.classList.remove('hidden')
  }

  hideVotingStats() {
    const statsContainer = document.getElementById('voting-stats')
    if (statsContainer) {
      statsContainer.classList.add('hidden')
    }
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