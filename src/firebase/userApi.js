import { getCurrentAuthUser } from './auth'

function toApiErrorMessage(responseStatus, payload) {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }
  return `User API request failed with status ${responseStatus}.`
}

/**
 * Fetch progress for the currently authenticated Firebase user through
 * the secure server API endpoint.
 * @param {{ forceRefreshToken?: boolean }} [options]
 * @returns {Promise<{ uid: string, count: number, data: Record<string, import('../types/book.js').BookProgress> }>}
 */
export async function fetchCurrentUserProgressFromApi(options = {}) {
  const user = getCurrentAuthUser()
  if (!user) {
    throw new Error('No authenticated user.')
  }

  const forceRefreshToken = options.forceRefreshToken === true
  const idToken = await user.getIdToken(forceRefreshToken)

  const response = await fetch('/api/v1/me/progress', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${idToken}`,
      accept: 'application/json',
    },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(toApiErrorMessage(response.status, payload))
  }

  if (!payload || typeof payload !== 'object' || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Unexpected response from secure user API endpoint.')
  }

  return {
    uid: String(payload.uid || ''),
    count: Number(payload.count || 0),
    data: payload.data,
  }
}
