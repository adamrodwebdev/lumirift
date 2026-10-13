/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** The platform of the build: unset for our own site, `crazygames` for the portal. */
  readonly VITE_PLATFORM?: 'crazygames';
}
