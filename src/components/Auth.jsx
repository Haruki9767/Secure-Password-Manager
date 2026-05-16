import { useState, useEffect } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from '../firebase.js'

export default function Auth({ step, currentUser, locked, onMasterUnlock, onRelock, onSignOut }) {
  const [email, setEmail]       = useState('')
  const [loginPw, setLoginPw]   = useState('')
  const [masterPw, setMasterPw] = useState('')
  const [relockPw, setRelockPw] = useState('')
  const [showLoginPw, setShowLoginPw]   = useState(false)
  const [showMasterPw, setShowMasterPw] = useState(false)
  const [showRelockPw, setShowRelockPw] = useState(false)
  const [loginError, setLoginError]   = useState('')
  const [masterError, setMasterError] = useState('')
  const [relockError, setRelockError] = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)
  const [masterLoading, setMasterLoading] = useState(false)
  const [relockLoading, setRelockLoading] = useState(false)
  const [isFirstTime, setIsFirstTime]     = useState(false)

  // Brute-force protection for the relock screen.
  // After MAX_RELOCK_ATTEMPTS failures the input is disabled for LOCKOUT_MS.
  const MAX_RELOCK_ATTEMPTS = 5
  const LOCKOUT_MS          = 30_000
  const [relockAttempts, setRelockAttempts] = useState(0)
  const [relockLockedUntil, setRelockLockedUntil] = useState(0)
  const [relockCountdown, setRelockCountdown] = useState(0)

  useEffect(() => {
    if (relockLockedUntil === 0) return
    const tick = () => {
      const remaining = Math.ceil((relockLockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setRelockCountdown(0)
        setRelockLockedUntil(0)
        setRelockAttempts(0)
      } else {
        setRelockCountdown(remaining)
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [relockLockedUntil])

  useEffect(() => {
    if (step === 'master' && currentUser) {
      get(ref(db, `users/${currentUser.uid}/meta/salt`)).then(snap => {
        setIsFirstTime(!snap.exists())
      }).catch(() => {})
    }
  }, [step, currentUser])

  async function handleLogin(e) {
    e?.preventDefault()
    if (!email || !loginPw) { setLoginError('Please enter your email and password.'); return }
    setLoginLoading(true)
    setLoginError('')
    try {
      await signInWithEmailAndPassword(auth, email, loginPw)
    } catch (err) {
      let msg = 'Sign in failed. Check your credentials.'
      if (err.code === 'auth/too-many-requests')      msg = 'Too many attempts. Account temporarily locked.'
      if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.'
      setLoginError(msg)
      setLoginLoading(false)
    }
  }

  async function handleMaster(e) {
    e?.preventDefault()
    if (!masterPw || masterPw.length < 8) { setMasterError('Master password must be at least 8 characters.'); return }
    setMasterLoading(true)
    setMasterError('')
    try {
      await onMasterUnlock(masterPw)
    } catch {
      setMasterError('Incorrect master password. Try again.')
      setMasterLoading(false)
    }
  }

  async function handleRelockSubmit(e) {
    e?.preventDefault()
    if (Date.now() < relockLockedUntil) return
    setRelockLoading(true)
    setRelockError('')
    try {
      await onRelock(relockPw)
      setRelockAttempts(0)
    } catch {
      const next = relockAttempts + 1
      setRelockAttempts(next)
      if (next >= MAX_RELOCK_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS
        setRelockLockedUntil(until)
        setRelockError(`Too many failed attempts. Try again in ${LOCKOUT_MS / 1000} seconds.`)
      } else {
        setRelockError(`Incorrect master password. ${MAX_RELOCK_ATTEMPTS - next} attempt${MAX_RELOCK_ATTEMPTS - next === 1 ? '' : 's'} remaining.`)
      }
      setRelockLoading(false)
    }
  }

  if (locked) {
    const isLockedOut = Date.now() < relockLockedUntil
    return (
      <div id="auth-screen">
        <div id="lock-screen-inner" className="auth-card">
          <div className="lock-anim">🔒</div>
          <h1 className="auth-title" style={{ textAlign: 'center' }}>Vault Locked</h1>
          <p className="auth-subtitle" style={{ textAlign: 'center' }}>Locked after inactivity. Re-enter your master password.</p>
          <form onSubmit={handleRelockSubmit}>
            <div className="field">
              <label>Master Password</label>
              <div className="field-wrap">
                <input
                  type={showRelockPw ? 'text' : 'password'}
                  className="mono has-toggle"
                  placeholder="Master password"
                  autoComplete="off"
                  value={relockPw}
                  onChange={e => setRelockPw(e.target.value)}
                  autoFocus
                  disabled={isLockedOut || relockLoading}
                />
                <button type="button" className="toggle-pw" onClick={() => setShowRelockPw(v => !v)}>
                  {showRelockPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {relockError && <div className="error-msg show">{relockError}</div>}
            {isLockedOut && relockCountdown > 0 && (
              <div className="error-msg show">Input locked — try again in {relockCountdown}s</div>
            )}
            <br />
            <button type="submit" className="btn btn-primary" disabled={isLockedOut || relockLoading}>
              {relockLoading ? 'Unlocking…' : isLockedOut ? `Locked (${relockCountdown}s)` : 'Unlock'}
            </button>
          </form>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔐</div>
          <div className="auth-logo-text">VAULT</div>
        </div>

        {step === 'login' && (
          <div>
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Access is restricted. Sign in to continue.</p>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <div className="field-wrap">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="has-toggle"
                    value={loginPw}
                    onChange={e => setLoginPw(e.target.value)}
                  />
                  <button type="button" className="toggle-pw" onClick={() => setShowLoginPw(v => !v)}>
                    {showLoginPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {loginError && <div className="error-msg show">{loginError}</div>}
              <br />
              <button type="submit" className="btn btn-primary" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        )}

        {step === 'master' && (
          <div>
            <div className="lock-anim">🗝️</div>
            <h1 className="auth-title" style={{ textAlign: 'center' }}>Unlock Vault</h1>
            <p className="auth-subtitle" style={{ textAlign: 'center' }}>
              Enter your master password to decrypt your data. This never leaves your device.
            </p>
            <form onSubmit={handleMaster}>
              <div className="field">
                <label>Master Password</label>
                <div className="field-wrap">
                  <input
                    type={showMasterPw ? 'text' : 'password'}
                    className="mono has-toggle"
                    placeholder="Master password"
                    autoComplete="off"
                    value={masterPw}
                    onChange={e => setMasterPw(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="toggle-pw" onClick={() => setShowMasterPw(v => !v)}>
                    {showMasterPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {masterError && <div className="error-msg show">{masterError}</div>}
              {isFirstTime && (
                <div className="info-msg">
                  🎉 First-time setup — choose a strong master password. It encrypts everything and{' '}
                  <strong>cannot be recovered if lost</strong>.
                </div>
              )}
              <br />
              <button type="submit" className="btn btn-primary" disabled={masterLoading}>
                {masterLoading ? 'Unlocking…' : 'Unlock'}
              </button>
            </form>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={onSignOut}
            >
              ← Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
