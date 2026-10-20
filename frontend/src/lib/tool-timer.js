// A timer plan is a sequence of phases. The runner reads wall-clock elapsed
// time against these boundaries, so delayed browser ticks cannot stretch rounds.
const whole = (value, name, min) => {
  if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`${name} must be an integer >= ${min}`)
  return value
}

export function timerPhases({ rounds, workSec, restSec = 0 }) {
  whole(rounds, 'rounds', 1)
  if (rounds > 99) throw new RangeError('rounds must be <= 99')
  whole(workSec, 'workSec', 1)
  whole(restSec, 'restSec', 0)
  if (rounds * workSec + (rounds - 1) * restSec > 7200) {
    throw new RangeError('timer must be at most two hours')
  }

  const phases = []
  for (let round = 1; round <= rounds; round++) {
    phases.push({ kind: 'work', round, seconds: workSec })
    if (restSec && round < rounds) phases.push({ kind: 'rest', round, seconds: restSec })
  }
  return phases
}

export function timerPosition(phases, elapsedMs) {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  let boundary = 0
  for (let index = 0; index < phases.length; index++) {
    const phase = phases[index]
    const end = boundary + phase.seconds * 1000
    if (elapsed < end) return { index, ...phase, remainingMs: end - elapsed, elapsedMs: elapsed }
    boundary = end
  }
  return { index: phases.length, kind: 'done', round: phases.at(-1)?.round || 0, remainingMs: 0, elapsedMs: Math.min(elapsed, boundary) }
}

// Every cue is placed in the media timeline, not dispatched by a JS timeout. The interval
// belongs to each work phase, so a 30-second cue never lands in a rest period.
export function timerCues(phases, intervalSec = 0, sound = true) {
  whole(intervalSec, 'intervalSec', 0)
  if (!sound) return []
  const cues = []
  let startSec = 0
  for (const phase of phases) {
    cues.push({ second: startSec, kind: phase.kind })
    if (phase.kind === 'work' && intervalSec) {
      for (let second = intervalSec; second < phase.seconds; second += intervalSec) {
        cues.push({ second: startSec + second, kind: 'interval' })
      }
    }
    startSec += phase.seconds
  }
  cues.push({ second: startSec, kind: 'done' })
  return cues
}
