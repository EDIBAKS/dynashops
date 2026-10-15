<template>
    <!-- Brand identity and account actions for the application shell. -->
  <q-header elevated class="app-header border-b border-blue-grey-9 bg-blue-grey-9 text-white">
    <div
      class="mx-auto flex h-16 w-full max-w-screen-2xl box-border items-center justify-between gap-2 px-3 sm:px-5"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div
          v-if="!logoSrc"
          class="brand-mark flex h-9 w-9 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          <q-icon name="shopping_cart" color="light-green-14" size="30px" />
        </div>
        <img
          v-else
          :src="logoSrc"
          :alt="`${brandTitle} logo`"
          class="h-9 w-9 shrink-0 rounded-lg object-contain"
        />

        <div class="brand-copy min-w-0">
          <div class="brand-title truncate text-lg font-bold tracking-wide sm:text-xl">
            <template v-if="brandTitle.startsWith('Dyna')">
              <span class="text-light-green-14">Dyna</span>
              <span class="text-white">{{ brandTitle.slice(4) }}</span>
            </template>
            <span v-else>{{ brandTitle }}</span>
          </div>
          <div
            v-if="brandSubtitle"
            class="brand-subtitle truncate text-[10px] tracking-wide text-blue-grey-2 sm:text-xs"
          >
            {{ brandSubtitle }}
          </div>
        </div>
      </div>

      <q-btn-dropdown
        no-caps
        unelevated
        dense
        dropdown-icon="expand_more"
        aria-label="Open account options"
        class="account-dropdown shrink-0 rounded-xl border border-blue-grey-6 bg-blue-grey-9 px-1 text-white shadow-sm transition hover:bg-blue-grey-8"
        content-class="account-options-menu rounded-xl border border-slate-200 bg-white shadow-xl"
        menu-anchor="bottom right"
        menu-self="top right"
      >
        <template #label>
          <div class="flex items-center gap-1.5">
            <q-avatar size="28px" class="bg-blue-grey-7 text-xs font-bold text-white">
              {{ initials }}
            </q-avatar>
            <div class="hidden max-w-36 truncate text-xs font-semibold sm:block">
              {{ displayName || 'Account' }}
            </div>
          </div>
        </template>

        <q-list class="min-w-48 p-1">
          <q-item v-if="displayName" class="rounded-lg" dense>
            <q-item-section>
              <q-item-label class="font-semibold text-slate-800">{{ displayName }}</q-item-label>
              <q-item-label caption>{{ $t('online') }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator class="my-1" />
          <q-item clickable v-close-popup class="rounded-lg" @click="$emit('profile')">
            <q-item-section avatar><q-icon name="person" color="blue-grey-7" /></q-item-section>
            <q-item-section>{{ $t('manageProfile') }}</q-item-section>
          </q-item>
          <q-item clickable v-close-popup class="rounded-lg" @click="$emit('logout')">
            <q-item-section avatar><q-icon name="logout" color="negative" /></q-item-section>
            <q-item-section class="text-negative">{{ $t('logout') }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>
    <slot name="toolbar" />
  </q-header>
</template>

<script setup>
// Vue computed values format the signed-in user?s display name.
import { computed } from 'vue'

const props = defineProps({
  brandTitle: {
    type: String,
    default: 'DynaShop',
  },
  brandSubtitle: {
    type: String,
    default: '',
  },
  logoSrc: {
    type: String,
    default: '',
  },
  firstName: {
    type: String,
    default: '',
  },
  lastName: {
    type: String,
    default: '',
  },
})

defineEmits(['profile', 'logout'])

// Derive compact account labels from the supplied name fields.
const initials = computed(() => {
  const nameParts = [props.firstName, props.lastName].filter(Boolean)
  return nameParts.length
    ? nameParts
        .map((name) => name[0])
        .join('')
        .toUpperCase()
    : 'U'
})
const displayName = computed(() => [props.firstName, props.lastName].filter(Boolean).join(' '))
</script>

<style scoped>
.app-header {
  padding-top: env(safe-area-inset-top, 0px);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.account-options-menu {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.account-dropdown :deep(.q-btn-dropdown__arrow) {
  color: #cbd5e1;
  margin-left: 0;
}

.account-dropdown {
  min-height: 38px;
  max-height: 42px;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1;
}

.brand-title,
.brand-subtitle {
  display: block;
}

.brand-title {
  line-height: 1.15;
}

.brand-subtitle {
  margin-top: 2px;
  line-height: 1.1;
}
</style>
