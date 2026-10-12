<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { FallingSession, type FallingCommand } from '@/families/falling/FallingSession';
import { FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import type { PieceSpec } from '@/families/falling/game/Game';
import { FallingInput, KEY_BINDINGS } from '@/families/falling/input/FallingInput';
import { WellGestures } from '@/families/falling/input/WellGestures';
import PiecePreview from '@/families/falling/ui/PiecePreview.vue';
import TouchControls from '@/families/falling/ui/TouchControls.vue';
import { effectsProfile } from '@/fx/EffectsProfile';
import { TonePalette } from '@/render/TonePalette';
import type { GameSession } from '@/session/GameSession';
import { TowerCamera, TURN_STEP } from '../camera/TowerCamera';
import { TowerRenderer } from '../render/TowerRenderer';

/**
 * The Tower: the falling family's controls and previews around a glass
 * cylinder. The camera follows the piece; Q / E (A / E on AZERTY) or a
 * two-finger drag turn it by hand.
 */
const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof FallingSession))
  throw new Error('TowerStage needs a FallingSession');
const session: FallingSession = props.session;

/** Camera keys, by physical position: Q on QWERTY is A on AZERTY. */
const CAMERA_KEYS: Readonly<Record<string, -1 | 1>> = { KeyQ: -1, KeyE: 1 };

const { t } = useI18n();
const { theme, settings, audio, haptics } = useServices();
const format = useFormat();

const wellArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const palette = shallowRef<TonePalette | null>(null);
const held = shallowRef<PieceSpec | null>(null);
const canHold = ref(true);
const queue = shallowRef<readonly PieceSpec[]>([]);
const previewSize = ref(48);

const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const effects = new FallingEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
const detachEffects = effects.attach(session);
const detachSounds = new FallingSoundscape(audio, haptics).attach(session);

const camera = new TowerCamera(session.view.board.width);
const detachSpawn = session.onGame('spawn', () => camera.recentre());

let renderer: TowerRenderer | null = null;
/** Width of a column face on, in CSS pixels: one swipe step. */
let columnCss = 24;

const execute = (command: FallingCommand) => {
  if (props.active) session.execute(command);
};
const input = new FallingInput(execute, () => emit('pause'));
const gestures = new WellGestures(execute, () => columnCss);

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  columnCss = renderer.layout(width - 4, height - 4, Math.min(2, window.devicePixelRatio || 1));
  previewSize.value = Math.round(Math.min(84, Math.max(36, columnCss * 2.6)));
  renderer.render();
});

const refreshPalette = async () => {
  await nextTick();
  palette.value = TonePalette.fromElement(document.documentElement);
  renderer?.setPalette(palette.value, theme.resolved.value === 'dark');
  renderer?.render();
};
watch(theme.resolved, refreshPalette);
watch(
  () => props.ghost,
  (enabled) => renderer?.setGhost(enabled),
);
watch(
  () => props.active,
  (active) => {
    if (!active) input.releaseAll();
  },
);

const sameSpecs = (a: readonly PieceSpec[], b: readonly PieceSpec[]) =>
  a.length === b.length && a.every((spec, i) => spec === b[i]);

const offFrame = props.clock.subscribe((delta) => {
  input.update(props.active ? delta : 0);
  if (props.active || session.state === 'over') effects.update(delta);
  const view = session.view;
  const piece = view.active;
  if (piece) {
    const cells = piece.localCells;
    camera.follow(piece.x + cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5);
  }
  camera.update(delta, profile.value.motion);
  if (view.held !== held.value) held.value = view.held;
  if (view.canHold !== canHold.value) canHold.value = view.canHold;
  const next = view.preview();
  if (!sameSpecs(next, queue.value)) queue.value = next;
  renderer?.render();
});

// --- Keyboard ---------------------------------------------------------------

