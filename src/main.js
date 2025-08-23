import { PlanningClubApp } from './app.js'

const app = new PlanningClubApp()
app.init()

// Make app available globally for testing
window.app = app
