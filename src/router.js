export class Router {
  constructor() {
    this.events = {}
    this.currentRoute = null
  }

  init() {
    this.handleRouteChange()
    window.addEventListener('popstate', () => this.handleRouteChange())
  }

  handleRouteChange() {
    const path = window.location.pathname
    
    if (path === '/' || path === '/index.html') {
      this.emit('route:home')
      this.currentRoute = 'home'
    } else if (path === '/about') {
      this.emit('route:about')
      this.currentRoute = 'about'
    } else {
      // Check if it's a session route (9-digit number)
      const sessionMatch = path.match(/^\/(\d{9})$/)
      if (sessionMatch) {
        const sessionId = sessionMatch[1]
        this.emit('route:session', sessionId)
        this.currentRoute = `session:${sessionId}`
      } else {
        // Invalid route, redirect to home
        this.navigate('/')
      }
    }
  }

  navigate(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
      this.handleRouteChange()
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