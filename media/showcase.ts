import { createApp, nextTick } from 'vue';
import { APP_SERVICES, createBrowserServices } from '@/app/AppServices';
import { FrameClock } from '@/app/FrameClock';
import { createAppI18n } from '@/i18n';
import { WebPlatform } from '@/platform/Platform';
import { MemoryStorage } from '@/services/KeyValueStorage';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/stage.css';
import '@/styles/ambiances.css';
import { SCENES, type SceneName } from './scenes';
import ShowcaseView from './ShowcaseView.vue';

/*
 * The preview videos' set (dev server only): the real stages, a clock moved
 * frame by frame by the recorder (scripts/crazygames-media.mjs), so every
 * frame is rendered exactly, whatever the speed of the machine.
 */
let pending: ((time: number) => void) | null = null;
let now = 0;
const clock = new FrameClock(
  (callback) => {
    pending = callback;
    return 1;
  },
  () => (pending = null),
);

// A canvas sized by its box may trip the browser's harmless "ResizeObserver loop"
// notice: it must not reach the dev server's error overlay in the middle of a video.
window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop')) event.stopImmediatePropagation();
});

const services = createBrowserServices(new WebPlatform(), new MemoryStorage());
services.settings.update({ effects: 'full', locale: 'en' });

const app = createApp(ShowcaseView, { clock })
  .provide(APP_SERVICES, services)
  .use(createAppI18n('en'));
const view = app.mount('#showcase') as unknown as { show(scene: unknown): void };
clock.start();

declare global {
  interface Window {
    showcase: { scene(name: SceneName): Promise<void>; step(ms: number): Promise<void> };
  }
}

window.showcase = {
  async scene(name) {
    view.show(SCENES[name]());
    await nextTick();
    // Lets the stage mount, measure itself and draw a first frame.
    await new Promise((resolve) => setTimeout(resolve, 300));
  },
  async step(ms) {
    now += ms;
    const run = pending;
    pending = null;
    run?.(now);
    await nextTick();
  },
};
