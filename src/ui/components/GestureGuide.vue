<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FamilyId } from '@/session/ModeId';
import { gestureRows, type GestureMark } from '../gestureGuide';
import AppIcon from './AppIcon.vue';
import GestureList from './GestureList.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The gesture guide (1.32): a phone drawn with the gestures where they play,
 * the two halves that turn each way, the drag, the flicks, numbered as the
 * list beside it names them, as the player set them (the touch settings). It
 * follows a game's family; outside a game, the falling well's.
 */
const props = defineProps<{ open: boolean; family: FamilyId | null }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings } = useServices();
const ids = { clip: useId(), left: useId(), right: useId() };
/** An arrowhead for each colour of arrow (a marker does not take its line's colour). */
const HEADS = ['gold', 'violet', 'lime'] as const;
type Head = (typeof HEADS)[number];
const headIds = Object.fromEntries(HEADS.map((head) => [head, useId()])) as Record<Head, string>;
const head = (colour: Head) => `url(#${headIds[colour]})`;

const rows = computed(() => gestureRows(props.family, settings.current));
/** Each gesture's number on the drawing, as in the list. */
const numbers = computed(
  () => new Map<GestureMark, number>(rows.value.map((row, index) => [row.mark, index + 1])),
);
const has = (mark: GestureMark) => numbers.value.has(mark);
const sides = computed(() => has('tapLeft'));

/** Where each gesture's number sits on the drawing. */
const BADGES: Readonly<Record<GestureMark, readonly [number, number]>> = {
  tapLeft: [70, 44],
  tapRight: [170, 44],
  tap: [144, 44],
  drag: [120, 164],
  softDrop: [140, 216],
  drop: [206, 194],
  hold: [34, 316],
  second: [150, 326],
  pair: [178, 326],
  turn: [178, 326],
};
const badges = computed(() =>
  rows.value.map(({ mark }, index) => ({ mark, number: index + 1, at: BADGES[mark] })),
);

/** The stack at the bottom of the drawn well: column, row (from the bottom), tone. */
const STACK: readonly (readonly [number, number, number])[] = [
  [0, 0, 1],
  [1, 0, 2],
  [2, 0, 2],
  [3, 0, 3],
  [5, 0, 4],
  [6, 0, 4],
  [7, 0, 5],
  [0, 1, 6],
  [1, 1, 6],
  [3, 1, 7],
  [6, 1, 1],
  [7, 1, 3],
];
const CELL = 11.5;
const stack = STACK.map(([column, row, tone]) => ({
  key: `${column}:${row}`,
  x: 74 + column * CELL,
  y: 294 - (row + 1) * CELL,
  tone: `var(--tone-${tone})`,
}));
</script>

