import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { timerPhases } from '../lib/tool-timer.js'
import { pauseToolTimer, resumeToolTimer, startToolTimer, stopToolTimer, subscribeToolTimer, toolTimerSnapshot } from '../lib/tool-timer-player.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const DEFAULTS = { rounds: 1, workSec: 60, restSec: 0, sound: true }
const SETTINGS_KEY = 'opengym_tool_timer_v1'
const clock = seconds => {
  const n = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    return Object.fromEntries(Object.entries(DEFAULTS).map(([key, fallback]) => [key, saved?.[key] ?? fallback]))
  } catch { return DEFAULTS }
}

function DurationEditor({ label, seconds, minimum, maximum, onSave, onCancel }) {
  const [minutes, setMinutes] = useState(String(Math.floor(seconds / 60)))
  const [remainder, setRemainder] = useState(String(seconds % 60).padStart(2, '0'))
  const mins = Number(minutes)
  const secs = Number(remainder)
  const valid = /^\d+$/.test(minutes) && /^\d+$/.test(remainder) && secs < 60 && mins * 60 + secs >= minimum && mins * 60 + secs <= maximum
  const save = () => { if (valid) onSave(mins * 60 + secs) }
  const keyDown = event => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') save()
    if (event.key === 'Escape') onCancel()
  }
  const digits = setter => event => setter(event.target.value.replace(/\D/g, ''))

  return <div className="tool-duration-editor" onKeyDown={keyDown}>
    <div className="tool-time-inputs">
      <label><span>{t('Minutes')}</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={minutes} autoFocus
        onFocus={event => event.target.select()} onChange={digits(setMinutes)} aria-label={`${label} ${t('Minutes')}`} /></label>
      <span className="tool-time-colon">:</span>
      <label><span>{t('Seconds')}</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={remainder}
        onFocus={event => event.target.select()} onChange={digits(setRemainder)} aria-label={`${label} ${t('Seconds')}`} /></label>
    </div>
    {!valid && <p className="small tool-error" role="alert">{t('Enter a valid duration')}</p>}
    <div className="tool-edit-actions"><button type="button" onClick={onCancel}>{t('Cancel')}</button>
      <button type="button" className="tool-edit-save" disabled={!valid} onClick={save}>{t('Done')}</button></div>
  </div>
}

