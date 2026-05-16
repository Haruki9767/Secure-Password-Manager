import { useState, useEffect, useCallback, useRef } from 'react'
import { ref, set, remove } from 'firebase/database'
import { db } from '../firebase.js'
import { encrypt, decrypt, encryptBinary, decryptBinary, uid } from '../crypto.js'

const FILE_LIMIT = 2 * 1024 * 1024

function fileIcon(t = '') {
  if (t.startsWith('image/')) return '🖼️'
  if (t.startsWith('video/')) return '🎬'
  if (t.startsWith('audio/')) return '🎵'
  if (t.includes('pdf'))      return '📄'
  if (t.includes('zip') || t.includes('rar') || t.includes('7z')) return '📦'
  if (t.includes('text'))     return '📃'
  return '📁'
}

function fmtSize(b) {
  if (b < 1024)    return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

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

export default function Files({ encryptionKey, currentUser, files, setFiles, search }) {
  const [fileList, setFileList] = useState([])
  const [dragover, setDragover] = useState(false)
  const { toasts, toast }       = useToast()
  const fileInputRef            = useRef(null)

  const decryptMetas = useCallback(async () => {
    const out = []
    const q   = search.toLowerCase()
    for (const [id, enc] of Object.entries(files)) {
      try {
        const meta = await decrypt(encryptionKey, enc.meta)
        if (q && !meta.name?.toLowerCase().includes(q)) continue
        out.push({ id, meta })
      } catch { /* skip */ }
    }
    out.sort((a, b) => new Date(b.meta.uploadedAt) - new Date(a.meta.uploadedAt))
    setFileList(out)
  }, [files, encryptionKey, search])

  useEffect(() => { decryptMetas() }, [decryptMetas])

  async function handleUpload(fileObjs) {
    for (const file of fileObjs) {
      if (file.size > FILE_LIMIT) { toast(`"${file.name}" exceeds 2 MB limit`, 'error', 4000); continue }
      await uploadFile(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadFile(file) {
    toast(`Encrypting "${file.name}"…`, 'info')
    try {
      const buf   = await file.arrayBuffer()
      const meta  = { name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString() }
      const encM  = await encrypt(encryptionKey, meta)
      // Encrypt the raw ArrayBuffer directly — no intermediate base64 step,
      // which previously inflated stored size by ~33%.
      const encD  = await encryptBinary(encryptionKey, buf)
      const fid   = uid()
      await set(ref(db, `users/${currentUser.uid}/files/${fid}`), { meta: encM, data: encD })
      setFiles(prev => ({ ...prev, [fid]: { meta: encM, data: encD } }))
      toast(`"${file.name}" stored securely!`, 'success')
    } catch {
      toast(`Failed to upload "${file.name}"`, 'error')
    }
  }

  async function downloadFile(id, meta) {
    try {
      toast('Decrypting file…', 'info')
      // decryptBinary returns an ArrayBuffer directly — no fromB64 step needed.
      const buf  = await decryptBinary(encryptionKey, files[id].data)
      const blob = new Blob([buf], { type: meta.type || 'application/octet-stream' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = meta.name
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast('File downloaded!', 'success')
    } catch {
      toast('Failed to decrypt file', 'error')
    }
  }

  async function deleteFile(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await remove(ref(db, `users/${currentUser.uid}/files/${id}`))
    setFiles(prev => { const n = { ...prev }; delete n[id]; return n })
    toast('File deleted', 'info')
  }

  function onDrop(e) {
    e.preventDefault()
    setDragover(false)
    handleUpload(Array.from(e.dataTransfer.files))
  }

  return (
    <>
      <Toast toasts={toasts} />
      <div
        className={`drop-zone${dragover ? ' dragover' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
      >
        <div className="drop-zone-icon">☁️</div>
        <div className="drop-zone-text">Drop files here or click to upload</div>
        <div className="drop-zone-sub">AES-256 encrypted before upload · Max 2 MB per file</div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        multiple
        onChange={e => handleUpload(Array.from(e.target.files))}
      />

      {fileList.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-text">{search ? 'No results found' : 'No files stored'}</div>
          {!search && <div className="empty-state-sub">Upload files above to store them securely</div>}
        </div>
      ) : (
        <div className="file-list">
          {fileList.map(({ id, meta }) => (
            <div key={id} className="file-card">
              <div className="file-icon">{fileIcon(meta.type)}</div>
              <div className="file-meta">
                <div className="file-name">{meta.name}</div>
                <div className="file-size">{fmtSize(meta.size)} · {new Date(meta.uploadedAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn-icon" title="Download decrypted file" onClick={() => downloadFile(id, meta)}>⬇️</button>
                <button className="btn-icon" title="Delete" onClick={() => deleteFile(id, meta.name)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
