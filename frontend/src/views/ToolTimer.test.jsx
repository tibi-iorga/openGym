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
const field = name => [...host.querySelectorAll('label')].find(element => element.textContent.includes(name))?.querySelector('input')

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
  expect(field('Work seconds').value).toBe('60')
  await act(async () => button('Start').click())
  expect(media.paused).toBe(false)
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
  act(() => {
    const input = field('Work seconds')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '90')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(host.querySelector('.tool-phase').textContent).toBe('Ready')
  expect(host.textContent).toContain('1:35 total')
})
