import { useState } from 'react'
import { RATING_SCALE } from '../types/book.js'

function RatingScaleInfo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rating-scale">
      <button
        type="button"
        className="rating-scale__toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="rating-scale-content"
      >
        How are difficulty ratings defined?
        <span className="rating-scale__chevron" aria-hidden="true">{open ? ' ▲' : ' ▼'}</span>
      </button>
      <div
        id="rating-scale-content"
        className={`rating-scale__content ${open ? 'rating-scale__content--open' : ''}`}
        hidden={!open}
      >
        <ul className="rating-scale__list">
          {RATING_SCALE.map(({ level, label, description }) => (
            <li key={level} className="rating-scale__item">
              <span className="rating-scale__level" data-rating={level}>
                {level}
              </span>
              <div className="rating-scale__text">
                <strong>{label}.</strong> {description}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default RatingScaleInfo
