import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { stepDays } from '../lib/steps.js'
import { Button } from './ui.jsx'

export default function StepsCard() {
  const steps = useStore(s => s.S.dailySteps)
  const navigate = useNavigate()
  const days = stepDays(steps)
  const today = days.find(day => day.date === todayISO())
  const count = today?.count

  return (
    <section className="card" aria-label={t('Steps')}>
      <div className="row between">
        <h2 style={{ margin: 0 }}>{t('Steps')}</h2>
        <Button size="sm" onClick={() => navigate('/steps')}>
          {days.length ? t('History') : t('Connect')}
        </Button>
      </div>
      <div className="big" style={{ marginTop: 8 }}>
        {Number.isSafeInteger(count) ? count.toLocaleString() : '—'}
        <span className="muted small" style={{ marginInlineStart: 8 }}>{t('Today')}</span>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        {today?.readAt
          ? t('Last phone read: {0}', new Date(today.readAt).toLocaleString())
          : t('Read your daily steps from Health Connect.')}
      </p>
    </section>
  )
}
