<template>
    <!-- Currency controls expose formatted values to the wrapped content. -->
  <div class="currency-toggle-wrapper" :class="{ 'currency-toggle-wrapper--compact': compact }">
    <div class="currency-toolbar">
      <div class="currency-toolbar-main">
        <div class="currency-toggle" role="group" aria-label="Display currency">
          <button
            type="button"
            class="currency-option"
            :class="{ 'currency-option--active': currencyType === 'dollar' }"
            :aria-pressed="currencyType === 'dollar'"
            @click="currencyType = 'dollar'"
          >
            <q-icon name="attach_money" size="17px" />
            <span>Dollars</span>
          </button>
          <button
            type="button"
            class="currency-option"
            :class="{ 'currency-option--active': currencyType === 'local' }"
            :aria-pressed="currencyType === 'local'"
            @click="currencyType = 'local'"
          >
            <q-icon name="payments" size="17px" />
            <span>Local Currency</span>
          </button>
        </div>
        <div class="currency-toolbar-center">
          <slot name="toolbar-center" />
        </div>
        <div class="currency-toolbar-end">
          <slot name="toolbar-end" />
        </div>
      </div>
      <div v-if="$slots['toolbar-pagination']" class="currency-toolbar-pagination">
        <slot name="toolbar-pagination" />
      </div>
    </div>

    <slot :currencyType="currencyType" :convert="convert" :formatCurrency="formatCurrency"></slot>
  </div>
</template>

<script setup>
// The display currency is converted using the current sales exchange rate.
import { ref } from 'vue'
import { useSalesStore } from '../stores/salesStore'

defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
})

const store = useSalesStore()

// Track the selected display unit for the scoped content.
const currencyType = ref('dollar')

// Format an amount in dollars or its local-currency equivalent.
const formatCurrency = (amount, type = 'dollar') => {
  const num = parseFloat(amount) || 0

  if (type === 'local') {
    const rate = Number.parseFloat(store.headerData?.exchangeRate) || 1
    return `${(num * rate).toFixed(0)} FC`
  }
  return `${num.toFixed(0)} $`
}

const convert = (amount) => formatCurrency(amount, currencyType.value)
</script>

<style scoped>
.currency-toggle-wrapper {
  min-width: 0;
}

.currency-toolbar {
  display: grid;
  min-width: 0;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.currency-toggle-wrapper--compact .currency-toolbar {
  margin-top: 0.5rem;
}

.currency-toolbar-main {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
}

.currency-toggle {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #455a64;
  border-radius: 0.875rem;
  background: #263238;
  padding: 0.25rem;
}

.currency-toolbar-end {
  min-width: 0;
}

.currency-toolbar-center {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.currency-toolbar-pagination {
  min-width: 0;
}

.currency-option {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  padding: 0.5rem 0.75rem;
  color: #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background-color 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.currency-option:hover {
  background: #37474f;
  color: #fff;
}

.currency-option--active {
  background: #455a64;
  color: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 20%);
}

.currency-option--active :deep(.q-icon) {
  color: #a5d6a7;
}

.currency-option:focus-visible {
  outline: 2px solid #a5d6a7;
  outline-offset: 2px;
}

.currency-toggle-wrapper--compact .currency-toggle {
  gap: 0.125rem;
  border-radius: 0.75rem;
  padding: 0.1875rem;
}

.currency-toggle-wrapper--compact .currency-option {
  min-height: 2rem;
  gap: 0.25rem;
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
}

@media (max-width: 480px) {
  .currency-toolbar-main {
    gap: 0.25rem;
  }

  .currency-toggle {
    gap: 0;
    padding: 0.125rem;
  }

  .currency-option {
    gap: 0.125rem;
    padding: 0.375rem;
    font-size: 0.6875rem;
  }

  .currency-option :deep(.q-icon) {
    display: none;
  }
}

@media (max-width: 480px) {
  .currency-toggle-wrapper--compact .currency-option {
    min-height: 1.875rem;
    padding: 0.3125rem 0.375rem;
    font-size: 0.625rem;
  }
}

@media (max-width: 360px) {
  .currency-option {
    font-size: 0.625rem;
  }
}
</style>
