import { Router } from './router.js'
import { PeerManager } from './peer-manager.js'
import { GameManager } from './game-manager.js'
import { UIManager } from './ui-manager.js'
import { ConnectionManager } from './services/connection-manager.js'
import { ErrorHandler } from './services/error-handler.js'
import { ThemeManager } from './services/theme-manager.js'
import { analytics } from './services/analytics.js'

export class RapidPlanningApp {
  constructor() {
    this.router = new Router()
    this.peerManager = new PeerManager()
    this.gameManager = new GameManager()
    this.connectionManager = new ConnectionManager()
    this.themeManager = new ThemeManager()
    this.uiManager = new UIManager(this.gameManager, this.connectionManager, this.themeManager)
    this.errorHandler = new ErrorHandler(this.uiManager)
    this.pendingGameState = null
    
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
      // Check if we're already in this session to prevent infinite loops
      if (String(this.gameManager.sessionId) === String(sessionId)) {
        this.uiManager.showGamePage(sessionId)
        return
      }
      
      // Check if user has already joined this session
      const sessionData = this.getSessionData(sessionId)
      
      if (sessionData && sessionData.playerData) {
        // User has already joined this session, rejoin with existing data
        // Show game page immediately to ensure UI is available
        this.gameManager.setSessionId(sessionId)
        this.gameManager.setPlayerData(sessionData.playerData)
        this.uiManager.showGamePage(sessionId)
        
        // Restore game state immediately after UI is rendered
        if (sessionData.gameState) {
          setTimeout(() => {
            this.restoreGameState(sessionData.gameState)
          }, 100) // Short delay to ensure DOM is ready
        }
        
        // Then attempt to rejoin session in background (without adding local player again)
        this.rejoinSessionBackground(sessionId, sessionData.playerData)
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
      // Persist state after automatic vote reveal
      this.persistCurrentState()
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
      // Persist state after voting
      this.persistCurrentState()
    })

    this.uiManager.on('clearVotes', () => {
      this.gameManager.clearVotes()
      analytics.trackVotingStarted()
      // Persist state after clearing votes
      this.persistCurrentState()
    })

    this.uiManager.on('showVotes', () => {
      this.gameManager.showVotes()
      analytics.trackVotesRevealed()
      // Persist state after showing votes
      this.persistCurrentState()
    })

    this.uiManager.on('reaction', (reaction) => {
      this.gameManager.setReaction(reaction)
      // Persist state after reaction change
      this.persistCurrentState()
    })

    this.uiManager.on('navigate', (path) => {
      if (path === '/') {
        this.router.navigate('home')
      } else if (path === '/about') {
        this.router.navigate('about')
      }
    })

    // Game manager to peer manager bridge events
    this.gameManager.on('broadcast', (data) => {
      this.peerManager.broadcast(data)
    })

    this.gameManager.on('sendToPlayer', (peerId, data) => {
      this.peerManager.send(peerId, data)
    })

    // Connection manager events
    this.connectionManager.on('connectionLost', () => {
      console.log('Connection lost - enabling offline mode')
      this.handleConnectionLoss()
    })

    this.connectionManager.on('connectionRestored', () => {
      console.log('Connection restored - attempting to reconnect')
      this.handleConnectionRestored()
    })

