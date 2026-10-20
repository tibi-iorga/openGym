import { timerPhases, timerPosition } from './tool-timer.js'
import { timerAudioBlob } from './tool-timer-audio.js'

let audio = null
let url = null
let phases = []
let state = 'idle'
let error = ''
let attempt = 0
const listeners = new Set()
const notify = () => listeners.forEach(listener => listener())

export function subscribeToolTimer(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toolTimerSnapshot() {
  const elapsedMs = state === 'done' ? phases.reduce((sum, phase) => sum + phase.seconds, 0) * 1000 : (audio?.currentTime || 0) * 1000
  const position = phases.length ? timerPosition(phases, elapsedMs) : null
  return { state, error, position, phases }
}

function cleanAudio() {
  attempt++
  if (audio) {
    audio.onpause = null
    audio.onplay = null
    audio.ontimeupdate = null
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = null
  }
  if (url) { URL.revokeObjectURL(url); url = null }
}

export function stopToolTimer() {
  cleanAudio()
  phases = []
  state = 'idle'
  error = ''
  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'
  notify()
}

export function pauseToolTimer() {
  attempt++
  audio?.pause()
  if (state === 'playing' || state === 'loading') state = 'paused'
  if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'
  notify()
}

export async function resumeToolTimer() {
  if (!audio) return
  const current = audio
  const currentAttempt = ++attempt
  try {
    await current.play()
    if (current !== audio || currentAttempt !== attempt || current.paused) return
    state = 'playing'
    error = ''
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'
  } catch {
    if (current !== audio || currentAttempt !== attempt) return
    state = 'paused'
    error = 'Playback was blocked. Tap Resume to try again.'
  }
  notify()
}

export function startToolTimer(config) {
  // Generate the whole track synchronously in the click handler. Chrome then sees play() as
  // user initiated, and the media pipeline owns cue timing even if the page is locked.
  const nextPhases = timerPhases(config)
  const blob = timerAudioBlob(nextPhases, config.intervalSec || 0, config.sound !== false)
  stopToolTimer()
  phases = nextPhases
  url = URL.createObjectURL(blob)
  audio = new Audio(url)
  audio.preload = 'auto'
  audio.onpause = () => { if (state === 'playing' || state === 'loading') { state = 'paused'; if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; notify() } }
  audio.onplay = () => { state = 'playing'; error = ''; if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; notify() }
  audio.ontimeupdate = notify
  audio.onended = () => { cleanAudio(); state = 'done'; if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'; notify() }
  audio.onerror = () => { state = 'paused'; error = 'Audio playback failed on this device.'; notify() }
  if (navigator.mediaSession) {
    if (typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: 'Timer', artist: 'openGym' })
    for (const [action, handler] of [['play', resumeToolTimer], ['pause', pauseToolTimer], ['stop', stopToolTimer]]) {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported action */ }
    }
  }
  state = 'loading'
  error = ''
  notify()
  // Calling play before yielding is essential to browser gesture authorization.
  void resumeToolTimer()
}
