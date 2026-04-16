function FiltersBar({
  canonFilter,
  canonOptions,
  onCanonFilterChange,
  searchQuery,
  onSearchChange,
  ratingFilter,
  onRatingFilterChange,
  genreFilter,
  onGenreFilterChange,
  readFilter,
  onReadFilterChange,
  ownedFilter,
  onOwnedFilterChange,
  availableGenres,
  sortBy,
  onSortByChange,
}) {
  return (
    <div className="filters">
      <div className="filters__grid">
        <div className="filters__field filters__field--canon">
          <label htmlFor="canon-filter" className="filters__label">
            Canon
          </label>
          <select
            id="canon-filter"
            className="filters__sort"
            value={canonFilter}
            onChange={(e) => onCanonFilterChange(e.target.value)}
            aria-label="Select canonical source"
          >
            {canonOptions.map((canonOption) => (
              <option key={canonOption} value={canonOption}>
                {canonOption === 'all'
                  ? 'All canons'
                  : canonOption.charAt(0).toUpperCase() + canonOption.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filters__field filters__field--search">
          <label htmlFor="search-books" className="filters__label">
            Search
          </label>
          <input
            id="search-books"
            type="search"
            className="filters__search"
            placeholder="Title, author, or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search books by title, author, or description"
          />
        </div>

        <div className="filters__field">
          <label htmlFor="genre-filter" className="filters__label">
            Genre
          </label>
          <select
            id="genre-filter"
            className="filters__sort"
            value={genreFilter}
            onChange={(e) => onGenreFilterChange(e.target.value)}
            aria-label="Filter by genre"
            disabled={availableGenres.length === 0}
          >
            <option value="">
              {availableGenres.length === 0 ? 'No genres yet' : 'All genres'}
            </option>
            {availableGenres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        <div className="filters__field">
          <label htmlFor="read-filter" className="filters__label">
            Reading status
          </label>
          <select
            id="read-filter"
            className="filters__sort"
            value={readFilter}
            onChange={(e) => onReadFilterChange(e.target.value)}
            aria-label="Filter by reading status"
          >
            <option value="all">All reading statuses</option>
            <option value="read">Read</option>
            <option value="unread">Unread</option>
          </select>
        </div>

        <div className="filters__field">
          <label htmlFor="owned-filter" className="filters__label">
            Ownership
          </label>
          <select
            id="owned-filter"
            className="filters__sort"
            value={ownedFilter}
            onChange={(e) => onOwnedFilterChange(e.target.value)}
            aria-label="Filter by ownership status"
          >
            <option value="all">All ownership statuses</option>
            <option value="owned">Owned</option>
            <option value="unowned">Unowned</option>
          </select>
        </div>

        <div className="filters__field filters__field--difficulty">
          <span className="filters__label">Difficulty</span>
          <div className="filters__chips" role="group" aria-label="Filter by reading difficulty">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className={`filters__chip ${ratingFilter === rating ? 'filters__chip--active' : ''}`}
                data-rating={rating}
                onClick={() => onRatingFilterChange(ratingFilter === rating ? null : rating)}
                aria-pressed={ratingFilter === rating}
                aria-label={`Difficulty ${rating}`}
              >
                {rating}
              </button>
            ))}
            {ratingFilter != null && (
              <button
                type="button"
                className="filters__chip filters__chip--clear"
                onClick={() => onRatingFilterChange(null)}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="filters__field filters__field--sort">
          <label htmlFor="sort-books" className="filters__label">
            Sort
          </label>
          <select
            id="sort-books"
            className="filters__sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            aria-label="Sort order"
          >
            <option value="rating-asc">By difficulty (easiest first)</option>
            <option value="title">By title A-Z</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default FiltersBar
