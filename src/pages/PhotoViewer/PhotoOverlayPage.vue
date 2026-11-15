<script setup lang="ts">
import PhotoViewerPage from './PhotoViewerPage.vue'

/**
 * Child route of the Review page — /projects/:id/review/photo?slot=&photo=
 *
 * Renders the photo viewer as a fullscreen overlay teleported to <body>, so the
 * Review list stays mounted underneath and the .app-content scroll position is
 * never touched. PhotoViewerPage is reused as-is: it reads :id from the parent
 * route and ?slot= / ?photo= from the query, exactly like the triage route.
 */
</script>

<template>
  <Teleport to="body">
    <div class="photo-overlay">
      <PhotoViewerPage />
    </div>
  </Teleport>
</template>

<style scoped>
.photo-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: #000;
  overscroll-behavior: contain;
}
</style>
