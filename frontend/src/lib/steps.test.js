import { describe, expect, it } from 'vitest'
import { importStepDays, stepDays } from './steps.js'
import { localExtras, mergeStates, resetIdsOf } from './sync-merge.js'

const read = (days, readAt = 100) => ({ days, readAt, zone: 'Europe/Bucharest' })
const day = (date, count) => ({ date, count })

describe('daily steps', () => {
  it('replaces totals on repeat reads, including corrections downwards and removed data', () => {
    let totals = importStepDays({}, read([day('2026-10-25', 1200), day('2026-10-26', 300)]))
    totals = importStepDays(totals, read([day('2026-10-26', 200)], 200))
    expect(totals['2026-10-26'].count).toBe(200)
    expect(totals['2026-10-25'].count).toBe(1200)
    totals = importStepDays(totals, read([day('2026-10-26', null)], 300))
    expect(totals['2026-10-26'].count).toBeNull()
  })

  it('preserves a real zero separately from missing data and keeps local date/zone', () => {
    const totals = importStepDays({}, read([day('2026-10-25', 0), day('2026-10-26', null)]))
    expect(stepDays(totals).map(d => [d.date, d.count, d.zone])).toEqual([
      ['2026-10-26', null, 'Europe/Bucharest'], ['2026-10-25', 0, 'Europe/Bucharest'],
    ])
  })

  it.each([-1, 1.5, '12', undefined, NaN])('rejects invalid count %s without changing prior data', count => {
    const previous = importStepDays({}, read([day('2026-10-26', 100)]))
    expect(() => importStepDays(previous, read([day('2026-10-26', count)]))).toThrow()
    expect(previous['2026-10-26'].count).toBe(100)
  })

  it('keeps newer per-day totals when a desktop changes an unrelated setting later', () => {
    const phone = { _ts: 200, dailySteps: importStepDays({}, read([day('2026-10-26', 400)], 200)) }
    const desktop = { _ts: 300, theme: 'light', dailySteps: importStepDays({}, read([day('2026-10-26', 100), day('2026-10-24', 900)])) }
    const merged = mergeStates(phone, desktop)
    expect(merged.dailySteps['2026-10-26'].count).toBe(400)
    expect(merged.dailySteps['2026-10-24'].count).toBe(900)
    expect(merged.theme).toBe('light')
  })

  it('does not resurrect daily steps from an offline copy after reset', () => {
    const before = { _ts: 100, workouts: [], routines: [], bodyweight: [], customEx: [], dailySteps: importStepDays({}, read([day('2026-10-26', 400)])) }
    const reset = { _ts: 200, resetAt: 200, resetIds: resetIdsOf(before), dailySteps: {} }
    expect(mergeStates(reset, before).dailySteps).toEqual({})
  })

  it('includes local step history in the adoption prompt before pairing with a server', () => {
    const local = { dailySteps: importStepDays({}, read([day('2026-10-26', 400)])) }
    expect(localExtras(local, {}).setup).toBe(1)
  })
})
