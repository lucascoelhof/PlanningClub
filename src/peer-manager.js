// PeerJS is loaded globally from CDN
const Peer = window.Peer;

export class PeerManager {
  constructor() {
    this.peer = null
    this.connections = new Map()
    this.events = {}
    this.sessionId = null
    this.isHost = false
  }

  async createSession(sessionId) {
    // Check if already connected
    if (this.peer && this.peer.open) {
      console.log('Already connected to peer network, not creating new connection')
      return Promise.resolve()
    }
    
    this.sessionId = sessionId
    this.isHost = true
    
    return new Promise((resolve, reject) => {
      console.log('Creating new peer connection for hosting session')
      // Try the default PeerJS cloud service first
      this.peer = new Peer(`host-${sessionId}`, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      })

      this.peer.on('open', (id) => {
        console.log('Host peer connected with ID:', id)
        this.emit('connected', id)
        resolve()
      })

      this.peer.on('connection', (conn) => {
        console.log('Received connection request from:', conn.peer, 'Open:', conn.open)
        
        // Set up handlers for the connection
        this.setupConnectionHandlers(conn)
        
        // Handle the connection when it opens
        if (conn.open) {
          console.log('Incoming connection already open')
          this.handleIncomingConnection(conn)
        } else {
          // Wait for connection to open
          conn.on('open', () => {
            console.log('Incoming connection opened from:', conn.peer)
            this.handleIncomingConnection(conn)
          })
        }
      })

      this.peer.on('error', (error) => {
        console.error('Peer error:', error)
        reject(error)
      })

      setTimeout(() => {
        if (!this.peer.open) {
          reject(new Error('Connection timeout'))
        }
      }, 10000)
    })
  }

  async joinSession(sessionId) {
    // Check if already connected
    if (this.peer && this.peer.open) {
      console.log('Already connected to peer network, not creating new connection')
      return Promise.resolve()
    }
    
    this.sessionId = sessionId
    this.isHost = false
    
    return new Promise((resolve, reject) => {
      console.log('Creating new peer connection for joining session')
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      })

      this.peer.on('open', (id) => {
        console.log('Client peer connected with ID:', id)
        this.emit('connected', id)
        
        // Connect to host
        const hostConnection = this.peer.connect(`host-${sessionId}`)
        
        // Check if connection is already open
        if (hostConnection.open) {
          console.log('Connection to host already open')
          this.handleOutgoingConnection(hostConnection)
          resolve()
        } else {
          hostConnection.on('open', () => {
            console.log('Connected to host')
            this.handleOutgoingConnection(hostConnection)
            resolve()
          })
        }

        hostConnection.on('error', (error) => {
          console.error('Connection to host failed:', error)
          reject(error)
        })

        setTimeout(() => {
          if (!hostConnection.open) {
            console.error('Connection timeout - host connection did not open')
            reject(new Error('Failed to connect to session'))
          }
        }, 10000)
      })

      this.peer.on('connection', (conn) => {
        console.log('Received connection request from:', conn.peer, 'Open:', conn.open)
        
        // Set up handlers for the connection
        this.setupConnectionHandlers(conn)
        
        // Handle the connection when it opens
        if (conn.open) {
          console.log('Incoming connection already open')
          this.handleIncomingConnection(conn)
        } else {
          // Wait for connection to open
          conn.on('open', () => {
            console.log('Incoming connection opened from:', conn.peer)
            this.handleIncomingConnection(conn)
          })
        }
      })

      this.peer.on('error', (error) => {
        console.error('Peer error:', error)
        reject(error)
      })
    })
  }

  setupConnectionHandlers(conn) {
    // Set up data, close, and error handlers immediately
    conn.on('data', (data) => {
      console.log('Data received from', conn.peer, ':', data)
      this.handlePeerData(conn.peer, data)
    })

    conn.on('close', () => {
      console.log('Connection closed for:', conn.peer)
      this.connections.delete(conn.peer)
      this.emit('peerDisconnected', conn.peer)
    })

    conn.on('error', (error) => {
      console.error('Connection error for', conn.peer, ':', error)
      // Don't delete connection on error, let close event handle it
    })
  }

  handleIncomingConnection(conn) {
    console.log('Handling incoming connection from:', conn.peer)
    
    // Connection should already be open when this is called
    this.connections.set(conn.peer, conn)
    this.emit('peerConnected', conn.peer)
    
    // If we're the host, share the current connection list with new peer
    if (this.isHost) {
      this.broadcastConnectionList()
      
      // Help establish P2P connections between all peers
      setTimeout(() => {
        if (conn.open) {
          conn.send({
            type: 'peer_list',
            peers: Array.from(this.connections.keys()).filter(id => id !== conn.peer)
          })
        }
      }, 100) // Small delay to ensure connection is stable
    }
  }

  handleOutgoingConnection(conn) {
    console.log('Outgoing connection established with:', conn.peer, 'Connection state:', conn.open)
    
    // Set up handlers immediately
    this.setupConnectionHandlers(conn)
    
    // Add to connections
    this.connections.set(conn.peer, conn)
    this.emit('peerConnected', conn.peer)
  }

  handlePeerData(peerId, data) {
    // Prevent handling our own data (shouldn't happen but safeguard)
    if (peerId === this.peer?.id) {
      console.warn('Received data from self, ignoring')
      return
    }
    
    console.log('Received data from', peerId, ':', data)
    
    if (data.type === 'peer_list' && !this.isHost) {
      // Connect to other peers in the session
      data.peers.forEach(peer => {
        if (!this.connections.has(peer) && peer !== this.peer.id) {
          const conn = this.peer.connect(peer)
          conn.on('open', () => {
            this.handleOutgoingConnection(conn)
          })
        }
      })
    } else {
      this.emit('dataReceived', peerId, data)
    }
  }

  broadcastConnectionList() {
    const peerList = Array.from(this.connections.keys())
    this.broadcast({
      type: 'connection_update',
      peers: peerList
    })
  }

  broadcast(data) {
    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        try {
          conn.send(data)
        } catch (error) {
          console.error('Failed to send data to', peerId, ':', error)
        }
      }
    })
  }

  send(peerId, data) {
    const conn = this.connections.get(peerId)
    if (conn && conn.open) {
      try {
        conn.send(data)
      } catch (error) {
        console.error('Failed to send data to', peerId, ':', error)
      }
    }
  }

  disconnect() {
    this.connections.forEach((conn) => {
      conn.close()
    })
    this.connections.clear()
    
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
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