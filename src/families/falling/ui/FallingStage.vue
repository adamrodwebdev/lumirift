<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import type { GameSession } from '@/session/GameSession';
import AppIcon, { type IconName } from '@/ui/components/AppIcon.vue';
import { useGameSurface } from '@/ui/useGameSurface';
import { isTouchScreen, useLandscape } from '@/ui/useOrientation';
import { FallingSession, type FallingCommand } from '../FallingSession';
import { FallingEffects } from '../fx/FallingEffects';
import { FallingSoundscape } from '../fx/FallingSoundscape';
import type { PieceSpec } from '../game/Game';
import { FallingInput, KEY_BINDINGS } from '../input/FallingInput';
import { WellGestures } from '../input/WellGestures';
import type { AbilityId } from '../modes/GameMode';
import { FallingRenderer } from '../render/FallingRenderer';
import { TonePalette } from '@/render/TonePalette';
import { decorFor } from '../render/WellDecor';
import PiecePreview from './PiecePreview.vue';
import TouchControls from './TouchControls.vue';

/**
 * A falling-family game: the well, the hold and the coming pieces. Each part
 * names its area of the game screen's grid (hold, well, next, side, pads);
 * the game screen places them for the orientation. On a touch screen the
 * whole game screen takes the gestures, so the finger never hides the well.
 */
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

const ABILITY_ICONS: Readonly<Record<AbilityId, IconName>> = { flip: 'flip' };

const { t } = useI18n();
const { theme, settings, audio, haptics, profile: progression } = useServices();
/** The cosmetics the player wears. */
const equipment = computed(() => progression.current.equipment);
const format = useFormat();
const landscape = useLandscape();
/** The on-screen buttons, for the touch players who chose them. */
const touch = isTouchScreen();
const pad = computed(() => touch && settings.current.controls === 'buttons');

const wellArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const palette = shallowRef<TonePalette | null>(null);
const held = shallowRef<PieceSpec | null>(null);
const canHold = ref(true);
const queue = shallowRef<readonly PieceSpec[]>([]);
const cellSize = ref(24);
/** Previews: small in the portrait band above the well, larger beside it. */
const previewSize = computed(() =>
  landscape.value ? Math.round(Math.min(84, Math.max(40, cellSize.value * 2.6))) : 38,
);
const wellLabel = computed(() => `${t('game.well')} · ${t(`modes.${session.modeId}.name`)}`);

let renderer: FallingRenderer | null = null;

/** Visual effects and sounds, driven by the engine's events. */
const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const effects = new FallingEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
// Hard drops are shown falling; Rhythm keeps them instant, its landings sound on the beat.
effects.animateDrops = session.modeId !== 'rhythm';
const detachEffects = effects.attach(session);
watch(
  () => equipment.value.shatter,
  (shatter) => effects.setShatter(shatter),
  { immediate: true },
);
const detachSounds = new FallingSoundscape(audio, haptics, (distance) =>
  effects.dropWait(distance),
).attach(session);

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
const gestures = new WellGestures(execute, () => cellSize.value);

// --- Layout and theme -------------------------------------------------------

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  // Minus the 2 px frame on each side.
  cellSize.value = renderer.layout(
    width - 4,
    height - 4,
    Math.min(2, window.devicePixelRatio || 1),
  );
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
  () => equipment.value.material,
  (material) => {
    renderer?.setMaterial(material);
    renderer?.render();
  },
);
watch(
  () => props.active,
  (active) => {
    if (!active) {
      input.releaseAll();
      gestures.cancel();
    }
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

// --- Keyboard and touch -----------------------------------------------------

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

useGameSurface({
  down: (event) => gestures.down(event.pointerId, event.clientX, event.clientY, event.timeStamp),
  move: (event) => gestures.move(event.pointerId, event.clientX, event.clientY),
  up: (event) => gestures.up(event.pointerId, event.clientX, event.clientY, event.timeStamp),
  cancel: () => gestures.cancel(),
});

onMounted(() => {
  if (canvas.value) renderer = new FallingRenderer(canvas.value, session.view);
  renderer?.setGhost(props.ghost);
  renderer?.setMaterial(equipment.value.material);
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
    <section class="stage__hold" :aria-label="t('hud.hold')">
      <button
        type="button"
        class="stage__box stage__box--hold"
        :class="{ 'stage__box--used': !canHold }"
        :aria-label="t('controls.hold')"
        @click="execute({ type: 'hold' })"
      >
        <span class="stage__label" aria-hidden="true">{{ t('hud.hold') }}</span>
        <PiecePreview
          :spec="held"
          :palette="palette"
          :material="equipment.material"
          :size="previewSize"
          :dimmed="!canHold"
        />
      </button>
      <button
        v-if="session.ability"
        type="button"
        class="stage__ability"
        :aria-label="t(`controls.ability.${session.ability}`)"
        @click="execute({ type: 'ability' })"
      >
        <AppIcon :name="ABILITY_ICONS[session.ability]" />
      </button>
    </section>

    <div ref="wellArea" class="stage__well">
      <canvas
        ref="canvas"
        class="stage__canvas"
        :class="moment && `stage__canvas--${moment}`"
        role="img"
        :aria-label="wellLabel"
      />
    </div>

    <section class="stage__next stage__box" :aria-label="t('hud.next')">
      <p class="stage__label" aria-hidden="true">{{ t('hud.next') }}</p>
      <PiecePreview
        v-for="(spec, index) in queue"
        :key="index"
        :spec="spec"
        :palette="palette"
        :material="equipment.material"
        :size="index === 0 ? previewSize : Math.round(previewSize * 0.75)"
      />
    </section>

    <!-- Extra panels of a mode (the opponent of a duel). -->
    <div v-if="$slots.side" class="stage__side"><slot name="side" /></div>

    <TouchControls v-if="pad" @press="input.press($event)" @release="input.release($event)" />
  </div>
</template>

<style scoped>
/* The shared parts (well, boxes, labels, next) are in styles/stage.css. */
.stage__hold {
  grid-area: hold;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stage__side {
  grid-area: side;
  min-width: 0;
  min-height: 0;
}

.stage__box--hold {
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
  transition:
    transform 120ms ease,
    border-color 160ms ease;
}

.stage__box--hold:active {
  transform: scale(0.94);
}

.stage__box--used {
  border-color: transparent;
}

.stage__ability {
  display: grid;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  border: 0;
  border-radius: 50%;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  box-shadow: 0 3px 0 var(--accent-edge);
}

.stage__ability:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--accent-edge);
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

/* Landscape: the hold box and the ability side by side, under the stats. */
@media (orientation: landscape) {
  .stage__hold {
    align-items: flex-end;
  }
}
</style>
