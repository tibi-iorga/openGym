// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Tools from './Tools.jsx'
import ToolTimer from './ToolTimer.jsx'
import { stopToolTimer, toolTimerSnapshot } from '../lib/tool-timer-player.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, media
class FakeAudio {
  constructor() { this.currentTime = 0; this.paused = true; media = this }
  play() { this.paused = false; this.onplay?.(); return Promise.resolve() }
  pause() { this.paused = true; this.onpause?.() }
  removeAttribute() {}
  load() {}
}

beforeEach(() => {
  localStorage.removeItem('opengym_tool_timer_v1')
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:timer-test', revokeObjectURL: () => {} })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => { stopToolTimer(); root.unmount() })
  host.remove()
  vi.unstubAllGlobals()
})

const button = name => [...host.querySelectorAll('button')].find(element => element.textContent.trim() === name || element.querySelector('strong')?.textContent === name || element.getAttribute('aria-label') === name)
const setting = name => [...host.querySelectorAll('.tool-stepper')].find(element => element.querySelector('.tool-stepper-label')?.textContent === name)
const setInput = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

it('uses three steppers, ignores legacy prep and interval settings, and saves exact time', async () => {
  localStorage.setItem('opengym_tool_timer_v1', JSON.stringify({ rounds: 3, workSec: 90, restSec: 45, prepareSec: 10, intervalSec: 45, sound: true }))
  await act(async () => root.render(<MemoryRouter><ToolTimer /></MemoryRouter>))
  expect(setting('Rounds').textContent).toContain('3')
  expect(setting('Time').textContent).toContain('1:30')
  expect(setting('Rest').textContent).toContain('0:45')
  expect(host.textContent).toContain('6:00 total')
  expect(host.textContent).not.toContain('Get ready')
  expect(host.textContent).not.toContain('During work')
  expect(host.textContent).not.toContain('Keep this Chrome app open')
  expect(host.textContent).not.toContain('One timer for sleds, boxing and more')
  expect(JSON.parse(localStorage.getItem('opengym_tool_timer_v1'))).toEqual({ rounds: 3, workSec: 90, restSec: 45, sound: true })
  act(() => button('Increase Time').click())
  expect(setting('Time').textContent).toContain('2:00')
  act(() => button('Decrease Time').click())
  expect(setting('Time').textContent).toContain('1:30')
  act(() => button('Decrease Rest').click())
  expect(setting('Rest').textContent).toContain('0:15')
  act(() => button('Increase Rest').click())
  act(() => button('Time 1:30').click())
  expect(host.querySelector('[aria-label="Time Minutes"]').value).toBe('1')
  act(() => setInput(host.querySelector('[aria-label="Time Seconds"]'), '75'))
  expect(button('Done').disabled).toBe(true)
  act(() => setInput(host.querySelector('[aria-label="Time Seconds"]'), '20'))
  act(() => button('Done').click())
  expect(setting('Time').textContent).toContain('1:20')
  expect(host.textContent).toContain('5:30 total')
  expect(JSON.parse(localStorage.getItem('opengym_tool_timer_v1')).workSec).toBe(80)
})

it('blocks step changes that would exceed the two-hour plan or remove the last round', async () => {
  localStorage.setItem('opengym_tool_timer_v1', JSON.stringify({ rounds: 1, workSec: 7200, restSec: 0, sound: true }))
  await act(async () => root.render(<MemoryRouter><ToolTimer /></MemoryRouter>))
  expect(button('Increase Time').disabled).toBe(true)
  expect(button('Decrease Rounds').disabled).toBe(true)
  act(() => button('Time 120:00').click())
  act(() => setInput(host.querySelector('[aria-label="Time Minutes"]'), '121'))
  expect(button('Done').disabled).toBe(true)
})

it('opens one timer from Tools, keeps it playing while browsing Exercises, and resumes from media time', async () => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/tools']}><Routes>
      <Route path="/tools" element={<Tools />} />
      <Route path="/tools/timer" element={<ToolTimer />} />
      <Route path="/library" element={<div>Exercise library <Link to="/tools/timer">Timer</Link></div>} />
    </Routes></MemoryRouter>)
  })
  expect(button('Exercises')).toBeTruthy()
  act(() => button('Timer').click())
  expect(host.textContent).toContain('Timer setup')
  expect(setting('Time').textContent).toContain('1:00')
  expect(host.textContent).toContain('1:00 total')
  await act(async () => button('Start').click())
  expect(media.paused).toBe(false)
  expect(host.querySelector('.tool-setup')).toBeNull()
  expect(host.querySelector('.tool-run')).toBeTruthy()
  expect(host.querySelector('.tool-phase').textContent).toBe('Work')
  expect(host.querySelector('.tool-next')).toBeNull()
  act(() => { media.currentTime = 2; media.ontimeupdate() })
  expect(host.querySelector('.tool-digits').textContent).toBe('0:58')
  act(() => button('Pause').click())
  expect(media.paused).toBe(true)
  await act(async () => button('Resume').click())
  expect(media.paused).toBe(false)
  act(() => button('Tools').click())
  act(() => button('Exercises').click())
  expect(host.textContent).toContain('Exercise library')
  expect(media.paused).toBe(false)
  act(() => media.onended())
  expect(toolTimerSnapshot()).toMatchObject({ state: 'done', position: { kind: 'done', remainingMs: 0 } })
  act(() => host.querySelector('a').click())
  expect(host.querySelector('.tool-phase').textContent).toBe('Done')
  act(() => button('Edit timer').click())
  expect(setting('Time').textContent).toContain('1:00')
  expect(host.querySelector('.tool-run')).toBeNull()
})
