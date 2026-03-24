import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { after, before, describe, it } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

const PROJECT_ID = 'transformative-books-rules'
const RULES = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
    },
  })
})

after(async () => {
  await testEnv.cleanup()
})

describe('Firestore security rules', () => {
  it('denies unauthenticated reads', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(guestDb, 'users', 'alice')))
  })

  it('allows verified owner writes and reads', async () => {
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore()
    await assertSucceeds(
      setDoc(
        doc(aliceDb, 'users', 'alice'),
        {
          migrationVersion: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'alice', 'bookProgress', 'book-one'), {
        isRead: true,
        owns: false,
        userRating: 5,
        notes: 'Strong impact.',
        updatedAt: serverTimestamp(),
        updatedByDevice: 'device-1',
      })
    )
    const snapshot = await assertSucceeds(getDoc(doc(aliceDb, 'users', 'alice', 'bookProgress', 'book-one')))
    assert.equal(snapshot.exists(), true)
  })

  it('denies writes from unverified users', async () => {
    const unverifiedDb = testEnv.authenticatedContext('unverified', { email_verified: false }).firestore()
    await assertFails(
      setDoc(doc(unverifiedDb, 'users', 'unverified', 'bookProgress', 'book-two'), {
        isRead: true,
        owns: false,
        userRating: 3,
        notes: 'Should fail.',
        updatedAt: serverTimestamp(),
        updatedByDevice: 'device-2',
      })
    )
  })

  it('denies cross-user access', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore()
    await assertFails(getDoc(doc(bobDb, 'users', 'alice')))
    await assertFails(
      setDoc(doc(bobDb, 'users', 'alice', 'bookProgress', 'book-three'), {
        isRead: true,
        owns: true,
        userRating: 4,
        notes: 'Not allowed.',
        updatedAt: serverTimestamp(),
        updatedByDevice: 'device-3',
      })
    )
  })

  it('denies invalid book progress payloads', async () => {
    const aliceDb = testEnv.authenticatedContext('alice', { email_verified: true }).firestore()
    await assertFails(
      setDoc(doc(aliceDb, 'users', 'alice', 'bookProgress', 'book-four'), {
        isRead: true,
        owns: false,
        userRating: 7,
        notes: 'Invalid rating.',
        updatedAt: serverTimestamp(),
        updatedByDevice: 'device-4',
      })
    )
  })
})
