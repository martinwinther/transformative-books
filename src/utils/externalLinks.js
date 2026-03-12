const GOODREADS_SEARCH_BASE_URL = 'https://www.goodreads.com/search'

/**
 * @param {string} title
 * @param {string} author
 * @returns {string}
 */
export function buildGoodreadsSearchUrl(title, author) {
  const normalizedTitle = (title ?? '').trim()
  const normalizedAuthor = (author ?? '').trim()
  const query = [normalizedTitle, normalizedAuthor].filter(Boolean).join(' ')

  if (!query) return GOODREADS_SEARCH_BASE_URL

  const params = new URLSearchParams({
    q: query,
    search_type: 'books',
  })

  return `${GOODREADS_SEARCH_BASE_URL}?${params.toString()}`
}