<template>
  <ModalDialog
    class="guide"
    :open="open"
    :title="t('gestures.title')"
    closable
    wide
    @dismiss="emit('close')"
  >
    <svg class="guide__phone" viewBox="0 0 240 360" aria-hidden="true">
      <defs>
        <clipPath :id="ids.clip">
          <rect x="12" y="12" width="216" height="336" rx="22" />
        </clipPath>
        <marker
          v-for="colour in HEADS"
          :id="headIds[colour]"
          :key="colour"
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path :class="`guide__head guide__head--${colour}`" d="M0 0L10 5L0 10z" />
        </marker>
        <!-- Each half lit from its own edge, fading toward the middle. -->
        <linearGradient :id="ids.left">
          <stop offset="0" class="guide__glow guide__glow--left" />
          <stop offset="1" class="guide__glow guide__glow--left guide__glow--fade" />
        </linearGradient>
        <linearGradient :id="ids.right">
          <stop offset="0" class="guide__glow guide__glow--right guide__glow--fade" />
          <stop offset="1" class="guide__glow guide__glow--right" />
        </linearGradient>
      </defs>
      <rect class="guide__body" x="4" y="4" width="232" height="352" rx="28" />
      <g :clip-path="`url(#${ids.clip})`">
        <template v-if="sides">
          <rect x="12" y="12" width="108" height="336" :fill="`url(#${ids.left})`" />
          <rect x="120" y="12" width="108" height="336" :fill="`url(#${ids.right})`" />
          <line class="guide__divider" x1="120" y1="14" x2="120" y2="346" />
        </template>
      </g>
      <rect class="guide__well" x="74" y="66" width="92" height="228" rx="5" />
      <rect
        v-for="block in stack"
        :key="block.key"
        class="guide__block"
        :x="block.x"
        :y="block.y"
        :width="CELL - 1"
        :height="CELL - 1"
        rx="2"
        :style="{ fill: block.tone }"
      />
      <g class="guide__piece">
        <rect x="103" y="98" width="10.5" height="10.5" rx="2" />
        <rect x="114.5" y="98" width="10.5" height="10.5" rx="2" />
        <rect x="126" y="98" width="10.5" height="10.5" rx="2" />
        <rect x="114.5" y="109.5" width="10.5" height="10.5" rx="2" />
      </g>

      <g v-if="has('tapLeft')" class="guide__mark guide__mark--left">
        <AppIcon name="rotateCcw" :size="30" x="29" y="27" />
      </g>
      <g v-if="has('tapRight')" class="guide__mark">
        <AppIcon name="rotateCw" :size="30" x="181" y="27" />
      </g>
      <g v-if="has('tap')" class="guide__mark">
        <circle class="guide__ring" cx="120" cy="44" r="12" />
        <circle class="guide__finger" cx="120" cy="44" r="5.5" />
      </g>
      <g v-if="has('drag')" class="guide__mark">
        <line
          class="guide__stroke"
          x1="86"
          y1="180"
          x2="154"
          y2="180"
          :marker-start="head('gold')"
          :marker-end="head('gold')"
        />
        <path class="guide__ticks" d="M103 175v10M120 175v10M137 175v10" />
      </g>
      <g v-if="has('softDrop')" class="guide__mark guide__mark--soft">
        <line
          class="guide__stroke guide__stroke--dashed"
          x1="120"
          y1="204"
          x2="120"
          y2="254"
          :marker-end="head('lime')"
        />
      </g>
      <g v-if="has('drop')" class="guide__mark">
        <line
          class="guide__stroke guide__stroke--bold"
          x1="206"
          y1="210"
          x2="206"
          y2="296"
          :marker-end="head('gold')"
        />
      </g>
      <g v-if="has('hold')" class="guide__mark guide__mark--left">
        <line
          class="guide__stroke guide__stroke--bold"
          x1="34"
          y1="296"
          x2="34"
          y2="210"
          :marker-end="head('violet')"
        />
      </g>
      <g v-if="has('second')" class="guide__mark">
        <circle class="guide__finger" cx="100" cy="326" r="5" />
        <line class="guide__stroke" x1="84" y1="326" x2="93" y2="326" />
        <circle class="guide__ring" cx="128" cy="326" r="10" />
        <circle class="guide__finger" cx="128" cy="326" r="4.5" />
      </g>
      <g v-if="has('pair')" class="guide__mark">
        <circle class="guide__ring" cx="144" cy="326" r="10" />
        <circle class="guide__finger" cx="144" cy="326" r="4.5" />
        <circle class="guide__ring" cx="162" cy="326" r="10" />
        <circle class="guide__finger" cx="162" cy="326" r="4.5" />
      </g>
      <g v-if="has('turn')" class="guide__mark">
        <circle class="guide__finger" cx="142" cy="330" r="4.5" />
        <circle class="guide__finger" cx="162" cy="330" r="4.5" />
        <path
          class="guide__stroke"
          d="M136 318q16-10 32 0"
          :marker-start="head('gold')"
          :marker-end="head('gold')"
        />
      </g>

      <g v-for="badge in badges" :key="badge.mark" class="guide__badge">
        <circle :cx="badge.at[0]" :cy="badge.at[1]" r="8.5" />
        <text :x="badge.at[0]" :y="badge.at[1]">{{ badge.number }}</text>
      </g>
    </svg>

    <div class="guide__legend">
      <GestureList :rows="rows" numbered />
      <p class="sheet-note">{{ t('gestures.note') }}</p>
    </div>
  </ModalDialog>
</template>

<style scoped>
.guide__phone {
  justify-self: center;
  width: auto;
  height: min(30svh, 15rem);
  max-width: 100%;
}

.guide__legend {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.guide__body {
  fill: var(--well-bg);
  stroke: var(--border);
  stroke-width: 2;
}

/* The halves: left turns left (violet), right turns right (the rift's gold). */
.guide__glow--left {
  stop-color: var(--jewel-violet);
  stop-opacity: 0.3;
}

.guide__glow--right {
  stop-color: var(--accent);
  stop-opacity: 0.24;
}

.guide__glow--fade {
  stop-opacity: 0.04;
}

.guide__divider {
  stroke: var(--text-muted);
  stroke-width: 1.5;
  stroke-dasharray: 5 6;
}

.guide__well {
  fill: var(--surface);
  stroke: var(--well-frame);
  stroke-width: 2;
}

.guide__piece rect {
  fill: var(--jewel-violet);
}

.guide__mark {
  color: var(--accent-strong);
}

.guide__mark--left {
  color: var(--jewel-violet);
}

.guide__mark--soft {
  color: var(--jewel-lime);
}

.guide__stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
}

.guide__stroke--bold {
  stroke-width: 4;
}

.guide__stroke--dashed {
  stroke-dasharray: 2 6;
}

.guide__ticks {
  stroke: currentColor;
  stroke-width: 2;
}

.guide__head--gold {
  fill: var(--accent-strong);
}

.guide__head--violet {
  fill: var(--jewel-violet);
}

.guide__head--lime {
  fill: var(--jewel-lime);
}

.guide__finger {
  fill: var(--crack);
}

.guide__ring {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.guide__badge circle {
  fill: var(--accent-fill);
}

.guide__badge text {
  fill: var(--on-accent-fill);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  text-anchor: middle;
  dominant-baseline: central;
}

/* Wide or on its side: the phone beside the list. */
@media (orientation: landscape) {
  .guide[open] {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
  }

  .guide__phone {
    grid-row: 2 / span 2;
    height: min(62svh, 22rem);
  }
}
</style>
