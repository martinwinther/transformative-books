import { useEffect, useState } from 'react'

function BookCard({ book, progress, onClick, onShare }) {
  const [shareState, setShareState] = useState('idle')

  useEffect(() => {
    if (shareState === 'idle') return
    const timeoutId = window.setTimeout(() => {
      setShareState('idle')
    }, 2200)
    return () => window.clearTimeout(timeoutId)
  }, [shareState])

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(book)
    }
  }

  const handleShareClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onShare) return
    try {
      const copied = await onShare(book)
      setShareState(copied ? 'copied' : 'error')
    } catch {
      setShareState('error')
    }
  }

  const hasNotes = Boolean(progress?.notes?.trim())
  const owns = progress?.owns === true
  const rawUserRating = progress?.userRating
  const userRating =
    typeof rawUserRating === 'number' &&
    Number.isInteger(rawUserRating) &&
    rawUserRating >= 1 &&
    rawUserRating <= 5
      ? rawUserRating
      : null

  return (
    <article
      className="book-card"
      onClick={() => onClick(book)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${book.title} by ${book.author}`}
    >
      <p className="book-card__kicker">Transformative read</p>
      {(progress?.isRead || owns || hasNotes || userRating != null) && (
        <div className="book-card__status" aria-label="Your reading progress">
          {progress?.isRead && <span className="book-card__status-pill book-card__status-pill--read">Read</span>}
          {owns && <span className="book-card__status-pill book-card__status-pill--owns">Owns</span>}
          {userRating != null && (
            <span
              className="book-card__status-pill book-card__status-pill--user-rating"
              aria-label={`Your rating ${userRating} out of 5`}
            >
              <span className="book-card__status-rating-value">{userRating}</span>
              <span className="book-card__status-rating-star" aria-hidden="true">★</span>
            </span>
          )}
          {hasNotes && <span className="book-card__status-pill">Notes</span>}
        </div>
      )}
      <div className="book-card__header">
        <h2 className="book-card__title">{book.title}</h2>
        <p className="book-card__author">{book.author}</p>
        {book.genres.length > 0 && (
          <ul className="book-card__genres" aria-label="Genres">
            {book.genres.map((genre) => (
              <li key={`${book.slug}-${genre}`} className="book-card__genre">
                {genre}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span
        className="book-card__rating"
        data-rating={book.rating}
        title={`Reading difficulty: ${book.rating} of 5`}
      >
        {book.rating}
      </span>
      <p className="book-card__description">{book.justification}</p>
      {hasNotes && (
        <p className="book-card__notes-preview">
          {progress.notes}
        </p>
      )}
      <div className="book-card__footer">
        <span className="book-card__cta" aria-hidden="true">Read rationale →</span>
        <button
          type="button"
          className={`book-card__share${shareState !== 'idle' ? ` book-card__share--${shareState}` : ''}`}
          onClick={handleShareClick}
          aria-label={`Share ${book.title}`}
        >
          {shareState === 'copied' ? 'Copied' : shareState === 'error' ? 'Retry' : 'Share'}
        </button>
      </div>
    </article>
  )
}

export default BookCard
