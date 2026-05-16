import { useState, useEffect, useCallback } from 'react'
import { ref, set, remove } from 'firebase/database'
import { db } from '../firebase.js'
import { encrypt, decrypt, uid, genPassword, pwStrength } from '../crypto.js'

function StrengthBar({ password }) {
  const { score, label } = pwStrength(password)
  const cls = ['', 'weak', 'fair', 'good', 'strong'][score]
  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`pw-strength-bar${i <= score ? ` filled ${cls}` : ''}`} />
        ))}
      </div>
      <span className="pw-strength-label">{label}</span>
    </div>
  )
}

function Toast({ toasts }) {
  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  function toast(msg, type = 'info', ms = 2600) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, ms)
  }
  return { toasts, toast }
}

function PwDetailModal({ entry, onEdit, onDelete, onClose }) {
  const fields = [
    { label: 'Website / Service', val: entry.site,     mono: false },
    { label: 'Username / Email',  val: entry.username, mono: false, canCopy: true },
    { label: 'Password',          val: entry.password, mono: true,  canCopy: true, secret: true },
    { label: 'Notes',             val: entry.notes,    mono: false },
  ].filter(f => f.val)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">{entry.site || 'Password Details'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {fields.map(f => <DetailField key={f.label} field={f} />)}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { onClose(); onEdit(entry) }}>✏️ Edit</button>
          <button className="btn btn-danger" onClick={() => onDelete(entry.id)}>🗑 Delete</button>
        </div>
      </div>
    </div>
  )
}

function DetailField({ field: f }) {
  const [shown, setShown] = useState(false)
  function copy(text) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  return (
    <div className="detail-field">
      <div className="detail-label">{f.label}</div>
      <div className={`detail-value${f.mono ? ' mono' : ''}`}>
        <span className="detail-value-text">
          {f.secret ? (shown ? f.val : '••••••••••••') : f.val}
        </span>
        {f.secret && (
          <button className="btn-icon" style={{ fontSize: 14 }} onClick={() => setShown(v => !v)}>
            {shown ? '🙈' : '👁'}
          </button>
        )}
        {f.canCopy && (
          <button className="btn-icon" style={{ fontSize: 14 }} onClick={() => copy(f.val)}>📋</button>
        )}
      </div>
    </div>
  )
}

