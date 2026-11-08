<template>
  <q-layout view="hHh lpR fFf" class="q-safe-area bg-gray-100">
    <!-- Shared language and route navigation. -->
    <HeaderComponent
      brand-title="DynaShop"
      :first-name="auth.userDetails?.firstname"
      :last-name="auth.userDetails?.lastname"
      @profile="goToProfile"
      @logout="logout"
    >
      <template #toolbar>
        <div v-if="auth.user && showInactivityWarning(auth.inactivityRemaining)" class="session-countdown" role="status">
          <q-icon name="schedule" size="16px" aria-hidden="true" />
          <span>{{ $t('inactivityCountdown', { time: inactivityTime }) }}</span>
        </div>
        <div class="quick-actions-bar bg-blue-grey-9 px-3 py-2">
          <div class="quick-actions flex items-center justify-center gap-2">
            <q-btn-dropdown
              no-caps
              unelevated
              dropdown-icon="expand_more"
              aria-label="Select language"
              class="quick-action-button rounded-xl border border-blue-grey-7 bg-blue-grey-8 text-white transition hover:bg-blue-grey-7"
              content-class="quick-action-menu rounded-xl border border-blue-grey-7 bg-blue-grey-9 text-white shadow-xl"
              menu-anchor="bottom middle"
              menu-self="top middle"
            >
              <template #label>
                <span class="flex items-center gap-1.5 px-1 text-xs font-bold tracking-wide">
                  <q-icon name="language" size="18px" class="text-light-green-14" />
                  {{ currentLanguage }}
                </span>
              </template>
              <q-list class="min-w-36 bg-blue-grey-9 p-1 text-white">
                <q-item
                  v-for="language in languages"
                  :key="language.code"
                  clickable
                  v-close-popup
                  class="min-h-11 rounded-lg text-white hover:bg-blue-grey-8"
                  :active="locale === language.code"
                  active-class="bg-blue-grey-7 text-white"
                  @click="setLanguage(language.code)"
                >
                  <q-item-section>{{ language.label }}</q-item-section>
                  <q-item-section v-if="locale === language.code" side>
                    <q-icon name="check" color="light-green-14" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>

            <q-btn-dropdown
              no-caps
              unelevated
              dropdown-icon="expand_more"
              aria-label="Open navigation menu"
              class="quick-action-button rounded-xl border border-blue-grey-7 bg-blue-grey-8 text-white transition hover:bg-blue-grey-7"
              content-class="quick-action-menu rounded-xl border border-blue-grey-7 bg-blue-grey-9 text-white shadow-xl"
              menu-anchor="bottom middle"
              menu-self="top middle"
            >
              <template #label>
                <span class="flex items-center gap-1.5 px-1 text-xs font-semibold">
                  <q-icon name="apps" size="18px" class="text-light-green-14" />
                  <span class="hidden sm:inline">Menu</span>
                </span>
              </template>
              <q-list class="min-w-48 bg-blue-grey-9 p-1 text-white">
                <q-item class="min-h-10 rounded-lg border-b border-blue-grey-7">
                  <q-item-section class="text-sm font-semibold tracking-wide text-light-green-14">
                    Menu
                  </q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  class="min-h-11 rounded-lg text-white hover:bg-blue-grey-8"
                  :active="activeTab === 'sales'"
                  active-class="bg-blue-grey-7 text-white"
                  @click="goToSales"
                >
                  <q-item-section avatar><q-icon name="storefront" /></q-item-section>
                  <q-item-section>{{ $t('fabSales') }}</q-item-section>
                  <q-item-section v-if="activeTab === 'sales'" side>
                    <q-icon name="check" color="light-green-14" />
                  </q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  class="min-h-11 rounded-lg text-white hover:bg-blue-grey-8"
                  :active="activeTab === 'reports'"
                  active-class="bg-blue-grey-7 text-white"
                  @click="goToReports"
                >
                  <q-item-section avatar><q-icon name="fact_check" /></q-item-section>
                  <q-item-section>{{ $t('fabReports') }}</q-item-section>
                  <q-item-section v-if="activeTab === 'reports'" side>
                    <q-icon name="check" color="light-green-14" />
                  </q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  class="min-h-11 rounded-lg text-white hover:bg-blue-grey-8"
                  :active="activeTab === 'admin'"
                  active-class="bg-blue-grey-7 text-white"
                  @click="goToAdmin"
                >
                  <q-item-section avatar><q-icon name="outbound" /></q-item-section>
                  <q-item-section>Admin</q-item-section>
                  <q-item-section v-if="activeTab === 'admin'" side>
                    <q-icon name="check" color="light-green-14" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
        </div>
      </template>
    </HeaderComponent>

    <!-- Page Content -->
    <q-page-container class="app-page-container bg-gray-100">
      <transition name="fade" mode="out-in">
        <router-view />
      </transition>
    </q-page-container>
    <FooterComponent :page-title="pageTitle" :brand-slogan="$t('slogan')" @logout="logout" />
  </q-layout>
