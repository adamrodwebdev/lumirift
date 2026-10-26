<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { FallingSession, type FallingCommand } from '@/families/falling/FallingSession';
import { FallingEffects } from '@/families/falling/fx/FallingEffects';
import { FallingSoundscape } from '@/families/falling/fx/FallingSoundscape';
import type { PieceSpec } from '@/families/falling/game/Game';
import { FallingInput } from '@/families/falling/input/FallingInput';
import NotchGlow from '@/families/falling/ui/NotchGlow.vue';
import PiecePreview from '@/families/falling/ui/PiecePreview.vue';
import TouchControls from '@/families/falling/ui/TouchControls.vue';
import { useTouchPlay } from '@/families/falling/ui/useTouchPlay';
import { effectsProfile } from '@/fx/EffectsProfile';
import { TonePalette } from '@/render/TonePalette';
import type { GameSession } from '@/session/GameSession';
import { useKeyBindings } from '@/ui/useKeyBindings';
import SurgeButton from '@/ui/components/SurgeButton.vue';
import { SURGE } from '@/ui/surgeControl';
import { useLandscape } from '@/ui/useOrientation';
import { TowerCamera, TURN_STEP } from '../camera/TowerCamera';
import { EyeEffects } from '../fx/EyeEffects';
import { TowerTurn } from '../input/TowerTurn';
import { EyeSounds } from '../fx/EyeSounds';
import { TowerRenderer } from '../render/TowerRenderer';
import { TowerMode } from '../TowerMode';

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

/**
 * The tower has no wall: an instant repeat would spin the piece round it.
 * The fastest repeat there moves it a column a frame.
 */
const ROUND_WELL_ARR_MS = 16;

const { t } = useI18n();
const { theme, settings, audio, haptics, look } = useServices();
/** The rift surge, the game screen's: its key and its button are here. */
const surge = inject(SURGE, null);
const keys = useKeyBindings();
const format = useFormat();
const landscape = useLandscape();

const wellArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const palette = shallowRef<TonePalette | null>(null);
const held = shallowRef<PieceSpec | null>(null);
const canHold = ref(true);
const queue = shallowRef<readonly PieceSpec[]>([]);
/** Width of a column face on, in CSS pixels: one swipe step. */
const columnSize = ref(24);
/** Previews: small in the portrait band above the tower, larger beside it. */
const previewSize = computed(() =>
  landscape.value ? Math.round(Math.min(84, Math.max(40, columnSize.value * 2.6))) : 38,
);

const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const effects = new FallingEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
  (combo) => t('wellWords.combo', { n: combo }),
);
const detachEffects = effects.attach(session);
watch(
  () => look.current.value.shatter,
  (shatter) => effects.setShatter(shatter),
  { immediate: true },
);
const soundscape = new FallingSoundscape(audio, haptics);
const detachSounds = soundscape.attach(session);

// The Eye of the Tower, on its boss level: its own effects and sounds.
const mode = session.view.mode;
const eyeEffects = mode instanceof TowerMode && mode.eye ? new EyeEffects(format.number) : null;
const detachEye =
  mode instanceof TowerMode && eyeEffects
    ? [eyeEffects.attach(session, mode), new EyeSounds(audio, haptics).attach(mode)]
    : [];

const camera = new TowerCamera(session.view.board.width);
const detachSpawn = session.onGame('spawn', () => camera.recentre());

let renderer: TowerRenderer | null = null;

const execute = (command: FallingCommand) => props.active && session.execute(command);
const input = new FallingInput(
  execute,
  () => emit('pause'),
  () => ({
    das: settings.current.das,
    arr: Math.max(settings.current.arr, ROUND_WELL_ARR_MS),
  }),
);

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  columnSize.value = renderer.layout(
    width - 4,
    height - 4,
    Math.min(2, window.devicePixelRatio || 1),
  );
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

// The player's moves repeat in real time, even while the surge slows the game.
const offFrame = props.clock.subscribe((delta, real) => {
  input.update(props.active ? real : 0);
  if (props.active || session.state === 'over') {
    effects.update(delta);
    eyeEffects?.update(delta);
    soundscape.update(delta);
  }
  const view = session.view;
  const piece = view.active;
  if (piece) camera.follow(piece.centre);
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
  const action = keys.value.actionFor(event.code);
  if (!action) return;
  // The rift surge is the screen's: the stage passes the call on.
  if (action === 'surge') {
    event.preventDefault();
    if (down && !event.repeat && props.active) surge?.trigger();
    return;
  }
  if (action === 'turnLeft' || action === 'turnRight') {
    event.preventDefault();
    if (down && props.active) camera.turn((action === 'turnLeft' ? -1 : 1) * TURN_STEP);
    return;
  }
  event.preventDefault();
  if (down) {
    if (!event.repeat) input.press(action);
  } else {
    input.release(action);
  }
};
const onKeyDown = (event: KeyboardEvent) => onKey(event, true);
const onKeyUp = (event: KeyboardEvent) => onKey(event, false);

// --- Touch: one finger plays, two fingers turn the tower (or rotate on a tap) --

const turn = new TowerTurn(
  (columns) => props.active && camera.turn(columns),
  () => columnSize.value,
);
/** On a touch screen: the gestures, the buttons chosen, the feel of each move. */
const { pad, notch, glows } = useTouchPlay({
  execute,
  cellSize: () => columnSize.value,
  active: () => props.active,
  session,
  turn,
});

onMounted(() => {
  if (canvas.value)
    renderer = new TowerRenderer(canvas.value, session.view, camera, effects, eyeEffects);
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
  detachEye.forEach((off) => off());
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
        <PiecePreview :spec="held" :palette="palette" :size="previewSize" :dimmed="!canHold" />
      </button>
      <SurgeButton />
    </section>

    <div ref="wellArea" class="stage__well">
      <canvas
        ref="canvas"
        class="stage__canvas stage__canvas--glass"
        role="img"
        :aria-label="t('tower.well')"
      />
      <NotchGlow v-if="glows" :beat="notch" :canvas="canvas" />
    </div>

    <section class="stage__next stage__box" :aria-label="t('hud.next')">
      <p class="stage__label" aria-hidden="true">{{ t('hud.next') }}</p>
      <PiecePreview
        v-for="(spec, index) in queue"
        :key="index"
        :spec="spec"
        :palette="palette"
        :size="index === 0 ? previewSize : Math.round(previewSize * 0.75)"
      />
    </section>

    <TouchControls
      v-if="pad !== 'none'"
      :pad="pad"
      @press="input.press($event)"
      @release="input.release($event)"
    />
  </div>
</template>

<style scoped>
.stage__hold {
  grid-area: hold;
  display: flex;
}

.stage__box--hold {
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
}

.stage__box--hold:active {
  transform: scale(0.94);
}

.stage__box--used {
  border-color: transparent;
}

/* The glass tower draws its own edges: no frame around its canvas. */
.stage__canvas--glass {
  box-shadow: none;
}
</style>
