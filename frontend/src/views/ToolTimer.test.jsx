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
const setting = name => [...host.querySelectorAll('.tool-setting-row')].find(element => element.querySelector('span')?.textContent === name)
const setInput = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

it('shows saved seconds as touch-sized times and commits a duration edit', async () => {
  localStorage.setItem('opengym_tool_timer_v1', JSON.stringify({ rounds: 3, workSec: 90, restSec: 45, prepareSec: 10, intervalSec: 45, sound: true }))
  await act(async () => root.render(<MemoryRouter><ToolTimer /></MemoryRouter>))
  expect(setting('Work').textContent).toContain('1:30')
  expect(setting('Rest').textContent).toContain('0:45')
  expect(host.querySelector('.tool-cadence-row select').value).toBe('custom')
  expect(host.querySelector('.tool-custom-row input').value).toBe('45')
  act(() => setting('Work').click())
  expect(host.querySelector('[aria-label="Work Minutes"]').value).toBe('1')
  act(() => setInput(host.querySelector('[aria-label="Work Seconds"]'), '75'))
  expect(button('Done').disabled).toBe(true)
  act(() => setInput(host.querySelector('[aria-label="Work Seconds"]'), '20'))
  act(() => button('Done').click())
  expect(setting('Work').textContent).toContain('1:20')
  expect(JSON.parse(localStorage.getItem('opengym_tool_timer_v1')).workSec).toBe(80)
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
  expect(setting('Work').textContent).toContain('1:00')
  await act(async () => button('Start').click())
  expect(media.paused).toBe(false)
  expect(host.querySelector('.tool-setup')).toBeNull()
  expect(host.querySelector('.tool-run')).toBeTruthy()
  expect(host.querySelector('.tool-next').textContent).toContain('Work')
  act(() => { media.currentTime = 7; media.ontimeupdate() })
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
  expect(setting('Work').textContent).toContain('1:00')
  expect(host.querySelector('.tool-run')).toBeNull()
})
