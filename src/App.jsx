import { useState, useEffect } from 'react'
import { loadBooks } from './data/loadBooks.js'
import BookCard from './components/BookCard.jsx'
import BookDrawer from './components/BookDrawer.jsx'
import FiltersBar from './components/FiltersBar.jsx'
import RatingScaleInfo from './components/RatingScaleInfo.jsx'

function App() {
  const [books, setBooks] = useState([])
  const [filteredBooks, setFilteredBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState(null)
  const [genreFilter, setGenreFilter] = useState('')
  const [sortBy, setSortBy] = useState('rating-asc')
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem('tb-theme')
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    loadBooks()
      .then((data) => {
        setBooks(data)
        setFilteredBooks(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let next = books.filter((book) => {
      const matchSearch =
        !searchQuery ||
        [book.title, book.author, book.justification, ...book.genres].some((s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase())
        )
      const matchRating =
        ratingFilter == null || book.rating === ratingFilter
      const matchGenre =
        !genreFilter || book.genres.includes(genreFilter)
      return matchSearch && matchRating && matchGenre
    })

    if (sortBy === 'rating-asc') {
      next = [...next].sort((a, b) => a.rating - b.rating || a.title.localeCompare(b.title))
    } else {
      next = [...next].sort((a, b) => a.title.localeCompare(b.title))
    }
    setFilteredBooks(next)
  }, [books, searchQuery, ratingFilter, genreFilter, sortBy])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('tb-theme', theme)
  }, [theme])

  const availableGenres = Array.from(
    new Set(books.flatMap((book) => book.genres))
  ).sort((a, b) => a.localeCompare(b))

  const handleCloseDrawer = () => setSelectedBook(null)
  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  return (
    <div className="app">
      <div className="ambient-layer" aria-hidden="true" />
      <header className="hero glass">
        <div className="hero__top-row">
          <p className="hero__eyebrow">Transformative Canon</p>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
        <h1>Discover Books That Change How You Think</h1>
        <p className="tagline">
          A reader-first library of timeless works chosen for depth, transformation, and lasting impact.
        </p>
        <div className="hero__stats" aria-label="Catalog overview">
          <span className="hero__stat glass-subtle">{books.length} titles</span>
          <span className="hero__stat glass-subtle">{availableGenres.length} genres</span>
          <span className="hero__stat glass-subtle">Curated for serious readers</span>
        </div>
      </header>

      <main className="main">
        <section className="controls glass">
          <RatingScaleInfo />
          <FiltersBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            ratingFilter={ratingFilter}
            onRatingFilterChange={setRatingFilter}
            genreFilter={genreFilter}
            onGenreFilterChange={setGenreFilter}
            availableGenres={availableGenres}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            resultCount={filteredBooks.length}
          />
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
                  <BookCard book={book} onClick={setSelectedBook} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <BookDrawer book={selectedBook} onClose={handleCloseDrawer} />
    </div>
  )
}

export default App
