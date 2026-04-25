import { createRoot } from 'react-dom/client'
import './styles.css'

const RELOAD_WINDOW_MS = 15000
const RELOAD_THRESHOLD = 4
const WINDOW_NAME_KEY = 'tbBootTimestamps'

function detectIosWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua)
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (!isAppleMobile && !isTouchMac) return false
  return /AppleWebKit/i.test(ua)
}

function readWindowNameState() {
  if (typeof window === 'undefined') return {}
  try {
    const value = window.name
    if (!value) return {}
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeWindowNameState(state) {
  if (typeof window === 'undefined') return
  try {
    window.name = JSON.stringify(state)
  } catch {
    // Ignore if browser blocks window.name writes.
  }
}

function markBootAndCheckLoop() {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  const state = readWindowNameState()
  const previous = Array.isArray(state[WINDOW_NAME_KEY]) ? state[WINDOW_NAME_KEY] : []
  const recent = previous.filter((ts) => typeof ts === 'number' && now - ts <= RELOAD_WINDOW_MS)
  const next = [...recent, now]
  writeWindowNameState({ ...state, [WINDOW_NAME_KEY]: next })
  return next.length >= RELOAD_THRESHOLD
}

const safeModeEnabled = markBootAndCheckLoop()
const iosWebKitDetected = detectIosWebKit()
const stabilityModeEnabled = safeModeEnabled || iosWebKitDetected

if (typeof window !== 'undefined' && stabilityModeEnabled) {
  window.__TB_STABILITY_MODE__ = true
  window.__TB_DISABLE_FIREBASE__ = true
  window.__TB_DISABLE_FIREBASE_REASON__ = safeModeEnabled
    ? 'safe-mode-reload-loop'
    : 'ios-webkit-stability'
  document.documentElement.dataset.stabilityMode = 'true'
  document.documentElement.dataset.reducedEffects = 'true'
}

if (typeof window !== 'undefined' && safeModeEnabled) {
  window.__TB_SAFE_MODE__ = true
  document.documentElement.dataset.safeMode = 'true'
}

if (typeof window !== 'undefined' && iosWebKitDetected) {
  window.__TB_IOS_WEBKIT__ = true
  document.documentElement.dataset.iosWebkit = 'true'
}

const root = createRoot(document.getElementById('root'))

async function bootstrap() {
  const { default: App } = await import('./App.jsx')
  root.render(<App />)
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap app', error)
  root.render(
    <main style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>Unable to start the app</h1>
      <p>Please refresh the page. If this keeps happening, try another browser.</p>
    </main>
  )
})