    this.connectionManager.on('offlineModeEnabled', () => {
      // Show offline capabilities
      this.uiManager.showOfflineMessage()
    })
  }

  async createSession(playerData) {
    return await this.errorHandler.safeAsync(async () => {
      // Only cleanup if we're switching from one session to another
      if (this.gameManager.sessionId) {
        this.cleanup()
      }
      
      const sessionId = this.generateSessionId()
      
      // Save session data to localStorage
      this.saveSessionData(sessionId, playerData)
      
      // Set sessionId first to prevent route handler from triggering joinSession
      this.gameManager.setSessionId(sessionId)
      
      // Only create new connection if we don't have one already
      if (!this.peerManager.peer || !this.peerManager.peer.open) {
        await this.peerManager.createSession(sessionId)
      }
      this.router.navigate('session', sessionId)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.createSession(sessionId, playerData)
      
      // Restore pending game state if available (for host refresh)
      if (this.pendingGameState) {
        setTimeout(() => {
          this.restoreGameState(this.pendingGameState)
          this.pendingGameState = null
        }, 1500)
      }
      
      // Track room creation
      analytics.trackRoomCreated()
      analytics.trackUserJoined(true) // true = host
    }, { operation: 'createSession' })
  }

  async rejoinSessionBackground(sessionId, playerData) {
    try {
      // Only create new connection if we don't have one already
      if (!this.peerManager.peer || !this.peerManager.peer.open) {
        await this.peerManager.joinSession(sessionId)
      }
      
      // Don't call gameManager.joinSession() as it would add local player again
      // The local player is already added by setPlayerData() above
      
      // Track participant joining
      analytics.trackUserJoined(false) // false = participant
    } catch (error) {
      console.warn('Failed to rejoin session in background:', error.message)
      // Don't navigate away on peer connection failures during refresh
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
      
      // Set session ID first to prevent route handler from triggering joinSession again
      this.gameManager.setSessionId(sessionId)
      
      // Only create new connection if we don't have one already
      if (!this.peerManager.peer || !this.peerManager.peer.open) {
        await this.peerManager.joinSession(sessionId)
      }
      
      this.router.navigate('session', sessionId)
      this.uiManager.showGamePage(sessionId)
      this.gameManager.joinSession(sessionId)
      
      // Restore pending game state if available
      if (this.pendingGameState) {
        setTimeout(() => {
          this.restoreGameState(this.pendingGameState)
          this.pendingGameState = null
        }, 1500) // Give UI more time to fully render
      }
      
      // Track participant joining
      analytics.trackUserJoined(false) // false = participant
    } catch (error) {
      this.uiManager.showError('Failed to join session: ' + error.message)
      this.router.navigate('home')
    }
  }

  handleConnectionLoss() {
    // Enable offline mode - we can still:
    // 1. Show the UI and allow local interactions
    // 2. Save state locally
    // 3. Queue actions for when connection returns
    this.connectionManager.enableOfflineMode()
    
    // Stop trying to send data over peer connections
    this.peerManager.pauseConnections()
  }

  handleConnectionRestored() {
    // Try to reconnect to the session if we were in one
    if (this.gameManager.sessionId && this.gameManager.playerData) {
      this.connectionManager.attemptReconnection(() => {
        return this.rejoinSessionBackground(this.gameManager.sessionId, this.gameManager.playerData)
      })
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
    
    // Cleanup connection manager
    if (this.connectionManager) {
      this.connectionManager.destroy()
    }
  }

  generateSessionId() {
    return Math.floor(Math.random() * 900000000) + 100000000
  }

  saveSessionData(sessionId, playerData, gameState = null) {
    try {
      const sessions = JSON.parse(localStorage.getItem('rapidPlanningSessions') || '{}')
      
      // Get existing session data or create new
      const existingSession = sessions[sessionId] || {}
      
      sessions[sessionId] = {
        playerData: playerData || existingSession.playerData,
        gameState: gameState || existingSession.gameState,
        joinedAt: existingSession.joinedAt || Date.now(),
        lastUpdated: Date.now()
      }
      
      // Keep only last 10 sessions to avoid localStorage bloat
      const sessionKeys = Object.keys(sessions)
      if (sessionKeys.length > 10) {
        const sortedKeys = sessionKeys.sort((a, b) => sessions[a].joinedAt - sessions[b].joinedAt)
        for (let i = 0; i < sessionKeys.length - 10; i++) {
          delete sessions[sortedKeys[i]]
        }
      }
      
      localStorage.setItem('rapidPlanningSessions', JSON.stringify(sessions))
    } catch (e) {
      console.warn('Failed to save session data:', e)
    }
  }

  getSessionData(sessionId) {
    try {
      const sessions = JSON.parse(localStorage.getItem('rapidPlanningSessions') || '{}')
      return sessions[sessionId] || null
    } catch (e) {
      console.warn('Failed to load session data:', e)
      return null
    }
  }

  getCurrentGameState() {
    try {
      return {
        selectedVote: this.uiManager ? this.uiManager.selectedVote : null,
        selectedReaction: this.uiManager ? this.uiManager.selectedReaction : null,
        votesRevealed: this.gameManager ? this.gameManager.votesRevealed : false,
        localPlayerVote: this.gameManager ? this.gameManager.getLocalPlayerVote() : null,
        timestamp: Date.now()
      }
    } catch (error) {
      console.warn('Error getting current game state:', error)
      return {
        selectedVote: null,
        selectedReaction: null,
        votesRevealed: false,
        localPlayerVote: null,
        timestamp: Date.now()
      }
    }
  }

  restoreGameState(gameState) {
    if (!gameState) return

    try {
      // Restore UI state
      if (gameState.selectedVote && this.uiManager) {
        this.uiManager.selectedVote = gameState.selectedVote
        this.uiManager.renderVoteCards()
        
        // Also restore the vote in game manager for local player
        if (this.gameManager && this.gameManager.localPeerId) {
          const localPlayer = this.gameManager.players.get(this.gameManager.localPeerId)
          if (localPlayer) {
            localPlayer.vote = gameState.selectedVote
            this.gameManager.players.set(this.gameManager.localPeerId, localPlayer)
            this.gameManager.emit('playersUpdated', Array.from(this.gameManager.players.values()))
          }
        }
      }

      if (gameState.selectedReaction && this.uiManager) {
        this.uiManager.selectedReaction = gameState.selectedReaction
        this.uiManager.renderReactionButtons()
        
        // Also restore the reaction in game manager for local player
        if (this.gameManager && this.gameManager.localPeerId) {
          const localPlayer = this.gameManager.players.get(this.gameManager.localPeerId)
          if (localPlayer) {
            localPlayer.reaction = gameState.selectedReaction
            this.gameManager.players.set(this.gameManager.localPeerId, localPlayer)
            this.gameManager.emit('playersUpdated', Array.from(this.gameManager.players.values()))
          }
        }
      }

      if (gameState.votesRevealed && this.uiManager && this.gameManager) {
        this.uiManager.votesRevealed = gameState.votesRevealed
        this.gameManager.votesRevealed = gameState.votesRevealed
        if (gameState.votesRevealed) {
          // Update players in UI manager from game manager
          this.uiManager.updatePlayers(Array.from(this.gameManager.players.values()))
          this.uiManager.showVotingStats()
        }
      }
    } catch (error) {
      console.warn('Error restoring game state:', error)
    }
  }

  persistCurrentState() {
    if (this.gameManager && this.gameManager.sessionId) {
      const gameState = this.getCurrentGameState()
      this.saveSessionData(this.gameManager.sessionId, null, gameState)
    }
  }
}