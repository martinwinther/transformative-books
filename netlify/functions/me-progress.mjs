import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store, max-age=0',
  vary: 'authorization',
}

function createJsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

function getHeader(headers, targetName) {
  const source = headers || {}
  const target = String(targetName || '').toLowerCase()
  for (const [key, value] of Object.entries(source)) {
    if (String(key).toLowerCase() === target) {
      return typeof value === 'string' ? value : ''
    }
  }
  return ''
}

function getBearerToken(headers) {
  const authorizationHeader = getHeader(headers, 'authorization').trim()
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return ''
  return match[1].trim()
}

function normalizePrivateKey(rawValue) {
  return String(rawValue || '').replace(/\\n/g, '\n').trim()
}

function parseJsonOrThrow(rawValue, envName) {
  try {
    return JSON.parse(rawValue)
  } catch {
    throw new Error(`Invalid JSON in ${envName}.`)
  }
}

function toServiceAccountShape(raw) {
  const projectId = raw?.projectId || raw?.project_id || process.env.FIREBASE_PROJECT_ID || ''
  const clientEmail = raw?.clientEmail || raw?.client_email || process.env.FIREBASE_CLIENT_EMAIL || ''
  const privateKey = normalizePrivateKey(raw?.privateKey || raw?.private_key || process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin service account fields in environment variables.')
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

function loadServiceAccountFromEnvironment() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
  if (inlineJson) {
    return toServiceAccountShape(parseJsonOrThrow(inlineJson, 'FIREBASE_SERVICE_ACCOUNT_JSON'))
  }

  const base64Json = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()
  if (base64Json) {
    const decoded = Buffer.from(base64Json, 'base64').toString('utf8')
    return toServiceAccountShape(parseJsonOrThrow(decoded, 'FIREBASE_SERVICE_ACCOUNT_BASE64'))
  }

  return toServiceAccountShape({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  })
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]
  }

  const serviceAccount = loadServiceAccountFromEnvironment()
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  })
}

function timestampToMillis(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw?.toMillis === 'function') return raw.toMillis()
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000
  return null
}

function sanitizeProgressEntry(raw) {
  return {
    isRead: raw?.isRead === true,
    owns: raw?.owns === true,
    userRating:
      Number.isInteger(raw?.userRating) && raw.userRating >= 1 && raw.userRating <= 5
        ? raw.userRating
        : null,
    notes: typeof raw?.notes === 'string' ? raw.notes.slice(0, 5000) : '',
    updatedAt: timestampToMillis(raw?.updatedAt),
    updatedByDevice: typeof raw?.updatedByDevice === 'string' ? raw.updatedByDevice.slice(0, 120) : '',
  }
}

async function fetchUserProgress(uid) {
  const db = getFirestore(getAdminApp())
  const snapshot = await db.collection('users').doc(uid).collection('bookProgress').get()
  const progress = {}
  for (const doc of snapshot.docs) {
    progress[doc.id] = sanitizeProgressEntry(doc.data())
  }
  return progress
}

export async function handler(event) {
  const method = String(event?.httpMethod || 'GET').toUpperCase()

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        allow: 'GET, OPTIONS',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      },
      body: '',
    }
  }

  if (method !== 'GET') {
    return createJsonResponse(
      405,
      { error: 'Method not allowed.' },
      {
        allow: 'GET, OPTIONS',
      }
    )
  }

  const token = getBearerToken(event?.headers)
  if (!token) {
    return createJsonResponse(401, { error: 'Missing bearer token.' })
  }

  let adminApp
  try {
    adminApp = getAdminApp()
  } catch (error) {
    console.error('Firebase Admin configuration error in secure API:', error)
    return createJsonResponse(500, { error: 'Server authentication is not configured.' })
  }

  let decodedToken
  try {
    const auth = getAuth(adminApp)
    decodedToken = await auth.verifyIdToken(token, true)
  } catch (error) {
    return createJsonResponse(401, { error: 'Invalid or expired authentication token.' })
  }

  if (decodedToken.email_verified !== true) {
    return createJsonResponse(403, { error: 'Email verification is required.' })
  }

  try {
    const progress = await fetchUserProgress(decodedToken.uid)
    return createJsonResponse(200, {
      uid: decodedToken.uid,
      count: Object.keys(progress).length,
      data: progress,
    })
  } catch (error) {
    console.error('Failed to fetch user progress for secure API:', error)
    return createJsonResponse(500, { error: 'Failed to fetch user progress.' })
  }
}
