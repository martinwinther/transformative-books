function MigrationDialog({ state, pending, onChoose }) {
  if (!state) return null

  const localCount = Object.keys(state.localProgress).length
  const cloudCount = Object.keys(state.cloudProgress).length

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="migration-modal glass">
        <h2 id="migration-title" className="migration-modal__title">Choose how to combine your progress</h2>
        <p className="migration-modal__copy">
          We found both local and cloud progress. Pick how to continue for this account.
        </p>
        <p className="migration-modal__counts">Local: {localCount} entries · Cloud: {cloudCount} entries</p>
        <div className="migration-modal__actions">
          <button
            type="button"
            className="migration-modal__button migration-modal__button--primary"
            disabled={pending}
            onClick={() => onChoose('merge')}
          >
            {pending ? 'Applying…' : 'Merge by latest edit'}
          </button>
          <button
            type="button"
            className="migration-modal__button"
            disabled={pending}
            onClick={() => onChoose('keep-cloud')}
          >
            Keep cloud only
          </button>
          <button
            type="button"
            className="migration-modal__button"
            disabled={pending}
            onClick={() => onChoose('keep-local')}
          >
            Keep local only
          </button>
        </div>
      </div>
    </div>
  )
}

export default MigrationDialog
