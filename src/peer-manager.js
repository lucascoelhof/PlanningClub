import Peer from 'peerjs'

export class PeerManager {
  constructor() {
    this.peer = null
    this.connections = new Map()
    this.events = {}
    this.sessionId = null
    this.isHost = false
  }

  async createSession(sessionId) {
    this.sessionId = sessionId
    this.isHost = true
    
    return new Promise((resolve, reject) => {
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
        this.handleIncomingConnection(conn)
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
    this.sessionId = sessionId
    this.isHost = false
    
    return new Promise((resolve, reject) => {
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
        
        hostConnection.on('open', () => {
          console.log('Connected to host')
          this.handleOutgoingConnection(hostConnection)
          resolve()
        })

        hostConnection.on('error', (error) => {
          console.error('Connection to host failed:', error)
          reject(error)
        })

        setTimeout(() => {
          if (!hostConnection.open) {
            reject(new Error('Failed to connect to session'))
          }
        }, 10000)
      })

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn)
      })

      this.peer.on('error', (error) => {
        console.error('Peer error:', error)
        reject(error)
      })
    })
  }

  handleIncomingConnection(conn) {
    console.log('Incoming connection from:', conn.peer)
    
    conn.on('open', () => {
      this.connections.set(conn.peer, conn)
      this.emit('peerConnected', conn.peer)
      
      // If we're the host, share the current connection list with new peer
      if (this.isHost) {
        this.broadcastConnectionList()
        
        // Help establish P2P connections between all peers
        conn.send({
          type: 'peer_list',
          peers: Array.from(this.connections.keys()).filter(id => id !== conn.peer)
        })
      }
    })

    conn.on('data', (data) => {
      this.handlePeerData(conn.peer, data)
    })

    conn.on('close', () => {
      this.connections.delete(conn.peer)
      this.emit('peerDisconnected', conn.peer)
    })

    conn.on('error', (error) => {
      console.error('Connection error:', error)
      this.connections.delete(conn.peer)
      this.emit('peerDisconnected', conn.peer)
    })
  }

  handleOutgoingConnection(conn) {
    console.log('Outgoing connection established with:', conn.peer)
    
    this.connections.set(conn.peer, conn)
    this.emit('peerConnected', conn.peer)

    conn.on('data', (data) => {
      this.handlePeerData(conn.peer, data)
    })

    conn.on('close', () => {
      this.connections.delete(conn.peer)
      this.emit('peerDisconnected', conn.peer)
    })

    conn.on('error', (error) => {
      console.error('Connection error:', error)
      this.connections.delete(conn.peer)
      this.emit('peerDisconnected', conn.peer)
    })
  }

  handlePeerData(peerId, data) {
    console.log('Received data from', peerId, ':', data)
    
    if (data.type === 'peer_list' && !this.isHost) {
      // Connect to other peers in the session
      data.peers.forEach(peer => {
        if (!this.connections.has(peer)) {
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