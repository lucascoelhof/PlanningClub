import { Router } from './router.js'
import { PeerManager } from './peer-manager.js'
import { GameManager } from './game-manager.js'
import { UIManager } from './ui-manager.js'

export class PlanningPokerApp {
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
      // Only join if we're not already in this session (convert to string for comparison)
      if (String(this.gameManager.sessionId) !== String(sessionId)) {
        this.joinSession(sessionId)
      } else {
        // We're already in this session, just show the game page
        this.uiManager.showGamePage(sessionId)
      }
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
    })

    this.uiManager.on('clearVotes', () => {
      this.gameManager.clearVotes()
    })

    this.uiManager.on('showVotes', () => {
      this.gameManager.showVotes()
    })

    this.uiManager.on('reaction', (reaction) => {
      this.gameManager.setReaction(reaction)
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
      
      // Set sessionId first to prevent route handler from triggering joinSession
      this.gameManager.setSessionId(sessionId)
      
      await this.peerManager.createSession(sessionId)
      this.router.navigate(`/${sessionId}`)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.createSession(sessionId, playerData)
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
        this.gameManager.setPlayerData(playerData)
      }
      
      await this.peerManager.joinSession(sessionId)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.joinSession(sessionId)
    } catch (error) {
      this.uiManager.showError('Failed to join session: ' + error.message)
      this.router.navigate('/')
    }
  }

  cleanup() {
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
}