export default function ToolTimer() {
  const nav = useNavigate()
  const [settings, setSettings] = useState(readSettings)
  const [snapshot, setSnapshot] = useState(toolTimerSnapshot)
  const [editing, setEditing] = useState(null)
  useEffect(() => subscribeToolTimer(() => setSnapshot(toolTimerSnapshot())), [])
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  // The media element owns the timer. This repaint only updates the visible digits; a delayed
  // callback cannot move a ding or stretch a round.
  useEffect(() => {
    if (snapshot.state !== 'playing') return
    const tick = setInterval(() => setSnapshot(toolTimerSnapshot()), 200)
    return () => clearInterval(tick)
  }, [snapshot.state])

  const change = (key, value) => {
    if (snapshot.state === 'done') stopToolTimer()
    setSettings(previous => ({ ...previous, [key]: value }))
  }
  let phases, invalid = ''
  try {
    phases = timerPhases(settings)
  } catch { invalid = t('Enter valid durations, up to two hours total') }
  const total = phases?.reduce((seconds, phase) => seconds + phase.seconds, 0) || 0
  const running = snapshot.state === 'playing' || snapshot.state === 'loading' || snapshot.state === 'paused'
  const done = snapshot.state === 'done'
  const position = snapshot.position
  const phaseName = position?.kind === 'work' ? t('Work') : position?.kind === 'rest' ? t('Rest') : t('Done')
  const next = running ? snapshot.phases[position?.index + 1] : null
  const nextName = next?.kind === 'work' ? t('Work') : next?.kind === 'rest' ? t('Rest') : null
  const stepper = (key, label, step, minimum) => {
    const value = settings[key]
    const candidate = delta => Math.max(minimum, value + delta)
    const allowed = delta => {
      const next = candidate(delta)
      if (next === value) return false
      try { timerPhases({ ...settings, [key]: next }); return true } catch { return false }
    }
    const maximum = key === 'workSec'
      ? Math.floor((7200 - (settings.rounds - 1) * settings.restSec) / settings.rounds)
      : settings.rounds > 1 ? Math.floor((7200 - settings.rounds * settings.workSec) / (settings.rounds - 1)) : 7200
    return <div className="tool-stepper" key={key}>
      <div className="tool-stepper-label">{label}</div>
      <div className="tool-stepper-controls">
        <button type="button" className="tool-stepper-adjust" aria-label={`${t('Decrease')} ${label}`}
          disabled={!allowed(-step)} onClick={() => change(key, candidate(-step))}>−</button>
        {key === 'rounds' ? <strong className="tool-stepper-value">{value}</strong>
          : <button type="button" className="tool-stepper-value" aria-label={`${label} ${clock(value)}`}
            aria-expanded={editing === key} onClick={() => setEditing(editing === key ? null : key)}>{clock(value)}</button>}
        <button type="button" className="tool-stepper-adjust" aria-label={`${t('Increase')} ${label}`}
          disabled={!allowed(step)} onClick={() => change(key, candidate(step))}>+</button>
      </div>
      {editing === key && <DurationEditor key={key} label={label} seconds={value} minimum={minimum} maximum={maximum}
        onSave={next => { change(key, next); setEditing(null) }} onCancel={() => setEditing(null)} />}
    </div>
  }

  return <>
    <div className="hdr tool-header"><button className="iconbtn" onClick={() => nav('/tools')} aria-label={t('Tools')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Timer')}</h1>
        {!running && !done && <div className="sub">{t('One timer for sleds, boxing and more')}</div>}</div></div>

    {running || done ? <section className={`tool-run is-${position?.kind || 'work'}`} aria-label={t('Timer')}>
      <div className="tool-run-main" role="timer">
        <div className="tool-phase">{phaseName}</div>
        <div className="tool-digits">{clock(position?.remainingMs / 1000 || 0)}</div>
        {running && settings.rounds > 1 && <div className="tool-round">{t('Round')} {position?.round} {t('of')} {settings.rounds}</div>}
        {done && <div className="tool-round">{t('Timer complete')}</div>}
      </div>
      {nextName && <div className="tool-next"><span>{t('Up next')}</span><strong>{nextName} · {clock(next.seconds)}</strong></div>}
      {snapshot.error && <p className="tool-error" role="alert">{snapshot.error}</p>}
      <div className="tool-run-controls">
        {done ? <><Button variant="primary" icon="play" disabled={!!invalid} onClick={() => startToolTimer(settings)}>{t('Start again')}</Button>
          <Button variant="tinted" onClick={stopToolTimer}>{t('Edit timer')}</Button></>
          : <><Button variant="primary" icon={snapshot.state === 'paused' ? 'play' : 'pause'}
              onClick={snapshot.state === 'paused' ? resumeToolTimer : pauseToolTimer}>{snapshot.state === 'paused' ? t('Resume') : t('Pause')}</Button>
            <Button variant="tinted" onClick={stopToolTimer}>{t('Stop')}</Button></>}
      </div>
    </section> : <section className="tool-setup" aria-label={t('Timer setup')}>
      <div className="tool-summary"><span>{t('Timer setup')}</span><strong>{clock(total)} {t('total')}</strong></div>
      <div className="tool-stepper-list">
        {stepper('rounds', t('Rounds'), 1, 1)}
        {stepper('workSec', t('Time'), 30, 1)}
        {stepper('restSec', t('Rest'), 30, 0)}
      </div>
      <div className="tool-setting-list">
        <label className="tool-setting-row tool-sound-row"><span><strong>{t('Play dings')}</strong><small>{t('At phase changes and finish')}</small></span>
          <input type="checkbox" checked={settings.sound} onChange={event => change('sound', event.target.checked)} /></label>
      </div>
      {invalid && <p className="small tool-error" role="alert">{invalid}</p>}
      {editing === null && <div className="tool-start-dock"><Button variant="primary" icon="play" disabled={!!invalid}
        onClick={() => startToolTimer(settings)}>{t('Start')}</Button></div>}
    </section>}
  </>
}
