# 🔐 SecureVault

A personal password manager with **client-side AES-256-GCM encryption** backed by Firebase. Your master password and encryption key never leave your device, only ciphertext is stored in the cloud.

---

## Features

- **Zero-knowledge encryption** — AES-256-GCM via the native Web Crypto API; no external crypto library
- **PBKDF2 key derivation** — 600,000 iterations with SHA-256, exceeding NIST SP 800-132
- **Fresh 96-bit IV per operation** — every encrypt call generates a new random IV
- **Passwords, Secure Notes & Files** — all encrypted before leaving the browser
- **Password Generator** — cryptographically secure (`crypto.getRandomValues`), never `Math.random`
- **Auto-lock** — vault locks automatically after 5 minutes of inactivity
- **Dark / Light theme**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Auth & Storage | Firebase v10 (Auth + Realtime Database) |
| Crypto | Web Crypto API (browser-native) |

---


## How encryption works

```
Master Password + Random Salt
        │
        ▼ PBKDF2 (SHA-256, 600 000 iterations)
  AES-256-GCM Key  (never leaves device)
        │
        ▼
  encrypt(plaintext)  →  [ 12-byte IV | ciphertext | 16-byte GCM tag ]
        │
        ▼  base64
  Stored in Firebase
```

- The salt is generated once on first vault setup and stored in Firebase (not secret, it is input to the KDF, not the key itself).
- A "verify token" (`VAULT_VERIFIED_v1`) is encrypted with the derived key and stored alongside the salt so the app can detect a wrong master password without decrypting all data.
- The encryption key is held only in React state and is cleared on lock or sign-out.

---

## Security considerations

- **Master password strength** — use a long, random passphrase. The app enforces a minimum of 8 characters, but longer is significantly stronger.
- **Firebase API key** — the `VITE_FIREBASE_*` values are embedded in the client bundle (this is expected for Firebase). Restrict your API key in the [Google Cloud Console](https://console.cloud.google.com/) to specific HTTP referrers / bundle IDs.
- **File size limit** — files are capped at 2 MB and encrypted before upload; raw bytes never touch Firebase in plaintext.
- **No server-side code** — this is a pure client-side app. There is no backend to compromise.

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
