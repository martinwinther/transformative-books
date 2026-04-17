import { useEffect, useRef, useState } from 'react'
import {
  CANON_OPTIONS,
  loadBooks,
  normalizeCanon,
  resolveCanonicalSelectionForSlug,
} from './data/loadBooks.js'
import {
  applyProgressPatch,
  areProgressMapsEqual,
  cloneProgressMap,
  getDeviceId,
  loadBookProgress,
  mergeProgressByLatest,
  saveBookProgress,
} from './data/bookProgress.js'
import { firebaseEnabled, firebaseMissingKeys } from './firebase/client'
import {
  onAuthSessionChange,
  refreshAuthUser,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
  signUpWithEmail,
  toAuthSession,
} from './firebase/auth'
import {
  ensureUserProfile,
  fetchUserProgressOnce,
  replaceUserProgress,
  setUserMigrationVersion,
  subscribeToUserProgress,
  syncProgressEntry,
} from './firebase/progressSync'
import AuthModal from './components/AuthModal.jsx'
import BookCard from './components/BookCard.jsx'
import BookDrawer from './components/BookDrawer.jsx'
import FiltersBar from './components/FiltersBar.jsx'
import MigrationDialog from './components/MigrationDialog.jsx'

const SHARE_SNIPPET_LIMIT = 180
const CANON_QUERY_KEY = 'canon'

function toReadableError(error) {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.'
  const code = typeof error.code === 'string' ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was canceled.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait and try again.'
    case 'permission-denied':
      return 'Permission denied by backend rules. Check verification status.'
    default:
      return typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Something went wrong. Please try again.'
  }
}

