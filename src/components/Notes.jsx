import { useState, useEffect, useCallback } from 'react'
import { ref, set, remove } from 'firebase/database'
import { db } from '../firebase.js'
import { encrypt, decrypt, uid } from '../crypto.js'

function Toast({ toasts }) {
  return (
    <div id="toast-container">
      {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  function toast(msg, type = 'info', ms = 2600) {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ms)
  }
  return { toasts, toast }
}

function NoteModal({ existing, readOnly, encryptionKey, currentUser, onSave, onEdit, onDelete, onClose }) {
  const [title, setTitle]   = useState(existing?.title || '')
  const [content, setContent] = useState(existing?.content || '')
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const isView = readOnly && existing

  async function handleSave(e) {
    e?.preventDefault()
    if (!title.trim()) { setError('Please enter a title.'); return }
    setSaving(true)
    try {
      const note = { title: title.trim(), content, updatedAt: new Date().toISOString() }
      if (!existing) note.createdAt = note.updatedAt
      const enc = await encrypt(encryptionKey, note)
      const nid = existing?.id || uid()
      await set(ref(db, `users/${currentUser.uid}/notes/${nid}`), enc)
      onSave(nid, enc)
      onClose()
    } catch {
      setError('Error saving. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">
            {isView ? (existing?.title || 'Note') : (existing ? 'Edit Note' : 'New Note')}
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="field">
            <label>Title</label>
            <input
              type="text"
              placeholder="Note title…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isView}
            />
          </div>
          <div className="field">
            <label>Content</label>
            <textarea
              rows="12"
              placeholder="Write your secure note here…"
              value={content}
              onChange={e => setContent(e.target.value)}
              disabled={isView}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          {error && <div className="error-msg show">{error}</div>}
          <div className="modal-footer">
            {isView ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => onEdit(existing)}>✏️ Edit</button>
                <button type="button" className="btn btn-danger" onClick={() => onDelete(existing.id)}>🗑 Delete</button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
                  {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Note'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Notes({ encryptionKey, currentUser, notes, setNotes, search }) {
  const [decrypted, setDecrypted] = useState([])
  const [modal, setModal]         = useState(null)
  const { toasts, toast }         = useToast()

  const decryptAll = useCallback(async () => {
    const out = []
    const q   = search.toLowerCase()
    for (const [id, enc] of Object.entries(notes)) {
      try {
        const e = await decrypt(encryptionKey, enc)
        if (q && !e.title?.toLowerCase().includes(q) && !e.content?.toLowerCase().includes(q)) continue
        out.push({ id, ...e })
      } catch { /* skip */ }
    }
    out.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    setDecrypted(out)
  }, [notes, encryptionKey, search])

  useEffect(() => { decryptAll() }, [decryptAll])

  useEffect(() => {
    function onAdd() { setModal({ type: 'form', entry: null, readOnly: false }) }
    document.addEventListener('vault:add-note', onAdd)
    return () => document.removeEventListener('vault:add-note', onAdd)
  }, [])

  function handleSave(nid, enc) {
    setNotes(prev => ({ ...prev, [nid]: enc }))
    toast(modal?.entry ? 'Note updated!' : 'Note saved!', 'success')
  }

  async function handleDelete(id) {
    if (!confirm('Delete this note? This cannot be undone.')) return
    await remove(ref(db, `users/${currentUser.uid}/notes/${id}`))
    setNotes(prev => { const n = { ...prev }; delete n[id]; return n })
    setModal(null)
    toast('Note deleted', 'info')
  }

  return (
    <>
      <Toast toasts={toasts} />
      {decrypted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-text">{search ? 'No results found' : 'No notes yet'}</div>
          {!search && <div className="empty-state-sub">Click &quot;Add New&quot; to create a secure note</div>}
        </div>
      ) : (
        <div className="items-grid">
          {decrypted.map(e => (
            <div key={e.id} className="note-card" onClick={() => setModal({ type: 'view', entry: e })}>
              <div className="note-card-title">{e.title || 'Untitled'}</div>
              <div className="note-card-preview">{e.content || ''}</div>
              <div className="note-card-footer">
                <span>{e.updatedAt ? new Date(e.updatedAt).toLocaleDateString() : ''}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" style={{ fontSize: 13 }} onClick={ev => { ev.stopPropagation(); setModal({ type: 'form', entry: e }) }}>✏️</button>
                  <button className="btn-icon" style={{ fontSize: 13 }} onClick={ev => { ev.stopPropagation(); handleDelete(e.id) }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'view' && (
        <NoteModal
          existing={modal.entry}
          readOnly
          encryptionKey={encryptionKey}
          currentUser={currentUser}
          onSave={handleSave}
          onEdit={e => setModal({ type: 'form', entry: e })}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'form' && (
        <NoteModal
          existing={modal.entry}
          readOnly={false}
          encryptionKey={encryptionKey}
          currentUser={currentUser}
          onSave={handleSave}
          onEdit={() => {}}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
