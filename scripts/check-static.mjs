import { readFile } from 'node:fs/promises'

const checks = [
  ['index.html', /<title>VAULT — Private Password Manager<\/title>/, 'private title'],
  ['index.html', /<meta name="description" content="Private password vault for authenticated users\./, 'private description'],
  ['index.html', /<meta name="robots" content="noindex, nofollow"\s*\/>/, 'noindex/nofollow'],
  ['index.html', /<meta name="theme-color" content="#111315"\s*\/>/, 'theme color'],
  ['public/404.html', /<title>VAULT — Page Not Found<\/title>/, '404 title'],
  ['public/404.html', /<meta name="robots" content="noindex, nofollow">/, '404 noindex/nofollow'],
  ['public/404.html', /<h1 id="not-found-title">Page not found<\/h1>/, '404 heading'],
  ['public/404.html', /<a href="\/">Return to VAULT<\/a>/, '404 home link'],
]

let failed = false
for (const [file, pattern, label] of checks) {
  const source = await readFile(file, 'utf8')
  if (!pattern.test(source)) {
    console.error(`FAIL ${file}: missing ${label}`)
    failed = true
  } else {
    console.log(`PASS ${file}: ${label}`)
  }
}

if (failed) process.exitCode = 1
else console.log(`Static checks passed (${checks.length} checks).`)
