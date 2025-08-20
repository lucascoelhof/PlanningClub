import './style.css'
import { PlanningPokerApp } from './app.js'

const app = new PlanningPokerApp()
app.init()

// Make app available globally for testing
window.app = app
