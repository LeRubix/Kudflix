import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bebas-neue/latin.css'
import './index.css'
import App from './App.tsx'
import PlayerApp from './PlayerApp.tsx'

const isPlayerWindow = new URLSearchParams(window.location.search).has('player')
const root = createRoot(document.getElementById('root')!)

if (isPlayerWindow) {
  document.documentElement.classList.add('player-window')
  // No StrictMode here: double-mounting would spawn mpv twice
  root.render(<PlayerApp />)
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
