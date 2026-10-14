<script setup lang="ts">
/** Decorative line icons (24 × 24). The button that holds one carries the label. */
const PATHS = {
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  drop: 'M6 4l6 6 6-6M6 10l6 6 6-6M5 20h14',
  rotateCw: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  rotateCcw: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5',
  hold: 'M4 8h16v12H4zM8 4h8M12 11v6M9 14l3 3 3-3',
  pause: 'M8 5v14M16 5v14',
  flip: 'M7 20V4M4 7l3-3 3 3M17 4v16M14 17l3 3 3-3',
  settings: 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  close: 'M6 6l12 12M18 6L6 18',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v7h14v-7',
  play: 'M8 5l11 7-11 7z',
  back: 'M10 6l-6 6 6 6M4 12h16',
  restart: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5',
  bomb: 'M11 21a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM15.5 8.5L18 6M17 3l1 2M20 6l2-1M19 9l2 1',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  cube: 'M5 5h14v14H5z',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6',
  atelier:
    'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  check: 'M5 12l5 5L20 7',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9',
  feather: 'M20 4C11 4 6 9 6 18M6 18l-2 2M6 18c5 0 10-3 12-8M9 14h6',
  spyglass: 'M3 14l12-6 3 5-12 6zM15 8l4-2 2 4-4 2M8 16l-2 5M11 15l2 6',
  anchor: 'M12 7v14M8 10h8M5 14a7 7 0 0 0 14 0M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  prism: 'M12 3L3 19h18zM12 3v16M7 11l5 2 5-2',
  phoenix: 'M12 21c-4 0-6-3-6-6 0-4 3-5 3-9 2 2 3 4 3 6 0-3 2-6 4-8 0 4 4 6 4 11 0 3-3 6-8 6z',
  satchel: 'M5 9h14v11H5zM9 9V6a3 3 0 0 1 6 0v3M5 13h14',
  ember: 'M12 21a5 5 0 0 0 5-5c0-3-2-5-3-8-1 2-2 3-3 4-1-2-1-3-1-5-2 2-3 5-3 9a5 5 0 0 0 5 5z',
  metronome: 'M9 3h6l4 18H5zM12 17l5-11M8 17h8',
  rampart: 'M4 21V9l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2v12zM10 21v-5h4v5',
} as const;

export type IconName = keyof typeof PATHS;

defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    class="icon"
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
}
</style>
