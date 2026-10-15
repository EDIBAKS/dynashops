<template>
    <!-- Brand credit, page context, and the logout action. -->
  <q-footer elevated class="app-footer bg-blue-grey-10 text-white">
    <div class="footer-content row items-center justify-between">
      <div class="footer-brand">
        <div class="row items-center q-gutter-xs">
          <q-icon name="copyright" size="16px" class="text-white" />
          <div class="text-caption">
            <span class="text-light-green-14">Alvin</span>
            <span class="text-white">Concepts</span>
          </div>
        </div>
        <div v-if="brandSlogan" class="footer-slogan">{{ brandSlogan }}</div>
      </div>

      <div class="row min-w-0 items-center q-gutter-sm">
        <div class="footer-page-title ellipsis text-caption text-white">
          {{ pageTitle }}
        </div>
        <q-btn
          dense
          round
          flat
          color="white"
          icon="exit_to_app"
          aria-label="Log out"
          class="hover-scale"
          @click="$emit('logout')"
        />
      </div>
    </div>
  </q-footer>
</template>

<script setup>
// Footer copy is supplied by the parent layout; logout is emitted upward.
defineProps({
  pageTitle: {
    type: String,
    default: '',
  },
  brandSlogan: {
    type: String,
    default: '',
  },
})

defineEmits(['logout'])
</script>

<style scoped>
.app-footer {
  padding-bottom: env(safe-area-inset-bottom, 0px);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.footer-content {
  box-sizing: border-box;
  min-height: 62px;
  gap: 8px;
  padding: 6px 12px;
}

.footer-brand {
  min-width: 0;
}

.footer-slogan {
  max-width: min(54vw, 320px);
  overflow: hidden;
  color: #cbd5e1;
  font-size: 10px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-page-title {
  max-width: min(40vw, 240px);
}
</style>
