<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import type { Goal, GoalKind } from '@/campaign/Goals';
import type { Tone } from '@/core/Tone';
import { ELEMENT_TONES } from '@/families/sand/engine/Elements';
import { SandEffects } from '@/families/sand/fx/SandEffects';
import { SandSoundscape } from '@/families/sand/fx/SandSoundscape';
import { SandRenderer } from '@/families/sand/render/SandRenderer';
import { effectsProfile } from '@/fx/EffectsProfile';
import * as sounds from '@/fx/sounds';
import { TonePalette } from '@/render/TonePalette';
import type { ElementName } from '@/session/Elements';
import type { GameSession } from '@/session/GameSession';
import AppIcon from '@/ui/components/AppIcon.vue';
import CampaignGoal from '@/ui/components/CampaignGoal.vue';
import { useLandscape } from '@/ui/useOrientation';
import { DunesController, type DunesPreview } from '../DunesController';
import { DunesSession } from '../DunesSession';
import { sandViewOf } from '../DunesView';
import type { OfferedSand } from '../engine/DunesDealer';
import type { Aim } from '../engine/DunesGame';
import type { DunesGoal } from '../engine/DunesLevels';
import { DunesOverlay } from '../render/DunesOverlay';
import { paintPiece } from '../render/paintPiece';
import DunesHandPiece from './DunesHandPiece.vue';
import { useHandDrag } from './useHandDrag';

/**
 * The board of Dunes (1.37): the Sand's grains drawn by the Sand's renderer,
 * the hand of three under it (beside it in landscape), the swap, the level's
 * goal. Its parts name the areas of the game screen's grid, as the Mosaic's
 * do (goal, well, prompt, hand, jokers).
 */
const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  /** False while paused or over: input is ignored. */
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof DunesSession)) throw new Error('DunesStage needs a DunesSession');
const session: DunesSession = props.session;
const game = session.game;

const { t } = useI18n();
const format = useFormat();
const { theme, settings, audio, haptics, pixelRatio } = useServices();

/** Each element's name, by its tone. */
const NAME_OF: ReadonlyMap<Tone, ElementName> = new Map(
  (Object.entries(ELEMENT_TONES) as [ElementName, Tone][]).map(([name, tone]) => [tone, name]),
);
/** Dunes' goals in the campaign's words: its goal card is the campaign's. */
const AS_CAMPAIGN: Readonly<Record<DunesGoal['kind'], GoalKind>> = {
  regions: 'lines',
  score: 'score',
  wyrm: 'boss',
};

// --- Engine, controller, effects ---------------------------------------------

const controller = new DunesController(game, (command) => props.active && session.execute(command));
const overlay = new DunesOverlay();
const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const palette = shallowRef<TonePalette | null>(null);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const moving = computed(() => profile.value.motion && !reducedMotion);
let keyboardMode = false;

