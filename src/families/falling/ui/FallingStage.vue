<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import type { GameSession } from '@/session/GameSession';
import { FallingSession, type FallingCommand } from '../FallingSession';
import { FallingEffects } from '../fx/FallingEffects';
import { FallingSoundscape } from '../fx/FallingSoundscape';
import type { PieceSpec } from '../game/Game';
import { FallingInput, KEY_BINDINGS } from '../input/FallingInput';
import { WellGestures } from '../input/WellGestures';
import { FallingRenderer } from '../render/FallingRenderer';
import { TonePalette } from '../render/TonePalette';
import { decorFor } from '../render/WellDecor';
import PiecePreview from './PiecePreview.vue';
import TouchControls from './TouchControls.vue';

const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  /** False while paused or over: input is ignored. */
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof FallingSession))
  throw new Error('FallingStage needs a FallingSession');
const session: FallingSession = props.session;

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
const wellLabel = computed(() => `${t('game.well')} · ${t(`modes.${session.modeId}.name`)}`);

let renderer: FallingRenderer | null = null;
let cellCss = 24;

/** Visual effects and sounds, driven by the engine's events. */
const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const effects = new FallingEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
const detachEffects = effects.attach(session);
const detachSounds = new FallingSoundscape(audio, haptics).attach(session);

/** Whole-well moments (flip, mirror) are CSS animations of the canvas. */
const moment = ref<'flip' | 'mirror' | 'tilt' | null>(null);
let momentTimer: ReturnType<typeof setTimeout> | undefined;
const playMoment = (name: 'flip' | 'mirror' | 'tilt') => {
  if (!profile.value.motion) return;
  moment.value = null;
  clearTimeout(momentTimer);
  requestAnimationFrame(() => (moment.value = name));
  momentTimer = setTimeout(() => (moment.value = null), 700);
};
const detachMoments = [
  session.onGame('flip', () => playMoment('flip')),
  session.onGame('mirror', () => playMoment('mirror')),
  session.onGame('tilt', () => playMoment('tilt')),
];

const execute = (command: FallingCommand) => {
  if (props.active) session.execute(command);
};
const input = new FallingInput(execute, () => emit('pause'));
const gestures = new WellGestures(execute, () => cellCss);

// --- Layout and theme -------------------------------------------------------

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  // Minus the 2 px frame on each side.
  cellCss = renderer.layout(width - 4, height - 4, Math.min(2, window.devicePixelRatio || 1));
  previewSize.value = Math.round(Math.min(84, Math.max(36, cellCss * 2.6)));
  renderer.render();
});

const refreshPalette = async () => {
  await nextTick(); // <html data-theme> is updated first
  palette.value = TonePalette.fromElement(document.documentElement);
  renderer?.setPalette(palette.value, theme.resolved.value === 'dark');
  renderer?.render();
};

watch(theme.resolved, refreshPalette);
watch(
  () => profile.value.motion,
  (motion) => renderer?.setDecor(decorFor(session.modeId), motion),
);
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

// --- Frame ------------------------------------------------------------------

const sameSpecs = (a: readonly PieceSpec[], b: readonly PieceSpec[]) =>
  a.length === b.length && a.every((spec, i) => spec === b[i]);

const syncPreviews = () => {
  const view = session.view;
  if (view.held !== held.value) held.value = view.held;
  if (view.canHold !== canHold.value) canHold.value = view.canHold;
  const next = view.preview();
  if (!sameSpecs(next, queue.value)) queue.value = next;
};

const offFrame = props.clock.subscribe((delta) => {
  input.update(props.active ? delta : 0);
  // Effects freeze with the pause, but the final collapse plays after game over.
  if (props.active || session.state === 'over') effects.update(delta);
  syncPreviews();
  renderer?.render();
});

// --- Keyboard and pointer ---------------------------------------------------

const onKey = (event: KeyboardEvent, down: boolean) => {
  const action = KEY_BINDINGS[event.code];
  if (!action || document.querySelector('dialog[open]')) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))
    return;
  event.preventDefault();
  if (down) {
    if (!event.repeat) input.press(action);
  } else {
    input.release(action);
  }
};
const onKeyDown = (event: KeyboardEvent) => onKey(event, true);
const onKeyUp = (event: KeyboardEvent) => onKey(event, false);

const onPointerDown = (event: PointerEvent) => {
  canvas.value?.setPointerCapture(event.pointerId);
  gestures.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
};
const onPointerMove = (event: PointerEvent) =>
  gestures.move(event.pointerId, event.clientX, event.clientY);
const onPointerUp = (event: PointerEvent) =>
  gestures.up(event.pointerId, event.clientX, event.clientY, event.timeStamp);
const onPointerCancel = () => gestures.cancel();

onMounted(() => {
  if (canvas.value) renderer = new FallingRenderer(canvas.value, session.view);
  renderer?.setGhost(props.ghost);
  renderer?.setEffects(effects);
  renderer?.setDecor(decorFor(session.modeId), profile.value.motion);
  if (wellArea.value) observer.observe(wellArea.value);
  void refreshPalette();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onBeforeUnmount(() => {
  offFrame();
  detachEffects();
  detachSounds();
  detachMoments.forEach((off) => off());
  clearTimeout(momentTimer);
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
      <!-- Extra panels of a mode (the opponent of a duel). -->
      <slot name="side" />
    </section>

    <div ref="wellArea" class="stage__well">
      <canvas
        ref="canvas"
        class="stage__canvas"
        :class="moment && `stage__canvas--${moment}`"
        role="img"
        :aria-label="wellLabel"
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
      :ability="session.ability"
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
  border: 2px solid var(--well-frame);
  border-radius: var(--radius-sm);
  touch-action: none;
  cursor: pointer;
}

.stage__canvas--flip {
  animation: well-flip 560ms cubic-bezier(0.3, 1.3, 0.5, 1);
}

.stage__canvas--mirror {
  animation: well-mirror 460ms cubic-bezier(0.3, 1.2, 0.5, 1);
}

.stage__canvas--tilt {
  animation: well-tilt 520ms cubic-bezier(0.3, 1.2, 0.5, 1);
}

@keyframes well-tilt {
  from {
    transform: rotate(90deg) scale(0.85);
  }
}

@keyframes well-flip {
  from {
    transform: perspective(60rem) rotateX(180deg);
  }
}

@keyframes well-mirror {
  from {
    transform: perspective(60rem) rotateY(180deg);
  }
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
