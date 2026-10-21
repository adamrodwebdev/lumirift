<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { MAX_STARS, type CampaignLevel } from '@/campaign/Levels';
import { newCosmetics } from '@/progression/Profile';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeId } from '@/session/ModeId';
import AppIcon from '../components/AppIcon.vue';
import PlayerChip from '../components/PlayerChip.vue';
import AtelierPage from '../hub/AtelierPage.vue';
import HomePage from '../hub/HomePage.vue';
import { HUB_ICONS, HUB_PAGES, type HubPage } from '../hub/hubPages';
import MapPage from '../hub/MapPage.vue';
import ModesPage from '../hub/ModesPage.vue';
import { useSwipe } from '../hub/useSwipe';
import { useLandscape } from '../useOrientation';
import '../hub/hub.css';

/**
 * The menu: four pages side by side (home, modes, campaign map, Atelier),
 * reached with the tabs or by swiping; the player, the stars, the sound and
 * the settings stay on top. The tabs sit under the thumb on a phone held
 * upright, and become a rail on the left of a wide screen.
 */
const props = defineProps<{
  /** Back from a game: the pages and tabs rise into place. */
  returning?: boolean;
}>();
const page = defineModel<HubPage>('page', { required: true });
const emit = defineEmits<{
  play: [modeId: ModeId, variant: string | null, origin: Element];
  daily: [challenge: DailyChallenge, origin: Element];
  level: [level: CampaignLevel, origin: Element];
  settings: [];
}>();

const { t } = useI18n();
const format = useFormat();
const { settings, campaign, profile } = useServices();
const landscape = useLandscape();

const index = computed(() => HUB_PAGES.indexOf(page.value));
const go = (target: number) => {
  const next = HUB_PAGES[Math.min(HUB_PAGES.length - 1, Math.max(0, target))];
  if (next) page.value = next;
};

/**
 * The pages are built when first needed: the one shown at once, a neighbour
 * as soon as a swipe heads for it, the others once the menu has settled (one
 * per idle moment). The first screen does not wait for the three others.
 */
const built = reactive(new Set<HubPage>([page.value]));
const build = (id: HubPage | undefined) => {
  if (id) built.add(id);
};
watch(page, build);
/** A page's place in the tabs pattern; only the page shown is reachable. */
const panel = (id: HubPage) => ({
  id: `hub-panel-${id}`,
  role: 'tabpanel',
  'aria-labelledby': `hub-tab-${id}`,
  inert: page.value !== id,
});
const SETTLE_MS = 2500;
let settled = false;
let settleTimer: number | undefined;
/** Safari has no idle callbacks: a short timer stands in. */
const idleCallback = (window as Partial<Pick<Window, 'requestIdleCallback'>>).requestIdleCallback;
const whenIdle = (run: () => void) =>
  idleCallback ? idleCallback.call(window, run, { timeout: 2000 }) : window.setTimeout(run, 200);
onMounted(() => {
  const queue = HUB_PAGES.filter((id) => !built.has(id));
  const next = () => {
    if (settled) return;
    build(queue.shift());
    if (queue.length > 0) whenIdle(next);
  };
  settleTimer = window.setTimeout(() => whenIdle(next), SETTLE_MS);
});
onBeforeUnmount(() => {
  settled = true;
  window.clearTimeout(settleTimer);
});

const muted = computed(() => settings.current.muted);
/** Looks earned and not seen in the Atelier yet: a badge on its tab. */
const newLooks = computed(() => newCosmetics(profile.current).length);
const stars = computed(() => campaign.model.totalStars);

// --- Swiping between pages ---------------------------------------------------

const pages = ref<HTMLElement | null>(null);
/** How far (px) the finger has pulled the pages; 0 at rest. */
const drag = ref(0);
const dragging = ref(false);
/** Where the tab pill stands, in pages (it follows the finger). */
const position = computed(() => index.value - drag.value / (pages.value?.clientWidth || 1));

useSwipe(pages, {
  move(dx) {
    dragging.value = true;
    build(HUB_PAGES[index.value + (dx < 0 ? 1 : -1)]);
    const pastEdge =
      (dx > 0 && index.value === 0) || (dx < 0 && index.value === HUB_PAGES.length - 1);
    drag.value = pastEdge ? dx / 3 : dx;
  },
  end(dx, velocity) {
    dragging.value = false;
    drag.value = 0;
    const width = pages.value?.clientWidth ?? 1;
    const step =
      Math.abs(velocity) > 0.45
        ? -Math.sign(velocity)
        : Math.abs(dx) > width * 0.22
          ? -Math.sign(dx)
          : 0;
    if (step !== 0) go(index.value + step);
  },
  cancel() {
    dragging.value = false;
    drag.value = 0;
  },
});

