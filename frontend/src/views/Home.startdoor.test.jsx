// @vitest-environment happy-dom
// Home exposes an empty start alongside the named plan and the full chooser.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

// Every weekday points at a routine and the weigh-in is off: today is always planned, and the
// weigh-in sheet's own way through to the Start screen never opens.
const setS = (over = {}) => useStore.setState(s => ({
  S: {
    ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false,
    week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }, ...over,
  },
  user: null,
}))
const mount = () => act(() => root.render(<Home />))
const door = () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Choose a different workout'))

describe('Home — the way to the Start screen when a plan already owns today', () => {
  it('offers an explicit empty workout without selecting today’s routine', () => {
    setS(); mount()
    const empty = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start empty workout')
    expect(empty).toBeTruthy()
    act(() => empty.click())
    expect(startFlow).toHaveBeenCalledWith([])
  })

  it('does not offer a new empty workout while a session is active', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    mount()
    expect(host.textContent).not.toContain('Start empty workout')
  })
  it('offers the chooser on a planned day alongside the routine shortcut', () => {
    setS(); mount()
    expect(door()).toBeTruthy()
  })

  it('opens the Start screen without starting anything', () => {
    setS(); mount()
    act(() => { door().dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(nav).toHaveBeenCalledWith('/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('is still there on a rest day, where freestyle is the only thing left to start', () => {
    setS({ week: {} }); mount()
    expect(door()).toBeTruthy()
  })

  it('goes away once a session is running — that screen resumes it, it does not choose', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    mount()
    expect(door()).toBeFalsy()
  })

  it('reads an open editor on a saved workout as an edit, not as a session in progress', () => {
    setS({ active: { id: 'w', name: 'Push', start: 1000, cur: 0, entries: [], editingWorkoutId: 'w' } })
    mount()
    const row = host.querySelector('.today-row')
    expect(row.querySelector('.ttl').textContent).toBe('Push')
    expect(row.querySelector('.tag').textContent).toBe('Edit')
    act(() => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(nav).toHaveBeenCalledWith('/workout')
  })

  it('still reads a running session as in progress', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    mount()
    const row = host.querySelector('.today-row')
    expect(row.querySelector('.ttl').textContent).toBe('Push (in progress)')
    expect(row.querySelector('.tag').textContent).toBe('Resume')
  })
})
