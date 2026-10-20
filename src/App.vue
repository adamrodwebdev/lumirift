<script setup lang="ts">
import {
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watchEffect,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { CampaignLevel } from '@/campaign/Levels';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeId } from '@/session/ModeId';
import AppHeader from '@/ui/components/AppHeader.vue';
import SettingsDialog from '@/ui/components/SettingsDialog.vue';
import HomeScreen from '@/ui/screens/HomeScreen.vue';

/** The game screen and its families are downloaded only when a game starts. */
const GameScreen = defineAsyncComponent(() => import('@/ui/screens/GameScreen.vue'));
const CampaignScreen = defineAsyncComponent(() => import('@/ui/screens/CampaignScreen.vue'));

type Screen =
  | { readonly kind: 'home' }
  | { readonly kind: 'campaign' }
  | {
      readonly kind: 'game';
      readonly modeId: ModeId;
      readonly daily: DailyChallenge | null;
      readonly variant: string | null;
      /** Set for a campaign level. */
      readonly level: CampaignLevel | null;
      readonly id: number;
    };

const { t, locale } = useI18n();
const { settings, audio, platform } = useServices();

const screen = shallowRef<Screen>({ kind: 'home' });
const settingsOpen = ref(false);
const main = ref<HTMLElement | null>(null);
let gameId = 0;

const play = (
  modeId: ModeId,
  daily: DailyChallenge | null = null,
  variant: string | null = null,
) => {
  show({ kind: 'game', modeId, daily, variant, level: null, id: ++gameId });
};
const playLevel = (level: CampaignLevel) =>
  show({ kind: 'game', modeId: level.modeId, daily: null, variant: null, level, id: ++gameId });
const home = () => show({ kind: 'home' });
const campaignMap = () => show({ kind: 'campaign' });
const show = (next: Screen) => {
  screen.value = next;
  window.scrollTo(0, 0);
  focusMain();
};
/**
 * A new screen replaces the button that led to it: focus moves to the main
 * region, so that keyboard and screen reader users start from the new screen.
 */
const focusMain = () => void nextTick(() => main.value?.focus({ preventScroll: true }));

// Language: interface, <html lang>, title and description follow the setting.
watchEffect(() => {
  locale.value = settings.current.locale;
  document.documentElement.lang = settings.current.locale;
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
const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume());
watchEffect(() => {
  audio.setVolume(settings.current.volume);
  audio.setMusicVolume(settings.current.musicVolume);
  audio.setMuted(settings.current.muted || portalMuted.value);
});
onMounted(() => {
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockAudio, { capture: true });
  window.removeEventListener('keydown', unlockAudio, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  offPortalMute();
  offPortalPause();
});
</script>

<template>
  <a class="skip" href="#main">{{ t('nav.skip') }}</a>
  <!-- No page header during a game: it keeps its own pause and sound buttons. -->
  <AppHeader
    v-if="screen.kind !== 'game'"
    :in-game="screen.kind !== 'home'"
    @home="home"
    @settings="settingsOpen = true"
  />
  <main id="main" ref="main" tabindex="-1">
    <HomeScreen
      v-if="screen.kind === 'home'"
      @play="(modeId, variant) => play(modeId, null, variant ?? null)"
      @daily="(challenge) => play(challenge.modeId, challenge)"
      @campaign="campaignMap"
      @level="playLevel"
    />
    <CampaignScreen v-else-if="screen.kind === 'campaign'" @play="playLevel" />
    <GameScreen
      v-else
      :key="screen.id"
      :mode-id="screen.modeId"
      :daily="screen.daily"
      :variant="screen.variant"
      :level="screen.level"
      @home="home"
      @campaign="campaignMap"
      @next="playLevel"
      @settings="settingsOpen = true"
    />
  </main>
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
