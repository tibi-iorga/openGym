import { MOBILE, isAndroid, readJsonFile, writeJsonFile } from './mobile.js'
import { importStepDays } from './steps.js'

const FILE = 'opengym-steps.json'
let settingsPromise
let pluginPromise
let running
let generation = 0
let contextKey = null
let lastRead = 0
let getContext = () => null
let applyDays = () => {}
let started = false
const listeners = new Set()
let state = { on: false, busy: false, error: null }

function publish(patch) {
  state = { ...state, ...patch }
  listeners.forEach(listener => listener())
}

export const stepsSnapshot = () => state
export function onStepsChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function settings() {
  settingsPromise ||= readJsonFile(FILE).then(file => file || {})
  return settingsPromise
}

async function saveSettings(value) {
  try {
    await writeJsonFile(FILE, value, { strict: true })
  } catch (error) {
    throw Object.assign(error, { code: 'storage' })
  }
  settingsPromise = Promise.resolve(value)
}

async function plugin() {
  if (!MOBILE || !(await isAndroid())) {
    return null
  }
  pluginPromise ||= import('@capacitor/core').then(({ registerPlugin }) => ({ HC: registerPlugin('HealthConnect') }))
  return pluginPromise
}

function sameContext(context) {
  const current = getContext()
  return current && context && current.owner === context.owner && current.resetAt === context.resetAt
}

export async function refreshSteps({ force = false } = {}) {
  if (!MOBILE) {
    return
  }
  const context = getContext()
  const key = context ? JSON.stringify([context.owner, context.resetAt]) : null
  const changed = key !== contextKey
  if (changed) {
    contextKey = key
    generation++
    lastRead = 0
    publish({ on: false, error: null })
  }
  if (running) {
    await running
    if (changed) {
      return refreshSteps({ force })
    }
    return
  }

  const version = generation
  running = (async () => {
    const saved = await settings()
    const enabled = !!context && saved.owner === context.owner && saved.resetAt === context.resetAt && saved.on
    publish({ on: !!enabled })
    if (!enabled || !sameContext(context)) {
      return
    }
    if (!force && lastRead && Date.now() - lastRead < 300000) {
      return
    }

    publish({ busy: true, error: null })
    try {
      const native = await plugin()
      if (!native) {
        throw Object.assign(new Error('Unavailable'), { code: 'unavailable' })
      }
      const result = await native.HC.readSteps()
      // No result may cross a sign-out, profile switch, reset or explicit stop.
      if (version !== generation || !sameContext(context)) {
        return
      }
      importStepDays({}, result) // Validate before calling the store's mutation path.
      applyDays(result)
      lastRead = Date.now()
    } catch (error) {
      if (version === generation && sameContext(context)) {
        publish({ error: error?.code === 'permission' ? 'permission' : 'failed' })
      }
    } finally {
      publish({ busy: false })
    }
  })().finally(() => { running = null })
  return running
}

export async function enableSteps() {
  const context = getContext()
  if (!context || state.busy) {
    return
  }
  const version = ++generation
  publish({ busy: true, error: null })
  try {
    const native = await plugin()
    if (!native) {
      throw new Error('Unavailable')
    }
    const result = await native.HC.requestStepsPermission()
    if (version !== generation || !sameContext(context)) {
      return
    }
    if (!result.granted) {
      publish({ error: 'permission' })
      return
    }
    await saveSettings({ owner: context.owner, resetAt: context.resetAt, on: true })
    publish({ on: true })
  } catch (error) {
    publish({ error: error?.code === 'storage' ? 'storage' : 'failed' })
  } finally {
    publish({ busy: false })
  }
  await refreshSteps({ force: true })
}

export async function disableSteps() {
  generation++
  // Invalidate first, then wait so an older file write cannot re-enable the reader.
  if (running) {
    await running
  }
  publish({ on: false, busy: false, error: null })
  settingsPromise = Promise.resolve({ on: false })
  try {
    await saveSettings({ on: false })
  } catch {
    publish({ error: 'storage' })
  }
}

export function initStepsSync(context, apply) {
  getContext = context
  applyDays = apply
  if (!MOBILE || started) {
    return
  }
  started = true
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        refreshSteps().catch(() => {})
      }
    })
  }).catch(() => {})
}
