// English fallback for the new Tools screen. Locale packs spread this first, then replace
// individual entries when translated, so the existing locale parity check still catches
// accidentally omitted UI text.
export const TOOL_STRINGS = Object.fromEntries([
  'Tools',
  'Timer',
  'Rounds, time, rest and dings',
  'Timer running',
  'Timer paused',
  'Browse the exercise library',
  'Work',
  'Rounds',
  'Play dings',
  'Timer complete',
  'Timer setup',
  'Minutes',
  'Seconds',
  'Enter a valid duration',
  'Enter valid durations, up to two hours total',
  'At phase changes and finish',
  'Round',
  'of',
  'Start again',
  'Edit timer',
  'Stop',
  'total',
].map(key => [key, key]))
