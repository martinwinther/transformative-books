export const STORAGE_KEY = 'tb-reader-progress'
const DEVICE_KEY = 'tb-device-id'
export const MAX_NOTES_LENGTH = 5000

function getLocalStorageSafely() {
  if (typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    if (!storage) return null
    storage.getItem('__tb_storage_probe__')
    return storage
  } catch {
    return null
  }
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function normalizeUserRating(raw) {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < 1 || n > 5) return null
  return n
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function normalizeUpdatedAt(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw))
  if (typeof raw === 'string') {
    const asNumber = Number(raw)
    if (Number.isFinite(asNumber)) return Math.max(0, Math.floor(asNumber))
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  if (typeof raw === 'object' && raw !== null) {
    if (typeof raw.toMillis === 'function') {
      const millis = raw.toMillis()
      return Number.isFinite(millis) ? Math.max(0, Math.floor(millis)) : null
    }
    if (typeof raw.seconds === 'number') {
      return Math.max(0, Math.floor(raw.seconds * 1000))
    }
  }
  return null
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeNotes(raw) {
  if (typeof raw !== 'string') return ''
  return raw.slice(0, MAX_NOTES_LENGTH)
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeUpdatedByDevice(raw) {
  if (typeof raw !== 'string') return ''
  return raw.slice(0, 120)
}

/**
 * @param {any} entry
 * @returns {boolean}
 */
export function hasMeaningfulProgress(entry) {
  if (!entry || typeof entry !== 'object') return false
  const notes = typeof entry.notes === 'string' ? entry.notes : ''
  return entry.isRead === true || entry.owns === true || notes.trim().length > 0 || normalizeUserRating(entry.userRating) != null
}

/**
 * @param {any} entry
 * @returns {import('../types/book.js').BookProgress | null}
 */
export function normalizeProgressEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const notes = normalizeNotes(entry.notes)
  const isRead = entry.isRead === true
  const owns = entry.owns === true
  const userRating = normalizeUserRating(entry.userRating)
  const updatedAt = normalizeUpdatedAt(entry.updatedAt)
  const updatedByDevice = normalizeUpdatedByDevice(entry.updatedByDevice)

  if (!isRead && !owns && !notes.trim() && userRating == null) return null

  return {
    isRead,
    owns,
    notes,
    userRating,
    updatedAt,
    updatedByDevice,
  }
}

/**
 * @param {any} rawMap
 * @returns {Record<string, import('../types/book.js').BookProgress>}
 */
export function normalizeProgressMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return {}
  return Object.fromEntries(
    Object.entries(rawMap)
      .map(([slug, entry]) => [slug, normalizeProgressEntry(entry)])
      .filter(([, entry]) => entry !== null)
  )
}

/**
 * @param {Record<string, import('../types/book.js').BookProgress>} progress
 * @returns {Record<string, import('../types/book.js').BookProgress>}
 */
export function cloneProgressMap(progress) {
  const normalized = normalizeProgressMap(progress)
  return Object.fromEntries(Object.entries(normalized).map(([slug, entry]) => [slug, { ...entry }]))
}

/**
 * @param {import('../types/book.js').BookProgress | undefined} entry
 * @returns {number}
 */
function updatedAtWeight(entry) {
  if (!entry || typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt)) return 0
  return Math.max(0, Math.floor(entry.updatedAt))
}

/**
 * @param {Record<string, import('../types/book.js').BookProgress>} left
 * @param {Record<string, import('../types/book.js').BookProgress>} right
 * @returns {Record<string, import('../types/book.js').BookProgress>}
 */
export function mergeProgressByLatest(left, right) {
  const a = normalizeProgressMap(left)
  const b = normalizeProgressMap(right)
  const slugs = new Set([...Object.keys(a), ...Object.keys(b)])
  const merged = {}
  for (const slug of slugs) {
    const leftEntry = a[slug]
    const rightEntry = b[slug]
    if (!leftEntry) {
      merged[slug] = { ...rightEntry }
      continue
    }
    if (!rightEntry) {
      merged[slug] = { ...leftEntry }
      continue
    }
    merged[slug] =
      updatedAtWeight(rightEntry) >= updatedAtWeight(leftEntry)
        ? { ...rightEntry }
        : { ...leftEntry }
  }
  return merged
}

/**
 * @param {Record<string, import('../types/book.js').BookProgress>} a
 * @param {Record<string, import('../types/book.js').BookProgress>} b
 * @returns {boolean}
 */
export function areProgressMapsEqual(a, b) {
  const left = normalizeProgressMap(a)
  const right = normalizeProgressMap(b)
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  for (const slug of leftKeys) {
    const la = left[slug]
    const rb = right[slug]
    if (!rb) return false
    if (
      la.isRead !== rb.isRead ||
      la.owns !== rb.owns ||
      la.notes !== rb.notes ||
      la.userRating !== rb.userRating ||
      la.updatedAt !== rb.updatedAt ||
      la.updatedByDevice !== rb.updatedByDevice
    ) {
      return false
    }
  }
  return true
}

/**
 * @param {Record<string, import('../types/book.js').BookProgress>} progress
 * @param {string} slug
 * @param {Partial<import('../types/book.js').BookProgress>} patch
 * @param {string} deviceId
 * @returns {{ nextProgress: Record<string, import('../types/book.js').BookProgress>, nextEntry: import('../types/book.js').BookProgress | null }}
 */
export function applyProgressPatch(progress, slug, patch, deviceId) {
  const normalizedProgress = normalizeProgressMap(progress)
  const current =
    normalizedProgress[slug] ?? { isRead: false, owns: false, notes: '', userRating: null, updatedAt: null, updatedByDevice: '' }
  const candidate = normalizeProgressEntry({
    ...current,
    ...patch,
    updatedAt: Date.now(),
    updatedByDevice: deviceId,
  })

  const nextProgress = { ...normalizedProgress }
  if (!candidate || !hasMeaningfulProgress(candidate)) {
    delete nextProgress[slug]
    return { nextProgress, nextEntry: null }
  }

  nextProgress[slug] = candidate
  return { nextProgress, nextEntry: candidate }
}

/**
 * @returns {Record<string, import('../types/book.js').BookProgress>}
 */
export function loadBookProgress() {
  const storage = getLocalStorageSafely()
  if (!storage) return {}

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return normalizeProgressMap(parsed)
  } catch {
    return {}
  }
}

/**
 * @param {Record<string, import('../types/book.js').BookProgress>} progress
 */
export function saveBookProgress(progress) {
  const storage = getLocalStorageSafely()
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgressMap(progress)))
  } catch {
    // Ignore local persistence failures and keep the UI responsive.
  }
}

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getDeviceId() {
  const storage = getLocalStorageSafely()
  if (!storage) return createDeviceId()

  try {
    const existing = storage.getItem(DEVICE_KEY)
    if (existing) return existing
    const created = createDeviceId()
    storage.setItem(DEVICE_KEY, created)
    return created
  } catch {
    return createDeviceId()
  }
}