</template>

<script setup>
// Shared navigation, localization, and session-management dependencies.
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from 'stores/auth'
import { useRouter } from 'vue-router'
import { Loading, Notify } from 'quasar'
import HeaderComponent from 'components/HeaderComponent.vue'
import FooterComponent from 'components/FooterComponent.vue'
import { showInactivityWarning } from 'src/utils/inactivity'
//const isAdmin = computed(() => ['Admin', 'SuperAdmin'].includes(auth.userDetails?.role))
// Current route, user session, language, and navigation state.
const auth = useAuth()
import { useRoute } from 'vue-router'
const router = useRouter()
const route = useRoute()
const { t: $t } = useI18n()
const { locale } = useI18n()
const languages = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]

const pageTitle = computed(() => {
  switch (route.name) {
    case 'home':
      return $t('home')
    case 'sales':
      return $t('salesPage')
    case 'reports':
      return $t('reportsPage')
    case 'stock':
      return $t('stock')
    case 'profile':
      return $t('profile')
    default:
      return route.name || ''
  }
})
// Compute the current page title
//const pageTitle = computed(() => pageTitles[route.name] || route.name || '')
// Route actions for the shared header controls.
const goToProfile = () => router.push('/manage-profile')
const setLanguage = (language) => {
  locale.value = language
  localStorage.setItem('lang', language)
}

// Computed label for display
const currentLanguage = computed(() => (locale.value === 'fr' ? 'FR' : 'EN'))
const inactivityTime = computed(() => {
  const seconds = auth.inactivityRemaining
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
const logout = async () => {
  try {
    await auth.logout()
    await router.replace({ name: 'Login' })
  } catch (error) {
    console.error('Logout failed:', error)
    Notify.create({ type: 'negative', message: $t('sessionLogoutFailed') })
  }
}
const activeTab = ref('sales')
const goToSales = async () => {
  activeTab.value = 'sales'

  Loading.show({
    message: 'Loading...',
    backgroundColor: 'rgba(0,0,0,0.4)',
  })
  Loading.show({
    spinnerColor: 'light-green-14',
    message: 'Loading...',
  })

  await router.push({ name: 'Home' })

  setTimeout(() => {
    Loading.hide()
  }, 300) // slight delay for smooth feel
}
const goToReports = async () => {
  activeTab.value = 'reports'

  Loading.show({
    message: 'Loading...',
    backgroundColor: 'rgba(0,0,0,0.4)',
  })
  Loading.show({
    spinnerColor: 'light-green-14',
    message: 'Loading...',
  })

  try {
    await router.push({ name: 'reports' })
  } finally {
    setTimeout(() => {
      Loading.hide()
    }, 300)
  }
}

const goToAdmin = async () => {
  activeTab.value = 'admin'

  Loading.show({
    message: 'Loading...',
    backgroundColor: 'rgba(0,0,0,0.4)',
  })
  Loading.show({
    spinnerColor: 'light-green-14',
    message: 'Loading...',
  })

  try {
    await router.push({ name: 'admin' })
  } finally {
    setTimeout(() => {
      Loading.hide()
    }, 300)
  }
}

</script>
<style scoped>
.session-countdown {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem max(0.75rem, env(safe-area-inset-right, 0px)) 0.4rem max(0.75rem, env(safe-area-inset-left, 0px));
  background: #fff3cd;
  color: #5c3c00;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
}

.app-page-container {
  min-height: 100dvh;
}

.quick-actions-bar {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 3.5rem;
  box-sizing: border-box;
  padding-right: max(0.75rem, env(safe-area-inset-right, 0px));
  padding-left: max(0.75rem, env(safe-area-inset-left, 0px));
  border-top: 1px solid rgb(255 255 255 / 10%);
  box-shadow: 0 2px 8px rgb(15 23 42 / 10%);
}

.quick-actions {
  width: 100%;
  justify-content: center;
}

.quick-action-button {
  min-height: 44px;
}

.quick-action-menu {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

:global(.q-menu.quick-action-menu) {
  z-index: 7000 !important;
  overflow: visible;
}

.fab-action-uniform {
  min-width: 120px; /* ensures all FAB actions have the same width */
  justify-content: flex-start; /* aligns icon and label nicely */
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
