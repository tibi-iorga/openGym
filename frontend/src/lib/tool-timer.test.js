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

  it('uses actual elapsed time at a boundary even if a screen tick was delayed', () => {
    const phases = timerPhases({ rounds: 2, workSec: 30, restSec: 10, prepareSec: 5 })
    expect(timerPosition(phases, 5_000)).toMatchObject({ kind: 'work', round: 1, remainingMs: 30_000 })
    expect(timerPosition(phases, 47_000)).toMatchObject({ kind: 'work', round: 2, remainingMs: 28_000 })
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
    const phases = timerPhases({ rounds: 2, workSec: 5, restSec: 3, prepareSec: 1 })
    expect(timerCues(phases, 2)).toEqual([
      { second: 0, kind: 'prepare' },
      { second: 1, kind: 'work' },
      { second: 3, kind: 'interval' },
      { second: 5, kind: 'interval' },
      { second: 6, kind: 'rest' },
      { second: 9, kind: 'work' },
      { second: 11, kind: 'interval' },
      { second: 13, kind: 'interval' },
      { second: 14, kind: 'done' },
    ])
    expect(timerCues(phases, 2, false)).toEqual([])
  })

  it('encodes cues into the audio timeline so hidden-page callbacks are unnecessary', async () => {
    const phases = timerPhases({ rounds: 1, workSec: 4, prepareSec: 1 })
    const blob = timerAudioBlob(phases, 2, true)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(11025)
    expect(view.getUint32(40, true)).toBe(bytes.length - 44)
    const audibleNear = second => bytes.slice(44 + second * 11025, 44 + (second + 0.15) * 11025).some(value => value !== 128)
    expect(audibleNear(1)).toBe(true) // work starts
    expect(audibleNear(3)).toBe(true) // interval ding
    expect(audibleNear(4)).toBe(false) // no extra ding between interval and finish
    expect(audibleNear(5)).toBe(true) // finish
  })
})
