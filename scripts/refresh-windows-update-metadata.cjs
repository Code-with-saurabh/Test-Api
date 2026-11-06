#!/usr/bin/env node
'use strict'

// Rebuild latest.yml and the NSIS blockmap after SignPath signs the installer.
// electron-builder generates both before post-build signing, so the hashes and
// blockmap become stale unless they are regenerated.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const { appBuilderPath } = require('app-builder-bin')

const root = path.resolve(__dirname, '..')
const releaseDir = path.join(root, 'release')
const pkg = require(path.join(root, 'package.json'))

function fail(message) {
  console.error(`[metadata] ${message}`)
  process.exit(1)
}

const input = process.argv[2]
if (!input) {
  fail('Usage: node scripts/refresh-windows-update-metadata.cjs <signed-exe>')
}

const exePath = path.resolve(root, input)
if (!fs.existsSync(exePath)) {
  fail(`Signed installer not found: ${exePath}`)
}
if (!exePath.startsWith(releaseDir + path.sep)) {
  fail(`Signed installer must be inside ${releaseDir}`)
}

const fileName = path.basename(exePath)
const contents = fs.readFileSync(exePath)
const sha512 = crypto.createHash('sha512').update(contents).digest('base64')
const size = contents.length

const blockmapPath = `${exePath}.blockmap`
const blockmap = spawnSync(
  appBuilderPath,
  ['blockmap', '--input', exePath, '--output', blockmapPath],
  { encoding: 'utf8' }
)
if (blockmap.status !== 0) {
  fail(`blockmap generation failed: ${blockmap.stderr || blockmap.stdout}`)
}

const latest = [
  `version: ${pkg.version}`,
  'files:',
  `  - url: ${fileName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${fileName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  ''
].join('\n')

fs.writeFileSync(path.join(releaseDir, 'latest.yml'), latest)
console.log(`[metadata] ${fileName}`)
console.log(`[metadata] size=${size}`)
console.log(`[metadata] sha512=${sha512}`)
console.log('[metadata] latest.yml and blockmap refreshed')
