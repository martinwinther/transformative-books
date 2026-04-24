function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function toCsvRow(cells) {
  return cells.map(csvEscape).join(',')
}

function formatCanon(book) {
  if (Array.isArray(book.canonSources) && book.canonSources.length > 0) {
    return book.canonSources.join(' + ')
  }
  return book.canon ?? ''
}

function formatGenres(book) {
  return Array.isArray(book.genres) ? book.genres.join(', ') : ''
}

function formatBooleanStatus(value, positiveLabel, negativeLabel) {
  return value ? positiveLabel : negativeLabel
}

function formatDateForFileName(date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}-${hours}${minutes}`
}

/**
 * @param {import('../types/book.js').Book[]} books
 * @param {Record<string, import('../types/book.js').BookProgress>} readerProgress
 * @returns {string}
 */
export function buildBooksCsv(books, readerProgress) {
  const headers = [
    'Position',
    'Title',
    'Author',
    'Canon',
    'Difficulty',
    'Genres',
    'Read status',
    'Owned status',
    'Your rating',
    'Your notes',
    'Short rationale',
  ]

  const rows = books.map((book, index) => {
    const progress = readerProgress[book.slug]
    return [
      index + 1,
      book.title,
      book.author,
      formatCanon(book),
      book.rating,
      formatGenres(book),
      formatBooleanStatus(progress?.isRead === true, 'Read', 'Unread'),
      formatBooleanStatus(progress?.owns === true, 'Owned', 'Not owned'),
      progress?.userRating ?? '',
      progress?.notes ?? '',
      book.justification,
    ]
  })

  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n')
}

/**
 * @param {{ canonFilter: string }} options
 * @returns {string}
 */
export function buildBooksCsvFileName(options) {
  const dateStamp = formatDateForFileName(new Date())
  const canonSegment = options.canonFilter === 'all' ? 'all-canons' : `${options.canonFilter}-canon`
  return `transformative-books-${canonSegment}-${dateStamp}.csv`
}

/**
 * @param {string} fileName
 * @param {string} csvText
 */
export function downloadCsvFile(fileName, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
