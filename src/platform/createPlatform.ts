import { DemoPlatform, WebPlatform, type Platform } from './Platform';

/**
 * The platform of this build (`vite build --mode crazygames`, `playgama`
 * or `demo` sets VITE_PLATFORM). A portal's code is a separate chunk, never downloaded by
 * the other builds.
 */
export async function createPlatform(): Promise<Platform> {
  if (import.meta.env.VITE_PLATFORM === 'crazygames') {
    const { CrazyGamesPlatform } = await import('./crazygames/CrazyGamesPlatform');
    return CrazyGamesPlatform.create();
  }
  if (import.meta.env.VITE_PLATFORM === 'playgama') {
    const { PlaygamaPlatform } = await import('./playgama/PlaygamaPlatform');
    return PlaygamaPlatform.create();
  }
  if (import.meta.env.VITE_PLATFORM === 'demo') return new DemoPlatform();
  return new WebPlatform();
}
