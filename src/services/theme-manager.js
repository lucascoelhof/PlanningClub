// Theme Manager for handling dark/light theme switching with user preferences
export class ThemeManager {
  constructor() {
    this.currentTheme = 'dark' // default
    this.themes = {
      dark: {
        name: 'Dark',
        icon: '🌙',
        cssClass: 'theme-dark'
      },
      light: {
        name: 'Light', 
        icon: '☀️',
        cssClass: 'theme-light'
      },
      auto: {
        name: 'Auto',
        icon: '🌓',
        cssClass: 'theme-auto'
      }
    }
    
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.events = {}
    
    this.init()
  }

  init() {
    // Load saved theme preference
    this.currentTheme = this.getStoredTheme()
    
    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto')
        this.emit('themeChanged', { 
          theme: 'auto', 
          effectiveTheme: e.matches ? 'dark' : 'light' 
        })
      }
    })
    
    // Apply initial theme
    this.applyTheme(this.currentTheme)
  }

  getStoredTheme() {
    try {
      const stored = localStorage.getItem('planningClub_theme')
      if (stored && this.themes[stored]) {
        return stored
      }
    } catch (e) {
      // localStorage might be unavailable
    }
    
    // Default to auto (follows system preference)
    return 'auto'
  }

  setTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`Unknown theme: ${themeName}`)
      return false
    }

    this.currentTheme = themeName
    this.applyTheme(themeName)
    this.saveTheme(themeName)
    
    this.emit('themeChanged', { 
      theme: themeName,
      effectiveTheme: this.getEffectiveTheme(themeName)
    })
    
    return true
  }

  applyTheme(themeName) {
    const body = document.body
    const effectiveTheme = this.getEffectiveTheme(themeName)
    
    // Remove all theme classes
    Object.values(this.themes).forEach(theme => {
      body.classList.remove(theme.cssClass)
    })
    
    // Add the effective theme class
    const themeConfig = this.themes[effectiveTheme] || this.themes.dark
    body.classList.add(themeConfig.cssClass)
    
    // Update CSS custom properties for theme
    this.updateCSSProperties(effectiveTheme)
  }

  getEffectiveTheme(themeName = this.currentTheme) {
    if (themeName === 'auto') {
      return this.mediaQuery.matches ? 'dark' : 'light'
    }
    return themeName
  }

  updateCSSProperties(effectiveTheme) {
    const root = document.documentElement
    
    if (effectiveTheme === 'light') {
      // Light theme colors
      root.style.setProperty('--bg-primary', '#ffffff')
      root.style.setProperty('--bg-secondary', '#f8fafc')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-glass', 'rgba(255, 255, 255, 0.9)')
      
      root.style.setProperty('--text-primary', '#1e293b')
      root.style.setProperty('--text-secondary', '#475569')
      root.style.setProperty('--text-muted', '#64748b')
      
      root.style.setProperty('--border-primary', 'rgba(0, 0, 0, 0.1)')
      root.style.setProperty('--border-secondary', 'rgba(0, 0, 0, 0.05)')
      
      root.style.setProperty('--shadow-primary', 'rgba(0, 0, 0, 0.1)')
      root.style.setProperty('--shadow-secondary', 'rgba(0, 0, 0, 0.05)')
      
      // Update background gradient for light theme
      document.body.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)'
    } else {
      // Dark theme colors (default)
      root.style.setProperty('--bg-primary', '#0c0c0c')
      root.style.setProperty('--bg-secondary', '#1a1a2e')
      root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.05)')
      root.style.setProperty('--bg-glass', 'rgba(255, 255, 255, 0.1)')
      
      root.style.setProperty('--text-primary', '#e2e8f0')
      root.style.setProperty('--text-secondary', '#cbd5e1')
      root.style.setProperty('--text-muted', '#94a3b8')
      
      root.style.setProperty('--border-primary', 'rgba(255, 255, 255, 0.1)')
      root.style.setProperty('--border-secondary', 'rgba(255, 255, 255, 0.05)')
      
      root.style.setProperty('--shadow-primary', 'rgba(0, 0, 0, 0.3)')
      root.style.setProperty('--shadow-secondary', 'rgba(0, 0, 0, 0.1)')
      
      // Keep original dark background gradient
      document.body.style.background = 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #0c0c0c 100%)'
    }
  }

  saveTheme(themeName) {
    try {
      localStorage.setItem('planningClub_theme', themeName)
    } catch (e) {
      console.warn('Could not save theme preference:', e)
    }
  }

  getCurrentTheme() {
    return this.currentTheme
  }

  getEffectiveThemeInfo() {
    const effectiveTheme = this.getEffectiveTheme()
    return {
      current: this.currentTheme,
      effective: effectiveTheme,
      info: this.themes[effectiveTheme],
      isAuto: this.currentTheme === 'auto'
    }
  }

  getThemeList() {
    return Object.entries(this.themes).map(([key, theme]) => ({
      key,
      ...theme,
      isCurrent: key === this.currentTheme,
      isEffective: key === this.getEffectiveTheme()
    }))
  }

  toggleTheme() {
    const themes = Object.keys(this.themes)
    const currentIndex = themes.indexOf(this.currentTheme)
    const nextIndex = (currentIndex + 1) % themes.length
    const nextTheme = themes[nextIndex]
    
    this.setTheme(nextTheme)
    return nextTheme
  }

  // Event system
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback)
    }
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.warn('Error in theme manager event handler:', error)
        }
      })
    }
  }

  // Cleanup
  destroy() {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange)
  }
}