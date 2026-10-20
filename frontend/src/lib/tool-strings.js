// English fallback for the new Tools screen. Locale packs spread this first, then replace
// individual entries when translated, so the existing locale parity check still catches
// accidentally omitted UI text.
export const TOOL_STRINGS = Object.fromEntries([
  'Tools',
  'Timer',
  'Countdown, rounds and interval dings',
  'Timer running',
  'Timer paused',
  'Browse the exercise library',
  'One timer for sleds, boxing and more',
  'Get ready',
  'Work',
  'Rounds',
  'Work seconds',
  'Rest seconds',
  'Get ready seconds',
  'Play dings',
  'Ding every N work seconds (0 = off)',
  'Time left in this phase',
  'Timer complete',
  'Timer setup',
  'Stop',
  'total',
  'Keep this Chrome app open. Lock-screen sound is best effort and may pause or interrupt other audio. Test your headphones before relying on dings.',
].map(key => [key, key]))
