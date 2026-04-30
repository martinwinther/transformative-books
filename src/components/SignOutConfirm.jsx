function SignOutConfirm({ open, pending, onCancel, onConfirm }) {
  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="signout-title">
      <div className="migration-modal glass">
        <h2 id="signout-title" className="migration-modal__title">Sign out of sync?</h2>
        <p className="migration-modal__copy">You will stop syncing progress across devices. Are you sure you want to sign out?</p>
        <div className="migration-modal__actions">
          <button
            type="button"
            className="migration-modal__button migration-modal__button--primary"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
          <button
            type="button"
            className="migration-modal__button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignOutConfirm
