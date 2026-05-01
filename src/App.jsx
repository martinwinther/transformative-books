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
import { firebaseEnabled } from './firebase/client'
import {
  onAuthSessionChange,
  signInWithEmail,
  signInWithGoogle,
  signOutCurrentUser,
  signUpWithEmail,
  toAuthSession,
} from './firebase/auth'
import {
  ensureUserProfile,
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
import SignOutConfirm from './components/SignOutConfirm.jsx'
import {
  buildBooksCsv,
  buildBooksCsvFileName,
  downloadCsvFile,
} from './utils/exportBooksCsv.js'

const SHARE_SNIPPET_LIMIT = 180
const CANON_QUERY_KEY = 'canon'
const SEARCH_QUERY_KEY = 'search'
const RATING_QUERY_KEY = 'rating'
const GENRE_QUERY_KEY = 'genre'
const READ_QUERY_KEY = 'read'
const OWNED_QUERY_KEY = 'owned'
const SORT_QUERY_KEY = 'sort'
const THEME_STORAGE_KEY = 'tb-theme'

const READ_FILTER_OPTIONS = new Set(['all', 'read', 'unread'])
const OWNED_FILTER_OPTIONS = new Set(['all', 'owned', 'unowned'])
const SORT_OPTIONS = new Set(['rating-asc', 'title'])

function normalizeRatingFilter(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null
}

function normalizeReadFilter(value) {
  return READ_FILTER_OPTIONS.has(value) ? value : 'all'
}

function normalizeOwnedFilter(value) {
  return OWNED_FILTER_OPTIONS.has(value) ? value : 'all'
}

function normalizeSortBy(value) {
  return SORT_OPTIONS.has(value) ? value : 'rating-asc'
}

function parseFiltersFromSearch(searchValue) {
  const search = typeof searchValue === 'string' ? searchValue : ''
  const params = new URLSearchParams(search)
  const searchQuery = params.get(SEARCH_QUERY_KEY)
  const genreFilter = params.get(GENRE_QUERY_KEY)

  return {
    canonFilter: normalizeCanon(params.get(CANON_QUERY_KEY)),
    searchQuery: typeof searchQuery === 'string' ? searchQuery : '',
    ratingFilter: normalizeRatingFilter(params.get(RATING_QUERY_KEY)),
    genreFilter: typeof genreFilter === 'string' ? genreFilter : '',
    readFilter: normalizeReadFilter(params.get(READ_QUERY_KEY)),
    ownedFilter: normalizeOwnedFilter(params.get(OWNED_QUERY_KEY)),
    sortBy: normalizeSortBy(params.get(SORT_QUERY_KEY)),
  }
}

function buildSearchParamsFromFilters(filters) {
  const params = new URLSearchParams()

  params.set(CANON_QUERY_KEY, normalizeCanon(filters.canonFilter))

  const searchQuery = typeof filters.searchQuery === 'string' ? filters.searchQuery : ''
  if (searchQuery) {
    params.set(SEARCH_QUERY_KEY, searchQuery)
  }

  const ratingFilter = normalizeRatingFilter(filters.ratingFilter)
  if (ratingFilter != null) {
    params.set(RATING_QUERY_KEY, String(ratingFilter))
  }

  const genreFilter = typeof filters.genreFilter === 'string' ? filters.genreFilter : ''
  if (genreFilter) {
    params.set(GENRE_QUERY_KEY, genreFilter)
  }

  const readFilter = normalizeReadFilter(filters.readFilter)
  if (readFilter !== 'all') {
    params.set(READ_QUERY_KEY, readFilter)
  }

  const ownedFilter = normalizeOwnedFilter(filters.ownedFilter)
  if (ownedFilter !== 'all') {
    params.set(OWNED_QUERY_KEY, ownedFilter)
  }

  const sortBy = normalizeSortBy(filters.sortBy)
  if (sortBy !== 'rating-asc') {
    params.set(SORT_QUERY_KEY, sortBy)
  }

  return params
}

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

function readStoredTheme() {
  const storage = getLocalStorageSafely()
  if (!storage) return null
  try {
    const storedTheme = storage.getItem(THEME_STORAGE_KEY)
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null
  } catch {
    return null
  }
}

function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function resolveInitialTheme() {
  return readStoredTheme() ?? resolveSystemTheme()
}

function persistTheme(theme) {
  const storage = getLocalStorageSafely()
  if (!storage) return
  try {
    storage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore persistence failures to keep rendering resilient on restricted browsers.
  }
}

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

function buildBooksPlainText(books) {
  return books
    .map((book) => {
      const rationale = typeof book.justification === 'string' ? book.justification.trim() : ''
      return [book.title, book.author, rationale].filter(Boolean).join(' - ')
    })
    .join('\n')
}

function App() {
  const safeModeEnabled = typeof window !== 'undefined' && window.__TB_SAFE_MODE__ === true
  const initialProgress = loadBookProgress()
  const [initialFilters] = useState(() => parseFiltersFromSearch(window.location.search))
  const [canonFilter, setCanonFilter] = useState(initialFilters.canonFilter)
  const [books, setBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [ratingFilter, setRatingFilter] = useState(initialFilters.ratingFilter)
  const [genreFilter, setGenreFilter] = useState(initialFilters.genreFilter)
  const [readFilter, setReadFilter] = useState(initialFilters.readFilter)
  const [ownedFilter, setOwnedFilter] = useState(initialFilters.ownedFilter)
  const [sortBy, setSortBy] = useState(initialFilters.sortBy)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [readerProgress, setReaderProgress] = useState(initialProgress)
  const [theme, setTheme] = useState(() => resolveInitialTheme())

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
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

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
    const nextParams = buildSearchParamsFromFilters({
      canonFilter,
      searchQuery,
      ratingFilter,
      genreFilter,
      readFilter,
      ownedFilter,
      sortBy,
    })
    const nextSearch = nextParams.toString()
    const currentSearch = window.location.search.replace(/^\?/, '')
    if (currentSearch === nextSearch) return
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', nextUrl)
  }, [canonFilter, searchQuery, ratingFilter, genreFilter, readFilter, ownedFilter, sortBy])

  useEffect(() => {
    const syncFiltersFromUrl = () => {
      const nextFilters = parseFiltersFromSearch(window.location.search)
      setCanonFilter((previous) =>
        previous === nextFilters.canonFilter ? previous : nextFilters.canonFilter
      )
      setSearchQuery((previous) =>
        previous === nextFilters.searchQuery ? previous : nextFilters.searchQuery
      )
      setRatingFilter((previous) =>
        previous === nextFilters.ratingFilter ? previous : nextFilters.ratingFilter
      )
      setGenreFilter((previous) =>
        previous === nextFilters.genreFilter ? previous : nextFilters.genreFilter
      )
      setReadFilter((previous) =>
        previous === nextFilters.readFilter ? previous : nextFilters.readFilter
      )
      setOwnedFilter((previous) =>
        previous === nextFilters.ownedFilter ? previous : nextFilters.ownedFilter
      )
      setSortBy((previous) => (previous === nextFilters.sortBy ? previous : nextFilters.sortBy))
    }

    window.addEventListener('popstate', syncFiltersFromUrl)
    return () => window.removeEventListener('popstate', syncFiltersFromUrl)
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
    if (!exportMenuOpen) return

    const handlePointerDown = (event) => {
      if (exportMenuRef.current?.contains(event.target)) return
      setExportMenuOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExportMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [exportMenuOpen])

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
    persistTheme(theme)
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

  const handleOpenAuth = () => {
    setSyncError('')
    setAuthModalError('')
    setAuthModalOpen(true)
  }

  const handleSignOut = async () => {
    setSignOutConfirmOpen(false)
    setSyncError('')
    try {
      await signOutCurrentUser()
    } catch (err) {
      setSyncError(toReadableError(err))
      setSyncState('error')
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
    const searchParams = buildSearchParamsFromFilters({
      canonFilter,
      searchQuery,
      ratingFilter,
      genreFilter,
      readFilter,
      ownedFilter,
      sortBy,
    })
    const nextSearch = searchParams.toString()
    url.search = nextSearch ? `?${nextSearch}` : ''
    const params = new URLSearchParams(url.hash.replace(/^#/, ''))
    params.set('book', book.slug)
    url.hash = params.toString()

    const snippet = toShareSnippet(book.justification)
    const shareText = snippet
      ? `${book.title} by ${book.author}\n${snippet}\n\n${url.toString()}`
      : `${book.title} by ${book.author}\n\n${url.toString()}`

    return copyTextToClipboard(shareText)
  }

  const handleExportVisibleBooksCsv = () => {
    const csvText = buildBooksCsv(filteredBooks, readerProgress)
    const fileName = buildBooksCsvFileName({ canonFilter })
    downloadCsvFile(fileName, csvText)
    setExportMenuOpen(false)
  }

  const handleCopyVisibleBooksCsv = async () => {
    const plainText = buildBooksPlainText(filteredBooks)
    await copyTextToClipboard(plainText)
    setExportMenuOpen(false)
  }

  const handlePrintVisibleBooks = () => {
    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return

    const bookListHtml = filteredBooks
      .map((book) => {
        const rationale = typeof book.justification === 'string' ? book.justification.trim() : ''
        return `
          <div class="print-book-item">
            <div class="print-book-title">${escapeHtml(book.title)}</div>
            <div class="print-book-author">${escapeHtml(book.author)}</div>
            ${rationale ? `<div class="print-book-rationale">${escapeHtml(rationale)}</div>` : ''}
          </div>
        `
      })
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Transformative Books - ${canonFilter === 'all' ? 'All Canons' : canonFilter.charAt(0).toUpperCase() + canonFilter.slice(1)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
            line-height: 1.6;
            color: #13233a;
            background: white;
            padding: 2rem;
          }
          .print-container {
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: #13233a;
          }
          .print-subtitle {
            font-size: 0.95rem;
            color: #3f5472;
            margin-bottom: 2rem;
            border-bottom: 2px solid #c8d8eb;
            padding-bottom: 1rem;
          }
          .print-book-item {
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid #e0e8f0;
          }
          .print-book-item:last-child {
            border-bottom: none;
          }
          .print-book-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: #13233a;
            margin-bottom: 0.3rem;
          }
          .print-book-author {
            font-size: 0.95rem;
            color: #3f5472;
            font-style: italic;
            margin-bottom: 0.5rem;
          }
          .print-book-rationale {
            font-size: 0.9rem;
            color: #334d70;
            line-height: 1.7;
          }
          @media print {
            body { padding: 1.5rem; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <h1>Transformative Books</h1>
          <div class="print-subtitle">${filteredBooks.length} books from the ${canonFilter === 'all' ? 'canon' : canonFilter + ' canon'}</div>
          ${bookListHtml}
        </div>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 250)
    setExportMenuOpen(false)
  }

  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const availableGenres = Array.from(
    new Set(books.flatMap((book) => book.genres))
  ).sort((a, b) => a.localeCompare(b))
  const handleCloseDrawer = () => {
    setSelectedBook(null)
    setBookHash('')
  }
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  const handleSyncButtonClick = () => {
    if (!firebaseEnabled || authLoading || authPending) return
    if (authSession) {
      setSignOutConfirmOpen(true)
      return
    }
    handleOpenAuth()
  }

  const syncButtonLabel = !firebaseEnabled
    ? 'Sync unavailable'
    : authLoading
      ? 'Checking sync status'
      : authSession
        ? 'Sign out of sync'
        : 'Sign in to sync'

  const syncButtonTitle = !firebaseEnabled
    ? 'Sync unavailable on this device'
    : authLoading
      ? 'Checking sync status'
      : authSession
        ? 'Sign out'
        : 'Sign in'

  const syncButtonClassName = [
    'sync-toggle',
    authSession ? 'sync-toggle--active' : '',
    syncState === 'error' ? 'sync-toggle--error' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const userInitials = authSession?.email
    ? authSession.email.split('@')[0].slice(0, 2).toUpperCase()
    : ''

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
          <div className="hero__actions">
            {authSession && (
              <div className="user-indicator" title={authSession.email} aria-hidden={false}>
                <div className="user-indicator__badge">{userInitials}</div>
              </div>
            )}
            <button
              type="button"
              className={syncButtonClassName}
              onClick={handleSyncButtonClick}
              disabled={!firebaseEnabled || authLoading || authPending}
              aria-label={syncButtonLabel}
              title={syncButtonTitle}
            >
              <svg
                className="sync-toggle__icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {authSession ? (
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M21 12a9 9 0 0 1-15.36 6.36M3 12a9 9 0 0 1 15.36-6.36M17 3h3v3M4 18v3h3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>

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
              <div className="catalog-shell__title-row">
                <h2 className="catalog-shell__title">Browse the library</h2>
                  <div className="catalog-shell__export-group" ref={exportMenuRef}>
                    <button
                      type="button"
                      className="catalog-shell__export"
                      onClick={() => setExportMenuOpen((previous) => !previous)}
                      aria-label={`Export or copy ${filteredBooks.length} visible books`}
                      aria-haspopup="menu"
                      aria-expanded={exportMenuOpen}
                      aria-controls="catalog-shell-export-menu"
                      title="Export or copy visible books"
                    >
                      <svg
                        className="catalog-shell__export-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 9V4h10v5M7 18h10v2H7v-2Zm12-7H5a2 2 0 0 0-2 2v3h4v-3h10v3h4v-3a2 2 0 0 0-2-2Z"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="catalog-shell__export-caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    {exportMenuOpen && (
                      <div
                        id="catalog-shell-export-menu"
                        className="catalog-shell__export-menu"
                        role="menu"
                        aria-label="Export options"
                      >
                        <button
                          type="button"
                          className="catalog-shell__export-menu-item"
                          onClick={handleExportVisibleBooksCsv}
                          role="menuitem"
                        >
                          Download CSV
                        </button>
                        <button
                          type="button"
                          className="catalog-shell__export-menu-item"
                          onClick={handleCopyVisibleBooksCsv}
                          role="menuitem"
                        >
                          Copy as text
                        </button>
                        <button
                          type="button"
                          className="catalog-shell__export-menu-item"
                          onClick={handlePrintVisibleBooks}
                          role="menuitem"
                        >
                          Print list
                        </button>
                      </div>
                    )}
                  </div>
              </div>
              <p className="catalog-shell__subtitle">Select any title to read why it belongs in the canon.</p>
              <p className="filters__count">Showing {filteredBooks.length} books</p>
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

      <SignOutConfirm
        open={signOutConfirmOpen}
        pending={false}
        onCancel={() => setSignOutConfirmOpen(false)}
        onConfirm={() => {
          void handleSignOut()
        }}
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
