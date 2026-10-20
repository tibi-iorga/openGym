import { timerCues } from './tool-timer.js'
import { RECORDED_BELL } from './tool-timer-bell.js'

// An HTML audio track keeps its own clock and can continue on Chrome's lock screen. A
// JavaScript interval cannot promise that: hidden-page callbacks may be delayed or stopped.
// The track is 8-bit mono PCM at 11,025 Hz. Reusing silence chunks avoids allocating a
// multi-megabyte array for a long timer; cue samples are the only new audio data.
const RATE = 11025
const SILENCE = new Uint8Array(RATE * 10).fill(128)
const CUE_LENGTH = { work: RECORDED_BELL.length / RATE, rest: 0.36, interval: 0.22, done: 1.28 }

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

function restTap(t) {
  const body = 0.72 * Math.exp(-t / 0.11) * Math.sin(2 * Math.PI * 418 * t)
    + 0.38 * Math.exp(-t / 0.065) * Math.sin(2 * Math.PI * 697 * t)
  return Math.min(1, t / 0.003) * body * Math.min(1, (CUE_LENGTH.rest - t) / 0.025)
}

function cueSamples(kind) {
  if (kind === 'work') return RECORDED_BELL
  const length = Math.round(CUE_LENGTH[kind] * RATE)
  const data = new Uint8Array(length)
  const secondStrike = Math.round(0.34 * RATE)
  for (let i = 0; i < length; i++) {
    const t = i / RATE
    if (kind === 'done') {
      const first = (RECORDED_BELL[i] ?? 128) - 128
      const second = (RECORDED_BELL[i - secondStrike] ?? 128) - 128
      data[i] = Math.round(128 + 0.58 * (first + second))
    } else {
      const wave = kind === 'rest' ? restTap(t)
        : Math.sin(2 * Math.PI * 990 * t) * Math.max(0, 1 - t / CUE_LENGTH.interval)
      data[i] = Math.max(0, Math.min(255, Math.round(128 + 48 * wave)))
    }
  }
  return data
}

export function timerAudioBlob(phases, intervalSec, sound) {
  const seconds = phases.reduce((total, phase) => total + phase.seconds, 0)
  const length = Math.round((seconds + CUE_LENGTH.done + 0.04) * RATE)
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
    const samples = cueSamples(cue.kind)
    parts.push(samples)
    cursor += samples.length
  }
  silence(length - cursor)
  return new Blob(parts, { type: 'audio/wav' })
}
