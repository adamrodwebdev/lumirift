import { inject, type InjectionKey } from 'vue';
import { detectLocale } from '@/i18n/locales';
import { ModeCatalog } from '@/session/ModeCatalog';
import { AudioEngine } from '@/services/audio/AudioEngine';
import { Haptics } from '@/services/Haptics';
import { BrowserStorage, type KeyValueStorage } from '@/services/KeyValueStorage';
import { ScoreBoard } from '@/services/ScoreBoard';
import { SettingsService } from '@/services/SettingsService';
import { ShareService } from '@/services/ShareService';
import { ThemeController } from '@/services/ThemeController';

/** Every service the interface depends on, created once and injected. */
export interface AppServices {
  readonly settings: SettingsService;
  readonly theme: ThemeController;
  readonly scores: ScoreBoard;
  readonly share: ShareService;
  readonly catalog: ModeCatalog;
  readonly audio: AudioEngine;
  readonly haptics: Haptics;
  readonly clock: () => Date;
}

export const APP_SERVICES: InjectionKey<AppServices> = Symbol('AppServices');

export function createBrowserServices(
  storage: KeyValueStorage = BrowserStorage.local(),
): AppServices {
  const settings = new SettingsService(storage, {
    locale: detectLocale(navigator.languages),
    theme: 'system',
    ghost: true,
    // Players who ask their system for less motion start with calmer effects.
    effects: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
    shake: true,
    haptics: true,
    volume: 0.7,
    muted: false,
  });
  return {
    settings,
    theme: new ThemeController(settings, document.documentElement, (query) =>
      window.matchMedia(query),
    ),
    scores: new ScoreBoard(storage),
    share: new ShareService(navigator),
    catalog: new ModeCatalog(),
    audio: AudioEngine.browser(),
    haptics: new Haptics(navigator, () => settings.current.haptics),
    clock: () => new Date(),
  };
}

export function useServices(): AppServices {
  const services = inject(APP_SERVICES);
  if (!services) throw new Error('App services are not provided');
  return services;
}
