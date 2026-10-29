import { createApp, nextTick } from 'vue';
import { APP_SERVICES, createBrowserServices, type AppServices } from '@/app/AppServices';
import { FrameClock } from '@/app/FrameClock';
import { Tone } from '@/core/Tone';
import { FallingSession } from '@/families/falling/FallingSession';
import { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import { SandSession } from '@/families/sand/SandSession';
import { createAppI18n } from '@/i18n';
import { WebPlatform } from '@/platform/Platform';
import { MemoryStorage } from '@/services/KeyValueStorage';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/stage.css';
import '@/styles/ambiances.css';
import { CLIP_WEEKS, TAKE_SETS, type ClipWeek, type TakeRecipe } from './clips';
import { SCENES, type FireChoice, type Scene, type SceneName } from './scenes';
import { SetTime } from './SetTime';
import ShowcaseView from './ShowcaseView.vue';
import { TakeSound } from './TakeSound';

/*
 * The set of the preview videos and of the clip factory (dev server only):
 * the real stages, a clock moved frame by frame by the recorder
 * (scripts/showcase-frames.mjs, scripts/clip-factory.mjs), so every frame is
 * rendered exactly, whatever the speed of the machine.
 *
 * `?clip` puts up the clip factory's set (1.39), one take per page load:
 * - the canvases draw at 3×, to crop and zoom without blur (the game and the
 *   portal videos stay at 2×);
 * - the game's screen (540 × 960) has a margin of its own background above
 *   and below, where the camera can go to keep the action in the apps' safe
 *   area;
 * - the page runs on the set's clock alone (SetTime): two takes of a scene
 *   draw the same frames;
 * - a take can carry its sound (TakeSound), rendered with its frames.
 */
const clip = new URLSearchParams(location.search).has('clip');
/** The background above and below the game's screen on the clip set (CSS px). */
const CLIP_MARGIN = 160;
/** Where a badge sits under the well, on a split screen's take (CSS px below its bottom edge). */
const MARKER_UNDER = 80;

const time = clip ? new SetTime(window) : null;
time?.install();
if (clip) document.documentElement.style.setProperty('--clip-margin', `${CLIP_MARGIN}px`);
/** The page's own waits keep the machine's clock. */
const wait = (ms: number) =>
  new Promise<void>((resolve) =>
    time ? time.realTimeout(resolve, ms) : window.setTimeout(resolve, ms),
  );

/** A clock moved by hand: `step` runs the frame it would have run. */
function handClock() {
  let pending: ((time: number) => void) | null = null;
  let now = 0;
  const clock = new FrameClock(
    (callback) => {
      pending = callback;
      return 1;
    },
    () => (pending = null),
  );
  return {
    clock,
    step(ms: number) {
      now += ms;
      const run = pending;
      pending = null;
      run?.(now);
    },
  };
}

// A canvas sized by its box may trip the browser's harmless "ResizeObserver loop"
// notice: it must not reach the dev server's error overlay in the middle of a video.
window.addEventListener('error', (event) => {
  if (event.message.includes('ResizeObserver loop')) event.stopImmediatePropagation();
});

const services = createBrowserServices(new WebPlatform(), new MemoryStorage(), {
  maxPixelRatio: clip ? 3 : 2,
});
services.settings.chooseEffects('full');
services.settings.chooseLocale('en');
const i18n = await createAppI18n('en');

interface StageHost {
  show(scene: Scene): void;
}

/** The set: the stage's view on a clock moved by hand, playing with these services. */
function mountSet(played: AppServices) {
  const hand = handClock();
  const view = createApp(ShowcaseView, { clock: hand.clock })
    .provide(APP_SERVICES, played)
    .use(i18n)
    .mount('#showcase') as unknown as StageHost;
  hand.clock.start();
  return { view, step: (ms: number) => hand.step(ms) };
}

// The preview videos' set stands from the start; a clip's set goes up with its take.
let set = clip ? null : mountSet(services);
let sound: TakeSound | null = null;

/**
 * Math.random, seeded: two recordings of a scene draw the same particles and
 * dust (the engines have their own seeded sources already).
 */
function seedRandom(text: string): void {
  let state = 2166136261;
  for (const char of text) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A take shot for a split screen: a plain background, no piece boxes (only the well is filmed). */
function plainSet(): void {
  const style = document.createElement('style');
  style.textContent =
    'body{background-image:none}body::before{display:none}.stage__hold,.stage__next{visibility:hidden}';
  document.head.append(style);
}

/** A box on the page, in CSS pixels. */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
const toBox = (rect: DOMRect): Box => ({
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
});

/** A moment of the scene, as the clip factory names it, and where it happened on the page. */
interface Peak {
  readonly event: string;
  /** Time since the scene started (ms). */
  readonly ms: number;
  /** In CSS pixels of the page, or null when the engine says no place. */
  readonly at: { readonly x: number; readonly y: number } | null;
  /** How far the action reaches up and down (CSS px of the page), when it is more than a point. */
  readonly extent: { readonly top: number; readonly bottom: number } | null;
}

/** A place in the well, as shares of its width and height. */
interface Share {
  readonly x: number;
  readonly y: number;
}
/** A stretch of the well's height, as shares of it. */
interface Band {
  readonly top: number;
  readonly bottom: number;
}
/**
 * The Heart lives under the floor: its rows of rubble rise from below and
 * burst there, four rows at most at once (an I), and it is wounded there.
 * Its moments happen at the floor; the action is the floor and those rows.
 */
const HEART_FLOOR: Share = { x: 0.5, y: 1 };
const HEART_ROWS: Band = { top: 0.8, bottom: 1 };

const toneName = (tone: number) =>
  (Object.keys(Tone) as (keyof typeof Tone)[]).find((key) => Tone[key] === tone)?.toLowerCase() ??
  String(tone);

const wellCanvas = (root: ParentNode = document) =>
  root.querySelector<HTMLCanvasElement>('#showcase .stage__well canvas');

/** What the engine measured since the scene started: the counts a challenge's caption quotes. */
interface Measures {
  burnt: number;
  struck: number;
  cleared: number;
}

/** Records the scene's moments (what happened, when, where on the page) and its counts. */
function recordPeaks(scene: Scene, now: () => number, measures: Measures): Peak[] {
  const peaks: Peak[] = [];
  const add = (event: string, share?: Share | null, band?: Band) => {
    const rect = wellCanvas()?.getBoundingClientRect();
    const at =
      share && rect
        ? { x: rect.left + share.x * rect.width, y: rect.top + share.y * rect.height }
        : null;
    const extent =
      band && rect
        ? { top: rect.top + band.top * rect.height, bottom: rect.top + band.bottom * rect.height }
        : null;
    peaks.push({ event, ms: now(), at, extent });
  };
  const { session } = scene;
  if (session instanceof SandSession) {
    const { width, height } = session.view.grid;
    const grain = (x: number, y: number): Share => ({
      x: (x + 0.5) / width,
      y: (y + 0.5) / height,
    });
    session.onGame('spawn', ({ piece }) => add(`spawn.${toneName(piece.tone)}`));
    session.onGame('react', ({ kind, x, y, grains }) => {
      measures.burnt += kind === 'blaze' || kind === 'scorch' ? grains : 0;
      add(`react.${kind}`, grain(x, y));
    });
    session.onGame('burn', ({ grains }) => (measures.burnt += grains));
    session.onGame('strike', ({ kind, x, toY, grains }) => {
      measures.struck += grains;
      add(`strike.${kind}`, grain(x, toY));
    });
    session.onGame('quench', ({ samples }) => {
      const first = samples[0];
      add('quench', first && grain(first.x, first.y));
    });
    session.onGame('clear', ({ samples, grains }) => {
      measures.cleared += grains;
      const first = samples[0];
      add('clear', first && grain(first.x, first.y));
    });
    session.onGame('boss', ({ event }) => add(`boss.${event.type}`));
  } else if (session instanceof FallingSession) {
    session.onGame('clear', ({ lines }) => {
      measures.cleared += lines;
      add(`clear.${lines}`);
    });
    const { mode } = session.view;
    if (mode instanceof RiftHeartMode) {
      mode.heartEvents.on('boss', ({ event }) =>
        add(
          event.type === 'hurt' ? `heart.hurt.${event.hit}` : `heart.${event.type}`,
          HEART_FLOOR,
          HEART_ROWS,
        ),
      );
    }
  }
  return peaks;
}

/** Where a challenge's answers go, as shares of the well (the fire challenge: oil left, water right). */
const MARKER_PLACES: Readonly<Record<string, Share>> = {
  A: { x: 0.2, y: 0.36 },
  B: { x: 0.78, y: 0.36 },
};

/** A badge on the page: its centre and its size (CSS px). */
interface Mark {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}
/** A badge's size: larger under a well, which a split screen shows at half the scale. */
const MARK_SIZE = { over: 64, under: 96 } as const;

/**
 * A challenge's A and B, in the game's own type: the only drawing the clips
 * add. Over the well where each answer drops, or `under` it (a split screen's
 * take: its one answer under its well). Returns where they are.
 */
function showMarkers(labels: readonly string[] | null, under = false): Mark[] {
  document.querySelector('#clip-markers')?.remove();
  const rect = wellCanvas()?.getBoundingClientRect();
  if (!labels?.length || !rect) return [];
  const marks: Mark[] = [];
  const size = under ? MARK_SIZE.under : MARK_SIZE.over;
  const layer = document.createElement('div');
  layer.id = 'clip-markers';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10';
  for (const label of labels) {
    const place = MARKER_PLACES[label] ?? { x: 0.5, y: 0.36 };
    const left = rect.left + (under ? 0.5 : place.x) * rect.width;
    const top = under ? rect.bottom + MARKER_UNDER : rect.top + place.y * rect.height;
    const badge = document.createElement('div');
    badge.textContent = label;
    badge.style.cssText = [
      'position:absolute',
      `left:${left}px`,
      `top:${top}px`,
      'transform:translate(-50%,-50%)',
      `width:${size}px`,
      `height:${size}px`,
      'display:grid',
      'place-items:center',
      'border-radius:50%',
      'background:var(--accent-fill)',
      'color:var(--on-accent-fill)',
      'font-family:var(--font-display)',
      'font-weight:800',
      `font-size:${Math.round(size * 0.53)}px`,
      'box-shadow:0 0 0 3px var(--bg),0 0 28px var(--accent-fill)',
    ].join(';');
    layer.append(badge);
    marks.push({ x: left, y: top, size });
  }
  document.body.append(layer);
  return marks;
}

/** Samples to text, for the trip back to the recorder. */
function toBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

let current: { scene: Scene; peaks: Peak[]; measures: Measures } | null = null;
let sceneMs = 0;

/** A take's options on the clip set. */
interface TakeOptions {
  /** The take carries its sound, this long (ms), at `fps` frames a second. */
  readonly soundMs?: number;
  readonly fps?: number;
  /** For a split screen: a plain background, no piece boxes. */
  readonly plain?: boolean;
}

/** Where the camera can look: the page, the game's screen on it and its well (CSS px). */
interface SetLayout {
  readonly page: { readonly width: number; readonly height: number };
  readonly screen: Box | null;
  readonly well: Box | null;
}

declare global {
  interface Window {
    showcase: {
      scene(
        name: SceneName,
        variant?: number,
        choice?: FireChoice | null,
        options?: TakeOptions,
      ): Promise<void>;
      step(ms: number): Promise<void>;
      peaks(): readonly Peak[];
      measures(): Measures;
      well(): Box | null;
      layout(): SetLayout;
      markers(labels: readonly string[] | null, under?: boolean): readonly Mark[];
      background(): string;
      week(monday: string): ClipWeek | null;
      /** A set of plain takes (1.41), or null. */
      takes(set: string): readonly TakeRecipe[] | null;
      /** The take's sound (one text of 32-bit float samples per channel), or null without sound. */
      audio(): Promise<string[] | null>;
    };
  }
}

window.showcase = {
  async scene(name, variant = 0, choice = null, { soundMs = 0, fps = 30, plain = false } = {}) {
    showMarkers(null);
    if (clip) {
      if (set) throw new Error('One take per load of the clip set: reload it for the next');
      if (plain) plainSet();
      // The sound's own noise first: the scene's draws stay the same with or without it.
      seedRandom('sound');
      sound = soundMs > 0 ? new TakeSound(soundMs, fps) : null;
      set = mountSet(sound ? { ...services, audio: sound.engine } : services);
    }
    if (!set) throw new Error('The set is not up');
    seedRandom(`${name}:${variant}:${choice ?? '-'}`);
    const scene = SCENES[name](variant, choice);
    sceneMs = 0;
    const measures = { burnt: 0, struck: 0, cleared: 0 };
    current = { scene, peaks: recordPeaks(scene, () => sceneMs, measures), measures };
    set.view.show(scene);
    await nextTick();
    // Lets the stage mount, measure itself and draw a first frame.
    await wait(300);
  },
  async step(ms) {
    if (!set) throw new Error('No scene on the set');
    await sound?.ready();
    sceneMs += ms;
    time?.advance(ms);
    set.step(ms);
    await nextTick();
    time?.stepAnimations(ms);
    if (sound && current) sound.played(current.scene.session.pressure(), ms);
  },
  peaks: () => current?.peaks ?? [],
  measures: () => ({ ...(current?.measures ?? { burnt: 0, struck: 0, cleared: 0 }) }),
  well() {
    const rect = wellCanvas()?.getBoundingClientRect();
    return rect ? toBox(rect) : null;
  },
  layout() {
    const main = document.querySelector('#showcase .showcase')?.getBoundingClientRect();
    const margin = clip ? CLIP_MARGIN : 0;
    const well = wellCanvas()?.getBoundingClientRect();
    return {
      page: { width: window.innerWidth, height: window.innerHeight },
      screen: main
        ? {
            x: main.left,
            y: main.top + margin,
            width: main.width,
            height: main.height - 2 * margin,
          }
        : null,
      well: well ? toBox(well) : null,
    };
  },
  markers: showMarkers,
  background: () => getComputedStyle(document.body).backgroundColor,
  week: (monday) => CLIP_WEEKS[monday] ?? null,
  takes: (name) => TAKE_SETS[name] ?? null,
  async audio() {
    const channels = await sound?.samples();
    return channels ? channels.map(toBase64) : null;
  },
};
