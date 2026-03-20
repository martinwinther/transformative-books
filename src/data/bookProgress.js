const STORAGE_KEY = 'tb-reader-progress'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const notes = typeof entry.notes === 'string' ? entry.notes : ''
  const isRead = entry.isRead === true
  const owns = entry.owns === true

  if (!isRead && !owns && !notes.trim()) return null

  return {
    isRead,
    owns,
    notes,
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
