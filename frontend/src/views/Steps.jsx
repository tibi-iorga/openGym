import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { isAndroid } from '../lib/mobile.js'
import { stepDays } from '../lib/steps.js'
import { disableSteps, enableSteps, onStepsChange, refreshSteps, stepsSnapshot } from '../lib/steps-sync.js'
import { openHealthConnect } from '../lib/health-sync.js'
import { Button } from '../components/ui.jsx'

export default function Steps() {
  const steps = useStore(s => s.S.dailySteps)
  const reader = useSyncExternalStore(onStepsChange, stepsSnapshot)
  const [android, setAndroid] = useState(false)
  const [actionError, setActionError] = useState(false)
  const days = stepDays(steps)
  const readAt = Math.max(0, ...days.map(day => day.readAt || 0))
  const today = days.find(day => day.date === todayISO())
  let errorMessage = t('Could not read steps. Check Health Connect and try again. Your saved totals are unchanged.')
  if (reader.error === 'permission') {
    errorMessage = t('Step permission was not granted. Allow access to read again.')
  } else if (reader.error === 'storage') {
    errorMessage = t('Could not save step settings. Try again before closing the app.')
  }

  useEffect(() => {
    let mounted = true
    isAndroid().then(value => { if (mounted) { setAndroid(value) } })
    return () => { mounted = false }
  }, [])

  const run = action => async () => {
    setActionError(false)
    try {
      await action()
    } catch {
      setActionError(true)
    }
  }

  return (
    <>
      <div className="hdr"><h1>{t('Steps')}</h1></div>
      <section className="card" aria-label={t('Today')}>
        <div className="muted">{t('Today')}</div>
        <div className="big" style={{ fontSize: 44, margin: '8px 0' }}>
          {Number.isSafeInteger(today?.count) ? today.count.toLocaleString() : '—'}
        </div>
        {today?.count == null && <p className="muted small">{t('No step data for today yet.')}</p>}
        {readAt > 0 && <p className="muted small">
          {t('Last phone read: {0}', new Date(readAt).toLocaleString())}
        </p>}
      </section>

      <section className="card" aria-label={t('Read steps')}>
        <h2 style={{ marginTop: 0 }}>{t('Read steps')}</h2>
        <p className="muted small">
          {t('Read-only access to daily step totals. No location tracking or changes to Health Connect. When connected to your server, totals sync with your profile.')}
        </p>
        {android ? (
          <>
            <p className="muted small">{t('Reads the last 30 days when you open the app. Earlier imported days stay in your history.')}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {(!reader.on || reader.error === 'permission') ? (
                <Button variant="primary" disabled={reader.busy} onClick={run(enableSteps)}>
                  {reader.busy ? t('Reading steps…') : t('Allow reading steps')}
                </Button>
              ) : (
                <Button variant="primary" disabled={reader.busy} onClick={run(() => refreshSteps({ force: true }))}>
                  {reader.busy ? t('Reading steps…') : t('Refresh steps')}
                </Button>
              )}
              {reader.on && <Button disabled={reader.busy} onClick={run(disableSteps)}>{t('Stop reading steps')}</Button>}
              {reader.error === 'storage' && <Button onClick={run(disableSteps)}>{t('Stop reading steps')}</Button>}
              <Button onClick={run(openHealthConnect)}>{t('Open Health Connect')}</Button>
            </div>
            {!reader.on && days.length > 0 && <p className="muted small">{t('Reading is off on this phone. Previously imported totals are kept.')}</p>}
          </>
        ) : (
          <p className="muted small">{t('Enable step reading in the openGym Android app. Synced totals will also appear here.')}</p>
        )}
        {(reader.error || actionError) && <p role="alert" className="small">
          {errorMessage}
        </p>}
      </section>

      <section className="card" aria-label={t('Daily steps')}>
        <h2 style={{ marginTop: 0 }}>{t('Daily steps')}</h2>
        {!days.length && <p className="muted">{t('No steps imported yet.')}</p>}
        {days.length > 0 && <p className="muted small">{t('Dates follow the phone’s local time when read. A dash means no data, not zero steps.')}</p>}
        <dl style={{ margin: 0 }}>
          {days.map(day => (
            <div className="row between" key={day.date} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <dt>{fmtDate(day.date, true)}</dt>
              <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {day.count === null ? <span aria-label={t('No data')}>—</span> : day.count.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
