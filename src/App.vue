<script setup lang="ts">
import {
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watchEffect,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeId } from '@/session/ModeId';
import AppHeader from '@/ui/components/AppHeader.vue';
import SettingsDialog from '@/ui/components/SettingsDialog.vue';
import HomeScreen from '@/ui/screens/HomeScreen.vue';

/** The game screen and its families are downloaded only when a game starts. */
const GameScreen = defineAsyncComponent(() => import('@/ui/screens/GameScreen.vue'));

type Screen =
  | { readonly kind: 'home' }
  | {
      readonly kind: 'game';
      readonly modeId: ModeId;
      readonly daily: DailyChallenge | null;
      readonly id: number;
    };

const { t, locale } = useI18n();
const { settings, audio } = useServices();

const screen = shallowRef<Screen>({ kind: 'home' });
const settingsOpen = ref(false);
let gameId = 0;

const play = (modeId: ModeId, daily: DailyChallenge | null = null) => {
  screen.value = { kind: 'game', modeId, daily, id: ++gameId };
  window.scrollTo(0, 0);
};
const home = () => {
  screen.value = { kind: 'home' };
};

// Language: interface, <html lang>, title and description follow the setting.
watchEffect(() => {
  locale.value = settings.current.locale;
  document.documentElement.lang = settings.current.locale;
  document.title = t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t('meta.description'));
});

// Sound: browsers allow audio only after a gesture; volume and mute follow the settings.
const unlockAudio = () => audio.unlock();
const onVisibility = () => (document.hidden ? audio.suspend() : audio.resume());
watchEffect(() => {
  audio.setVolume(settings.current.volume);
  audio.setMuted(settings.current.muted);
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
});
</script>

<template>
  <a class="skip" href="#main">{{ t('nav.skip') }}</a>
  <AppHeader :in-game="screen.kind === 'game'" @home="home" @settings="settingsOpen = true" />
  <main id="main" tabindex="-1">
    <HomeScreen
      v-if="screen.kind === 'home'"
      @play="play"
      @daily="(challenge) => play(challenge.modeId, challenge)"
    />
    <GameScreen
      v-else
      :key="screen.id"
      :mode-id="screen.modeId"
      :daily="screen.daily"
      @home="home"
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
