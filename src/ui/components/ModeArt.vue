<script setup lang="ts">
import { computed } from 'vue';
import type { ModeId } from '@/session/ModeId';

/**
 * A small illustration of a mode, drawn from data: blocks on a 12 × 8 grid,
 * plus strokes and shapes. Colours are the piece tokens (both themes).
 */
const props = defineProps<{ mode: ModeId }>();

type Shape =
  | {
      readonly kind: 'blocks';
      readonly tone: number;
      readonly cells: readonly (readonly [number, number])[];
    }
  | { readonly kind: 'path'; readonly d: string; readonly tone?: number; readonly dashed?: boolean }
  | {
      readonly kind: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    };

const row = (y: number, from: number, to: number, skip: readonly number[] = []) =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, y] as const).filter(
    ([x]) => !skip.includes(x),
  );

const STACK: Shape[] = [
  { kind: 'blocks', tone: 1, cells: row(7, 2, 9, [6]) },
  { kind: 'blocks', tone: 2, cells: row(6, 2, 5) },
  { kind: 'blocks', tone: 5, cells: row(6, 7, 9) },
];

const ART: Readonly<Record<ModeId, readonly Shape[]>> = {
  classic: [
    ...STACK,
    {
      kind: 'blocks',
      tone: 3,
      cells: [
        [6, 3],
        [5, 4],
        [6, 4],
        [7, 4],
      ],
    },
  ],
  tide: [
    { kind: 'blocks', tone: 2, cells: row(7, 2, 9) },
    { kind: 'blocks', tone: 7, cells: row(6, 2, 8) },
    { kind: 'path', d: 'M10 46 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0', tone: 13 },
    {
      kind: 'blocks',
      tone: 4,
      cells: [
        [5, 2],
        [6, 2],
        [6, 3],
        [7, 3],
      ],
    },
  ],
  flip: [...STACK, { kind: 'path', d: 'M60 8 v26 M53 15 l7 -7 7 7 M53 27 l7 7 7 -7', tone: 3 }],
  chroma: [
    { kind: 'blocks', tone: 9, cells: row(7, 2, 9) },
    { kind: 'blocks', tone: 10, cells: row(6, 2, 7) },
    {
      kind: 'blocks',
      tone: 11,
      cells: [
        [4, 3],
        [5, 3],
        [5, 4],
        [6, 4],
      ],
    },
  ],
  mirror: [
    {
      kind: 'blocks',
      tone: 1,
      cells: [
        [2, 7],
        [3, 7],
        [3, 6],
        [8, 7],
        [9, 7],
        [8, 6],
      ],
    },
    {
      kind: 'blocks',
      tone: 6,
      cells: [
        [4, 7],
        [7, 7],
      ],
    },
    { kind: 'path', d: 'M60 6 v58', tone: 3, dashed: true },
  ],
  fusion: [
    {
      kind: 'blocks',
      tone: 5,
      cells: [
        [3, 7],
        [4, 7],
        [4, 6],
        [5, 6],
        [5, 5],
        [6, 5],
      ],
    },
    { kind: 'blocks', tone: 1, cells: row(7, 6, 9) },
    { kind: 'path', d: 'M37 54 L47 50 L57 46', tone: 3 },
  ],
  tilt: [
    { kind: 'path', d: 'M30 10 L86 18 L78 70 L22 62 Z', tone: 12 },
    { kind: 'blocks', tone: 7, cells: row(6, 3, 7) },
    { kind: 'blocks', tone: 4, cells: row(7, 3, 8) },
  ],
  silhouette: [
    { kind: 'path', d: 'M30 70 V40 H50 V20 H70 V40 H90 V70 Z', tone: 3, dashed: true },
    { kind: 'blocks', tone: 2, cells: row(7, 3, 8) },
    {
      kind: 'blocks',
      tone: 6,
      cells: [
        [5, 6],
        [6, 6],
      ],
    },
  ],
  rhythm: [...STACK, { kind: 'path', d: 'M14 12 v14 M26 16 v10 M38 12 v14 M50 16 v10', tone: 4 }],
  duel: [
    {
      kind: 'blocks',
      tone: 1,
      cells: [
        [1, 7],
        [2, 7],
        [3, 7],
        [4, 7],
        [2, 6],
        [3, 6],
      ],
    },
    {
      kind: 'blocks',
      tone: 12,
      cells: [
        [7, 7],
        [8, 7],
        [10, 7],
        [7, 6],
        [9, 6],
        [10, 6],
      ],
    },
    { kind: 'path', d: 'M60 8 v58', tone: 12, dashed: true },
    { kind: 'path', d: 'M44 20 l14 0 m-5 -5 l5 5 -5 5', tone: 3 },
  ],
  mosaic: [
    {
      kind: 'blocks',
      tone: 2,
      cells: [
        [3, 2],
        [4, 2],
        [3, 3],
      ],
    },
    {
      kind: 'blocks',
      tone: 5,
      cells: [
        [6, 3],
        [7, 3],
        [6, 4],
        [7, 4],
      ],
    },
    { kind: 'blocks', tone: 1, cells: row(5, 3, 8, [5]) },
    {
      kind: 'blocks',
      tone: 3,
      cells: [
        [4, 6],
        [8, 6],
        [8, 4],
      ],
    },
  ],
  sand: [
    { kind: 'path', d: 'M12 70 Q30 50 48 62 T84 56 T110 70 Z', tone: 9 },
    { kind: 'path', d: 'M12 70 Q36 62 60 68 T110 66', tone: 13 },
    {
      kind: 'blocks',
      tone: 14,
      cells: [
        [6, 2],
        [7, 2],
        [6, 3],
      ],
    },
  ],
  tower: [
    { kind: 'ellipse', cx: 60, cy: 14, rx: 26, ry: 6 },
    { kind: 'ellipse', cx: 60, cy: 66, rx: 26, ry: 6 },
    { kind: 'path', d: 'M34 14 V66 M86 14 V66', tone: 12 },
    {
      kind: 'blocks',
      tone: 13,
      cells: [
        [5, 6],
        [6, 6],
        [5, 5],
      ],
    },
    {
      kind: 'blocks',
      tone: 4,
      cells: [
        [4, 6],
        [7, 6],
      ],
    },
  ],
};

const CELL = 10;
const shapes = computed(() => ART[props.mode]);
const tone = (n: number | undefined) => `var(--tone-${n ?? 12})`;
</script>

<template>
  <svg class="art" viewBox="0 0 120 80" aria-hidden="true">
    <template v-for="(shape, i) in shapes" :key="i">
      <g v-if="shape.kind === 'blocks'" :style="{ fill: tone(shape.tone) }">
        <rect
          v-for="[x, y] in shape.cells"
          :key="`${x}-${y}`"
          :x="x * CELL + 1"
          :y="y * CELL - 9"
          :width="CELL - 2"
          :height="CELL - 2"
          rx="1.5"
        />
      </g>
      <path
        v-else-if="shape.kind === 'path'"
        :d="shape.d"
        class="art__stroke"
        :class="{ 'art__stroke--dashed': shape.dashed }"
        :style="{ stroke: tone(shape.tone) }"
      />
      <ellipse
        v-else
        class="art__stroke"
        :cx="shape.cx"
        :cy="shape.cy"
        :rx="shape.rx"
        :ry="shape.ry"
        :style="{ stroke: tone(12) }"
      />
    </template>
  </svg>
</template>

<style scoped>
.art {
  display: block;
  inline-size: 100%;
  block-size: auto;
}

.art__stroke {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.art__stroke--dashed {
  stroke-dasharray: 4 4;
}
</style>
