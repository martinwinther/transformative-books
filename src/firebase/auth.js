import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, firebaseEnabled } from './client'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

function assertFirebaseEnabled() {
  if (!firebaseEnabled || !auth) {
    throw new Error('Firebase auth is not configured.')
  }
}

/**
 * @param {import('firebase/auth').User | null} user
 * @returns {{ uid: string, email: string, emailVerified: boolean } | null}
 */
export function toAuthSession(user) {
  if (!user) return null
  return {
    uid: user.uid,
    email: user.email ?? '',
    emailVerified: user.emailVerified === true,
  }
}

/**
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void}
 */
export function onAuthSessionChange(callback) {
  if (!firebaseEnabled || !auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export function getCurrentAuthUser() {
  if (!firebaseEnabled || !auth) return null
  return auth.currentUser
}

export async function signUpWithEmail(email, password) {
  assertFirebaseEnabled()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await sendEmailVerification(credential.user)
  return credential.user
}

export async function signInWithEmail(email, password) {
  assertFirebaseEnabled()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signInWithGoogle() {
  assertFirebaseEnabled()
  const credential = await signInWithPopup(auth, googleProvider)
  return credential.user
}

export async function sendVerificationEmail() {
  assertFirebaseEnabled()
  const user = auth.currentUser
  if (!user) throw new Error('No authenticated user.')
  await sendEmailVerification(user)
}

export async function refreshAuthUser() {
  assertFirebaseEnabled()
  const user = auth.currentUser
  if (!user) return null
  await reload(user)
  return auth.currentUser
}

export async function signOutCurrentUser() {
  assertFirebaseEnabled()
  await signOut(auth)
}