// --- Tabs: arrows move between them (WAI-ARIA tabs, automatic activation) ---

const tabs = ref<HTMLButtonElement[]>([]);
const onTabKey = (event: KeyboardEvent) => {
  const last = HUB_PAGES.length - 1;
  const moves: Record<string, number> = {
    ArrowRight: index.value + 1,
    ArrowDown: index.value + 1,
    ArrowLeft: index.value - 1,
    ArrowUp: index.value - 1,
    Home: 0,
    End: last,
  };
  const target = moves[event.key];
  if (target === undefined) return;
  event.preventDefault();
  const next = (target + HUB_PAGES.length) % HUB_PAGES.length;
  go(next);
  void nextTick(() => tabs.value[next]?.focus());
};

// Back from a game: the pages and tabs rise, once.
const rising = ref(props.returning);
onMounted(() => {
  if (rising.value) window.setTimeout(() => (rising.value = false), 700);
});
</script>

<template>
  <div class="hub" :class="{ 'hub--rising': rising }">
    <header class="hub__top">
      <PlayerChip @atelier="go(3)" />
      <button
        type="button"
        class="stars"
        :aria-label="t('hub.stars', { n: stars, max: MAX_STARS })"
        @click="go(2)"
      >
        <AppIcon name="star" :size="18" />
        <span>{{ format.number(stars) }}</span>
        <small>/ {{ format.number(MAX_STARS) }}</small>
      </button>
      <span class="hub__grow" />
      <button
        type="button"
        class="btn btn--square"
        :aria-label="muted ? t('nav.unmute') : t('nav.mute')"
        :aria-pressed="muted"
        @click="settings.update({ muted: !muted })"
      >
        <AppIcon :name="muted ? 'mute' : 'sound'" />
      </button>
      <button
        type="button"
        class="btn btn--square"
        :aria-label="t('nav.settings')"
        @click="emit('settings')"
      >
        <AppIcon name="settings" />
      </button>
    </header>

    <div ref="pages" class="hub__pages">
      <div
        class="hub__track"
        :class="{ 'hub__track--dragging': dragging }"
        :style="{ '--index': index, '--drag': `${drag}px` }"
      >
        <HomePage
          v-if="built.has('home')"
          v-bind="panel('home')"
          :active="page === 'home'"
          @play="(modeId, origin) => emit('play', modeId, null, origin)"
          @daily="(challenge, origin) => emit('daily', challenge, origin)"
          @level="(level, origin) => emit('level', level, origin)"
        />
        <section v-else v-bind="panel('home')" class="page" />
        <ModesPage
          v-if="built.has('modes')"
          v-bind="panel('modes')"
          @play="(modeId, variant, origin) => emit('play', modeId, variant, origin)"
        />
        <section v-else v-bind="panel('modes')" class="page" />
        <MapPage
          v-if="built.has('map')"
          v-bind="panel('map')"
          @play="(level, origin) => emit('level', level, origin)"
        />
        <section v-else v-bind="panel('map')" class="page" />
        <AtelierPage
          v-if="built.has('atelier')"
          v-bind="panel('atelier')"
          :active="page === 'atelier'"
        />
        <section v-else v-bind="panel('atelier')" class="page" />
      </div>
    </div>

    <nav class="hub__tabs" :aria-label="t('hub.pages')">
      <div
        class="tabs"
        role="tablist"
        :aria-orientation="landscape ? 'vertical' : 'horizontal'"
        :style="{ '--position': position }"
        @keydown="onTabKey"
      >
        <span class="tabs__pill" :class="{ 'tabs__pill--dragging': dragging }" aria-hidden="true" />
        <button
          v-for="(id, i) in HUB_PAGES"
          :id="`hub-tab-${id}`"
          :key="id"
          ref="tabs"
          type="button"
          role="tab"
          class="tab"
          :aria-selected="i === index"
          :aria-controls="`hub-panel-${id}`"
          :tabindex="i === index ? 0 : -1"
          @click="go(i)"
        >
          <AppIcon :name="HUB_ICONS[id]" :size="25" />
          <span>{{ t(`hub.tabs.${id}`) }}</span>
          <span v-if="id === 'atelier' && newLooks > 0" class="tab__badge">
            <span aria-hidden="true">{{ format.number(newLooks) }}</span>
            <span class="sr-only">{{ t('hub.newLooks', { n: newLooks }, newLooks) }}</span>
          </span>
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* Portrait: the bar on top, the pages, the tabs under the thumb. */
.hub {
  container: hub / size;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'top'
    'pages'
    'tabs';
  height: 100dvh;
  overflow: hidden;
  /* Nothing scrolls: the fingers belong to the pager and the buttons. */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.hub__top {
  grid-area: top;
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: calc(var(--space-2) + env(safe-area-inset-top))
    calc(var(--space-3) + env(safe-area-inset-right)) 0.375rem
    calc(var(--space-3) + env(safe-area-inset-left));
}

.hub__grow {
  flex: 1;
}

.stars {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.stars :deep(svg) {
  fill: currentColor;
}

.stars small {
  color: var(--text-muted);
  font-weight: 600;
}

.hub__pages {
  /* The pages size their content on this box (`cq` units), the hub's own queries on `hub`. */
  container: pages / size;
  grid-area: pages;
  position: relative;
  overflow: hidden;
}

.hub__track {
  position: absolute;
  inset: 0;
  display: flex;
  width: 400%;
  transform: translate3d(calc(var(--index) * -25% + var(--drag)), 0, 0);
  transition: transform 420ms var(--ease-out);
  will-change: transform;
}

.hub__track > * {
  flex: 0 0 25%;
}

.hub__track--dragging,
.tabs__pill--dragging {
  transition: none;
}

.hub__tabs {
  grid-area: tabs;
  position: relative;
  z-index: 3;
  padding: var(--space-1) calc(0.625rem + env(safe-area-inset-right))
    calc(var(--space-2) + env(safe-area-inset-bottom)) calc(0.625rem + env(safe-area-inset-left));
}

.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-1);
  height: 4rem;
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: 1.375rem;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow:
    var(--shadow),
    inset 0 1px 0 var(--highlight);
}

