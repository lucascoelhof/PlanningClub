import './style.css'
import { PlanningClubsApp } from './app.js'

const app = new PlanningClubsApp()
app.init()

// Make app available globally for testing
window.app = app
