function SyncPanel({
  firebaseEnabled,
  firebaseMissingKeys,
  authLoading,
  authSession,
  syncState,
  syncError,
  onOpenAuth,
  onSignOut,
  onResendVerification,
  onRefreshVerification,
  onReloadCloud,
  onReimportLocal,
}) {
  const userEmail = authSession?.email ?? ''

  if (!firebaseEnabled) {
    return (
      <section className="sync-panel glass-subtle" aria-live="polite">
        <p className="sync-panel__title">Sync unavailable</p>
        <p className="sync-panel__copy">
          Firebase env vars are missing ({firebaseMissingKeys.join(', ')}). Progress is saved locally only.
        </p>
      </section>
    )
  }

  if (authLoading) {
    return (
      <section className="sync-panel glass-subtle" aria-live="polite">
        <p className="sync-panel__title">Checking sync session…</p>
      </section>
    )
  }

  if (!authSession) {
    return (
      <section className="sync-panel glass-subtle" aria-live="polite">
        <p className="sync-panel__title">Sync across devices</p>
        <p className="sync-panel__copy">Keep your reading progress in sync by creating an account.</p>
        <button type="button" className="sync-panel__primary" onClick={onOpenAuth}>Sync across devices</button>
      </section>
    )
  }

  if (!authSession.emailVerified) {
    return (
      <section className="sync-panel glass-subtle" aria-live="polite">
        <p className="sync-panel__title">Verify your email to enable cloud writes</p>
        <p className="sync-panel__copy">
          Signed in as <strong>{userEmail}</strong>. Local tracking still works; verify to unlock syncing.
        </p>
        <div className="sync-panel__actions">
          <button type="button" className="sync-panel__primary" onClick={onResendVerification}>Resend verification email</button>
          <button type="button" className="sync-panel__secondary" onClick={onRefreshVerification}>I verified, refresh</button>
          <button type="button" className="sync-panel__secondary" onClick={onSignOut}>Sign out</button>
        </div>
        {syncError && <p className="sync-panel__error">{syncError}</p>}
      </section>
    )
  }

  return (
    <section className="sync-panel glass-subtle" aria-live="polite">
      <p className="sync-panel__title">Cloud sync active</p>
      <p className="sync-panel__copy">
        Signed in as <strong>{userEmail}</strong>. Status: {syncState === 'synced' ? 'live sync connected' : 'synchronizing…'}
      </p>
      <div className="sync-panel__actions">
        <button type="button" className="sync-panel__secondary" onClick={onReloadCloud}>Reset to cloud</button>
        <button type="button" className="sync-panel__secondary" onClick={onReimportLocal}>Re-import local to cloud</button>
        <button type="button" className="sync-panel__secondary" onClick={onSignOut}>Sign out</button>
      </div>
      {syncError && <p className="sync-panel__error">{syncError}</p>}
    </section>
  )
}

export default SyncPanel
