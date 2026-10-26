// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { todayISO } from '../lib/format.js'
import Steps from './Steps.jsx'

const h = vi.hoisted(() => ({ android: true, steps: {}, reader: { on: false, busy: false, error: null } }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: { dailySteps: h.steps } }) }))
vi.mock('../lib/mobile.js', () => ({ isAndroid: async () => h.android }))
vi.mock('../lib/health-sync.js', () => ({ openHealthConnect: vi.fn() }))
vi.mock('../lib/steps-sync.js', () => ({
  onStepsChange: () => () => {}, stepsSnapshot: () => h.reader,
  enableSteps: vi.fn(), disableSteps: vi.fn(), refreshSteps: vi.fn(),
}))
import { enableSteps, refreshSteps } from '../lib/steps-sync.js'

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  Object.assign(h, { android: true, steps: {}, reader: { on: false, busy: false, error: null } })
  vi.clearAllMocks()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = () => act(async () => root.render(<Steps />))
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)

it('offers explicit read-only permission before any import', async () => {
  await mount()
  expect(host.textContent).toContain('Read-only access')
  expect(host.textContent).toContain('No steps imported yet.')
  await act(async () => button('Allow reading steps').click())
  expect(enableSteps).toHaveBeenCalledOnce()
})

it('renders a real zero, unknown days and the actual last phone read', async () => {
  h.steps = {
    [todayISO()]: { count: 0, readAt: 100 },
    '2025-01-01': { count: null, readAt: 100 },
  }
  h.reader = { on: true, busy: false, error: null }
  await mount()
  expect(host.querySelector('.big').textContent).toBe('0')
  expect(host.querySelector('[aria-label="No data"]')).toBeTruthy()
  expect(host.textContent).toContain('Last phone read:')
  await act(async () => button('Refresh steps').click())
  expect(refreshSteps).toHaveBeenCalledWith({ force: true })
})

it('shows the last total with a permission recovery action after revocation', async () => {
  h.steps = { [todayISO()]: { count: 1234, readAt: 100 } }
  h.reader = { on: true, busy: false, error: 'permission' }
  await mount()
  expect(host.querySelector('.big').textContent).toBe((1234).toLocaleString())
  expect(host.querySelector('[role="alert"]').textContent).toContain('permission')
  expect(button('Allow reading steps')).toBeTruthy()
})

it('shows synced totals on web without native permission or refresh controls', async () => {
  h.android = false
  h.steps = { [todayISO()]: { count: 250, readAt: 100 } }
  await mount()
  expect(host.querySelector('.big').textContent).toBe('250')
  expect(button('Allow reading steps')).toBeUndefined()
  expect(button('Refresh steps')).toBeUndefined()
  expect(host.textContent).toContain('openGym Android app')
})
