import { WebPlatform, type Platform } from './Platform';

/**
 * The platform of this build (`vite build --mode crazygames` sets
 * VITE_PLATFORM). A portal's code is a separate chunk, never downloaded by
 * the other builds.
 */
export async function createPlatform(): Promise<Platform> {
  if (import.meta.env.VITE_PLATFORM === 'crazygames') {
    const { CrazyGamesPlatform } = await import('./crazygames/CrazyGamesPlatform');
    return CrazyGamesPlatform.create();
  }
  return new WebPlatform();
}
