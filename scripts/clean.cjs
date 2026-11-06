const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const targets = ['out', 'release', 'dist', 'coverage', '.vite']

for (const target of targets) {
  const full = path.join(root, target)
  if (!fs.existsSync(full)) continue
  fs.rmSync(full, { recursive: true, force: true })
  console.log(`removed ${target}/`)
}
