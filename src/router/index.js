import { route } from 'quasar/wrappers'
import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'

// Create router instance outside default export
const Router = createRouter({
  history: createWebHistory(),
  routes,
})

// ✅ Export Router for stores and utilities
export { Router as router }

// ✅ Default export for Quasar boot wrapper
export default route(function () {
  return Router
})
