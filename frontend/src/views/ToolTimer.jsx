import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { timerPhases } from '../lib/tool-timer.js'
import { pauseToolTimer, resumeToolTimer, startToolTimer, stopToolTimer, subscribeToolTimer, toolTimerSnapshot } from '../lib/tool-timer-player.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const DEFAULTS = { rounds: 1, workSec: 60, restSec: 0, prepareSec: 5, intervalSec: 0, sound: true }
const SETTINGS_KEY = 'opengym_tool_timer_v1'
const CADENCES = [0, 15, 30, 60]
const clock = seconds => {
  const n = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

function readSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) } } catch { return DEFAULTS }
}

function DurationEditor({ label, seconds, minimum, onSave, onCancel }) {
  const [minutes, setMinutes] = useState(String(Math.floor(seconds / 60)))
  const [remainder, setRemainder] = useState(String(seconds % 60).padStart(2, '0'))
  const mins = Number(minutes)
  const secs = Number(remainder)
  const valid = /^\d+$/.test(minutes) && /^\d+$/.test(remainder) && mins <= 120 && secs < 60 && mins * 60 + secs >= minimum
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
    if (!Number.isSafeInteger(settings.intervalSec) || settings.intervalSec < 0 || settings.intervalSec > 7200) invalid = t('Enter a valid interval')
  } catch { invalid = t('Enter valid durations, up to two hours total') }
  const total = phases?.reduce((seconds, phase) => seconds + phase.seconds, 0) || 0
  const running = snapshot.state === 'playing' || snapshot.state === 'loading' || snapshot.state === 'paused'
  const done = snapshot.state === 'done'
  const position = snapshot.position
  const phaseName = position?.kind === 'prepare' ? t('Get ready') : position?.kind === 'work' ? t('Work') : position?.kind === 'rest' ? t('Rest') : t('Done')
  const next = running ? snapshot.phases[position?.index + 1] : null
  const nextName = next?.kind === 'work' ? t('Work') : next?.kind === 'rest' ? t('Rest') : null
  const durationRow = (key, label, minimum) => <div className="tool-setting" key={key}>
    <button type="button" className="tool-setting-row" aria-expanded={editing === key} onClick={() => setEditing(editing === key ? null : key)}>
      <span>{label}</span><strong>{clock(settings[key])}</strong><Icon name="chevronRight" />
    </button>
    {editing === key && <DurationEditor key={key} label={label} seconds={settings[key]} minimum={minimum}
      onSave={value => { change(key, value); setEditing(null) }} onCancel={() => setEditing(null)} />}
  </div>

  return <>
    <div className="hdr tool-header"><button className="iconbtn" onClick={() => nav('/tools')} aria-label={t('Tools')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Timer')}</h1>
        {!running && !done && <div className="sub">{t('One timer for sleds, boxing and more')}</div>}</div></div>

    {running || done ? <section className={`tool-run is-${position?.kind || 'work'}`} aria-label={t('Timer')}>
      <div className="tool-run-main" role="timer">
        <div className="tool-phase">{phaseName}</div>
        <div className="tool-digits">{clock(position?.remainingMs / 1000 || 0)}</div>
        {running && position?.kind !== 'prepare' && settings.rounds > 1 && <div className="tool-round">{t('Round')} {position?.round} {t('of')} {settings.rounds}</div>}
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
      <div className="tool-setting-list">
        {durationRow('workSec', t('Work'), 1)}
        {durationRow('restSec', t('Rest'), 0)}
        <label className="tool-setting-row tool-rounds-row"><span>{t('Rounds')}</span>
          <input type="number" inputMode="numeric" min="1" max="99" value={settings.rounds} aria-label={t('Rounds')}
            onChange={event => change('rounds', event.target.value === '' ? '' : Number(event.target.value))} /></label>
        {durationRow('prepareSec', t('Get ready'), 0)}
      </div>
      <p className="small dim tool-setup-help">{t('Rest is skipped after the final round')}</p>

      <h4 className="sec">{t('Sound')}</h4>
      <div className="tool-setting-list">
        <label className="tool-setting-row tool-sound-row"><span><strong>{t('Play dings')}</strong><small>{t('At phase changes and finish')}</small></span>
          <input type="checkbox" checked={settings.sound} onChange={event => change('sound', event.target.checked)} /></label>
        <label className="tool-setting-row tool-cadence-row"><span>{t('During work')}</span>
          <select value={CADENCES.includes(settings.intervalSec) ? settings.intervalSec : 'custom'} disabled={!settings.sound}
            onChange={event => change('intervalSec', event.target.value === 'custom' ? 45 : Number(event.target.value))}>
            <option value="0">{t('Off')}</option><option value="15">{t('Every 15 seconds')}</option>
            <option value="30">{t('Every 30 seconds')}</option><option value="60">{t('Every minute')}</option>
            <option value="custom">{t('Custom interval')}</option>
          </select></label>
        {!CADENCES.includes(settings.intervalSec) && <label className="tool-setting-row tool-custom-row"><span>{t('Every N seconds')}</span>
          <input type="number" inputMode="numeric" min="1" max="7200" value={settings.intervalSec} disabled={!settings.sound}
            onChange={event => change('intervalSec', event.target.value === '' ? '' : Number(event.target.value))} /></label>}
      </div>
      <p className="small dim tool-note">{t('Keep this Chrome app open. Lock-screen sound is best effort and may pause or interrupt other audio. Test your headphones before relying on dings.')}</p>
      {invalid && <p className="small tool-error" role="alert">{invalid}</p>}
      {editing === null && <div className="tool-start-dock"><Button variant="primary" icon="play" disabled={!!invalid}
        onClick={() => startToolTimer(settings)}>{t('Start')}</Button></div>}
    </section>}
  </>
}
