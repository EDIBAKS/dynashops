// src/boot/auth-guard.js
import { useAuth } from 'stores/auth'
import { boot } from 'quasar/wrappers'

export default boot(({ router }) => {
  const auth = useAuth()

  // Add global navigation guard
  router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const requiresGuest = to.matched.some((record) => record.meta.requiresGuest)

    // Restore session from localStorage if missing
    if (!auth.user) {
      auth.loadFromLocalStorage()
    }

    // 🕒 Check for inactivity timeout
    const lastActivity = localStorage.getItem('last-activity')
    const limit = auth.inactivityLimit || 3 * 60 * 1000 // fallback 3 minutes
    const now = Date.now()

    if (auth.user && lastActivity && now - lastActivity > limit) {
      console.log('⏰ Session expired due to inactivity.')
      await auth.logout(true)
      return next('/') // redirect to login
    }

    // Update last activity timestamp
    localStorage.setItem('last-activity', now.toString())

    // Route access logic
    if (requiresAuth && !auth.user) {
      return next('/') // redirect to login if not logged in
    } else if (requiresGuest && auth.user) {
      return next('/main') // redirect logged-in users away from login
    }

    next()
  })

  // 🔹 Reset last-activity timestamp whenever user interacts
  const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
  activityEvents.forEach((evt) => {
    window.addEventListener(evt, () => {
      localStorage.setItem('last-activity', Date.now().toString())
    })
  })
})
