import { useState, useEffect } from 'react'
import { genPassword, pwStrength } from '../crypto.js'

function StrengthBar({ password }) {
  const { score, label } = pwStrength(password)
  const cls = ['', 'weak', 'fair', 'good', 'strong'][score]
  return (
    <div className="pw-strength" style={{ marginBottom: 16 }}>
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`pw-strength-bar${i <= score ? ` filled ${cls}` : ''}`} />
        ))}
      </div>
      <span className="pw-strength-label">{label}</span>
    </div>
  )
}

export default function Generator({ onClose }) {
  const [length, setLength] = useState(20)
  const [useUpper, setUpper] = useState(true)
  const [useLower, setLower] = useState(true)
  const [useNum, setNum]     = useState(true)
  const [useSym, setSym]     = useState(true)
  const [password, setPassword] = useState('')

  function generate() {
    setPassword(genPassword(length, useUpper, useLower, useNum, useSym))
  }

  useEffect(() => { generate() }, []) // eslint-disable-line

  function copy() {
    if (password) navigator.clipboard.writeText(password).catch(() => {})
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Password Generator</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="gen-output">
          <span className="gen-output-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{password}</span>
          <button className="btn-icon" onClick={copy}>📋</button>
        </div>

        <StrengthBar password={password} />

        <div className="gen-length">
          <label>
            <span>Length: {length}</span>
          </label>
          <input
            type="range" min="8" max="64" value={length}
            onChange={e => setLength(Number(e.target.value))}
          />
        </div>

        <div className="gen-options">
          {[
            { label: 'Uppercase (A–Z)', val: useUpper, set: setUpper },
            { label: 'Lowercase (a–z)', val: useLower, set: setLower },
            { label: 'Numbers (0–9)',   val: useNum,   set: setNum   },
            { label: 'Symbols (!@#$)',  val: useSym,   set: setSym   },
          ].map(o => (
            <label key={o.label} className="gen-check">
              <input type="checkbox" checked={o.val} onChange={e => o.set(e.target.checked)} />
              {o.label}
            </label>
          ))}
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 4 }}
          onClick={generate}
        >
          🔄 Generate New
        </button>
      </div>
    </div>
  )
}
