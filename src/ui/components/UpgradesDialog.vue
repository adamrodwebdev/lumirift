<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { MAX_RANK, nextRankCost, UPGRADES, type UpgradeId } from '@/campaign/Upgrades';
import { useCampaignText } from '../useCampaignText';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The campaign upgrades: ten of them, three ranks each, bought with the
 * stars won in the levels; every star can be taken back. The ten sit in a
 * grid; the one chosen shows what it does and is bought below.
 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { campaign } = useServices();
const text = useCampaignText();

const cards = computed(() => {
  const model = campaign.model;
  return UPGRADES.map((upgrade) => {
    const rank = model.rankOf(upgrade.id);
    return {
      upgrade,
      rank,
      cost: nextRankCost(rank),
      affordable: model.canBuy(upgrade.id),
    };
  });
});
const available = computed(() => campaign.model.availableStars);
const spent = computed(() => campaign.model.spentStars);

const selectedId = ref<UpgradeId>(UPGRADES[0]!.id);
const selected = computed(
  () => cards.value.find((card) => card.upgrade.id === selectedId.value) ?? cards.value[0]!,
);

const rankLabel = (rank: number) => t('upgrades.rank', { n: rank, max: MAX_RANK });
const buy = () => campaign.buy(selected.value.upgrade.id);
</script>

<template>
  <ModalDialog
    class="upgrades"
    :open="open"
    :title="t('upgrades.title')"
    closable
    wide
    @dismiss="emit('close')"
  >
    <div class="wallet">
      <p class="wallet__stars">
        <AppIcon name="star" :size="20" />
        {{ t('upgrades.available', { n: available }, available) }}
      </p>
      <button
        type="button"
        class="btn btn--ghost wallet__refund"
        :disabled="spent === 0"
        @click="campaign.refund()"
      >
        {{ t('upgrades.refund') }}
      </button>
    </div>

    <ul class="grid">
      <li v-for="card in cards" :key="card.upgrade.id">
        <button
          type="button"
          class="tile"
          :aria-pressed="selectedId === card.upgrade.id"
          @click="selectedId = card.upgrade.id"
        >
          <span class="tile__icon" aria-hidden="true">
            <AppIcon :name="card.upgrade.id" :size="22" />
          </span>
          <span class="tile__name">{{ text.upgradeName(card.upgrade.id) }}</span>
          <span class="pips" role="img" :aria-label="rankLabel(card.rank)">
            <span
              v-for="n in MAX_RANK"
              :key="n"
              class="pip"
              :class="{ 'pip--on': n <= card.rank }"
            />
          </span>
        </button>
      </li>
    </ul>

    <div class="detail" aria-live="polite">
      <div class="detail__text">
        <h3 class="detail__name">
          {{ text.upgradeName(selected.upgrade.id) }}
          <small>{{ t(`upgrades.scope.${selected.upgrade.scope}`) }}</small>
        </h3>
        <!-- Not bought yet: what the first rank brings says it all. -->
        <p v-if="selected.rank > 0" class="detail__effect">
          {{ text.upgradeEffect(selected.upgrade.id, selected.rank) }}
        </p>
        <p v-if="selected.rank < MAX_RANK" class="detail__next">
          {{
            t('upgrades.next', {
              effect: text.upgradeEffect(selected.upgrade.id, selected.rank + 1),
            })
          }}
        </p>
      </div>
      <button
        type="button"
        class="btn btn--raised detail__buy"
        :class="{ 'btn--primary': selected.affordable }"
        :disabled="!selected.affordable"
        @click="buy"
      >
        <template v-if="selected.cost === null">{{ t('upgrades.max') }}</template>
        <template v-else>
          <AppIcon name="star" :size="16" />
          {{ t('upgrades.buy', { n: selected.cost }) }}
        </template>
      </button>
    </div>

    <p class="sheet-note upgrades__note">{{ t('upgrades.note') }}</p>
  </ModalDialog>
</template>

<style scoped>
.wallet {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.wallet__stars {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 800;
}

.wallet__stars :deep(svg) {
  fill: currentColor;
}

.wallet__refund {
  flex: none;
  min-height: var(--touch);
  padding-inline: var(--space-2);
  color: var(--text-muted);
  font-size: 0.8rem;
  text-decoration: underline;
}

.wallet__refund:disabled {
  opacity: 0.45;
  cursor: default;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: var(--space-2);
  width: 100%;
  min-height: 3rem;
  padding: 0.35rem var(--space-2);
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  background: var(--highlight);
  text-align: start;
  transition:
    border-color 160ms ease,
    transform 120ms ease;
}

.tile:active {
  transform: scale(0.97);
}

.tile[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.tile__icon {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.65rem;
  background: var(--surface-2);
  color: var(--accent);
}

.tile__name {
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pips {
  display: inline-flex;
  gap: 0.2rem;
}

.pip {
  width: 1rem;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--surface-2);
}

.pip--on {
  background: var(--accent-gradient);
}

/* The upgrade chosen: what it does now, what the next rank adds, the way to buy it. */
.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  background: var(--well-bg);
}

.detail__name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
  font-size: 1rem;
}

.detail__name small {
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
}

.detail__effect {
  margin-top: 0.2rem;
  font-size: 0.85rem;
}

.detail__next {
  margin-top: 0.15rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.detail__buy {
  padding-inline: var(--space-3);
  font-size: 0.88rem;
  white-space: nowrap;
}

.detail__buy:disabled {
  opacity: 0.55;
  cursor: default;
}

/* Wide screens: the ten on the left; the stars and the chosen upgrade on the right. */
@media (orientation: landscape) {
  .upgrades[open] {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr) auto;
  }

  .grid {
    grid-column: 1;
    grid-row: 2 / span 3;
    align-content: start;
  }

  .tile {
    min-height: 2.75rem;
    padding-block: 0.2rem;
  }

  .wallet,
  .detail,
  .upgrades__note {
    grid-column: 2;
  }

  .detail {
    grid-template-columns: minmax(0, 1fr);
    align-self: stretch;
    align-content: space-between;
  }
}
</style>
