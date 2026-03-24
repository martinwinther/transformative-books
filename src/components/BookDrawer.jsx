import { useEffect, useRef, useState } from 'react'
import { buildGoodreadsSearchUrl } from '../utils/externalLinks'

function BookDrawer({
  book,
  progress,
  onClose,
  onReadChange,
  onOwnChange,
  onUserRatingChange,
  onNotesChange,
  notesHelpText,
}) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)
  const [hoverRating, setHoverRating] = useState(null)

  useEffect(() => {
    if (!book) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [book, onClose])

  useEffect(() => {
    if (book) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [book])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  useEffect(() => {
    setHoverRating(null)
  }, [book?.slug])

  if (!book) return null

  const notes = progress?.notes ?? ''
  const isRead = progress?.isRead === true
  const owns = progress?.owns === true
  const rawUserRating = progress?.userRating
  const userRating =
    typeof rawUserRating === 'number' &&
    Number.isInteger(rawUserRating) &&
    rawUserRating >= 1 &&
    rawUserRating <= 5
      ? rawUserRating
      : null
  const effectiveRating = hoverRating ?? userRating
  const goodreadsLink = buildGoodreadsSearchUrl(book.title, book.author)

  return (
    <div
      ref={overlayRef}
      className="drawer-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        ref={panelRef}
        className="drawer"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__header">
          <h2 id="drawer-title" className="drawer__title">
            {book.title}
          </h2>
          <p className="drawer__author">{book.author}</p>
          {book.genres.length > 0 && (
            <ul className="drawer__genres" aria-label="Genres">
              {book.genres.map((genre) => (
                <li key={`${book.slug}-drawer-${genre}`} className="drawer__genre">
                  {genre}
                </li>
              ))}
            </ul>
          )}
          <span
            className="drawer__rating"
            data-rating={book.rating}
            title={`Reading difficulty: ${book.rating} of 5`}
          >
            Difficulty: {book.rating}/5
          </span>
          {book.title && (
            <a
              className="drawer__goodreads"
              href={goodreadsLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Search Goodreads for ${book.title} by ${book.author}`}
            >
              <span className="drawer__goodreads-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path d="M6.6 6.4c0-1.9 1.6-3.4 3.5-3.4 1.6 0 2.8.9 3.3 2.1.6-1.2 1.8-2.1 3.4-2.1 1.9 0 3.5 1.5 3.5 3.4v11.2c0 .7-.6 1.4-1.4 1.4h-2.2c-.8 0-1.4-.7-1.4-1.4V9.7c0-.6-.5-1.1-1.1-1.1s-1.1.5-1.1 1.1v7.9c0 .7-.6 1.4-1.4 1.4h-2.1c-.8 0-1.4-.7-1.4-1.4V9.7c0-.6-.5-1.1-1.1-1.1s-1.1.5-1.1 1.1v7.9c0 .7-.6 1.4-1.4 1.4H8c-.8 0-1.4-.7-1.4-1.4V6.4z" />
                </svg>
              </span>
              <span className="drawer__goodreads-text">Goodreads</span>
            </a>
          )}
          {book.amazonLink && (
            <a
              className="drawer__amazon"
              href={book.amazonLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Buy ${book.title} on Amazon`}
            >
              <span className="drawer__amazon-mark" aria-hidden="true">
                <svg viewBox="0 0 48 24" role="presentation" focusable="false">
                  <path d="M6 7c6 5 17 8 28 4" />
                  <path d="M31.5 11.4l2.7-.6-1.2 2.5" />
                </svg>
              </span>
              <span className="drawer__amazon-text">Amazon</span>
            </a>
          )}
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="drawer__body">
          <section className="drawer__section drawer__section--tracker">
            <h3 className="drawer__section-title">Your tracker</h3>
            <label className="drawer__read-toggle">
              <input
                type="checkbox"
                checked={isRead}
                onChange={(e) => onReadChange(book.slug, e.target.checked)}
              />
              <span>I&apos;ve read this book</span>
            </label>
            <label className="drawer__own-toggle">
              <input
                type="checkbox"
                checked={owns}
                onChange={(e) => onOwnChange(book.slug, e.target.checked)}
              />
              <span>I own this book</span>
            </label>
            <div className="drawer__user-rating-wrap">
              <p className="drawer__user-rating-label" id={`user-rating-label-${book.slug}`}>
                Your rating
              </p>
              <div
                className="drawer__user-rating"
                role="group"
                aria-labelledby={`user-rating-label-${book.slug}`}
                onMouseLeave={() => setHoverRating(null)}
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isActive =
                    effectiveRating != null && starValue <= effectiveRating
                  return (
                    <button
                      key={starValue}
                      type="button"
                      className={`drawer__star ${isActive ? 'drawer__star--on' : ''}`}
                      onClick={() => {
                        const nextRating = userRating === starValue ? null : starValue
                        onUserRatingChange(book.slug, nextRating)
                        setHoverRating(nextRating)
                      }}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onFocus={() => setHoverRating(starValue)}
                      aria-label={
                        userRating === starValue
                          ? `Clear ${starValue} star rating`
                          : `Rate this book ${starValue} out of 5 stars`
                      }
                      aria-pressed={userRating === starValue}
                    >
                      ★
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="drawer__notes-label" htmlFor={`notes-${book.slug}`}>
              Personal notes
            </label>
            <textarea
              id={`notes-${book.slug}`}
              className="drawer__notes"
              value={notes}
              onChange={(e) => onNotesChange(book.slug, e.target.value)}
              placeholder="Capture your reflections, favorite passages, or what changed for you."
              rows={7}
            />
            <p className="drawer__notes-help">{notesHelpText || 'Saved locally in this browser for now.'}</p>
          </section>
          <section className="drawer__section">
            <h3 className="drawer__section-title">Summary</h3>
            <p className="drawer__justification">{book.justification}</p>
          </section>
          <section className="drawer__section">
            <h3 className="drawer__section-title">Why this complexity rating</h3>
            <p className="drawer__expanded">{book.expandedJustification}</p>
          </section>
          <section className="drawer__section">
            <h3 className="drawer__section-title">Why it&apos;s transformative</h3>
            <p className={book.transformativeExperience === 'Coming later' ? 'drawer__placeholder' : 'drawer__expanded'}>
              {book.transformativeExperience}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default BookDrawer