/** Where the player holds a piece now (dragged, or picked with the keys), when it fits there. */
const aimNow = (): Aim | null => {
  const preview = currentPreview();
  return preview?.valid ? preview : null;
};
const view = sandViewOf(game, aimNow);
const effects = new SandEffects(
  view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
const detachEffects = effects.attach(session);
// Big clears hold the game still a moment (1.41).
effects.holdTimeWith(props.clock);
const detachSounds = new SandSoundscape(audio, haptics).attach(session);

// --- Reactive mirror of the hand, the swaps and the goal -------------------------

interface HandSlot {
  readonly slot: number;
  readonly piece: OfferedSand | null;
  readonly fits: boolean;
}
const hand = shallowRef<readonly HandSlot[]>([]);
const selected = ref<number | null>(null);
const swaps = ref(game.swaps);
const level = shallowRef(game.level);
const goalValue = ref(0);
const opening = ref(game.hint !== null);
const dealing = ref(false);
const pieceSize = ref(72);

/** Reads the game: called after each event, and each frame for what the sand changes. */
const refresh = () => {
  const fitting = game.fitting();
  const next = game.hand.map((piece, slot) => ({ slot, piece, fits: fitting[slot] ?? false }));
  const changed = next.some((entry, i) => {
    const before = hand.value[i];
    return !before || entry.piece !== before.piece || entry.fits !== before.fits;
  });
  if (changed || next.length !== hand.value.length) hand.value = next;
  selected.value = controller.selected;
  swaps.value = game.swaps;
  if (level.value !== game.level) level.value = game.level;
  goalValue.value = game.goalValue;
  opening.value = game.hint !== null;
  dealing.value = game.dealing;
};
const detachRefresh = (['deal', 'place', 'swaps', 'goal', 'revive', 'state'] as const).map((type) =>
  session.onDunes(type, refresh),
);
const detachDeal = session.onDunes('deal', ({ reason }) =>
  audio.play(reason === 'swap' ? sounds.shuffle : sounds.deal),
);

const held = computed(() => hand.value.filter((entry) => entry.piece !== null));
const fittingCount = computed(() => held.value.filter((entry) => entry.fits).length);
/** One piece of several fits: it glows, the others say why they wait. */
const onlyOne = computed(() => fittingCount.value === 1 && held.value.length > 1);
const stuck = computed(() => held.value.length > 0 && fittingCount.value === 0);

/** The line over the hand, spoken: the danger of a hand. */
const status = computed(() => {
  if (session.state === 'over' || dealing.value) return '';
  if (stuck.value) return swaps.value > 0 ? t('dunes.stuck') : '';
  return onlyOne.value ? t('dunes.onlyOne') : '';
});

const elementOf = (piece: OfferedSand | null): ElementName | null =>
  piece ? (NAME_OF.get(piece.tone) ?? null) : null;

/** The tip beside the swap: the opening, the element in hand, how to earn a swap, the calm. */
const tip = computed(() => {
  if (opening.value) return t('dunes.tips.opening');
  const element = held.value.map((entry) => elementOf(entry.piece)).find((name) => name !== null);
  if (element) return t(`dunes.tips.${element}`);
  return swaps.value === 0 ? t('dunes.tips.earnSwap') : t('dunes.tips.calm');
});

const noteOf = (entry: HandSlot): string => {
  if (!entry.piece) return '';
  if (!entry.fits) return t('dunes.noRoom');
  if (onlyOne.value) return t('dunes.fits');
  const element = elementOf(entry.piece);
  return element ? t(`dunes.element.${element}`) : '';
};

const pieceLabel = (entry: HandSlot, index: number): string => {
  if (!entry.piece) return t('dunes.empty');
  const name = t('dunes.piece', { n: index + 1 });
  const size = entry.piece.shape.size;
  const element = elementOf(entry.piece);
  const what = element ? t(`dunes.element.${element}`) : t('dunes.cells', { n: size }, size);
  return entry.fits ? `${name}, ${what}` : `${name}, ${what}, ${t('dunes.stuckPiece')}`;
};

/** What each kind of goal asks, in words (the Wyrm's is the campaign's sentence). */
const GOAL_TEXT: Readonly<Record<DunesGoal['kind'], (target: number) => string>> = {
  regions: (n) => t('dunes.goal.regions', { n: format.number(n) }, n),
  score: (n) => t('dunes.goal.score', { n: format.number(n) }, n),
  wyrm: () => t('bosses.duneWorm.defeat'),
};

const goalCard = computed(() => {
  const { goal, number } = level.value;
  const campaignGoal: Goal = { kind: AS_CAMPAIGN[goal.kind], target: goal.target };
  return {
    label: t('dunes.level', { n: number }),
    text: GOAL_TEXT[goal.kind](goal.target),
    goal: campaignGoal,
  };
});

// --- Board ---------------------------------------------------------------------

const boardArea = ref<HTMLElement | null>(null);
const handArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ghostCanvas = ref<HTMLCanvasElement | null>(null);
const landscape = useLandscape();
let renderer: SandRenderer | null = null;
let cellCss = 30;
const ratio = () => pixelRatio();

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  // Minus the 2 px frame on each side.
  cellCss = renderer.layout(width - 4, height - 4, ratio());
});
/**
 * Three pieces must fit: side by side under the board in portrait, one above
 * the other beside it in landscape. The hand's room comes from the grid,
 * never from the pieces: no loop between the two.
 */
const handObserver = new ResizeObserver(([entry]) => {
  if (!entry) return;
  const { width, height } = entry.contentRect;
  const room = landscape.value ? Math.min(width - 8, (height - 2 * 8) / 3) : (width - 2 * 12) / 3;
  // A tall board (12 rows): the hand keeps less of a phone's height than the Mosaic's.
  const cap = landscape.value ? 120 : Math.min(120, window.innerHeight * 0.13);
  pieceSize.value = Math.round(Math.max(44, Math.min(cap, room)));
});

const refreshPalette = async () => {
  await nextTick();
  palette.value = TonePalette.fromElement(document.documentElement);
  renderer?.setPalette(palette.value);
};
watch(theme.resolved, refreshPalette);