/* The chosen tab's pill: it slides from tab to tab, and follows a swipe. */
.tabs__pill {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: var(--space-1);
  width: calc((100% - 5 * var(--space-1)) / 4);
  border-radius: 1.125rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-2) 70%, var(--jewel-violet)),
    var(--surface-2)
  );
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent),
    0 0.4rem 1.1rem color-mix(in srgb, var(--rift-glow) 20%, transparent);
  transform: translate3d(calc(var(--position) * (100% + var(--space-1))), 0, 0);
  transition: transform 420ms var(--ease-out);
  pointer-events: none;
}

.tab {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space-1);
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 1.125rem;
  background: none;
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab :deep(svg) {
  transition:
    transform 420ms var(--ease-spring),
    color 200ms ease;
}

.tab[aria-selected='true'] {
  color: var(--text);
}

.tab .tab__badge {
  position: absolute;
  top: 0.35rem;
  left: calc(50% + 0.45rem);
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--jewel-rose);
  color: var(--bg);
  font-size: 0.65rem;
  line-height: 1.1rem;
  letter-spacing: 0;
  text-align: center;
  box-shadow: 0 0.2rem 0.6rem color-mix(in srgb, var(--jewel-rose) 50%, transparent);
}

.tab[aria-selected='true'] :deep(svg) {
  color: var(--accent);
  transform: translateY(-1px) scale(1.14);
}

/* Back from a game: the pages and the tabs rise into place. */
.hub--rising .hub__pages {
  animation: rise 520ms var(--ease-out) both;
}

.hub--rising .hub__tabs {
  animation: rise 520ms var(--ease-out) 120ms both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(1.1rem);
  }
}

/* Landscape and desktop: the tabs become a rail on the left. */
@media (orientation: landscape) {
  .hub {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      'tabs top'
      'tabs pages';
  }

  .hub__top {
    padding-left: 0.625rem;
  }

  .hub__tabs {
    display: flex;
    align-items: center;
    padding: calc(0.625rem + env(safe-area-inset-top)) 0
      calc(0.625rem + env(safe-area-inset-bottom)) calc(0.625rem + env(safe-area-inset-left));
  }

  .tabs {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(4, minmax(0, 1fr));
    width: 4.875rem;
    height: min(100%, 20rem);
  }

  .tabs__pill {
    right: var(--space-1);
    bottom: auto;
    width: auto;
    height: calc((100% - 5 * var(--space-1)) / 4);
    transform: translate3d(0, calc(var(--position) * (100% + var(--space-1))), 0);
  }
}
</style>
