/**
 * In CI, point electron-builder / electron-updater at the repository that is
 * actually running the workflow (so forks work without editing package.json).
 * Usage: GITHUB_REPOSITORY=owner/repo node scripts/ci-set-publish.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const slug = process.env.GITHUB_REPOSITORY || ''
const [owner, repo] = slug.split('/')
const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (owner && repo) {
  pkg.build = pkg.build || {}
  pkg.build.publish = [
    {
      provider: 'github',
      owner,
      repo,
      releaseType: 'release'
    }
  ]
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`[release] publish target -> ${owner}/${repo}`)
} else {
  console.log('[release] GITHUB_REPOSITORY not set; keeping package.json publish target')
}
