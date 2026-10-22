<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { levelProgress } from '@/progression/Experience';

/** The player in one chip: level ring and experience; opens the Atelier. */
const emit = defineEmits<{ atelier: [] }>();

const { t } = useI18n();
const format = useFormat();
const { profile } = useServices();

const level = computed(() => levelProgress(profile.current.xp));
const share = computed(() =>
  level.value.needed === 0 ? 1 : level.value.into / level.value.needed,
);
const xpText = computed(() =>
  level.value.needed === 0
    ? t('profile.maxLevel')
    : t('profile.xp', {
        into: format.number(level.value.into),
        needed: format.number(level.value.needed),
      }),
);
</script>

<template>
  <button
    type="button"
    class="chip"
    :aria-label="t('title.player', { level: level.level, xp: xpText })"
    @click="emit('atelier')"
  >
    <span class="chip__ring" :style="{ '--share': `${share * 100}%` }" aria-hidden="true">
      <span class="chip__level">{{ level.level }}</span>
    </span>
    <span class="chip__text" aria-hidden="true">
      <span class="chip__name">{{ t('profile.level', { n: level.level }) }}</span>
      <span class="chip__xp">{{ xpText }}</span>
    </span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0.2rem var(--space-3) 0.2rem 0.2rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: var(--text);
  text-align: start;
}

.chip:hover {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
}

.chip__ring {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  flex: none;
  border-radius: 50%;
  background: conic-gradient(var(--accent) 0 var(--share), var(--border) var(--share) 100%);
}

.chip__level {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  background: var(--surface);
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 0.85rem;
}

.chip__text {
  display: grid;
  gap: 0.05rem;
  line-height: 1.15;
}

.chip__name {
  font-weight: 700;
  font-size: 0.82rem;
}

.chip__xp {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}

/*
 * A narrow top bar (a phone under 360 px, a 400 % zoom): the ring alone tells
 * the level and its share of XP, and the bar keeps its buttons on screen.
 */
@container top (inline-size < 21rem) {
  .chip {
    padding: 0.2rem;
  }

  .chip__text {
    display: none;
  }
}
</style>
