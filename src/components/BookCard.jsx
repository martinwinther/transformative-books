function BookCard({ book, onClick }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(book)
    }
  }

  return (
    <article
      className="book-card"
      onClick={() => onClick(book)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${book.title} by ${book.author}`}
    >
      <div className="book-card__header">
        <h2 className="book-card__title">{book.title}</h2>
        <p className="book-card__author">{book.author}</p>
      </div>
      <span
        className="book-card__rating"
        data-rating={book.rating}
        title={`Reading difficulty: ${book.rating} of 5`}
      >
        {book.rating}
      </span>
      <p className="book-card__description">{book.justification}</p>
    </article>
  )
}

export default BookCard
