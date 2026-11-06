/**
 * Central branding + release information.
 *
 * Change the repository owner/name here if you fork TestApi. The same values
 * live in package.json -> build.publish (used by electron-builder and
 * electron-updater). The GitHub Actions release workflow overrides the
 * publish target automatically with the repository that runs the workflow.
 */
export const APP_NAME = 'TestApi'
export const APP_TAGLINE = 'Free, offline-first desktop API client'
export const APP_ID = 'com.testapi.app'

export const GITHUB_OWNER = 'Code-with-saurabh'
export const GITHUB_REPO = 'Test-Api'
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const GITHUB_RELEASES_URL = `${GITHUB_URL}/releases`
export const GITHUB_LATEST_RELEASE_URL = `${GITHUB_URL}/releases/latest`
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`
export const DOWNLOADS_PAGE_URL = `https://${GITHUB_OWNER.toLowerCase()}.github.io/${GITHUB_REPO}/`
export const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}`

export const AUTHOR = {
  name: 'Saurabh Sharma',
  role: 'Full Stack MERN Developer',
  website: 'https://saurabhsharma.is-a.dev/',
  github: 'https://github.com/Code-with-saurabh',
  linkedin: 'https://www.linkedin.com/in/saurabh-sharma-64643128b/',
  email: 'saurabhsharma12166@gmail.com'
} as const

/**
 * Build a direct download URL for a release asset.
 * Example: downloadUrl('1.0.0', 'win', 'x64', 'exe')
 * -> https://github.com/owner/repo/releases/download/v1.0.0/TestApi-1.0.0-win-x64.exe
 */
export function releaseAssetUrl(
  version: string,
  os: 'win' | 'mac' | 'linux',
  arch: 'x64' | 'arm64',
  ext: string
): string {
  // electron-builder uses target-specific arch labels on Linux:
  // AppImage -> x86_64, deb -> amd64, tar.gz -> x64.
  const fileArch =
    os === 'linux' ? (ext === 'AppImage' ? 'x86_64' : ext === 'deb' ? 'amd64' : 'x64') : arch
  return `${GITHUB_URL}/releases/download/v${version}/TestApi-${version}-${os}-${fileArch}.${ext}`
}
