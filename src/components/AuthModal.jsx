import { useEffect, useMemo, useState } from 'react'

function AuthModal({
  open,
  pending,
  error,
  onClose,
  onEmailSignIn,
  onEmailSignUp,
  onGoogleSignIn,
}) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const title = useMemo(() => (mode === 'signin' ? 'Sign in to sync' : 'Create your sync account'), [mode])

  useEffect(() => {
    if (!open) return
    setPassword('')
  }, [open, mode])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || password.length < 6) return
    if (mode === 'signin') {
      await onEmailSignIn(email.trim(), password)
    } else {
      await onEmailSignUp(email.trim(), password)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="auth-modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal__header">
          <h2 id="auth-modal-title" className="auth-modal__title">{title}</h2>
          <button type="button" className="auth-modal__close" onClick={onClose} aria-label="Close auth dialog">×</button>
        </div>
        <p className="auth-modal__intro">
          Continue as a guest anytime. Account sync keeps your progress aligned across devices.
        </p>

        <div className="auth-modal__tabs" aria-label="Authentication modes">
          <button
            type="button"
            aria-pressed={mode === 'signin'}
            className={`auth-modal__tab ${mode === 'signin' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === 'signup'}
            className={`auth-modal__tab ${mode === 'signup' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-modal__form" onSubmit={handleSubmit}>
          <label className="auth-modal__label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            className="auth-modal__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="auth-modal__label" htmlFor="auth-password">Password (min 6 chars)</label>
          <input
            id="auth-password"
            className="auth-modal__input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="auth-modal__error">{error}</p>}

          <button
            type="submit"
            className="auth-modal__submit"
            disabled={pending || !email.trim() || password.length < 6}
          >
            {pending ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-modal__divider" role="separator" aria-label="Alternative sign-in method">or</div>
        <button type="button" className="auth-modal__google" onClick={onGoogleSignIn} disabled={pending}>
          {pending ? 'Working…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}

export default AuthModal
