import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from './firebase.js'
import { deriveKey, encrypt, decrypt, toB64 } from './crypto.js'
import Auth from './components/Auth.jsx'
import Vault from './components/Vault.jsx'

const LOCK_TIMEOUT = 5 * 60 * 1000

export default function App() {
  const [currentUser, setCurrentUser]     = useState(null)
  const [authStep, setAuthStep]           = useState('login') // 'login' | 'master'
  const [encryptionKey, setEncryptionKey] = useState(null)
  const [locked, setLocked]               = useState(false)
  const [passwords, setPasswords]         = useState({})
  const [notes, setNotes]                 = useState({})
  const [files, setFiles]                 = useState({})
  const [theme, setTheme]                 = useState(() => localStorage.getItem('vault-theme') || 'dark')
  const lockTimerRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('vault-theme', theme)
  }, [theme])

  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current)
      lockTimerRef.current = null
    }
  }, [])

  const resetLockTimer = useCallback(() => {
    clearLockTimer()
    lockTimerRef.current = setTimeout(() => {
      setEncryptionKey(null)
      setLocked(true)
    }, LOCK_TIMEOUT)
  }, [clearLockTimer])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handler = () => { if (encryptionKey) resetLockTimer() }
    events.forEach(ev => document.addEventListener(ev, handler, { passive: true }))
    return () => events.forEach(ev => document.removeEventListener(ev, handler))
  }, [encryptionKey, resetLockTimer])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        setCurrentUser(user)
        setAuthStep('master')
      } else {
        setCurrentUser(null)
        setEncryptionKey(null)
        setAuthStep('login')
        setLocked(false)
        clearLockTimer()
        setPasswords({})
        setNotes({})
        setFiles({})
      }
    })
    return unsub
  }, [clearLockTimer])

  async function loadData(user) {
    try {
      const snap = await get(ref(db, `users/${user.uid}`))
      const d    = snap.val() || {}
      setPasswords(d.passwords || {})
      setNotes(d.notes || {})
      setFiles(d.files || {})
    } catch {
      // will surface as empty state
    }
  }

  async function handleMasterUnlock(mp) {
    const snap = await get(ref(db, `users/${currentUser.uid}/meta`))
    const meta = snap.val()

    if (!meta?.salt) {
      const salt    = crypto.getRandomValues(new Uint8Array(32))
      const saltB64 = toB64(salt)
      const key     = await deriveKey(mp, salt)
      const verify  = await encrypt(key, 'VAULT_VERIFIED_v1')
      const { set } = await import('firebase/database')
      await set(ref(db, `users/${currentUser.uid}/meta`), { salt: saltB64, verify })
      setEncryptionKey(key)
      setLocked(false)
      await loadData(currentUser)
      resetLockTimer()
    } else {
      const testKey = await deriveKey(mp, meta.salt)
      const verified = await decrypt(testKey, meta.verify)
      if (verified !== 'VAULT_VERIFIED_v1') throw new Error('bad key')
      setEncryptionKey(testKey)
      setLocked(false)
      await loadData(currentUser)
      resetLockTimer()
    }
  }

  async function handleRelock(mp) {
    const snap     = await get(ref(db, `users/${currentUser.uid}/meta`))
    const meta     = snap.val()
    const testKey  = await deriveKey(mp, meta.salt)
    const verified = await decrypt(testKey, meta.verify)
    if (verified !== 'VAULT_VERIFIED_v1') throw new Error('bad key')
    setEncryptionKey(testKey)
    setLocked(false)
    resetLockTimer()
  }

  async function handleSignOut() {
    clearLockTimer()
    setEncryptionKey(null)
    setPasswords({})
    setNotes({})
    setFiles({})
    await signOut(auth)
  }

  function handleLockVault() {
    setEncryptionKey(null)
    clearLockTimer()
    setLocked(true)
  }

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  const isInApp = !!encryptionKey && !locked

  return (
    <>
      {!isInApp && (
        <Auth
          step={authStep}
          currentUser={currentUser}
          locked={locked}
          onMasterUnlock={handleMasterUnlock}
          onRelock={handleRelock}
          onSignOut={handleSignOut}
        />
      )}
      {isInApp && (
        <Vault
          currentUser={currentUser}
          encryptionKey={encryptionKey}
          passwords={passwords}
          notes={notes}
          files={files}
          setPasswords={setPasswords}
          setNotes={setNotes}
          setFiles={setFiles}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLock={handleLockVault}
          onSignOut={handleSignOut}
        />
      )}
    </>
  )
}