const drag = useHandDrag({
  board: canvas,
  ghost: ghostCanvas,
  hand: handArea,
  cellCss: () => cellCss,
  pieceAt: (slot) => game.hand[slot] ?? null,
  previewAt: (slot, x, y) => controller.previewAt(slot, x, y),
  drop: (slot, x, y) => {
    controller.drop(slot, x, y);
    refresh();
  },
  select: (slot) => {
    keyboardMode = false;
    controller.selectSlot(slot);
    refresh();
  },
  paint: (target, piece, cellPx) => {
    const ctx = target.getContext('2d');
    if (!ctx || !palette.value) return;
    ctx.clearRect(0, 0, target.width, target.height);
    paintPiece(ctx, piece, palette.value, { cell: cellPx, left: 0, top: 0 });
  },
  handScale: (slot) => {
    const piece = game.hand[slot];
    if (!piece) return 0.6;
    const handCell =
      pieceSize.value / Math.max(3.2, piece.shape.width + 0.6, piece.shape.height + 0.6);
    return Math.min(1, handCell / cellCss);
  },
  active: () => props.active,
  moving: () => moving.value,
  play: (sound) => audio.play(sound),
});

/** The piece held over the board: dragged, or picked with the keys. */
function currentPreview(): DunesPreview | null {
  return drag.preview() ?? (keyboardMode ? controller.keyboardPreview() : null);
}

const hintPreview = (): DunesPreview | null => {
  const hint = game.hint;
  const piece = hint ? game.hand[hint.slot] : null;
  return hint && piece ? { ...hint, shape: piece.shape, tone: piece.tone, valid: true } : null;
};

const offFrame = props.clock.subscribe((delta, real) => {
  // Effects freeze with the pause; they go on at the end, and while the Wyrm shows itself.
  if (props.active || session.state === 'over' || game.isShowing) effects.update(delta, real);
  if (!renderer || !canvas.value) return;
  renderer.render();
  overlay.draw(canvas.value, Math.round(cellCss * ratio()), palette.value, {
    preview: props.active ? currentPreview() : null,
    hint: props.active ? hintPreview() : null,
    cursor: keyboardMode && props.active && controller.selected === null ? controller.cursor : null,
    motion: moving.value,
  });
  refresh();
});

const cellAt = (clientX: number, clientY: number) => {
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return null;
  const x = Math.floor((clientX - rect.left) / cellCss);
  const y = Math.floor((clientY - rect.top) / cellCss);
  const board = game.board();
  return x >= 0 && y >= 0 && x < board.columns && y < board.rows ? { x, y } : null;
};

const onBoardMove = () => {
  // The pointer takes over from the keyboard.
  keyboardMode = false;
};

/** A piece picked, then a cell tapped: it goes down there. */
const onBoardTap = (event: PointerEvent) => {
  if (drag.dragging()) return;
  keyboardMode = false;
  const cell = cellAt(event.clientX, event.clientY);
  if (!cell || !props.active) return;
  controller.tapCell(cell.x, cell.y);
  refresh();
};

const swap = () => {
  if (!props.active) return;
  controller.swap();
  refresh();
};

// --- Keyboard ----------------------------------------------------------------------

const DIGIT_SLOTS: Readonly<Record<string, number>> = {
  Digit1: 0,
  Numpad1: 0,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 2,
  Numpad3: 2,
};
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

const onKeyDown = (event: KeyboardEvent) => {
  if (document.querySelector('dialog[open]')) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))
    return;
  const code = event.code;
  // Backspace lets the piece go (never Esc: portals keep it to leave full screen); P pauses.
  if (code === 'Backspace' && controller.selected !== null) {
    event.preventDefault();
    controller.cancel();
    refresh();
    return;
  }
  if (code === 'KeyP') {
    event.preventDefault();
    emit('pause');
    return;
  }
  if (!props.active) return;
  const slot = DIGIT_SLOTS[code];
  const arrow = ARROWS[code];
  if (slot !== undefined) {
    controller.selectSlot(slot);
  } else if (arrow) {
    controller.moveCursor(arrow[0], arrow[1]);
  } else if (code === 'Enter' || code === 'Space') {
    // Enter or Space on a focused button activates it instead.
    if (event.target instanceof HTMLButtonElement) return;
    controller.confirm();
  } else if (code === 'KeyR') {
    controller.swap();
  } else {
    return;
  }
  event.preventDefault();
  keyboardMode = true;
  refresh();
};

watch(
  () => props.active,
  (active) => {
    if (!active) drag.cancel();
  },
);

