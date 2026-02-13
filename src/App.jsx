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
  const [sortBy, setSortBy] = useState('rating-asc')

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
        [book.title, book.author, book.justification].some((s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase())
        )
      const matchRating =
        ratingFilter == null || book.rating === ratingFilter
      return matchSearch && matchRating
    })

    if (sortBy === 'rating-asc') {
      next = [...next].sort((a, b) => a.rating - b.rating || a.title.localeCompare(b.title))
    } else {
      next = [...next].sort((a, b) => a.title.localeCompare(b.title))
    }
    setFilteredBooks(next)
  }, [books, searchQuery, ratingFilter, sortBy])

  const handleCloseDrawer = () => setSelectedBook(null)

  return (
    <div className="app">
      <header className="hero">
        <h1>Transformative Books</h1>
        <p className="tagline">A curated canon of the most transformative books of all time.</p>
      </header>

      <main className="main">
        <RatingScaleInfo />
        <FiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          ratingFilter={ratingFilter}
          onRatingFilterChange={setRatingFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          resultCount={filteredBooks.length}
        />

        {loading && <p className="status">Loading catalog…</p>}
        {error && <p className="status status--error">{error}</p>}
        {!loading && !error && filteredBooks.length === 0 && (
          <p className="status">No books match your filters.</p>
        )}
        {!loading && !error && filteredBooks.length > 0 && (
          <div className="catalog" role="list">
            {filteredBooks.map((book) => (
              <div key={book.slug} className="catalog__item" role="listitem">
                <BookCard book={book} onClick={setSelectedBook} />
              </div>
            ))}
          </div>
        )}
      </main>

      <BookDrawer book={selectedBook} onClose={handleCloseDrawer} />
    </div>
  )
}

export default App
