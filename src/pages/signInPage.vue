<template>
  <q-page class="flex items-center justify-center bg-gray-100 px-3 py-6 sm:px-4">
    <div class="w-full max-w-md">
      <form
        class="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 sm:rounded-3xl"
        @submit.prevent="login"
      >
        <!-- Logo / Header -->
        <div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-7 text-center sm:py-9">
          <q-icon name="shopping_cart" class="text-light-green-14" size="52px" />
          <div class="text-h5 text-weight-bold q-mt-sm">
            <span class="text-light-green-14">Dyna</span><span class="text-white">Shop</span>
          </div>
        </div>

        <!-- Enter credentials and submit the sign-in request. -->
        <div class="space-y-4 px-5 py-6 sm:space-y-5 sm:px-8 sm:py-8">
          <div
            v-if="sessionExpired"
            role="alert"
            class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900"
          >
            <q-icon name="schedule" size="22px" class="mt-0.5 shrink-0 text-amber-600" />
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold">{{ $t('sessionExpiredTitle') }}</div>
              <div class="mt-0.5 text-sm leading-snug">{{ $t('sessionExpired') }}</div>
            </div>
            <button
              type="button"
              class="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-700 transition hover:bg-amber-100"
              aria-label="Dismiss"
              @click="sessionExpired = false"
            >
              <q-icon name="close" size="18px" />
            </button>
          </div>

          <div>
            <label for="login-email" class="mb-1.5 block text-sm font-semibold text-slate-700">
              {{ $t('email') }}
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              spellcheck="false"
              required
              :disabled="loading"
              class="block min-h-[3rem] w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-200 disabled:opacity-60"
            />
          </div>

          <div>
            <label for="login-password" class="mb-1.5 block text-sm font-semibold text-slate-700">
              {{ $t('password') }}
            </label>
            <input
              id="login-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              :disabled="loading"
              class="block min-h-[3rem] w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-200 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-[#37474f] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#263238] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-[#b0bec5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <q-spinner v-if="loading" size="20px" color="white" />
            <span>{{ $t('login') }}</span>
          </button>
        </div>
      </form>

      <div class="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-500">
        <q-icon name="copyright" size="18px" />
        <span class="font-semibold"><span class="text-light-green-14">Alvin</span>Concepts</span>
      </div>
    </div>
  </q-page>
</template>

<script setup>
// Authentication, routing, and notification dependencies.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from 'stores/auth'
import { useI18n } from 'vue-i18n'

// Set by auth.logout(true) when the user was signed out for inactivity; shown once
const sessionExpired = ref(sessionStorage.getItem('session-expired') === '1')
sessionStorage.removeItem('session-expired')

// Login form and one-time session-expiry state.
const router = useRouter()
const $q = useQuasar()
const auth = useAuth()
const { t: $t } = useI18n()
const email = ref('')
const password = ref('')
const loading = ref(false)
// Authenticate the user and report success or failure.
async function login() {
  loading.value = true
  try {
    await auth.login(email.value, password.value)

    $q.notify({
      type: 'positive',
      message: $t('loginSuccess'),
      position: 'top-right',
    })

    router.push('/main')
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message || $t('loginFailed'),
      position: 'top-right',
    })
  } finally {
    loading.value = false
  }
}
</script>