function PwFormModal({ existing, encryptionKey, currentUser, onSave, onClose }) {
  const [site, setSite]     = useState(existing?.site || '')
  const [user, setUser]     = useState(existing?.username || '')
  const [pw, setPw]         = useState(existing?.password || '')
  const [notes, setNotes]   = useState(existing?.notes || '')
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e?.preventDefault()
    if (!site || !user || !pw) { setError('Please fill in all required fields.'); return }
    setSaving(true)
    try {
      const entry = { site, username: user, password: pw, notes, updatedAt: new Date().toISOString() }
      if (!existing?.id) entry.createdAt = entry.updatedAt
      const enc = await encrypt(encryptionKey, entry)
      const eid = existing?.id || uid()
      await set(ref(db, `users/${currentUser.uid}/passwords/${eid}`), enc)
      onSave(eid, enc)
      onClose()
    } catch {
      setError('Error saving. Try again.')
      setSaving(false)
    }
  }

  function generate() {
    const p = genPassword(20, true, true, true, true)
    setPw(p)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">{existing ? 'Edit Password' : 'Add Password'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="field">
            <label>Website / Service *</label>
            <input type="text" placeholder="e.g. google.com" autoComplete="off" value={site} onChange={e => setSite(e.target.value)} />
          </div>
          <div className="field">
            <label>Username / Email *</label>
            <input type="text" placeholder="user@example.com" autoComplete="off" value={user} onChange={e => setUser(e.target.value)} />
          </div>
          <div className="field">
            <label>Password *</label>
            <div className="field-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                className="mono has-toggle"
                autoComplete="new-password"
                placeholder="Password"
                value={pw}
                onChange={e => setPw(e.target.value)}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            <StrengthBar password={pw} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows="3" placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={generate}>
            ⚡ Generate strong password
          </button>
          {error && <div className="error-msg show">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Passwords({ encryptionKey, currentUser, passwords, setPasswords, search }) {
  const [decrypted, setDecrypted] = useState([])
  const [modal, setModal]         = useState(null) // null | { type: 'detail'|'form', entry? }
  const { toasts, toast }         = useToast()

  const decryptAll = useCallback(async () => {
    const out = []
    const q   = search.toLowerCase()
    for (const [id, enc] of Object.entries(passwords)) {
      try {
        const e = await decrypt(encryptionKey, enc)
        if (q && !e.site?.toLowerCase().includes(q) && !e.username?.toLowerCase().includes(q)) continue
        out.push({ id, ...e })
      } catch { /* skip corrupt */ }
    }
    out.sort((a, b) => (a.site || '').localeCompare(b.site || ''))
    setDecrypted(out)
  }, [passwords, encryptionKey, search])

  useEffect(() => { decryptAll() }, [decryptAll])

  useEffect(() => {
    function onAdd() { setModal({ type: 'form', entry: null }) }
    document.addEventListener('vault:add-password', onAdd)
    return () => document.removeEventListener('vault:add-password', onAdd)
  }, [])

  function handleSave(eid, enc) {
    setPasswords(prev => ({ ...prev, [eid]: enc }))
    toast(modal?.entry ? 'Password updated!' : 'Password saved!', 'success')
  }

  async function handleDelete(id) {
    if (!confirm('Delete this password entry? This cannot be undone.')) return
    await remove(ref(db, `users/${currentUser.uid}/passwords/${id}`))
    setPasswords(prev => { const n = { ...prev }; delete n[id]; return n })
    setModal(null)
    toast('Password deleted', 'info')
  }

  function copy(text, label = 'Copied!') {
    navigator.clipboard.writeText(text).then(() => toast(label, 'success'))
  }

  return (
    <>
      <Toast toasts={toasts} />
      {decrypted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔑</div>
          <div className="empty-state-text">{search ? 'No results found' : 'No passwords saved yet'}</div>
          {!search && <div className="empty-state-sub">Click &quot;Add New&quot; to save your first password</div>}
        </div>
      ) : (
        <div className="items-grid">
          {decrypted.map(e => (
            <div key={e.id} className="item-card" onClick={() => setModal({ type: 'detail', entry: e })}>
              <div className="item-card-header">
                <div className="item-favicon">{(e.site || '?')[0].toUpperCase()}</div>
                <div className="item-card-meta">
                  <div className="item-card-title">{e.site || 'Untitled'}</div>
                  <div className="item-card-sub">{e.username || ''}</div>
                </div>
                <div className="item-card-actions">
                  <button className="btn-icon" title="Copy password" onClick={ev => { ev.stopPropagation(); copy(e.password, 'Password copied!') }}>📋</button>
                  <button className="btn-icon" title="Edit" onClick={ev => { ev.stopPropagation(); setModal({ type: 'form', entry: e }) }}>✏️</button>
                </div>
              </div>
              <div className="item-card-pw">
                <span className="pw-dots">{'●'.repeat(Math.min(e.password?.length || 8, 12))}</span>
                <button className="btn-icon" style={{ fontSize: 12, padding: '2px 6px' }} onClick={ev => { ev.stopPropagation(); copy(e.password, 'Password copied!') }}>📋</button>
              </div>
              {e.updatedAt && <div className="item-card-date">Updated {new Date(e.updatedAt).toLocaleDateString()}</div>}
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'detail' && (
        <PwDetailModal
          entry={modal.entry}
          onEdit={e => setModal({ type: 'form', entry: e })}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'form' && (
        <PwFormModal
          existing={modal.entry}
          encryptionKey={encryptionKey}
          currentUser={currentUser}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
