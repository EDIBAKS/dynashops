<template>
  <!-- Fades each page in on navigation -->
  <router-view v-slot="{ Component }">
    <transition name="page-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup>
import { onMounted } from 'vue'

// Fade out the launch loader from index.html once the app has mounted
onMounted(() => {
  const loader = document.getElementById('app-loader')
  if (!loader) return
  setTimeout(() => {
    loader.classList.add('hide')
    setTimeout(() => loader.remove(), 600)
  }, 400)
})
</script>

<style>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.25s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
