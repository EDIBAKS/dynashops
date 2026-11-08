import { boot } from 'quasar/wrappers'
import { Notify } from 'quasar'
import { watch } from 'vue'
import { useAuth } from 'stores/auth'
import { supabase } from 'boot/supabase'
import { activityStorageKey, createInactivityTracker } from 'src/utils/inactivity'

export default boot(async ({ router, app }) => {
  const auth = useAuth()
  const t = (key) => app.config.globalProperties.$t(key)
  let tracker
  let interval
  const activityEvents = ['mousemove', 'pointerdown', 'click', 'keydown', 'input', 'change', 'scroll', 'wheel', 'touchstart']
  const onActivity = () => tracker?.activity()
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') tracker?.tick()
  }
  const onStorage = (event) => {
    if (event.key === activityStorageKey) tracker?.tick()
  }

  activityEvents.forEach((event) => window.addEventListener(event, onActivity, { passive: true, capture: true }))
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onVisibilityChange)

  watch(() => auth.user?.id, (id, previousId) => {
    tracker?.stop()
    clearInterval(interval)
    tracker = null
    if (!id) {
      if (previousId && router.currentRoute.value.matched.some((record) => record.meta.requiresAuth)) {
        void router.replace({ name: 'Login' })
      }
      return
    }

    tracker = createInactivityTracker({
      userId: id,
      limit: auth.inactivityLimit,
      storage: localStorage,
      onTick: (seconds) => { auth.inactivityRemaining = seconds },
      onExpire: () => auth.logout(true),
      onError: (error) => {
        console.error('Inactivity logout failed:', error)
        Notify.create({ type: 'negative', message: t('sessionLogoutFailed') })
      },
    })
    tracker.tick()
    interval = setInterval(() => tracker?.tick(), 1000)
  }, { flush: 'sync' })

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      queueMicrotask(() => auth.clearSession())
    }
  })

  try {
    await auth.fetchUser()
  } catch (error) {
    console.error('Session restore failed:', error)
    Notify.create({ type: 'negative', message: t('sessionRestoreFailed') })
  }

  router.beforeEach((to) => {
    if (to.matched.some((record) => record.meta.requiresAuth) && !auth.user) return { name: 'Login' }
    if (to.matched.some((record) => record.meta.requiresGuest) && auth.user) return { name: 'Home' }
  })
})
