import { useState } from 'react'
import Passwords from './Passwords.jsx'
import Notes from './Notes.jsx'
import Files from './Files.jsx'
import Generator from './Generator.jsx'

export default function Vault({
  currentUser, encryptionKey,
  passwords, notes, files,
  setPasswords, setNotes, setFiles,
  theme, onToggleTheme, onLock, onSignOut,
}) {
  const [section, setSection]       = useState('passwords')
  const [search, setSearch]         = useState('')
  const [showGenerator, setShowGenerator] = useState(false)

  const isDark = theme === 'dark'

  function handleAddNew() {
    setSearch('')
    if (section === 'passwords') document.dispatchEvent(new CustomEvent('vault:add-password'))
    else if (section === 'notes') document.dispatchEvent(new CustomEvent('vault:add-note'))
  }

  return (
    <div id="app" className="visible">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🔐</div>
            <div className="sidebar-logo-text">VAULT</div>
          </div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-label">Storage</div>
          <div
            className={`nav-item ${section === 'passwords' ? 'active' : ''}`}
            onClick={() => { setSection('passwords'); setSearch('') }}
          >
            <span className="nav-icon">🔑</span>
            <span>Passwords</span>
            <span className="nav-count">{Object.keys(passwords).length}</span>
          </div>
          <div
            className={`nav-item ${section === 'notes' ? 'active' : ''}`}
            onClick={() => { setSection('notes'); setSearch('') }}
          >
            <span className="nav-icon">📝</span>
            <span>Secure Notes</span>
            <span className="nav-count">{Object.keys(notes).length}</span>
          </div>
          <div
            className={`nav-item ${section === 'files' ? 'active' : ''}`}
            onClick={() => { setSection('files'); setSearch('') }}
          >
            <span className="nav-icon">📁</span>
            <span>Files</span>
            <span className="nav-count">{Object.keys(files).length}</span>
          </div>
          <div className="nav-label">Tools</div>
          <div className="nav-item" onClick={() => setShowGenerator(true)}>
            <span className="nav-icon">⚡</span>
            <span>Password Generator</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={onToggleTheme}>
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button className="sidebar-btn" onClick={onLock}>
            <span>🔒</span><span>Lock Vault</span>
          </button>
          <button className="sidebar-btn danger" onClick={onSignOut}>
            <span>🚪</span><span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">
            {section === 'passwords' ? 'Passwords' : section === 'notes' ? 'Secure Notes' : 'Files'}
          </div>
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="Search…"
              autoComplete="off"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {section !== 'files' && (
            <button className="btn btn-secondary" onClick={handleAddNew}>+ Add New</button>
          )}
        </div>
        <div className="content-area">
          {section === 'passwords' && (
            <Passwords
              encryptionKey={encryptionKey}
              currentUser={currentUser}
              passwords={passwords}
              setPasswords={setPasswords}
              search={search}
            />
          )}
          {section === 'notes' && (
            <Notes
              encryptionKey={encryptionKey}
              currentUser={currentUser}
              notes={notes}
              setNotes={setNotes}
              search={search}
            />
          )}
          {section === 'files' && (
            <Files
              encryptionKey={encryptionKey}
              currentUser={currentUser}
              files={files}
              setFiles={setFiles}
              search={search}
            />
          )}
        </div>
      </div>

      {showGenerator && <Generator onClose={() => setShowGenerator(false)} />}
    </div>
  )
}
