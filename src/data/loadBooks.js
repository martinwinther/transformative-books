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
 * Fetch and parse the books CSV into Book objects.
 * @returns {Promise<import('../types/book.js').Book[]>}
 */
const TRANSFORMATIVE_PLACEHOLDER = 'Coming later'

/**
 * Fetch and parse the books CSV into Book objects.
 * Uses the CSV that includes TransformativeExperience when present.
 * @returns {Promise<import('../types/book.js').Book[]>}
 */
export async function loadBooks() {
  const url = '/transformative-canon-with-transformative-experience.csv'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load books: ${response.status}`)
  }
  const text = await response.text()
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

    books.push({
      author,
      title,
      rating,
      justification,
      expandedJustification: expandedJustification || justification,
      transformativeExperience,
      slug: buildSlug(author, title),
    })
  }

  return books
}
