// @vitest-environment happy-dom
// Exercise the actual start flow and persisted store; no mocked session builder.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Workout from './Workout.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))

const routines = [{ id: 'push', name: 'Push', ex: [{ id: '0025', sets: 3, reps: 8, weight: 20 }] }]
const week = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, ['push']]))
let host, root, originalS

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  originalS = useStore.getState().S
  useUI.setState({ sheets: [], toasts: [] })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS })
})

function mount(overrides) {
  useStore.setState({ S: { ...structuredClone(DEF), weighIn: false, ...overrides } })
  act(() => root.render(<Workout />))
}

describe('workout chooser', () => {
  for (const [name, setup] of [
    ['planned day', { routines, week }],
    ['rest day', { routines, week: {} }],
    ['no routines', { routines: [], week: {} }],
  ]) {
    it(`starts empty on a ${name}, before asking for any routine`, () => {
      mount(setup)
      const before = structuredClone(useStore.getState().S)
      const buttons = [...host.querySelectorAll('button')]
      expect(buttons[0].textContent.trim()).toBe('Start an empty workout')
      act(() => buttons[0].click())
      const after = useStore.getState().S
      expect(after.active).toMatchObject({ entries: [], routineIds: [] })
      expect(after.active.id).toBeTruthy()
      expect(after.routines).toEqual(before.routines)
      expect(after.week).toEqual(before.week)
      expect(after.workouts).toEqual(before.workouts)
      expect(host.textContent).toContain('Add exercise')
      expect(JSON.parse(localStorage.getItem('gym_state_v1')).active.id).toBe(after.active.id)
    })
  }

  it('still starts the explicitly selected planned routine', () => {
    mount({ routines, week })
    expect(useStore.getState().S.active).toBeNull()
    const button = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Start Push')
    act(() => button.click())
    expect(useStore.getState().S.active.routineIds).toEqual(['push'])
    expect(useStore.getState().S.active.entries.map(e => e.id)).toEqual(['0025'])
  })

  it('shows planned and other templates immediately without starting a session', () => {
    const pull = { id: 'pull', name: 'Pull', ex: [{ id: '0025' }] }
    mount({ routines: [...routines, pull], week })
    const heading = [...host.querySelectorAll('h2')].find(h => h.textContent === 'Start from a template')
    expect(heading).toBeTruthy()
    expect(host.querySelector('[aria-expanded]')).toBeNull()
    expect(host.textContent).toContain('Start Push')
    const other = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Pull'))
    expect(other).toBeTruthy()
    expect(other.closest('[hidden]')).toBeNull()
    expect(useStore.getState().S.active).toBeNull()
  })

  it('explains an empty template list and keeps empty start available', () => {
    mount({ routines: [], week: {} })
    expect(host.textContent).toContain('No routines yet.')
    expect(host.textContent).toContain('Plan')
    expect(host.textContent).toContain('Start an empty workout')
    expect(useStore.getState().S.active).toBeNull()
  })
})
