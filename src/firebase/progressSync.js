import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { MAX_NOTES_LENGTH, hasMeaningfulProgress, normalizeProgressEntry, normalizeProgressMap } from '../data/bookProgress'
import { db, firebaseEnabled } from './client'

function assertFirebaseEnabled() {
  if (!firebaseEnabled || !db) {
    throw new Error('Firebase Firestore is not configured.')
  }
}

function userDocRef(uid) {
  return doc(db, 'users', uid)
}

function progressCollectionRef(uid) {
  return collection(db, 'users', uid, 'bookProgress')
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function timestampToMillis(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const numeric = Number(raw)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof raw === 'object' && raw !== null) {
    if (typeof raw.toMillis === 'function') return raw.toMillis()
    if (typeof raw.seconds === 'number') return raw.seconds * 1000
  }
  return null
}

/**
 * @param {any} entry
 * @param {string} deviceId
 * @returns {Record<string, any> | null}
 */
function toFirestoreProgressEntry(entry, deviceId) {
  const normalized = normalizeProgressEntry(entry)
  if (!normalized || !hasMeaningfulProgress(normalized)) return null

  return {
    isRead: normalized.isRead,
    owns: normalized.owns,
    notes: normalized.notes.slice(0, MAX_NOTES_LENGTH),
    userRating: normalized.userRating,
    updatedAt: serverTimestamp(),
    updatedByDevice: (normalized.updatedByDevice || deviceId || '').slice(0, 120),
  }
}

/**
 * @param {Record<string, any>} raw
 * @returns {import('../types/book.js').BookProgress | null}
 */
function fromFirestoreProgressEntry(raw) {
  return normalizeProgressEntry({
    isRead: raw?.isRead === true,
    owns: raw?.owns === true,
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    userRating: raw?.userRating ?? null,
    updatedAt: timestampToMillis(raw?.updatedAt),
    updatedByDevice: typeof raw?.updatedByDevice === 'string' ? raw.updatedByDevice : '',
  })
}

export async function ensureUserProfile(uid) {
  assertFirebaseEnabled()
  const ref = userDocRef(uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) {
    const data = snapshot.data() || {}
    await setDoc(
      ref,
      {
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    )
    return data
  }

  const initialProfile = {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    migrationVersion: 0,
  }
  await setDoc(ref, initialProfile, { merge: true })
  return { migrationVersion: 0 }
}

export async function setUserMigrationVersion(uid, migrationVersion) {
  assertFirebaseEnabled()
  await setDoc(
    userDocRef(uid),
    {
      migrationVersion,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * @param {string} uid
 * @param {(progress: Record<string, import('../types/book.js').BookProgress>) => void} onProgress
 * @param {(error: unknown) => void} onError
 * @returns {() => void}
 */
export function subscribeToUserProgress(uid, onProgress, onError) {
  assertFirebaseEnabled()
  return onSnapshot(
    progressCollectionRef(uid),
    (snapshot) => {
      const next = {}
      for (const change of snapshot.docs) {
        const normalized = fromFirestoreProgressEntry(change.data())
        if (!normalized) continue
        next[change.id] = normalized
      }
      onProgress(normalizeProgressMap(next))
    },
    onError
  )
}

export async function syncProgressEntry(uid, slug, entry, deviceId) {
  assertFirebaseEnabled()
  const ref = doc(db, 'users', uid, 'bookProgress', slug)
  const serialized = toFirestoreProgressEntry(entry, deviceId)
  if (!serialized) {
    await deleteDoc(ref)
    return
  }
  await setDoc(ref, serialized, { merge: true })
}

/**
 * @param {string} uid
 * @param {Record<string, import('../types/book.js').BookProgress>} progressMap
 * @param {string} deviceId
 */
export async function replaceUserProgress(uid, progressMap, deviceId) {
  assertFirebaseEnabled()
  const normalized = normalizeProgressMap(progressMap)
  const colRef = progressCollectionRef(uid)
  const existing = await getDocs(colRef)
  const nextSlugs = new Set(Object.keys(normalized))
  const batch = writeBatch(db)

  for (const snap of existing.docs) {
    if (!nextSlugs.has(snap.id)) {
      batch.delete(snap.ref)
    }
  }

  for (const [slug, entry] of Object.entries(normalized)) {
    const serialized = toFirestoreProgressEntry(entry, deviceId)
    if (!serialized) continue
    const ref = doc(db, 'users', uid, 'bookProgress', slug)
    batch.set(ref, serialized, { merge: true })
  }

  await batch.commit()
}

/**
 * @param {string} uid
 * @returns {Promise<Record<string, import('../types/book.js').BookProgress>>}
 */
export async function fetchUserProgressOnce(uid) {
  assertFirebaseEnabled()
  const snapshot = await getDocs(progressCollectionRef(uid))
  const next = {}
  for (const entry of snapshot.docs) {
    const normalized = fromFirestoreProgressEntry(entry.data())
    if (!normalized) continue
    next[entry.id] = normalized
  }
  return normalizeProgressMap(next)
}
