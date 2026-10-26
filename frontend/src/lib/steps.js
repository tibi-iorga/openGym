// Daily Health Connect aggregates, never a sum of individual device/source records.
// Null means the provider had no data for that day; it is distinct from a measured zero.
export function importStepDays(previous = {}, result) {
  if (!Array.isArray(result?.days) || !Number.isFinite(result?.readAt) || typeof result?.zone !== 'string') {
    throw new Error('Invalid step response')
  }

  const next = { ...previous }
  for (const day of result.days) {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(day?.date) &&
      new Date(day.date + 'T12:00:00Z').toISOString().slice(0, 10) === day.date
    const validCount = day?.count === null || (Number.isSafeInteger(day?.count) && day.count >= 0)
    if (!validDate || !validCount) {
      throw new Error('Invalid step day')
    }

    next[day.date] = {
      count: day.count,
      zone: result.zone,
      readAt: result.readAt,
      _ts: Math.max(result.readAt, (previous[day.date]?._ts || 0) + 1),
    }
  }
  return next
}

export function stepDays(steps = {}) {
  return Object.entries(steps)
    .filter(([date, day]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && day &&
      (day.count === null || (Number.isSafeInteger(day.count) && day.count >= 0)))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, day]) => ({ date, ...day }))
}
