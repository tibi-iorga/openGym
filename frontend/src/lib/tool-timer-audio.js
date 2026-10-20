import { timerCues } from './tool-timer.js'

// An HTML audio track keeps its own clock and can continue on Chrome's lock screen. A
// JavaScript interval cannot promise that: hidden-page callbacks may be delayed or stopped.
// The track is 8-bit mono PCM at 11,025 Hz. Reusing silence chunks avoids allocating a
// multi-megabyte array for a long timer; cue samples are the only new audio data.
const RATE = 11025
const SILENCE = new Uint8Array(RATE * 10).fill(128)
const CUE_LENGTH = { work: 0.94, rest: 0.36, interval: 0.22, done: 1.28 }
const BELL_PARTIALS = [
  [624, 0.52, 0.82], [633, 0.18, 0.73], [943, 0.38, 0.66],
  [1271, 0.30, 0.52], [1716, 0.24, 0.40], [2369, 0.14, 0.24], [3217, 0.09, 0.13],
]

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

function bell(t) {
  if (t < 0 || t >= CUE_LENGTH.work) return 0
  const attack = Math.min(1, t / 0.004)
  const ring = BELL_PARTIALS.reduce((sum, [frequency, volume, decay]) =>
    sum + volume * Math.exp(-t / decay) * Math.sin(2 * Math.PI * frequency * t), 0)
  const strike = 0.28 * Math.exp(-t / 0.015) * Math.sin(2 * Math.PI * 3910 * t)
  return attack * (ring + strike) * Math.min(1, (CUE_LENGTH.work - t) / 0.035)
}

function restTap(t) {
  const body = 0.72 * Math.exp(-t / 0.11) * Math.sin(2 * Math.PI * 418 * t)
    + 0.38 * Math.exp(-t / 0.065) * Math.sin(2 * Math.PI * 697 * t)
  return Math.min(1, t / 0.003) * body * Math.min(1, (CUE_LENGTH.rest - t) / 0.025)
}

function cueSamples(kind) {
  const length = Math.round(CUE_LENGTH[kind] * RATE)
  const data = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / RATE
    const wave = kind === 'work' ? bell(t)
      : kind === 'rest' ? restTap(t)
        : kind === 'done' ? 0.82 * bell(t) + 0.82 * bell(t - 0.34)
          : Math.sin(2 * Math.PI * 990 * t) * Math.max(0, 1 - t / CUE_LENGTH.interval)
    data[i] = Math.max(0, Math.min(255, Math.round(128 + 48 * wave)))
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
