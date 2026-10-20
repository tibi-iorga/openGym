import { describe, expect, it } from 'vitest'
import { timerCues, timerPhases, timerPosition } from './tool-timer.js'
import { timerAudioBlob } from './tool-timer-audio.js'

describe('tool timer phases', () => {
  it('alternates work and rest without resting after the final round', () => {
    expect(timerPhases({ rounds: 3, workSec: 180, restSec: 60 })).toEqual([
      { kind: 'work', round: 1, seconds: 180 },
      { kind: 'rest', round: 1, seconds: 60 },
      { kind: 'work', round: 2, seconds: 180 },
      { kind: 'rest', round: 2, seconds: 60 },
      { kind: 'work', round: 3, seconds: 180 },
    ])
  })

  it('starts with the first work round and ignores a legacy preparation setting', () => {
    expect(timerPhases({ rounds: 2, workSec: 60, restSec: 30, prepareSec: 5 })).toEqual([
      { kind: 'work', round: 1, seconds: 60 },
      { kind: 'rest', round: 1, seconds: 30 },
      { kind: 'work', round: 2, seconds: 60 },
    ])
  })

  it('uses actual elapsed time at a boundary even if a screen tick was delayed', () => {
    const phases = timerPhases({ rounds: 2, workSec: 30, restSec: 10 })
    expect(timerPosition(phases, 0)).toMatchObject({ kind: 'work', round: 1, remainingMs: 30_000 })
    expect(timerPosition(phases, 30_000)).toMatchObject({ kind: 'rest', round: 1, remainingMs: 10_000 })
    expect(timerPosition(phases, 42_000)).toMatchObject({ kind: 'work', round: 2, remainingMs: 28_000 })
    expect(timerPosition(phases, 90_000)).toMatchObject({ kind: 'done', remainingMs: 0 })
  })

  it('rejects invalid durations before a timer can start', () => {
    expect(() => timerPhases({ rounds: 0, workSec: 60 })).toThrow(RangeError)
    expect(() => timerPhases({ rounds: 1, workSec: 0 })).toThrow(RangeError)
    expect(() => timerPhases({ rounds: 1, workSec: 60, restSec: -1 })).toThrow(RangeError)
    expect(() => timerPhases({ rounds: 1000000000, workSec: 1 })).toThrow(RangeError)
    expect(() => timerPhases({ rounds: 2, workSec: 3600, restSec: 1 })).toThrow(RangeError)
  })

  it('places interval dings in work, with distinct phase and finish cues', () => {
    const phases = timerPhases({ rounds: 2, workSec: 5, restSec: 3 })
    expect(timerCues(phases, 2)).toEqual([
      { second: 0, kind: 'work' },
      { second: 2, kind: 'interval' },
      { second: 4, kind: 'interval' },
      { second: 5, kind: 'rest' },
      { second: 8, kind: 'work' },
      { second: 10, kind: 'interval' },
      { second: 12, kind: 'interval' },
      { second: 13, kind: 'done' },
    ])
    expect(timerCues(phases, 2, false)).toEqual([])
  })

  it('encodes cues into the audio timeline so hidden-page callbacks are unnecessary', async () => {
    const phases = timerPhases({ rounds: 1, workSec: 4 })
    const blob = timerAudioBlob(phases, 2, true)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(11025)
    expect(view.getUint32(40, true)).toBe(bytes.length - 44)
    const audibleNear = second => bytes.slice(44 + second * 11025, 44 + (second + 0.15) * 11025).some(value => value !== 128)
    expect(audibleNear(0)).toBe(true) // work starts immediately
    expect(audibleNear(2)).toBe(true) // interval ding
    expect(audibleNear(3)).toBe(false) // no extra ding between interval and finish
    expect(audibleNear(4)).toBe(true) // finish
  })

  it('gives the round bell a longer ring than the rest cue at their phase boundaries', async () => {
    const phases = timerPhases({ rounds: 2, workSec: 2, restSec: 2 })
    const bytes = new Uint8Array(await timerAudioBlob(phases, 0, true).arrayBuffer())
    const energy = (from, to) => {
      const start = 44 + Math.round(from * 11025)
      const end = 44 + Math.round(to * 11025)
      return bytes.slice(start, end).reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / (end - start)
    }
    expect(energy(0.6, 0.7)).toBeGreaterThan(1) // metallic round bell is still ringing
    expect(energy(2.6, 2.7)).toBeLessThan(1) // muted rest cue has ended
    expect(energy(6.4, 6.5)).toBeGreaterThan(1) // finish has a separate second strike
  })

  it('keeps recorded strikes inside one-second rounds without shifting or clipping the next cue', async () => {
    const phases = timerPhases({ rounds: 2, workSec: 1, restSec: 1 })
    const bytes = new Uint8Array(await timerAudioBlob(phases, 0, true).arrayBuffer()).slice(44)
    const energy = (from, to) => {
      const slice = bytes.slice(Math.round(from * 11025), Math.round(to * 11025))
      return slice.reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / slice.length
    }
    expect(energy(0.50, 0.60)).toBeGreaterThan(energy(0.40, 0.50) * 1.5) // recorded third strike
    expect(energy(0.95, 1.00)).toBeLessThan(1) // fade ends before Rest
    expect(energy(1.00, 1.05)).toBeGreaterThan(1) // Rest starts on time
    expect(energy(2.00, 2.05)).toBeGreaterThan(1) // next round starts on time
    expect(energy(3.00, 3.05)).toBeGreaterThan(1) // Finish starts on time
    expect(bytes.some(sample => sample === 0 || sample === 255)).toBe(false)
  })
})
