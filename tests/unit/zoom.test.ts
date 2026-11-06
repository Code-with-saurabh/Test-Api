import { describe, expect, it } from 'vitest'
import {
  APP_ZOOM_STEP,
  DEFAULT_APP_ZOOM,
  MAX_APP_ZOOM,
  MIN_APP_ZOOM,
  clampAppZoom,
  formatZoomPercent,
  isValidAppZoom,
  normalizeAppZoom,
  stepAppZoom,
  zoomPercentToFactor
} from '../../src/shared/zoom'

describe('app zoom model', () => {
  it('exposes sane limits and a 10% step', () => {
    expect(MIN_APP_ZOOM).toBe(50)
    expect(MAX_APP_ZOOM).toBe(300)
    expect(DEFAULT_APP_ZOOM).toBe(100)
    expect(APP_ZOOM_STEP).toBe(10)
  })

  it('accepts supported zoom values', () => {
    expect(isValidAppZoom(50)).toBe(true)
    expect(isValidAppZoom(100)).toBe(true)
    expect(isValidAppZoom(300)).toBe(true)
  })

  it('rejects values outside the range, off-step values and non-numbers', () => {
    expect(isValidAppZoom(40)).toBe(false)
    expect(isValidAppZoom(305)).toBe(false)
    expect(isValidAppZoom(105)).toBe(false)
    expect(isValidAppZoom(Number.NaN)).toBe(false)
    expect(isValidAppZoom('100')).toBe(false)
  })

  it('steps zoom without crossing the limits', () => {
    expect(stepAppZoom(100, 1)).toBe(110)
    expect(stepAppZoom(100, -1)).toBe(90)
    expect(stepAppZoom(MAX_APP_ZOOM, 1)).toBe(MAX_APP_ZOOM)
    expect(stepAppZoom(MIN_APP_ZOOM, -1)).toBe(MIN_APP_ZOOM)
  })

  it('normalizes persisted garbage to a supported value', () => {
    expect(normalizeAppZoom(undefined)).toBe(100)
    expect(normalizeAppZoom(Number.NaN)).toBe(100)
    expect(normalizeAppZoom(104)).toBe(100)
    expect(normalizeAppZoom(106)).toBe(110)
    expect(normalizeAppZoom(9999)).toBe(300)
    expect(normalizeAppZoom(-20)).toBe(50)
  })

  it('clamps and rounds to the nearest step', () => {
    expect(clampAppZoom(113)).toBe(110)
    expect(clampAppZoom(119)).toBe(120)
    expect(clampAppZoom(0)).toBe(50)
    expect(clampAppZoom(400)).toBe(300)
  })

  it('converts percentages to Electron zoom factors and formats labels', () => {
    expect(zoomPercentToFactor(50)).toBe(0.5)
    expect(zoomPercentToFactor(100)).toBe(1)
    expect(zoomPercentToFactor(300)).toBe(3)
    expect(formatZoomPercent(130)).toBe('130%')
  })
})
