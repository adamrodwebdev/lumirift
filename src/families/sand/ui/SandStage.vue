<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { FallingInput, KEY_BINDINGS } from '@/families/falling/input/FallingInput';
import { WellGestures } from '@/families/falling/input/WellGestures';
import TouchControls from '@/families/falling/ui/TouchControls.vue';
import { effectsProfile } from '@/fx/EffectsProfile';
import { TonePalette } from '@/render/TonePalette';
import type { GameSession } from '@/session/GameSession';
import type { PieceSpec } from '../engine/SandGame';
import { SandEffects } from '../fx/SandEffects';
import { SandSoundscape } from '../fx/SandSoundscape';
import { SandRenderer } from '../render/SandRenderer';
import { SandSession } from '../SandSession';
import SandPreview from './SandPreview.vue';

/** The sand well: the falling family's controls, a pixel-drawn well, the next pieces. */
const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof SandSession)) throw new Error('SandStage needs a SandSession');
const session: SandSession = props.session;

const { t } = useI18n();
const format = useFormat();
const { theme, settings, audio, haptics } = useServices();

const wellArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const palette = shallowRef<TonePalette | null>(null);
const queue = shallowRef<readonly PieceSpec[]>([]);
const previewSize = ref(48);

const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const effects = new SandEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
const detachEffects = effects.attach(session);
const detachSounds = new SandSoundscape(audio, haptics).attach(session);

let renderer: SandRenderer | null = null;
let cellCss = 24;

const execute = (command: FallingCommand) => {
  if (props.active) session.execute(command);
};
const input = new FallingInput(execute, () => emit('pause'));
const gestures = new WellGestures(execute, () => cellCss);

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  cellCss = renderer.layout(width - 4, height - 4, Math.min(2, window.devicePixelRatio || 1));
  previewSize.value = Math.round(Math.min(84, Math.max(36, cellCss * 2.6)));
});

const refreshPalette = async () => {
  await nextTick();
  palette.value = TonePalette.fromElement(document.documentElement);
  renderer?.setPalette(palette.value);
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

const offFrame = props.clock.subscribe((delta) => {
  input.update(props.active ? delta : 0);
  if (props.active || session.state === 'over') effects.update(delta);
  const next = session.view.preview();
  if (next.length !== queue.value.length || next.some((spec, i) => spec !== queue.value[i]))
    queue.value = next;
  renderer?.render();
});

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

onMounted(() => {
  if (canvas.value) renderer = new SandRenderer(canvas.value, session.view, effects);
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
  observer.disconnect();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <div class="stage">
    <div ref="wellArea" class="stage__well">
      <canvas
        ref="canvas"
        class="stage__canvas"
        role="img"
        :aria-label="t('sand.well')"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="gestures.cancel()"
      />
    </div>

    <section class="stage__next" :aria-label="t('hud.next')">
      <p class="stage__label">{{ t('hud.next') }}</p>
      <SandPreview
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
      :can-hold="false"
      @press="input.press($event)"
      @release="input.release($event)"
    />
  </div>
</template>

<style scoped>
.stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'well next'
    'controls controls';
  gap: var(--space-2);
  height: 100%;
  padding: var(--space-2) var(--space-2) 0;
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
  border: 2px solid var(--well-frame);
  box-shadow:
    0 0 3rem rgb(120 90 255 / 0.22),
    inset 0 0 2rem rgb(120 90 255 / 0.12);
  border-radius: var(--radius-sm);
  touch-action: none;
  cursor: pointer;
}

.stage__next {
  grid-area: next;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.stage__label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
