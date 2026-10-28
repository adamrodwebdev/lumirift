import { inject, type InjectionKey } from 'vue';
import { AD_TUNING } from '@/ads/AdPolicy';
import { AdScheduler } from '@/ads/AdScheduler';
import { DEFAULT_KEYS } from '@/families/falling/input/KeyBindings';
import { DRAG_SPEED } from '@/families/falling/input/phone/GestureTuning';
import { DEFAULT_REPEAT } from '@/families/falling/input/RepeatTiming';
import { detectLocale } from '@/i18n/locales';
import { modeOpen } from '@/campaign/ModeUnlocks';
import { allowsMode, offersDaily } from '@/platform/Edition';
import { WebPlatform, type Platform } from '@/platform/Platform';
import { ModeCatalog } from '@/session/ModeCatalog';
import { AmbianceController } from '@/services/AmbianceController';
import { WornLook } from '@/services/WornLook';
import { AudioEngine } from '@/services/audio/AudioEngine';
import { CampaignService } from '@/services/CampaignService';
import { GiftService } from '@/services/GiftService';
import { SeasonService } from '@/services/SeasonService';
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
  /** The gift calendar (1.35): one gift a day of play. */
  readonly gifts: GiftService;
  /** The seasons and the week's event (1.36): points, the track's rewards, the week's goal. */
  readonly seasons: SeasonService;
  /** What the player wears now: their equipment, or a look tried for one game (1.31). */
  readonly look: WornLook;
  /** Campaign stars and upgrades. */
  readonly campaign: CampaignService;
  readonly share: ShareService;
  readonly catalog: ModeCatalog;
  readonly audio: AudioEngine;
  readonly haptics: Haptics;
  readonly clock: () => Date;
  /** Our site or a game portal: gameplay events, ads, the portal's mute button. */
  readonly platform: Platform;
  /** The ad policy for this visit: the newcomers' grace, the interval, the rewarded offers. */
  readonly ads: AdScheduler;
  /** How many canvas pixels a CSS pixel gets: the screen's density, capped (see `GAME_PIXEL_RATIO`). */
  readonly pixelRatio: () => number;
}

export const APP_SERVICES: InjectionKey<AppServices> = Symbol('AppServices');

/**
 * The game's canvases draw at the screen's density, at most 2: beyond it, the
 * fill rate costs frames for no difference a player sees. The clip factory's
 * page (1.39) draws at 3, to crop and zoom a frame without blur.
 */
export const GAME_PIXEL_RATIO = 2;

export interface ServiceOptions {
  /** The canvases' highest density (`GAME_PIXEL_RATIO` in the game). */
  readonly maxPixelRatio?: number;
}

export function createBrowserServices(
  platform: Platform = new WebPlatform(),
  storage: KeyValueStorage = platform.storage ?? BrowserStorage.local(),
  { maxPixelRatio = GAME_PIXEL_RATIO }: ServiceOptions = {},
): AppServices {
  const settings = new SettingsService(storage, {
    // A portal knows the player's language; English when the game lacks it (Russian for
    // Russia's neighbours on Yandex).
    locale: detectLocale(platform.locale ? [platform.locale] : navigator.languages, platform),
    ghost: true,
    // Players who ask their system for less motion start with calmer effects.
    effects: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
    shake: true,
    // Vibrations are asked for, not imposed (1.32): players find them tiring.
    haptics: false,
    volume: 0.7,
    musicVolume: 0.5,
    controls: 'gestures',
    dragSpeed: DRAG_SPEED.standard,
    tapSides: true,
    leftHanded: false,
    muted: false,
    keys: DEFAULT_KEYS,
    ...DEFAULT_REPEAT,
  });
  // A portal's language wins at each launch over the saved one (Playgama and
  // CrazyGames both check that the game follows it).
  if (platform.locale) settings.chooseLocale(detectLocale([platform.locale], platform));
  const catalog = new ModeCatalog();
  const campaign = new CampaignService(storage);
  // Objectives only ask for modes the player can reach (in this edition, open in the
  // campaign), and for the daily challenge only where there is one.
  const profile = new ProfileService(storage, () => ({
    modes: catalog
      .list()
      .map((mode) => mode.id)
      .filter((id) => allowsMode(platform.edition, id) && modeOpen(id, campaign.model)),
    daily: offersDaily(platform.edition),
  }));
  const look = new WornLook(profile);
  new AmbianceController(look, settings, document.documentElement);
  const clock = () => new Date();
  return {
    settings,
    theme: new ThemeController(document.documentElement),
    scores: new ScoreBoard(storage),
    profile,
    gifts: new GiftService(profile, clock),
    seasons: new SeasonService(storage, profile, clock),
    look,
    campaign,
    share: new ShareService(navigator),
    catalog,
    audio: AudioEngine.browser(),
    haptics: new Haptics(navigator, () => settings.current.haptics),
    clock,
    platform,
    ads: new AdScheduler(
      AD_TUNING[platform.id],
      // No-ads arrives with the purchases (1.31): until then, nobody owns it. A player back
      // after a week away has the newcomers' grace again (1.35): their play counts from then.
      () => ({
        playedMs: profile.current.playedMs - profile.current.graceFromMs,
        adFree: false,
      }),
      () => clock().getTime(),
    ),
    pixelRatio: () => Math.min(maxPixelRatio, window.devicePixelRatio || 1),
  };
}

export function useServices(): AppServices {
  const services = inject(APP_SERVICES);
  if (!services) throw new Error('App services are not provided');
  return services;
}
