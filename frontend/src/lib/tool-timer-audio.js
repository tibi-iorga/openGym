import { timerCues } from './tool-timer.js'

// An HTML audio track keeps its own clock and can continue on Chrome's lock screen. A
// JavaScript interval cannot promise that: hidden-page callbacks may be delayed or stopped.
// The track is 8-bit mono PCM at 11,025 Hz. Reusing silence chunks avoids allocating a
// multi-megabyte array for a long timer; cue samples are the only new audio data.
const RATE = 11025
const SILENCE = new Uint8Array(RATE * 10).fill(128)
const DING_LENGTH = { prepare: 0.32, work: 0.48, rest: 0.32, interval: 0.22, done: 0.72 }

function header(samples) {
  const bytes = new ArrayBuffer(44)
  const view = new DataView(bytes)
  const word = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  word(0, 'RIFF'); view.setUint32(4, 36 + samples, true)
  word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true); view.setUint32(28, RATE, true)
  view.setUint16(32, 1, true); view.setUint16(34, 8, true)
  word(36, 'data'); view.setUint32(40, samples, true)
  return bytes
}

function ding(kind) {
  const length = Math.round(DING_LENGTH[kind] * RATE)
  const data = new Uint8Array(length)
  const notes = kind === 'done' ? [880, 1100, 1320] : kind === 'work' ? [880, 1100] : [kind === 'rest' ? 660 : 990]
  for (let i = 0; i < length; i++) {
    const note = Math.floor(i / (0.23 * RATE))
    if (note >= notes.length) { data[i] = 128; continue }
    const within = (i / RATE) % 0.23
    const envelope = Math.min(1, within / 0.012) * Math.max(0, 1 - within / 0.21)
    const wave = Math.sin(2 * Math.PI * notes[note] * within) + 0.28 * Math.sin(4 * Math.PI * notes[note] * within)
    data[i] = Math.max(0, Math.min(255, Math.round(128 + 44 * envelope * wave)))
  }
  return data
}

export function timerAudioBlob(phases, intervalSec, sound) {
  const seconds = phases.reduce((total, phase) => total + phase.seconds, 0)
  const length = Math.round((seconds + 0.75) * RATE)
  const parts = [header(length)]
  let cursor = 0
  const silence = count => {
    while (count > 0) {
      const take = Math.min(count, SILENCE.length)
      parts.push(SILENCE.subarray(0, take))
      cursor += take
      count -= take
    }
  }
  for (const cue of timerCues(phases, intervalSec, sound)) {
    const start = Math.round(cue.second * RATE)
    silence(Math.max(0, start - cursor))
    const samples = ding(cue.kind)
    parts.push(samples)
    cursor += samples.length
  }
  silence(length - cursor)
  return new Blob(parts, { type: 'audio/wav' })
}