onMounted(() => {
  if (canvas.value) renderer = new SandRenderer(canvas.value, view, effects);
  renderer?.setGhost(false);
  if (boardArea.value) observer.observe(boardArea.value);
  if (handArea.value) handObserver.observe(handArea.value);
  void refreshPalette();
  refresh();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  offFrame();
  drag.cancel();
  detachEffects();
  detachSounds();
  detachDeal();
  detachRefresh.forEach((off) => off());
  observer.disconnect();
  handObserver.disconnect();
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="stage dunes">
    <div class="dunes__goal">
      <CampaignGoal
        :label="goalCard.label"
        :text="goalCard.text"
        :goal="goalCard.goal"
        :value="goalValue"
      />
    </div>

    <div ref="boardArea" class="stage__well dunes__board">
      <canvas
        ref="canvas"
        class="dunes__canvas"
        role="img"
        :aria-label="t('dunes.board')"
        @pointermove="onBoardMove"
        @pointerup="onBoardTap"
      />
    </div>

    <div ref="handArea" class="dunes__hand" role="group" :aria-label="t('dunes.hand')">
      <DunesHandPiece
        v-for="(entry, index) in hand"
        :key="entry.slot"
        :piece="entry.piece"
        :palette="palette"
        :size="pieceSize"
        :label="pieceLabel(entry, index)"
        :note="noteOf(entry)"
        :selected="selected === entry.slot"
        :fits="entry.fits"
        :only="onlyOne && entry.fits"
        :lifted="drag.lifted.value === entry.slot"
        :index="index"
        :moving="moving"
        :data-slot="entry.slot"
        @grab="drag.grab(entry.slot, $event)"
        @select="
          controller.selectSlot(entry.slot);
          refresh();
        "
      />
    </div>

    <div class="dunes__swap">
      <button
        type="button"
        class="dunes__swap-button"
        :class="{ 'dunes__swap-button--call': stuck && swaps > 0 }"
        :disabled="swaps === 0 || dealing"
        :aria-label="t('dunes.swapLabel', { n: swaps }, swaps)"
        @click="swap"
      >
        <AppIcon name="swap" :size="20" />
        <span>{{ t('dunes.swap') }}</span>
        <span class="dunes__swap-count">{{
          swaps > 0 ? t('dunes.swapsLeft', { n: swaps }, swaps) : t('dunes.swapsNone')
        }}</span>
      </button>
      <!-- The danger of the hand in its pill, else the tip (hidden on a short screen). -->
      <p v-if="status" class="dunes__status" aria-hidden="true">{{ status }}</p>
      <p v-else class="dunes__tip">{{ tip }}</p>
      <p class="sr-only" role="status">{{ status }}</p>
    </div>

    <canvas ref="ghostCanvas" class="dunes__ghost" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* The shared parts are in styles/stage.css; each part names its grid area. */
.dunes__goal {
  grid-area: goal;
  display: flex;
  min-width: 0;
}

.dunes__board {
  width: 100%;
}

.dunes__canvas {
  display: block;
  max-width: 100%;
  border-radius: var(--radius-sm);
  box-shadow:
    0 0 0 2px var(--well-frame),
    0 0 3rem var(--well-glow),
    0 0 0 7px var(--well-halo);
  touch-action: none;
  cursor: pointer;
}

/* The danger of a hand, as a pill: only one piece fits, or none (swap). */
.dunes__status {
  align-self: center;
  min-width: 0;
  padding: 0.2em 0.9em;
  border: 1px solid var(--danger);
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  font-weight: 800;
  color: var(--text);
}

.dunes__hand {
  grid-area: hand;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: 0;
}

.dunes__swap {
  grid-area: jokers;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: var(--touch);
}

.dunes__swap-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 1px solid var(--accent-fill);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 700;
}

.dunes__swap-button:disabled {
  border-style: dashed;
  border-color: var(--border);
  color: var(--text-muted);
  cursor: default;
}

/* Stuck with a swap in hand: the button calls. */
.dunes__swap-button--call {
  background: var(--accent-fill);
  color: var(--on-accent-fill);
}

.dunes__swap-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.dunes__tip {
  min-width: 0;
  max-width: 28em;
  font-size: 0.875rem;
  line-height: 1.35;
  color: var(--text-muted);
  text-wrap: pretty;
}

.dunes__ghost {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  z-index: 5;
  pointer-events: none;
  will-change: transform;
  filter: drop-shadow(0 0.75rem 1rem rgb(0 0 0 / 0.4));
}

@media (prefers-reduced-motion: no-preference) {
  .dunes__swap-button--call {
    animation: swap-call 1.2s ease-in-out infinite;
  }
}

@keyframes swap-call {
  50% {
    transform: scale(1.06);
  }
}

/* A short screen keeps its height for the board: the tip goes (each element is named as it comes). */
@media (height < 40rem) {
  .dunes__tip {
    display: none;
  }
}

/* Landscape: the hand stands in a column beside the board; the swap and its tip in the side column. */
@media (orientation: landscape) {
  .dunes__hand {
    flex-direction: column;
    gap: var(--space-2);
  }

  .dunes__swap {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
  }
}
</style>
