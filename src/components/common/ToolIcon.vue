<script setup lang="ts">
/**
 * Line-art icon set for the photo viewer edit tools.
 * PrimeIcons has no distinct glyph for flip / crop / move-to-folder,
 * so these are drawn inline to keep every tool visually unambiguous.
 */
defineProps<{
  name: 'undo' | 'flip' | 'crop' | 'rotate' | 'move' | 'delete'
  size?: number
}>()
</script>

<template>
  <svg
    class="tool-icon"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Undo: arrow turning back to the left -->
    <template v-if="name === 'undo'">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H10" />
    </template>

    <!-- Flip horizontal: mirrored panels around a dashed axis -->
    <template v-else-if="name === 'flip'">
      <path d="M8.5 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h3" />
      <path d="M15.5 4h3A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M12 2.5v2.5" />
      <path d="M12 8.5v2.5" />
      <path d="M12 14.5v2.5" />
      <path d="M12 20.5v1" />
    </template>

    <!-- Crop: two overlapping crop marks -->
    <template v-else-if="name === 'crop'">
      <path d="M6.5 2.5v13.5a1.5 1.5 0 0 0 1.5 1.5h13.5" />
      <path d="M17.5 21.5V8a1.5 1.5 0 0 0-1.5-1.5H2.5" />
    </template>

    <!-- Rotate clockwise: full circular arrow -->
    <template v-else-if="name === 'rotate'">
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path d="M20.5 3.5V9H15" />
    </template>

    <!-- Move: arrow going into a folder -->
    <template v-else-if="name === 'move'">
      <path d="M4 9.5V6a1.5 1.5 0 0 1 1.5-1.5h3.2a1 1 0 0 1 .8.4l1.2 1.6H18a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 18 19.5H5.5A1.5 1.5 0 0 1 4 18v-3.5" />
      <path d="M2.5 12h7" />
      <path d="m6.5 9 3 3-3 3" />
    </template>

    <!-- Delete: trash can -->
    <template v-else>
      <path d="M3.5 6.5h17" />
      <path d="M9 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M18.5 6.5l-.8 12.2a1.8 1.8 0 0 1-1.8 1.8H8.1a1.8 1.8 0 0 1-1.8-1.8L5.5 6.5" />
      <path d="M10.2 10.8v6" />
      <path d="M13.8 10.8v6" />
    </template>
  </svg>
</template>

<style scoped>
.tool-icon {
  display: block;
  flex-shrink: 0;
}
</style>
