<script setup lang="ts">
import {
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { loadMessages } from '@/i18n';
import type { CampaignLevel } from '@/campaign/Levels';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeId } from '@/session/ModeId';
import SettingsDialog from '@/ui/components/SettingsDialog.vue';
import { preloadStage } from '@/ui/stages';
import type { HubPage } from '@/ui/hub/hubPages';
import RiftWipe from '@/ui/hub/RiftWipe.vue';
import HubScreen from '@/ui/screens/HubScreen.vue';

/** The game screen and its families are downloaded only when a game starts. */
const loadGame = () => import('@/ui/screens/GameScreen.vue');
const GameScreen = defineAsyncComponent(loadGame);

interface Game {
  readonly modeId: ModeId;
  readonly daily: DailyChallenge | null;
  readonly variant: string | null;
  /** Set for a campaign level. */
  readonly level: CampaignLevel | null;
}
/** The rift's light between two screens (`RiftWipe`). */
interface ScreenChange {
  run(from: Element | null, swap: () => Promise<void> | void): Promise<void>;
}
type Screen =
  | { readonly kind: 'hub'; readonly returning: boolean }
  | ({ readonly kind: 'game'; readonly id: number } & Game);

const i18n = useI18n();
const { t, locale } = i18n;
const { settings, audio, platform, catalog } = useServices();

const screen = shallowRef<Screen>({ kind: 'hub', returning: false });
/** The menu's page, kept while a game runs: the player comes back where they left. */
const hubPage = ref<HubPage>('home');
const settingsOpen = ref(false);
const main = ref<HTMLElement | null>(null);
const wipe = ref<ScreenChange | null>(null);
let gameId = 0;
let changing = false;

/**
 * Changes screen behind the rift's light, from the button that asked for it;
 * one change at a time (a second tap during one is ignored).
 */
const change = async (origin: Element | null, next: () => Promise<Screen> | Screen) => {
  if (changing) return;
  changing = true;
  const swap = async () => {
    screen.value = await next();
    await nextTick();
    // Two frames: the new screen is painted before the light lifts.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    focusMain();
  };
  try {
    if (wipe.value) await wipe.value.run(origin, swap);
    else await swap();
  } finally {
    changing = false;
  }
};

const play = (game: Game, origin: Element | null) =>
  void change(origin, async () => {
    // The light covers the download of the game's code: the screen, the family, its stage.
    await Promise.all([
      loadGame(),
      catalog.preload(game.modeId),
      preloadStage(catalog.get(game.modeId)),
    ]);
    return { kind: 'game', id: ++gameId, ...game };
  });
const playMode = (modeId: ModeId, variant: string | null, origin: Element | null) =>
  play({ modeId, daily: null, variant, level: null }, origin);
const playDaily = (challenge: DailyChallenge, origin: Element | null) =>
  play({ modeId: challenge.modeId, daily: challenge, variant: null, level: null }, origin);
const playLevel = (level: CampaignLevel, origin: Element | null = null) =>
  play({ modeId: level.modeId, daily: null, variant: null, level }, origin);
const backToHub = (page?: HubPage) => {
  if (page) hubPage.value = page;
  void change(null, () => ({ kind: 'hub', returning: true }));
};

/**
 * A new screen replaces the button that led to it: focus moves to the main
 * region, so that keyboard and screen reader users start from the new screen.
 */
const focusMain = () => main.value?.focus({ preventScroll: true });

// Language: a language chosen for the first time brings its messages first;
// then the interface, <html lang>, title and description follow it.
watch(
  () => settings.current.locale,
  async (next) => {
    if (!i18n.availableLocales.includes(next))
      i18n.setLocaleMessage(next, await loadMessages(next));
    if (settings.current.locale === next) locale.value = next;
  },
  { immediate: true },
);
watchEffect(() => {
  document.documentElement.lang = locale.value;
  document.title = t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t('meta.description'));
});

// Sound: browsers allow audio only after a gesture; volume and mute follow the
// settings, and the portal's own mute button when there is one.
const portalMuted = ref(platform.muted);
const offPortalMute = platform.onMuteChange((muted) => (portalMuted.value = muted));
const offPortalPause = platform.onPauseChange((paused) =>
  paused ? audio.suspend() : document.hidden || audio.resume(),
);
const unlockAudio = () => audio.unlock();
/**
 * On a portal, Escape belongs to the portal (it leaves full screen): cancelling
 * the key keeps the browser from turning it into a window's close request, so
 * the game never reacts to it.
 */
const keepEscapeForPortal = (event: KeyboardEvent) => {
  if (event.key === 'Escape') event.preventDefault();
};
const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume());
watchEffect(() => {
  audio.setVolume(settings.current.volume);
  audio.setMusicVolume(settings.current.musicVolume);
  audio.setMuted(settings.current.muted || portalMuted.value);
});
onMounted(() => {
  if (platform.reservesEscape)
    window.addEventListener('keydown', keepEscapeForPortal, { capture: true });
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keepEscapeForPortal, { capture: true });
  window.removeEventListener('pointerdown', unlockAudio, { capture: true });
  window.removeEventListener('keydown', unlockAudio, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  offPortalMute();
  offPortalPause();
});
</script>

<template>
  <a class="skip" href="#main">{{ t('nav.skip') }}</a>
  <main id="main" ref="main" tabindex="-1">
    <HubScreen
      v-if="screen.kind === 'hub'"
      v-model:page="hubPage"
      :returning="screen.returning"
      @play="playMode"
      @daily="playDaily"
      @level="playLevel"
      @settings="settingsOpen = true"
    />
    <GameScreen
      v-else
      :key="screen.id"
      :mode-id="screen.modeId"
      :daily="screen.daily"
      :variant="screen.variant"
      :level="screen.level"
      @home="backToHub()"
      @campaign="backToHub('map')"
      @next="playLevel"
      @settings="settingsOpen = true"
    />
  </main>
  <RiftWipe ref="wipe" />
  <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
</template>

<style scoped>
.skip {
  position: absolute;
  left: var(--space-2);
  top: -100%;
  z-index: 10;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-weight: 700;
}

.skip:focus {
  top: var(--space-2);
}

main:focus {
  outline: none;
}
</style>
