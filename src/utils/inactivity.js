export const activityStorageKey = 'session-last-activity'

export function showInactivityWarning(remainingSeconds) {
  return remainingSeconds <= 60
}

export function createInactivityTracker({
  userId, limit, storage, now = Date.now, onTick, onExpire, onError,
}) {
  let lastActivity = 0
  let expiring = false
  let retryAt = 0
  let stopped = false

  function readSharedActivity() {
    try {
      const saved = JSON.parse(storage.getItem(activityStorageKey) || 'null')
      return saved?.userId === userId && Number.isFinite(saved.at) ? saved.at : 0
    } catch (error) {
      console.error('Unable to read session activity:', error)
      return 0
    }
  }

  function writeActivity(at) {
    storage.setItem(activityStorageKey, JSON.stringify({ userId, at }))
    lastActivity = at
  }

  function tick() {
    if (stopped) return
    const time = now()
    lastActivity = Math.max(lastActivity, readSharedActivity())
    const remaining = Math.max(0, lastActivity + limit - time)
    onTick(Math.ceil(remaining / 1000))
    if (remaining === 0 && !expiring && time >= retryAt) {
      expiring = true
      Promise.resolve()
        .then(() => { if (!stopped) return onExpire() })
        .catch((error) => {
          retryAt = now() + 30000
          onError(error)
        })
        .finally(() => { expiring = false })
    }
  }

  function activity() {
    if (stopped || expiring) return
    const time = now()
    lastActivity = Math.max(lastActivity, readSharedActivity())
    if (time >= lastActivity + limit) {
      tick()
      return
    }
    writeActivity(time)
    tick()
  }

  lastActivity = readSharedActivity()
  if (!lastActivity) writeActivity(now())
  return {
    tick,
    activity,
    stop() { stopped = true },
  }
}
