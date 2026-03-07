import { useEffect, useRef } from 'react'

function BookDrawer({ book, onClose }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

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

  if (!book) return null

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
