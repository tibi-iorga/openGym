import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { subscribeToolTimer, toolTimerSnapshot } from '../lib/tool-timer-player.js'
import Icon from '../components/Icon.jsx'

export default function Tools() {
  const nav = useNavigate()
  const [timer, setTimer] = useState(toolTimerSnapshot)
  useEffect(() => subscribeToolTimer(() => setTimer(toolTimerSnapshot())), [])
  const subtitle = timer.state === 'playing' ? t('Timer running') : timer.state === 'paused' ? t('Timer paused') : t('Countdown, rounds and interval dings')
  return <>
    <div className="hdr"><h1>{t('Tools')}</h1></div>
    <div className="sect-b">
      <button className="lrow tool-link" onClick={() => nav('/tools/timer')}>
        <Icon name="timer" /><span className="grow"><strong>{t('Timer')}</strong><small>{subtitle}</small></span><Icon name="chevronRight" />
      </button>
      <div className="divider" style={{ margin: '0 14px' }} />
      <button className="lrow tool-link" onClick={() => nav('/library')}>
        <Icon name="dumbbell" /><span className="grow"><strong>{t('Exercises')}</strong><small>{t('Browse the exercise library')}</small></span><Icon name="chevronRight" />
      </button>
    </div>
  </>
}
