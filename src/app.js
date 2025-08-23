import { Router } from './router.js'
import { PeerManager } from './peer-manager.js'
import { GameManager } from './game-manager.js'
import { UIManager } from './ui-manager.js'
import { analytics } from './services/analytics.js'

export class PlanningClubApp {
  constructor() {
    this.router = new Router()
    this.peerManager = new PeerManager()
    this.gameManager = new GameManager()
    this.uiManager = new UIManager()
    
    this.setupEventListeners()
  }

  init() {
    // Initialize UI manager first to ensure DOM is ready
    this.uiManager.init()
    // Then initialize router which will trigger route events
    this.router.init()
    
    // Clean up connections when page is closed/refreshed
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
  }

  setupEventListeners() {
    // Router events
    this.router.on('route:home', () => {
      // Don't cleanup automatically on navigation to home
      // Only cleanup when explicitly creating/joining new sessions
      this.uiManager.showHomePage()
    })

    this.router.on('route:session', (sessionId) => {
      // Check if user has already joined this session
      const sessionData = this.getSessionData(sessionId)
      
      if (sessionData && sessionData.playerData) {
        // User has already joined this session, rejoin with existing data
        if (String(this.gameManager.sessionId) !== String(sessionId)) {
          this.joinSession(sessionId, sessionData.playerData)
        } else {
          // We're already in this session, just show the game page
          this.uiManager.showGamePage(sessionId)
        }
      } else {
        // New user accessing shared link - show name prompt
        this.uiManager.showJoinPrompt(sessionId)
      }
    })

    this.router.on('route:about', () => {
      this.uiManager.showAboutPage()
    })

    // Game events
    this.gameManager.on('playersUpdated', (players) => {
      this.uiManager.updatePlayers(players)
    })

    this.gameManager.on('votingComplete', () => {
      this.uiManager.revealVotes()
    })

    this.gameManager.on('reactionExpired', () => {
      this.uiManager.clearReactionSelection()
    })

    // Peer events
    this.peerManager.on('connected', (peerId) => {
      this.gameManager.setLocalPeerId(peerId)
    })

    this.peerManager.on('peerConnected', (peerId) => {
      this.gameManager.addPeer(peerId)
    })

    this.peerManager.on('peerDisconnected', (peerId) => {
      this.gameManager.removePeer(peerId)
    })

    this.peerManager.on('dataReceived', (peerId, data) => {
      this.gameManager.handlePeerMessage(peerId, data)
    })

    // UI events
    this.uiManager.on('createSession', (playerData) => {
      this.createSession(playerData)
    })

    this.uiManager.on('joinSession', (sessionId, playerData) => {
      this.joinSession(sessionId, playerData)
    })

    this.uiManager.on('vote', (vote) => {
      this.gameManager.castVote(vote)
      analytics.trackVoteSubmitted()
    })

    this.uiManager.on('clearVotes', () => {
      this.gameManager.clearVotes()
      analytics.trackVotingStarted()
    })

    this.uiManager.on('showVotes', () => {
      this.gameManager.showVotes()
      analytics.trackVotesRevealed()
    })

    this.uiManager.on('reaction', (reaction) => {
      this.gameManager.setReaction(reaction)
    })

    this.uiManager.on('navigate', (path) => {
      this.router.navigate(path)
    })

    // Game manager to peer manager bridge events
    this.gameManager.on('broadcast', (data) => {
      this.peerManager.broadcast(data)
    })

    this.gameManager.on('sendToPlayer', (peerId, data) => {
      this.peerManager.send(peerId, data)
    })
  }

  async createSession(playerData) {
    try {
      // Only cleanup if we're switching from one session to another
      if (this.gameManager.sessionId) {
        this.cleanup()
      }
      
      const sessionId = this.generateSessionId()
      
      // Save session data to localStorage
      this.saveSessionData(sessionId, playerData)
      
      // Set sessionId first to prevent route handler from triggering joinSession
      this.gameManager.setSessionId(sessionId)
      
      await this.peerManager.createSession(sessionId)
      this.router.navigate(`/${sessionId}`)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.createSession(sessionId, playerData)
      
      // Track room creation
      analytics.trackRoomCreated()
      analytics.trackUserJoined(true) // true = host
    } catch (error) {
      this.uiManager.showError('Failed to create session: ' + error.message)
    }
  }

  async joinSession(sessionId, playerData = null) {
    try {
      // Only cleanup if we're switching from one session to another
      if (this.gameManager.sessionId && String(this.gameManager.sessionId) !== String(sessionId)) {
        this.cleanup()
      }
      
      if (playerData) {
        // Save session data to localStorage
        this.saveSessionData(sessionId, playerData)
        this.gameManager.setPlayerData(playerData)
      }
      
      await this.peerManager.joinSession(sessionId)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.joinSession(sessionId)
      
      // Track participant joining
      analytics.trackUserJoined(false) // false = participant
    } catch (error) {
      this.uiManager.showError('Failed to join session: ' + error.message)
      this.router.navigate('/')
    }
  }

  cleanup() {
    // Track if user was in a room
    if (this.gameManager.sessionId) {
      analytics.trackRoomLeft()
    }
    
    // Disconnect from peers
    this.peerManager.disconnect()
    
    // Reset game manager
    this.gameManager.reset()
    
    // Hide loading states
    this.uiManager.hideLoading()
  }

  generateSessionId() {
    return Math.floor(Math.random() * 900000000) + 100000000
  }

  saveSessionData(sessionId, playerData) {
    try {
      const sessions = JSON.parse(localStorage.getItem('planningClubSessions') || '{}')
      sessions[sessionId] = {
        playerData,
        joinedAt: Date.now()
      }
      // Keep only last 10 sessions to avoid localStorage bloat
      const sessionKeys = Object.keys(sessions)
      if (sessionKeys.length > 10) {
        const sortedKeys = sessionKeys.sort((a, b) => sessions[a].joinedAt - sessions[b].joinedAt)
        for (let i = 0; i < sessionKeys.length - 10; i++) {
          delete sessions[sortedKeys[i]]
        }
      }
      localStorage.setItem('planningClubSessions', JSON.stringify(sessions))
    } catch (e) {
      console.warn('Failed to save session data:', e)
    }
  }

  getSessionData(sessionId) {
    try {
      const sessions = JSON.parse(localStorage.getItem('planningClubSessions') || '{}')
      return sessions[sessionId] || null
    } catch (e) {
      console.warn('Failed to load session data:', e)
      return null
    }
  }
}