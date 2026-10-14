<script setup lang="ts">
/**
 * The title screen's living scene (decorative): a well of gems torn in two by
 * the rift, a piece dropping in, shards escaping the crack. One SVG, so it
 * scales to any frame; colours are the piece tokens; motion stops with
 * reduced motion (the global rule ends each animation on its last frame).
 */
const CELL = 48;
/** Columns of the stack, bottom up: tone per row (0 = empty). */
const LEFT: readonly (readonly number[])[] = [
  [1, 5, 2, 3],
  [7, 4, 3, 5],
  [3, 1, 2],
  [5, 3],
];
const RIGHT: readonly (readonly number[])[] = [
  [5, 3, 4],
  [3, 7, 1, 4],
  [4, 1, 5, 4],
];
const BASE = 560;

interface Gem {
  readonly x: number;
  readonly y: number;
  readonly tone: number;
}

const column = (columns: readonly (readonly number[])[], left: number, lift: number): Gem[] =>
  columns.flatMap((tones, c) =>
    tones.map((tone, r) => ({ x: left + c * CELL, y: BASE - (r + 1) * CELL - lift, tone })),
  );

const gems: readonly Gem[] = [...column(LEFT, 66, 0), ...column(RIGHT, 274, 8)];
const piece: readonly Gem[] = [
  { x: 226, y: 232, tone: 1 },
  { x: 274, y: 232, tone: 1 },
  { x: 274, y: 184, tone: 1 },
  { x: 322, y: 232, tone: 1 },
];
const SHARD_TONES = [2, 5, 1, 4, 3, 7] as const;
const shards = Array.from({ length: 9 }, (_, i) => ({
  x: 196 + ((i * 47) % 130),
  y: 250 + ((i * 61) % 170),
  size: 7 + (i % 3) * 4,
  tone: SHARD_TONES[i % SHARD_TONES.length]!,
  delay: -(i * 0.7),
  turn: (i * 53) % 360,
}));
const RIFT = 'M262 318 L244 382 L272 432 L248 494 L268 540 L256 600';
</script>

<template>
  <svg class="scene" viewBox="0 0 520 600" aria-hidden="true" focusable="false">
    <defs>
      <!-- Light and shadow of a gem, laid over its colour (colour-free). -->
      <g id="gem-shade">
        <path d="M0 0H44V6H6V44H0Z" fill="#fff" fill-opacity="0.3" />
        <path d="M44 0V44H0V38H38V0Z" fill="#000" fill-opacity="0.3" />
        <rect x="9" y="8" width="13" height="5" rx="2.5" fill="#fff" fill-opacity="0.55" />
      </g>
      <clipPath id="gem-clip"><rect width="44" height="44" rx="8" /></clipPath>
      <radialGradient id="rift-light" cx="50%" cy="60%" r="50%">
        <stop offset="0" stop-color="var(--rift-glow)" stop-opacity="0.45" />
        <stop offset="1" stop-color="var(--rift-glow)" stop-opacity="0" />
      </radialGradient>
    </defs>

    <ellipse cx="262" cy="420" rx="170" ry="260" fill="url(#rift-light)" />
    <rect x="50" y="20" width="420" height="560" rx="22" class="scene__well" />

    <g class="scene__drop">
      <g
        v-for="(gem, i) in piece"
        :key="`p${i}`"
        :transform="`translate(${gem.x} ${gem.y})`"
        clip-path="url(#gem-clip)"
      >
        <rect width="44" height="44" :fill="`var(--tone-${gem.tone})`" />
        <use href="#gem-shade" />
      </g>
    </g>

    <g
      v-for="(gem, i) in gems"
      :key="i"
      :transform="`translate(${gem.x} ${gem.y})`"
      clip-path="url(#gem-clip)"
    >
      <rect width="44" height="44" :fill="`var(--tone-${gem.tone})`" />
      <use href="#gem-shade" />
    </g>

    <g class="scene__rift">
      <path :d="RIFT" class="scene__rift-glow" />
      <path :d="RIFT" class="scene__rift-halo" />
      <path :d="RIFT" class="scene__rift-core" />
    </g>

    <path
      v-for="(shard, i) in shards"
      :key="`s${i}`"
      class="scene__shard"
      :d="`M0 ${-shard.size}L${shard.size} ${shard.size}L${-shard.size} ${shard.size * 0.4}Z`"
      :fill="`var(--tone-${shard.tone})`"
      :style="{
        '--x': `${shard.x}px`,
        '--y': `${shard.y}px`,
        '--turn': `${shard.turn}deg`,
        animationDelay: `${shard.delay}s`,
      }"
    />
  </svg>
</template>

<style scoped>
.scene {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.scene__well {
  fill: color-mix(in srgb, var(--surface) 55%, transparent);
  stroke: var(--well-frame);
  stroke-width: 2;
}

.scene__drop {
  animation: drop 3.2s cubic-bezier(0.55, 0, 0.7, 0.2) infinite;
}

.scene__rift {
  animation: pulse 2.4s ease-in-out infinite;
}

.scene__rift path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.scene__rift-glow {
  stroke: var(--rift-glow);
  stroke-width: 26;
  stroke-opacity: 0.2;
}

.scene__rift-halo {
  stroke: var(--accent);
  stroke-width: 10;
  stroke-opacity: 0.55;
}

.scene__rift-core {
  stroke: var(--rift-core);
  stroke-width: 3.5;
}

.scene__shard {
  transform: translate(var(--x), var(--y)) rotate(var(--turn));
  animation: float 6s ease-in-out infinite;
}

@keyframes drop {
  0% {
    transform: translateY(-140px);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  70%,
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pulse {
  50% {
    opacity: 0.8;
  }
}

@keyframes float {
  50% {
    transform: translate(var(--x), calc(var(--y) - 16px)) rotate(calc(var(--turn) + 30deg));
  }
}

:global(:root[data-motion='still']) .scene * {
  animation: none;
}
</style>
