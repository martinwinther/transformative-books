/**
 * Parse a single CSV row respecting double-quoted fields (which may contain commas).
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && ch === ',') {
      result.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  result.push(current.trim())
  return result
}

/**
 * Strip optional "L123:" prefix from CSV lines (from editor row labels).
 * @param {string} line
 * @returns {string}
 */
function stripLinePrefix(line) {
  const match = line.match(/^L\d+:(.*)$/s)
  return match ? match[1].trim() : line
}

/**
 * Build a URL-safe slug from author and title.
 * @param {string} author
 * @param {string} title
 * @returns {string}
 */
function buildSlug(author, title) {
  const combined = `${author} ${title}`.toLowerCase()
  return combined
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalize external URLs from CSV to safe absolute links.
 * @param {string} raw
 * @returns {string}
 */
function normalizeUrl(raw) {
  const value = (raw ?? '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('www.')) return `https://${value}`
  return ''
}

const MAX_GENRES_PER_BOOK = 3
const CANON_URLS = {
  western: '/western-canon.csv',
  eastern: '/eastern-canon.csv',
}

export const CANON_OPTIONS = ['western', 'eastern', 'all']
export const DEFAULT_CANON = 'western'

const booksCache = new Map()

function normalizeCanonicalText(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildCanonicalBookKey(author, title) {
  return `${normalizeCanonicalText(author)}::${normalizeCanonicalText(title)}`
}

export function normalizeCanon(rawCanon) {
  if (rawCanon === 'western' || rawCanon === 'eastern' || rawCanon === 'all') {
    return rawCanon
  }
  return DEFAULT_CANON
}

/**
 * Parse and normalize genres from a single CSV cell.
 * Accepts pipe-separated values (primary), with comma/semicolon fallback.
 * @param {string} raw
 * @returns {string[]}
 */
function parseGenresFromCell(raw) {
  if (!raw) return []
  const parts = raw
    .split(/[|;,]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const seen = new Set()
  const genres = []
  for (const part of parts) {
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    genres.push(part)
    if (genres.length === MAX_GENRES_PER_BOOK) break
  }
  return genres
}

/**
 * Parse and normalize genres from either a unified Genres column or
 * up to 3 legacy columns (Genre1/Genre2/Genre3).
 * @param {string[]} cells
 * @param {number} genresIdx
 * @param {number} genre1Idx
 * @param {number} genre2Idx
 * @param {number} genre3Idx
 * @returns {string[]}
 */
function parseGenres(cells, genresIdx, genre1Idx, genre2Idx, genre3Idx) {
  if (genresIdx >= 0) {
    return parseGenresFromCell((cells[genresIdx] ?? '').trim())
  }

  const parts = [genre1Idx, genre2Idx, genre3Idx]
    .filter((idx) => idx >= 0)
    .map((idx) => (cells[idx] ?? '').trim())
    .filter(Boolean)

  if (parts.length === 0) return []
  return parseGenresFromCell(parts.join('|'))
}

const TRANSFORMATIVE_PLACEHOLDER = 'Coming later'

/**
 * Fetch and parse the books CSV into Book objects.
 * Uses the CSV that includes TransformativeExperience when present.
 * @param {'western' | 'eastern'} canon
 * @param {string} text
 * @returns {Promise<import('../types/book.js').Book[]>}
 */
function parseBooksFromCsv(canon, text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())

  const books = []
  const headerLine = stripLinePrefix(lines[0])
  const header = parseCSVLine(headerLine)
  const authorIdx = header.findIndex((h) => h.toLowerCase() === 'author')
  const titleIdx = header.findIndex((h) => h.toLowerCase() === 'title')
  const ratingIdx = header.findIndex((h) => h.toLowerCase() === 'rating')
  const justificationIdx = header.findIndex((h) => h.toLowerCase() === 'justification')
  const expandedIdx = header.findIndex(
    (h) => h.toLowerCase() === 'expandedjustification' || h.toLowerCase() === 'expanded justification'
  )
  const transformativeIdx = header.findIndex(
    (h) => h.toLowerCase().replace(/\s/g, '') === 'transformativeexperience'
  )
  const genresIdx = header.findIndex((h) => h.toLowerCase() === 'genres' || h.toLowerCase() === 'genre')
  const genre1Idx = header.findIndex((h) => h.toLowerCase() === 'genre1')
  const genre2Idx = header.findIndex((h) => h.toLowerCase() === 'genre2')
  const genre3Idx = header.findIndex((h) => h.toLowerCase() === 'genre3')
  const amazonLinkIdx = header.findIndex((h) => {
    const key = h.toLowerCase().replace(/\s|_/g, '')
    return key === 'link' || key === 'amazonlink' || key === 'amazonurl' || key === 'amazon'
  })

  if (
    authorIdx < 0 ||
    titleIdx < 0 ||
    ratingIdx < 0 ||
    justificationIdx < 0 ||
    expandedIdx < 0
  ) {
    throw new Error('CSV missing required columns: Author, Title, Rating, Justification, ExpandedJustification')
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = stripLinePrefix(lines[i])
    if (!raw) continue
    const cells = parseCSVLine(raw)
    const author = (cells[authorIdx] ?? '').trim()
    const title = (cells[titleIdx] ?? '').trim()
    if (!author && !title) continue

    const ratingRaw = (cells[ratingIdx] ?? '1').trim()
    const rating = Math.min(5, Math.max(1, parseInt(ratingRaw, 10) || 1))
    const justification = (cells[justificationIdx] ?? '').trim()
    const expandedJustification = (cells[expandedIdx] ?? '').trim()
    const transformativeRaw =
      transformativeIdx >= 0 ? (cells[transformativeIdx] ?? '').trim() : ''
    const transformativeExperience =
      transformativeRaw || TRANSFORMATIVE_PLACEHOLDER
    const genres = parseGenres(cells, genresIdx, genre1Idx, genre2Idx, genre3Idx)
    const amazonLink =
      amazonLinkIdx >= 0 ? normalizeUrl(cells[amazonLinkIdx] ?? '') : ''

    books.push({
      author,
      title,
      rating,
      genres,
      justification,
      expandedJustification: expandedJustification || justification,
      transformativeExperience,
      amazonLink,
      slug: buildSlug(author, title),
      canon,
      canonSources: [canon],
    })
  }

  return books
}

async function loadSingleCanonBooks(canon) {
  const url = CANON_URLS[canon]
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load books: ${response.status}`)
  }
  const text = await response.text()
  return parseBooksFromCsv(canon, text)
}

function mergeCanons(westernBooks, easternBooks) {
  const merged = []
  const seenByAuthorTitle = new Map()

  const addBook = (book) => {
    const key = buildCanonicalBookKey(book.author, book.title)
    const existing = seenByAuthorTitle.get(key)
    if (!existing) {
      seenByAuthorTitle.set(key, book)
      merged.push(book)
      return
    }
    if (!existing.canonSources.includes(book.canon)) {
      existing.canonSources = [...existing.canonSources, book.canon]
    }
  }

  // Western precedence for exact author+title duplicates.
  westernBooks.forEach(addBook)
  easternBooks.forEach(addBook)

  return merged
}

/**
 * Fetch and parse the books CSV into Book objects.
 * @param {'western' | 'eastern' | 'all'} requestedCanon
 * @returns {Promise<import('../types/book.js').Book[]>}
 */
export async function loadBooks(requestedCanon = DEFAULT_CANON) {
  const canon = normalizeCanon(requestedCanon)
  const cached = booksCache.get(canon)
  if (cached) return cached

  const pending =
    canon === 'all'
      ? Promise.all([loadBooks('western'), loadBooks('eastern')]).then(([westernBooks, easternBooks]) =>
          mergeCanons(westernBooks, easternBooks)
        )
      : loadSingleCanonBooks(canon)

  booksCache.set(canon, pending)
  return pending
}

/**
 * Resolve the most specific canon that contains a slug.
 * @param {string} slug
 * @returns {Promise<'western' | 'eastern' | 'all' | null>}
 */
export async function resolveCanonicalSelectionForSlug(slug) {
  const value = String(slug ?? '').trim()
  if (!value) return null

  const [westernBooks, easternBooks] = await Promise.all([loadBooks('western'), loadBooks('eastern')])
  const inWestern = westernBooks.some((book) => book.slug === value)
  const inEastern = easternBooks.some((book) => book.slug === value)

  if (inWestern && inEastern) return 'all'
  if (inWestern) return 'western'
  if (inEastern) return 'eastern'
  return null
}
