import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ file: null, calls: [], grant: true, fail: null, wait: null, active: null, storageFail: false }))
vi.mock('./mobile.js', () => ({
  MOBILE: true,
  isAndroid: async () => true,
  readJsonFile: async () => h.file,
  writeJsonFile: async (name, value) => {
    if (h.storageFail) { throw new Error('Disk full') }
    h.file = value
  },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: (event, fn) => { h.active = fn } } }))
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({
  requestStepsPermission: async () => { h.calls.push('read permission'); return { granted: h.grant } },
  readSteps: async () => {
    h.calls.push('read')
    if (h.wait) { await h.wait }
    if (h.fail) { throw Object.assign(new Error('Failed'), { code: h.fail }) }
    return { days: [{ date: '2026-10-26', count: 321 }], zone: 'Europe/Bucharest', readAt: 100 }
  },
  requestPermissions: () => { throw new Error('Must not request write access') },
  write: () => { throw new Error('Must not write health records') },
}) }))

let reader, context, apply
beforeEach(async () => {
  vi.resetModules()
  Object.assign(h, { file: null, calls: [], grant: true, fail: null, wait: null, active: null, storageFail: false })
  context = { owner: 'server/account-a', resetAt: 0 }
  apply = vi.fn()
  reader = await import('./steps-sync.js')
  reader.initStepsSync(() => context, apply)
})

describe('read-only step sync', () => {
  it('does nothing until explicitly enabled, then asks only for reading and imports totals', async () => {
    await reader.refreshSteps()
    expect(h.calls).toEqual([])
    await reader.enableSteps()
    expect(h.calls).toEqual(['read permission', 'read'])
    expect(apply).toHaveBeenCalledOnce()
    expect(h.file.on).toBe(true)
    await reader.refreshSteps()
    expect(apply).toHaveBeenCalledOnce() // duplicate foreground events are throttled
  })

  it('stays off after denied permission', async () => {
    h.grant = false
    await reader.enableSteps()
    expect(apply).not.toHaveBeenCalled()
    expect(h.file).toBeNull()
    expect(reader.stepsSnapshot()).toMatchObject({ on: false, error: 'permission', busy: false })
  })

  it('retains prior totals and last read on permission revocation, then recovers', async () => {
    await reader.enableSteps()
    h.fail = 'permission'
    await reader.refreshSteps({ force: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(reader.stepsSnapshot().error).toBe('permission')
    h.fail = null
    await reader.enableSteps()
    expect(apply).toHaveBeenCalledTimes(2)
    expect(reader.stepsSnapshot().error).toBeNull()
  })

  it('does not read for another profile just because this phone granted permission', async () => {
    await reader.enableSteps()
    context = { owner: 'server/account-b', resetAt: 0 }
    await reader.refreshSteps({ force: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(reader.stepsSnapshot().on).toBe(false)
  })

  it('requires a new opt-in after resetting the profile', async () => {
    await reader.enableSteps()
    context = { ...context, resetAt: 200 }
    await reader.refreshSteps({ force: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(reader.stepsSnapshot().on).toBe(false)
  })

  it.each(['account', 'reset', 'signout', 'disable'])('discards an in-flight read after %s', async reason => {
    await reader.enableSteps()
    apply.mockClear()
    let resolve
    h.wait = new Promise(done => { resolve = done })
    const pending = reader.refreshSteps({ force: true })
    await vi.waitFor(() => expect(h.calls.filter(c => c === 'read')).toHaveLength(2))
    let stop
    if (reason === 'account') { context = { owner: 'server/account-b', resetAt: 0 } }
    if (reason === 'reset') { context = { ...context, resetAt: 200 } }
    if (reason === 'signout') { context = null }
    if (reason === 'disable') { stop = reader.disableSteps() }
    resolve()
    await pending
    await stop
    expect(apply).not.toHaveBeenCalled()
  })

  it('stops future reads without deleting already imported totals', async () => {
    await reader.enableSteps()
    await reader.disableSteps()
    await reader.refreshSteps({ force: true })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(h.file.on).toBe(false)
  })

  it('reports a failed persisted stop and stops reading in this session while it is retried', async () => {
    await reader.enableSteps()
    h.storageFail = true
    await reader.disableSteps()
    expect(reader.stepsSnapshot()).toMatchObject({ on: false, error: 'storage' })
    await reader.refreshSteps({ force: true })
    expect(apply).toHaveBeenCalledTimes(1)
    h.storageFail = false
    await reader.disableSteps()
    expect(h.file.on).toBe(false)
  })
})
