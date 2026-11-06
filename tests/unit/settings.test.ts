import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MAX_EDITOR_FONT_SIZE, MIN_EDITOR_FONT_SIZE, normalizeEditorFontSize } from '../../src/shared/types'
import { GITHUB_REPO, GITHUB_URL, releaseAssetUrl } from '../../src/shared/branding'

describe('editor font size', () => {
  it('defaults to a readable size', () => {
    expect(DEFAULT_SETTINGS.editorFontSize).toBe(13)
  })

  it('clamps and rounds input', () => {
    expect(normalizeEditorFontSize(12.4)).toBe(12)
    expect(normalizeEditorFontSize(12.6)).toBe(13)
    expect(normalizeEditorFontSize(1)).toBe(MIN_EDITOR_FONT_SIZE)
    expect(normalizeEditorFontSize(99)).toBe(MAX_EDITOR_FONT_SIZE)
    expect(normalizeEditorFontSize(undefined)).toBe(DEFAULT_SETTINGS.editorFontSize)
    expect(normalizeEditorFontSize('15')).toBe(DEFAULT_SETTINGS.editorFontSize)
  })
})

describe('branding + release links', () => {
  it('points at the Test-Api repository', () => {
    expect(GITHUB_REPO).toBe('Test-Api')
    expect(GITHUB_URL).toBe('https://github.com/Code-with-saurabh/Test-Api')
  })

  it('builds predictable direct download URLs', () => {
    expect(releaseAssetUrl('1.2.3', 'win', 'x64', 'exe')).toBe(
      'https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.2.3/TestApi-1.2.3-win-x64.exe'
    )
    expect(releaseAssetUrl('1.2.3', 'mac', 'arm64', 'dmg')).toBe(
      'https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.2.3/TestApi-1.2.3-mac-arm64.dmg'
    )
    expect(releaseAssetUrl('1.2.3', 'linux', 'x64', 'AppImage')).toBe(
      'https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.2.3/TestApi-1.2.3-linux-x86_64.AppImage'
    )
    expect(releaseAssetUrl('1.2.3', 'linux', 'x64', 'deb')).toBe(
      'https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.2.3/TestApi-1.2.3-linux-amd64.deb'
    )
    expect(releaseAssetUrl('1.2.3', 'linux', 'x64', 'tar.gz')).toBe(
      'https://github.com/Code-with-saurabh/Test-Api/releases/download/v1.2.3/TestApi-1.2.3-linux-x64.tar.gz'
    )
  })
})
