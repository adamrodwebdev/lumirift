<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey, previousDay } from '@/core/Day';
import { levelProgress } from '@/progression/Experience';
import { OBJECTIVE_XP } from '@/progression/Objectives';
import { useProgressText } from '../useProgressText';
import AppIcon from './AppIcon.vue';

/** The player's level, streak and objectives of the day, on the home screen. */
const emit = defineEmits<{ atelier: [] }>();

const { t } = useI18n();
const format = useFormat();
const { profile, clock } = useServices();
const text = useProgressText();

const day = dayKey(clock());
const level = computed(() => levelProgress(profile.current.xp));
const share = computed(() =>
  level.value.needed === 0 ? 100 : Math.round((level.value.into / level.value.needed) * 100),
);
// A new day brings new objectives.
profile.objectivesFor(day);
const objectives = computed(() => profile.current.objectives);
const streak = computed(() => {
  const { count, lastDay } = profile.current.streak;
  // A streak still counts if the daily challenge was played today or yesterday.
  return lastDay === day || lastDay === previousDay(day) ? count : 0;
});
</script>

<template>
  <section class="profile" aria-labelledby="profile-title">
    <div class="profile__head">
      <h2 id="profile-title" class="profile__level">
        {{ t('profile.level', { n: level.level }) }}
      </h2>
      <p v-if="streak > 0" class="profile__streak">
        <AppIcon name="flame" :size="18" />{{ t('profile.streak', { n: streak }, streak) }}
      </p>
      <button type="button" class="btn profile__atelier" @click="emit('atelier')">
        <AppIcon name="atelier" :size="20" />{{ t('cosmetics.title') }}
      </button>
    </div>

    <div
      class="xp"
      role="progressbar"
      :aria-label="t('profile.xpLabel')"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="share"
      :aria-valuetext="
        level.needed === 0
          ? t('profile.maxLevel')
          : t('profile.xp', {
              into: format.number(level.into),
              needed: format.number(level.needed),
            })
      "
    >
      <span class="xp__fill" :style="{ inlineSize: `${share}%` }" />
    </div>
    <p class="profile__xp">
      {{
        level.needed === 0
          ? t('profile.maxLevel')
          : t('profile.xp', {
              into: format.number(level.into),
              needed: format.number(level.needed),
            })
      }}
    </p>

    <h3 class="profile__subtitle">{{ t('profile.objectives') }}</h3>
    <ul class="objectives">
      <li
        v-for="entry in objectives"
        :key="entry.objective.kind"
        class="objective"
        :class="{ 'objective--done': entry.done }"
      >
        <AppIcon v-if="entry.done" name="check" :size="18" />
        <span class="objective__text">{{ text.objective(entry.objective) }}</span>
        <span class="objective__progress">
          {{
            entry.done
              ? t('profile.done')
              : `${format.number(entry.progress)} / ${format.number(entry.objective.target)}`
          }}
        </span>
        <span class="objective__reward">{{
          t('profile.reward', { n: OBJECTIVE_XP[entry.objective.tier] })
        }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.profile {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.profile__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}

.profile__level {
  font-size: clamp(1.3rem, 1.1rem + 1vw, 1.7rem);
}

.profile__streak {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 700;
  color: var(--accent);
}

.profile__atelier {
  margin-inline-start: auto;
}

.xp {
  block-size: 0.6rem;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.xp__fill {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--accent-fill);
  transition: inline-size 400ms ease;
}

.profile__xp {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.profile__subtitle {
  margin-block-start: var(--space-2);
  font-size: 1rem;
}

.objectives {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.objective {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.objective--done {
  grid-template-columns: auto 1fr auto;
  color: var(--text-muted);
}

.objective__progress {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.objective__reward {
  grid-column: 1 / -1;
  font-size: 0.8rem;
  color: var(--text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .xp__fill {
    transition: none;
  }
}
</style>
