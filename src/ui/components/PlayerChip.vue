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
  gap: var(--space-3);
  min-height: var(--touch);
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: var(--text);
  text-align: start;
}

@media (min-width: 480px) {
  .chip {
    padding-inline-end: var(--space-4);
  }
}

.chip:hover {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
}

.chip__ring {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: conic-gradient(var(--accent) 0 var(--share), var(--surface-2) var(--share) 100%);
}

.chip__level {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--surface);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 0.85rem;
}

/* Phones: the ring alone, the row is for the daily challenge too. */
.chip__text {
  display: none;
  line-height: 1.2;
}

@media (min-width: 480px) {
  .chip__text {
    display: grid;
  }
}

.chip__name {
  font-weight: 700;
  font-size: 0.9rem;
}

.chip__xp {
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