const onKey = (event: KeyboardEvent, down: boolean) => {
  if (document.querySelector('dialog[open]')) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))
    return;
  const turn = CAMERA_KEYS[event.code];
  if (turn !== undefined) {
    event.preventDefault();
    if (down && props.active) camera.turn(turn * TURN_STEP);
    return;
  }
  const action = KEY_BINDINGS[event.code];
  if (!action) return;
  event.preventDefault();
  if (down) {
    if (!event.repeat) input.press(action);
  } else {
    input.release(action);
  }
};
const onKeyDown = (event: KeyboardEvent) => onKey(event, true);
const onKeyUp = (event: KeyboardEvent) => onKey(event, false);

// --- Pointer: one finger plays, two fingers turn the tower ------------------

const pointers = new Map<number, number>();
let turning = false;

const middle = () => [...pointers.values()].reduce((sum, x) => sum + x, 0) / pointers.size;

const onPointerDown = (event: PointerEvent) => {
  canvas.value?.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, event.clientX);
  if (pointers.size >= 2) {
    turning = true;
    gestures.cancel();
    return;
  }
  if (!turning) gestures.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
};
const onPointerMove = (event: PointerEvent) => {
  if (!pointers.has(event.pointerId)) return;
  if (!turning) {
    pointers.set(event.pointerId, event.clientX);
    gestures.move(event.pointerId, event.clientX, event.clientY);
    return;
  }
  const before = middle();
  pointers.set(event.pointerId, event.clientX);
  // The surface follows the fingers: dragging right brings the left columns forward.
  if (props.active) camera.turn(-(middle() - before) / columnCss);
};
const onPointerUp = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  if (!turning) gestures.up(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  if (pointers.size === 0) turning = false;
};
const onPointerCancel = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  gestures.cancel();
  if (pointers.size === 0) turning = false;
};

onMounted(() => {
  if (canvas.value) renderer = new TowerRenderer(canvas.value, session.view, camera, effects);
  renderer?.setGhost(props.ghost);
  if (wellArea.value) observer.observe(wellArea.value);
  void refreshPalette();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onBeforeUnmount(() => {
  offFrame();
  detachEffects();
  detachSounds();
  detachSpawn();
  observer.disconnect();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <div class="stage">
    <section class="stage__side stage__side--hold" :aria-label="t('hud.hold')">
      <p class="stage__label">{{ t('hud.hold') }}</p>
      <PiecePreview :spec="held" :palette="palette" :size="previewSize" :dimmed="!canHold" />
    </section>

    <div ref="wellArea" class="stage__well">
      <canvas
        ref="canvas"
        class="stage__canvas"
        role="img"
        :aria-label="t('tower.well')"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      />
    </div>

    <section class="stage__side stage__side--next" :aria-label="t('hud.next')">
      <p class="stage__label">{{ t('hud.next') }}</p>
      <PiecePreview
        v-for="(spec, index) in queue"
        :key="index"
        :spec="spec"
        :palette="palette"
        :size="index === 0 ? previewSize : Math.round(previewSize * 0.75)"
      />
    </section>

    <TouchControls
      class="stage__controls"
      :ability="null"
      @press="input.press($event)"
      @release="input.release($event)"
    />
  </div>
</template>

<style scoped>
.stage {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'hold well next'
    'controls controls controls';
  gap: var(--space-2);
  height: 100%;
  padding: var(--space-2) var(--space-2) 0;
}

.stage__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.stage__side--hold {
  grid-area: hold;
}

.stage__side--next {
  grid-area: next;
}

.stage__label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stage__well {
  grid-area: well;
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.stage__canvas {
  display: block;
  max-width: 100%;
  border-radius: var(--radius-sm);
  touch-action: none;
  cursor: pointer;
}

.stage__controls {
  grid-area: controls;
  display: none;
}

@media (hover: none) and (pointer: coarse) {
  .stage__controls {
    display: grid;
  }
}

@media (min-width: 768px) {
  .stage {
    gap: var(--space-6);
    padding: var(--space-4);
  }
}
</style>