function parseSharedBookSlug(hashValue) {
  const hash = typeof hashValue === 'string' ? hashValue.replace(/^#/, '') : ''
  if (!hash) return ''
  const params = new URLSearchParams(hash)
  const slug = params.get('book')
  return typeof slug === 'string' ? slug.trim() : ''
}

function parseCanonFromSearch(searchValue) {
  const search = typeof searchValue === 'string' ? searchValue : ''
  const params = new URLSearchParams(search)
  return normalizeCanon(params.get(CANON_QUERY_KEY))
}

function toShareSnippet(text) {
  const normalized = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : ''
  if (!normalized) return ''
  if (normalized.length <= SHARE_SNIPPET_LIMIT) return normalized
  return `${normalized.slice(0, SHARE_SNIPPET_LIMIT - 1).trim()}…`
}

async function copyTextToClipboard(text) {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to legacy copy fallback.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  const didCopy = document.execCommand('copy')
  document.body.removeChild(textarea)
  return didCopy
}

function App() {
  const initialProgress = loadBookProgress()
  const [canonFilter, setCanonFilter] = useState(() => parseCanonFromSearch(window.location.search))
  const [books, setBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState(null)
  const [genreFilter, setGenreFilter] = useState('')
  const [readFilter, setReadFilter] = useState('all')
  const [ownedFilter, setOwnedFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rating-asc')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [readerProgress, setReaderProgress] = useState(initialProgress)
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem('tb-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const readerProgressRef = useRef(initialProgress)
  const deviceIdRef = useRef(getDeviceId())
  const resolvedMigrationsRef = useRef(new Set())
  const migrationStateRef = useRef(null)

  const [authSession, setAuthSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(firebaseEnabled)
  const [syncState, setSyncState] = useState(firebaseEnabled ? 'guest' : 'firebase-disabled')
  const [syncError, setSyncError] = useState('')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authPending, setAuthPending] = useState(false)
  const [authModalError, setAuthModalError] = useState('')
  const [migrationState, setMigrationState] = useState(null)
  const [migrationPending, setMigrationPending] = useState(false)

  useEffect(() => {
    migrationStateRef.current = migrationState
  }, [migrationState])

  const commitReaderProgress = (nextProgress) => {
    const cloned = cloneProgressMap(nextProgress)
    if (areProgressMapsEqual(readerProgressRef.current, cloned)) return
    readerProgressRef.current = cloned
    setReaderProgress(cloned)
  }

  useEffect(() => {
    let isActive = true
    setLoading(true)
    setError(null)

    loadBooks(canonFilter)
      .then((data) => {
        if (!isActive) return
        setBooks(data)
        setFilteredBooks(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!isActive) return
        setBooks([])
        setError(err.message)
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [canonFilter])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get(CANON_QUERY_KEY) === canonFilter) return
    params.set(CANON_QUERY_KEY, canonFilter)
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', nextUrl)
  }, [canonFilter])

  useEffect(() => {
    const syncCanonFromUrl = () => {
      const nextCanon = parseCanonFromSearch(window.location.search)
      setCanonFilter((previousCanon) => (previousCanon === nextCanon ? previousCanon : nextCanon))
    }

    window.addEventListener('popstate', syncCanonFromUrl)
    return () => window.removeEventListener('popstate', syncCanonFromUrl)
  }, [])

  useEffect(() => {
    let isActive = true

    const syncSelectedBookFromHash = async () => {
      const sharedSlug = parseSharedBookSlug(window.location.hash)
      if (!sharedSlug) {
        if (isActive) setSelectedBook(null)
        return
      }

      const matched = books.find((book) => book.slug === sharedSlug)
      if (matched) {
        if (isActive) setSelectedBook(matched)
        return
      }

      if (canonFilter !== 'all') {
        const canonicalSelection = await resolveCanonicalSelectionForSlug(sharedSlug)
        if (!isActive) return

        if (
          canonicalSelection &&
          canonicalSelection !== 'all' &&
          canonicalSelection !== canonFilter
        ) {
          setCanonFilter(canonicalSelection)
          return
        }
      }

      if (isActive) setSelectedBook(null)
    }

    syncSelectedBookFromHash()
    window.addEventListener('hashchange', syncSelectedBookFromHash)
    return () => {
      isActive = false
      window.removeEventListener('hashchange', syncSelectedBookFromHash)
    }
  }, [books, canonFilter])

  useEffect(() => {
    if (!genreFilter) return
    const genreStillAvailable = books.some((book) => book.genres.includes(genreFilter))
    if (!genreStillAvailable) {
      setGenreFilter('')
    }
  }, [books, genreFilter])

  useEffect(() => {
    let next = books.filter((book) => {
      const matchSearch =
        !searchQuery ||
        [book.title, book.author, book.justification, ...book.genres].some((s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase())
        )
      const matchRating = ratingFilter == null || book.rating === ratingFilter
      const matchGenre = !genreFilter || book.genres.includes(genreFilter)
      const progress = readerProgress[book.slug]
      const isRead = progress?.isRead === true
      const isOwned = progress?.owns === true
      const matchRead =
        readFilter === 'all' ||
        (readFilter === 'read' && isRead) ||
        (readFilter === 'unread' && !isRead)
      const matchOwned =
        ownedFilter === 'all' ||
        (ownedFilter === 'owned' && isOwned) ||
        (ownedFilter === 'unowned' && !isOwned)
      return matchSearch && matchRating && matchGenre && matchRead && matchOwned
    })

    if (sortBy === 'rating-asc') {
      next = [...next].sort((a, b) => a.rating - b.rating || a.title.localeCompare(b.title))
    } else {
      next = [...next].sort((a, b) => a.title.localeCompare(b.title))
    }
    setFilteredBooks(next)
  }, [books, searchQuery, ratingFilter, genreFilter, readFilter, ownedFilter, sortBy, readerProgress])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('tb-theme', theme)
  }, [theme])

  useEffect(() => {
    saveBookProgress(readerProgress)
  }, [readerProgress])

  useEffect(() => {
    if (!firebaseEnabled) {
      setAuthLoading(false)
      setSyncState('firebase-disabled')
      return
    }

    return onAuthSessionChange((user) => {
      const session = toAuthSession(user)
      setAuthSession(session)
      setAuthLoading(false)
      setSyncError('')
      setAuthModalError('')
      if (!session) {
        setSyncState('guest')
        setMigrationState(null)
        setMigrationPending(false)
        return
      }
      setSyncState(session.emailVerified ? 'syncing' : 'unverified')
      setAuthModalOpen(false)
    })
  }, [])

  useEffect(() => {
    if (!firebaseEnabled || !authSession?.uid || !authSession.emailVerified) return
    let isActive = true
    let unsubscribe = () => {}

    const setupSync = async () => {
      try {
        setSyncState('syncing')
        const profile = await ensureUserProfile(authSession.uid)
        if (!isActive) return
        if (Number(profile?.migrationVersion) >= 1) {
          resolvedMigrationsRef.current.add(authSession.uid)
        }

        unsubscribe = subscribeToUserProgress(
          authSession.uid,
          async (cloudProgress) => {
            if (!isActive) return
            if (migrationStateRef.current?.uid === authSession.uid) return

            const localProgress = readerProgressRef.current
            const hasLocal = Object.keys(localProgress).length > 0
            const hasCloud = Object.keys(cloudProgress).length > 0

            if (!resolvedMigrationsRef.current.has(authSession.uid)) {
              if (!hasLocal && !hasCloud) {
                await setUserMigrationVersion(authSession.uid, 1)
                if (!isActive) return
                resolvedMigrationsRef.current.add(authSession.uid)
                setSyncState('synced')
                return
              }

              if (hasLocal && !hasCloud) {
                await replaceUserProgress(authSession.uid, localProgress, deviceIdRef.current)
                await setUserMigrationVersion(authSession.uid, 1)
                if (!isActive) return
                resolvedMigrationsRef.current.add(authSession.uid)
                setSyncState('synced')
                return
              }

              if (!hasLocal && hasCloud) {
                commitReaderProgress(cloudProgress)
                await setUserMigrationVersion(authSession.uid, 1)
                if (!isActive) return
                resolvedMigrationsRef.current.add(authSession.uid)
                setSyncState('synced')
                return
              }

              setMigrationState({
                uid: authSession.uid,
                localProgress: cloneProgressMap(localProgress),
                cloudProgress: cloneProgressMap(cloudProgress),
              })
              setSyncState('syncing')
              return
            }

            const merged = mergeProgressByLatest(localProgress, cloudProgress)
            commitReaderProgress(merged)
            if (!areProgressMapsEqual(merged, cloudProgress)) {
              replaceUserProgress(authSession.uid, merged, deviceIdRef.current).catch((err) => {
                if (!isActive) return
                setSyncError(toReadableError(err))
                setSyncState('error')
              })
            }
            setSyncState('synced')
            setSyncError('')
          },
          (err) => {
            if (!isActive) return
            setSyncError(toReadableError(err))
            setSyncState('error')
          }
        )
      } catch (err) {
        if (!isActive) return
        setSyncError(toReadableError(err))
        setSyncState('error')
      }
    }

    setupSync()
    return () => {
      isActive = false
      unsubscribe()
    }
  }, [authSession?.uid, authSession?.emailVerified])

  const runAuthAction = async (fn) => {
    setAuthPending(true)
    setAuthModalError('')
    try {
      await fn()
      setAuthModalOpen(false)
    } catch (err) {
      setAuthModalError(toReadableError(err))
    } finally {
      setAuthPending(false)
    }
  }

  const handleMigrationChoice = async (choice) => {
    if (!migrationState || !authSession?.uid) return
    setMigrationPending(true)
    setSyncError('')
    try {
      let nextProgress
      if (choice === 'keep-cloud') {
        nextProgress = cloneProgressMap(migrationState.cloudProgress)
      } else if (choice === 'keep-local') {
        nextProgress = cloneProgressMap(migrationState.localProgress)
      } else {
        nextProgress = mergeProgressByLatest(migrationState.localProgress, migrationState.cloudProgress)
      }

      if (choice !== 'keep-cloud') {
        await replaceUserProgress(authSession.uid, nextProgress, deviceIdRef.current)
      }
      await setUserMigrationVersion(authSession.uid, 1)
      resolvedMigrationsRef.current.add(authSession.uid)
      setMigrationState(null)
      commitReaderProgress(nextProgress)
      setSyncState('synced')
    } catch (err) {
      setSyncError(toReadableError(err))
      setSyncState('error')
    } finally {
      setMigrationPending(false)
    }
  }

  const handleReadChange = (slug, isRead) => {
    updateBookProgress(slug, { isRead })
  }

  const handleOwnChange = (slug, owns) => {
    updateBookProgress(slug, { owns })
  }

  const handleNotesChange = (slug, notes) => {
    updateBookProgress(slug, { notes })
  }

  const handleUserRatingChange = (slug, userRating) => {
    updateBookProgress(slug, { userRating })
  }

  const cloudWritesEnabled =
    Boolean(firebaseEnabled && authSession?.uid && authSession?.emailVerified) &&
    syncState === 'synced' &&
    !migrationState

  const updateBookProgress = (slug, patch) => {
    const { nextProgress, nextEntry } = applyProgressPatch(
      readerProgressRef.current,
      slug,
      patch,
      deviceIdRef.current
    )
    commitReaderProgress(nextProgress)

    if (!cloudWritesEnabled || !authSession?.uid) return
    syncProgressEntry(authSession.uid, slug, nextEntry, deviceIdRef.current).catch((err) => {
      setSyncError(toReadableError(err))
      setSyncState('error')
    })
  }

  const setBookHash = (slug) => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (slug) {
      params.set('book', slug)
    } else {
      params.delete('book')
    }
    const hash = params.toString()
    const nextUrl = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`
    window.history.replaceState(null, '', nextUrl)
  }

  const handleSelectBook = (book) => {
    setSelectedBook(book)
    setBookHash(book.slug)
  }

  const handleShareBook = async (book) => {
    const url = new URL(window.location.href)
    url.searchParams.set(CANON_QUERY_KEY, canonFilter)
    const params = new URLSearchParams(url.hash.replace(/^#/, ''))
    params.set('book', book.slug)
    url.hash = params.toString()

    const snippet = toShareSnippet(book.justification)
    const shareText = snippet
      ? `${book.title} by ${book.author}\n${snippet}\n\n${url.toString()}`
      : `${book.title} by ${book.author}\n\n${url.toString()}`

    return copyTextToClipboard(shareText)
  }

  const availableGenres = Array.from(
    new Set(books.flatMap((book) => book.genres))
  ).sort((a, b) => a.localeCompare(b))
  const handleCloseDrawer = () => {
    setSelectedBook(null)
    setBookHash('')
  }
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  const notesHelpText = !firebaseEnabled
    ? 'Saved locally in this browser.'
    : !authSession
      ? 'Saved locally. Sign in to sync across devices.'
      : !authSession.emailVerified
        ? 'Saved locally. Verify your email to start cloud sync.'
        : syncState === 'synced'
          ? 'Synced across your devices.'
          : 'Syncing with cloud…'

  return (
    <div className="app">
      <div className="ambient-layer" aria-hidden="true" />
      <header className="hero">
        <div className="hero__content">
          <h1 className="hero__title">Transformative Canon</h1>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <span className="theme-toggle__icon" aria-hidden="true">
              {theme === 'light' ? '◐' : '◑'}
            </span>
          </button>
        </div>
      </header>

      <main className="main">
        <section className="controls glass">
          <button
            type="button"
            className="controls__header"
            aria-expanded={filtersOpen}
            aria-controls="filters-panel"
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            title={filtersOpen ? 'Hide filters' : 'Show filters'}
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <span className="controls__title">Filters</span>
            <span className="controls__toggle-icon" aria-hidden="true">
              {filtersOpen ? '▾' : '▸'}
            </span>
          </button>
          {filtersOpen && (
            <div id="filters-panel">
              <FiltersBar
                canonFilter={canonFilter}
                canonOptions={CANON_OPTIONS}
                onCanonFilterChange={setCanonFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                ratingFilter={ratingFilter}
                onRatingFilterChange={setRatingFilter}
                genreFilter={genreFilter}
                onGenreFilterChange={setGenreFilter}
                readFilter={readFilter}
                onReadFilterChange={setReadFilter}
                ownedFilter={ownedFilter}
                onOwnedFilterChange={setOwnedFilter}
                availableGenres={availableGenres}
                sortBy={sortBy}
                onSortByChange={setSortBy}
              />
            </div>
          )}
        </section>

        {loading && <p className="status">Loading catalog…</p>}
        {error && <p className="status status--error">{error}</p>}
        {!loading && !error && filteredBooks.length === 0 && (
          <p className="status">No books match your filters.</p>
        )}
        {!loading && !error && filteredBooks.length > 0 && (
          <section className="catalog-shell">
            <div className="catalog-shell__header">
              <h2 className="catalog-shell__title">Browse the library</h2>
              <p className="catalog-shell__subtitle">Select any title to read why it belongs in the canon.</p>
            </div>
            <div className="catalog" role="list">
              {filteredBooks.map((book) => (
                <div key={book.slug} className="catalog__item" role="listitem">
                  <BookCard
                    book={book}
                    progress={readerProgress[book.slug]}
                    onClick={handleSelectBook}
                    onShare={handleShareBook}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <BookDrawer
        book={selectedBook}
        progress={selectedBook ? readerProgress[selectedBook.slug] : null}
        onClose={handleCloseDrawer}
        onReadChange={handleReadChange}
        onOwnChange={handleOwnChange}
        onUserRatingChange={handleUserRatingChange}
        onNotesChange={handleNotesChange}
        notesHelpText={notesHelpText}
      />

      <AuthModal
        open={authModalOpen}
        pending={authPending}
        error={authModalError}
        onClose={() => setAuthModalOpen(false)}
        onEmailSignIn={(email, password) => runAuthAction(() => signInWithEmail(email, password))}
        onEmailSignUp={(email, password) => runAuthAction(() => signUpWithEmail(email, password))}
        onGoogleSignIn={() => runAuthAction(() => signInWithGoogle())}
      />

      <MigrationDialog
        state={migrationState}
        pending={migrationPending}
        onChoose={handleMigrationChoice}
      />
    </div>
  )
}

export default App
