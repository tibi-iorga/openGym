import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { timerPhases, timerPosition } from '../lib/tool-timer.js'
import { pauseToolTimer, resumeToolTimer, startToolTimer, stopToolTimer, subscribeToolTimer, toolTimerSnapshot } from '../lib/tool-timer-player.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const DEFAULTS = { rounds: 1, workSec: 60, restSec: 0, prepareSec: 5, intervalSec: 0, sound: true }
const SETTINGS_KEY = 'opengym_tool_timer_v1'
const clock = seconds => {
  const n = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

function readSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) } } catch { return DEFAULTS }
}

export default function ToolTimer() {
  const nav = useNavigate()
  const [settings, setSettings] = useState(readSettings)
  const [snapshot, setSnapshot] = useState(toolTimerSnapshot)
  useEffect(() => subscribeToolTimer(() => setSnapshot(toolTimerSnapshot())), [])
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  // The media element owns the timer. This repaint only updates the visible digits; a delayed
  // callback cannot move a ding or stretch a round.
  useEffect(() => {
    if (snapshot.state !== 'playing') return
    const tick = setInterval(() => setSnapshot(toolTimerSnapshot()), 200)
    return () => clearInterval(tick)
  }, [snapshot.state])

  const change = (key, value) => setSettings(previous => ({ ...previous, [key]: value }))
  let phases, invalid = ''
  try {
    phases = timerPhases(settings)
    if (!Number.isSafeInteger(settings.intervalSec) || settings.intervalSec < 0) invalid = 'Enter a valid interval.'
  } catch { invalid = 'Enter valid durations, up to two hours total.' }
  const total = phases?.reduce((seconds, phase) => seconds + phase.seconds, 0) || 0
  const running = snapshot.state === 'playing' || snapshot.state === 'loading' || snapshot.state === 'paused'
  const position = snapshot.position || (phases ? timerPosition(phases, 0) : null)
  const phaseName = position?.kind === 'prepare' ? t('Get ready') : position?.kind === 'work' ? t('Work') : position?.kind === 'rest' ? t('Rest') : t('Done')
  const remaining = position ? clock(position.remainingMs / 1000) : '0:00'

  const field = (key, label, min, max) => <label className="tool-field" key={key}>
    <span>{label}</span><input className="field" type="number" inputMode="numeric" min={min} max={max} step="1" value={settings[key]}
      disabled={running} onChange={event => change(key, event.target.value === '' ? '' : Number(event.target.value))} />
  </label>

  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/tools')} aria-label={t('Tools')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Timer')}</h1><div className="sub">{t('One timer for sleds, boxing and more')}</div></div></div>

    <div className="card tool-clock" role="timer" aria-label={t('Timer')}>
      <div className="tool-phase">{snapshot.state === 'idle' ? t('Ready') : phaseName}{running && position?.kind !== 'done' && position?.kind !== 'prepare' && settings.rounds > 1 ? ` · ${position.round}/${settings.rounds}` : ''}</div>
      <div className="tool-digits">{remaining}</div>
      <div className="small dim">{running ? t('Time left in this phase') : snapshot.state === 'done' ? t('Timer complete') : `${clock(total)} ${t('total')}`}</div>
    </div>

    {snapshot.error && <p className="tool-error" role="alert">{snapshot.error}</p>}
    <div className="tool-controls">
      {snapshot.state === 'playing' || snapshot.state === 'loading' ? <Button variant="primary" icon="pause" onClick={pauseToolTimer}>{t('Pause')}</Button>
        : snapshot.state === 'paused' ? <Button variant="primary" icon="play" onClick={resumeToolTimer}>{t('Resume')}</Button>
          : <Button variant="primary" icon="play" disabled={!!invalid} onClick={() => startToolTimer(settings)}>{t('Start')}</Button>}
      {running && <Button variant="tinted" onClick={stopToolTimer}>{t('Stop')}</Button>}
    </div>
    {invalid && <p className="small tool-error" role="alert">{invalid}</p>}

    <h4 className="sec">{t('Timer setup')}</h4>
    <div className="card">
      <div className="tool-fields">
        {field('rounds', t('Rounds'), 1, 99)}
        {field('workSec', t('Work seconds'), 1, 7200)}
        {field('restSec', t('Rest seconds'), 0, 7200)}
        {field('prepareSec', t('Get ready seconds'), 0, 7200)}
      </div>
      <label className="tool-check"><input type="checkbox" checked={settings.sound} disabled={running} onChange={event => change('sound', event.target.checked)} />{t('Play dings')}</label>
      <label className="tool-field tool-interval"><span>{t('Ding every N work seconds (0 = off)')}</span>
        <input className="field" type="number" inputMode="numeric" min="0" max="7200" step="1" value={settings.intervalSec}
          disabled={running || !settings.sound} onChange={event => change('intervalSec', event.target.value === '' ? '' : Number(event.target.value))} />
      </label>
    </div>
    <p className="small dim tool-note">{t('Keep this Chrome app open. Lock-screen sound is best effort and may pause or interrupt other audio. Test your headphones before relying on dings.')}</p>
  </>
}
