import { inject, type InjectionKey } from 'vue';
import { detectLocale } from '@/i18n/locales';
import { WebPlatform, type Platform } from '@/platform/Platform';
import { ModeCatalog } from '@/session/ModeCatalog';
import { AmbianceController } from '@/services/AmbianceController';
import { AudioEngine } from '@/services/audio/AudioEngine';
import { CampaignService } from '@/services/CampaignService';
import { Haptics } from '@/services/Haptics';
import { BrowserStorage, type KeyValueStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import { ScoreBoard } from '@/services/ScoreBoard';
import { SettingsService } from '@/services/SettingsService';
import { ShareService } from '@/services/ShareService';
import { ThemeController } from '@/services/ThemeController';

/** Every service the interface depends on, created once and injected. */
export interface AppServices {
  readonly settings: SettingsService;
  readonly theme: ThemeController;
  readonly scores: ScoreBoard;
  /** Experience, objectives, streak and cosmetics. */
  readonly profile: ProfileService;
  /** Campaign stars and upgrades. */
  readonly campaign: CampaignService;
  readonly share: ShareService;
  readonly catalog: ModeCatalog;
  readonly audio: AudioEngine;
  readonly haptics: Haptics;
  readonly clock: () => Date;
  /** Our site or a game portal: gameplay events, ads, the portal's mute button. */
  readonly platform: Platform;
}

export const APP_SERVICES: InjectionKey<AppServices> = Symbol('AppServices');

export function createBrowserServices(
  platform: Platform = new WebPlatform(),
  storage: KeyValueStorage = platform.storage ?? BrowserStorage.local(),
): AppServices {
  const settings = new SettingsService(storage, {
    // A portal knows the player's language; English when it does not.
    locale: detectLocale(platform.locale ? [platform.locale] : navigator.languages),
    theme: 'system',
    ghost: true,
    // Players who ask their system for less motion start with calmer effects.
    effects: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
    shake: true,
    haptics: true,
    volume: 0.7,
    muted: false,
  });
  const catalog = new ModeCatalog();
  const profile = new ProfileService(storage, () => catalog.list().map((mode) => mode.id));
  new AmbianceController(profile, settings, document.documentElement);
  return {
    settings,
    theme: new ThemeController(settings, document.documentElement, (query) =>
      window.matchMedia(query),
    ),
    scores: new ScoreBoard(storage),
    profile,
    campaign: new CampaignService(storage),
    share: new ShareService(navigator),
    catalog,
    audio: AudioEngine.browser(),
    haptics: new Haptics(navigator, () => settings.current.haptics),
    clock: () => new Date(),
    platform,
  };
}

export function useServices(): AppServices {
  const services = inject(APP_SERVICES);
  if (!services) throw new Error('App services are not provided');
  return services;
}
