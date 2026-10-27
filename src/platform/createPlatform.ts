import { FULL_EDITION, soloEdition } from './Edition';
import { DemoPlatform, WebPlatform, type Platform } from './Platform';

/** The edition of this build: one mode alone for a sandbox test (VITE_SOLO, 1.37), else the whole game. */
const solo = import.meta.env.VITE_SOLO;
const edition = solo ? soloEdition(solo) : FULL_EDITION;

/**
 * The platform of this build (`vite build --mode crazygames`, `playgama`,
 * `yandex` or `demo` sets VITE_PLATFORM). A portal's code is a separate chunk, never downloaded by
 * the other builds. A test build of one mode (`playgama-dunes`, `playgama-sand`, `dunes`) sets VITE_SOLO too.
 */
export async function createPlatform(): Promise<Platform> {
  if (import.meta.env.VITE_PLATFORM === 'crazygames') {
    const { CrazyGamesPlatform } = await import('./crazygames/CrazyGamesPlatform');
    return CrazyGamesPlatform.create();
  }
  if (import.meta.env.VITE_PLATFORM === 'playgama') {
    const { PlaygamaPlatform } = await import('./playgama/PlaygamaPlatform');
    return PlaygamaPlatform.create(undefined, edition);
  }
  if (import.meta.env.VITE_PLATFORM === 'yandex') {
    const { YandexPlatform } = await import('./yandex/YandexPlatform');
    return YandexPlatform.create();
  }
  if (import.meta.env.VITE_PLATFORM === 'demo') return new DemoPlatform();
  return new WebPlatform(edition);
}
