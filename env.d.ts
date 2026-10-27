/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** The platform of the build: unset for our own site, `crazygames` or `demo` (portfolio). */
  readonly VITE_PLATFORM?: 'crazygames' | 'playgama' | 'yandex' | 'demo';
  /** A test build of one mode alone (1.37, a sandbox test): `dunes` or `sand`; unset elsewhere. */
  readonly VITE_SOLO?: 'dunes' | 'sand';
}
