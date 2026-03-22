const STORAGE_KEY = 'tb-reader-progress'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
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

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const notes = typeof entry.notes === 'string' ? entry.notes : ''
  const isRead = entry.isRead === true
  const owns = entry.owns === true
  const userRating = normalizeUserRating(entry.userRating)

  if (!isRead && !owns && !notes.trim() && userRating == null) return null

  return {
    isRead,
    owns,
    notes,
    userRating,
  }
}

export function loadBookProgress() {
  if (!canUseStorage()) return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([slug, entry]) => [slug, normalizeEntry(entry)])
        .filter(([, entry]) => entry !== null)
    )
  } catch {
    return {}
  }
}

export function saveBookProgress(progress) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Ignore local persistence failures and keep the UI responsive.
  }
}
