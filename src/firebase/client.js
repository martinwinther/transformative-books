import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

function detectIosWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIosPlatform =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return isIosPlatform && /AppleWebKit/i.test(ua)
}

function resolveFirebaseRuntimeDisableReason() {
  if (typeof window !== 'undefined' && typeof window.__TB_DISABLE_FIREBASE_REASON__ === 'string') {
    return window.__TB_DISABLE_FIREBASE_REASON__
  }
  if (typeof window !== 'undefined' && window.__TB_DISABLE_FIREBASE__ === true) {
    return 'safe-mode-reload-loop'
  }
  if (typeof window !== 'undefined' && window.__TB_IOS_WEBKIT__ === true) {
    return 'ios-webkit-stability'
  }
  if (detectIosWebKit()) {
    return 'ios-webkit-stability'
  }
  return ''
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
}

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
export const firebaseMissingKeys = requiredFirebaseKeys.filter((key) => !firebaseConfig[key])
export const firebaseRuntimeDisabledReason = resolveFirebaseRuntimeDisableReason()
export const firebaseEnabled = firebaseMissingKeys.length === 0 && !firebaseRuntimeDisabledReason

const appInstance = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null
const authInstance = appInstance ? getAuth(appInstance) : null
const dbInstance = appInstance ? getFirestore(appInstance) : null

const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'
const authPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099)
const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080)
const shouldUseEmulators =
  firebaseEnabled &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

if (shouldUseEmulators && authInstance && dbInstance) {
  try {
    connectAuthEmulator(authInstance, `http://${emulatorHost}:${authPort}`, { disableWarnings: true })
  } catch {
    // Auth emulator can only be connected once per app lifecycle.
  }
  try {
    connectFirestoreEmulator(dbInstance, emulatorHost, firestorePort)
  } catch {
    // Firestore emulator can only be connected once per app lifecycle.
  }
}

export const app = appInstance
export const auth = authInstance
export const db = dbInstance
