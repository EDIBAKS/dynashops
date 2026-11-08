import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityStorageKey, createInactivityTracker, showInactivityWarning } from './inactivity.js'

test('warning appears only during the final minute and stays visible on expiry', () => {
  assert.equal(showInactivityWarning(600), false)
  assert.equal(showInactivityWarning(61), false)
  assert.equal(showInactivityWarning(60), true)
  assert.equal(showInactivityWarning(1), true)
  assert.equal(showInactivityWarning(0), true)
})

function setup(initialTime = 100000) {
  let time = initialTime
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  }
  const seconds = []
  let expirations = 0
  const options = {
    userId: 'user-a',
    limit: 600000,
    storage,
    now: () => time,
    onTick: (value) => seconds.push(value),
    onExpire: () => { expirations += 1 },
    onError: (error) => { throw error },
  }
  return {
    storage, options, seconds,
    setTime: (value) => { time = value },
    expirations: () => expirations,
  }
}

test('activity resets the countdown and it expires only after the new deadline', async () => {
  const ctx = setup()
  const tracker = createInactivityTracker(ctx.options)
  tracker.tick()
  assert.equal(ctx.seconds.at(-1), 600)
  ctx.setTime(699999)
  tracker.activity()
  assert.equal(ctx.seconds.at(-1), 600)
  ctx.setTime(1299998)
  tracker.tick()
  assert.equal(ctx.seconds.at(-1), 1)
  assert.equal(ctx.expirations(), 0)
  ctx.setTime(1299999)
  tracker.tick()
  tracker.tick()
  await Promise.resolve()
  assert.equal(ctx.expirations(), 1)
})

test('reloads and interruptions retain the deadline, rather than resetting it', async () => {
  const ctx = setup()
  createInactivityTracker(ctx.options).stop()
  ctx.setTime(400000)
  const restored = createInactivityTracker(ctx.options)
  restored.tick()
  assert.equal(ctx.seconds.at(-1), 300)
  ctx.setTime(700000)
  restored.activity()
  await Promise.resolve()
  assert.equal(ctx.seconds.at(-1), 0)
  assert.equal(ctx.expirations(), 1)
})

test('activity in another tab extends the shared deadline for the same user', async () => {
  const ctx = setup()
  const first = createInactivityTracker(ctx.options)
  const second = createInactivityTracker(ctx.options)
  ctx.setTime(600000)
  second.activity()
  ctx.setTime(700000)
  first.tick()
  await Promise.resolve()
  assert.equal(ctx.seconds.at(-1), 500)
  assert.equal(ctx.expirations(), 0)
})

test('a different account does not inherit an earlier inactivity deadline', () => {
  const ctx = setup()
  ctx.storage.setItem(activityStorageKey, JSON.stringify({ userId: 'other', at: 1 }))
  const tracker = createInactivityTracker(ctx.options)
  tracker.tick()
  assert.equal(ctx.seconds.at(-1), 600)
})

test('a stopped tracker cannot sign out a later session', async () => {
  const ctx = setup()
  const tracker = createInactivityTracker(ctx.options)
  ctx.setTime(700000)
  tracker.tick()
  tracker.stop()
  await Promise.resolve()
  assert.equal(ctx.expirations(), 0)
})

test('failed automatic logout is reported and retried without resetting the deadline', async () => {
  const ctx = setup()
  let errors = 0
  let attempts = 0
  ctx.options.onExpire = () => { attempts += 1; return Promise.reject(new Error('offline')) }
  ctx.options.onError = () => { errors += 1 }
  const tracker = createInactivityTracker(ctx.options)
  ctx.setTime(700000)
  tracker.tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(errors, 1)
  tracker.activity()
  assert.equal(ctx.seconds.at(-1), 0)
  assert.equal(attempts, 1)
  ctx.setTime(730000)
  tracker.tick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(attempts, 2)
})
