<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { MAX_RANK, nextRankCost, UPGRADES, type UpgradeId } from '@/campaign/Upgrades';
import { useCampaignText } from '../useCampaignText';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The campaign upgrades: ten of them, three ranks each, bought with the
 * stars won in the levels. Stars can all be taken back to try others.
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
    const cost = nextRankCost(rank);
    return { upgrade, rank, cost, affordable: model.canBuy(upgrade.id) };
  });
});
const available = computed(() => campaign.model.availableStars);
const spent = computed(() => campaign.model.spentStars);

const buy = (id: UpgradeId) => campaign.buy(id);
</script>

<template>
  <ModalDialog :open="open" :title="t('upgrades.title')" @dismiss="emit('close')">
    <p class="intro">{{ t('upgrades.intro') }}</p>
    <p class="wallet">
      <AppIcon name="star" :size="20" />
      {{ t('upgrades.available', { n: available }, available) }}
    </p>
    <ul class="grid">
      <li v-for="card in cards" :key="card.upgrade.id" class="upgrade">
        <span class="upgrade__icon" aria-hidden="true">
          <AppIcon :name="card.upgrade.id" :size="26" />
        </span>
        <span class="upgrade__body">
          <span class="upgrade__name">{{ text.upgradeName(card.upgrade.id) }}</span>
          <span class="upgrade__scope">{{ t(`upgrades.scope.${card.upgrade.scope}`) }}</span>
          <span class="upgrade__effect">
            {{
              card.rank > 0 ? text.upgradeEffect(card.upgrade.id, card.rank) : t('upgrades.none')
            }}
          </span>
          <span v-if="card.rank < MAX_RANK" class="upgrade__next">
            {{ t('upgrades.next', { effect: text.upgradeEffect(card.upgrade.id, card.rank + 1) }) }}
          </span>
        </span>
        <span class="upgrade__foot">
          <span
            class="pips"
            role="img"
            :aria-label="t('upgrades.rank', { n: card.rank, max: MAX_RANK })"
          >
            <span
              v-for="n in MAX_RANK"
              :key="n"
              class="pip"
              :class="{ 'pip--on': n <= card.rank }"
            />
          </span>
          <button
            type="button"
            class="btn upgrade__buy"
            :class="{ 'btn--primary': card.affordable }"
            :disabled="!card.affordable"
            @click="buy(card.upgrade.id)"
          >
            <template v-if="card.cost === null">{{ t('upgrades.max') }}</template>
            <template v-else>
              <AppIcon name="star" :size="16" />
              {{ t('upgrades.buy', { n: card.cost }) }}
            </template>
          </button>
        </span>
      </li>
    </ul>
    <div class="actions">
      <button type="button" class="btn" :disabled="spent === 0" @click="campaign.refund()">
        {{ t('upgrades.refund') }}
      </button>
      <button type="button" class="btn btn--primary" @click="emit('close')">
        {{ t('upgrades.close') }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.intro {
  color: var(--text-muted);
}

.wallet {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-block: var(--space-3);
  font-weight: 800;
  color: var(--accent);
}

.grid {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.upgrade {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

.upgrade__icon {
  display: grid;
  place-items: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--accent);
}

.upgrade__body {
  display: grid;
  gap: 0.1rem;
}

.upgrade__name {
  font-weight: 800;
}

.upgrade__scope,
.upgrade__next {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.upgrade__effect {
  font-size: 0.9rem;
}

.pips {
  display: inline-flex;
  gap: var(--space-1);
}

.pip {
  inline-size: 1.4rem;
  block-size: 0.4rem;
  border-radius: 999px;
  background: var(--surface-2);
}

.pip--on {
  background: var(--accent-gradient);
}

.upgrade__foot {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.upgrade__buy:disabled {
  opacity: 0.55;
  cursor: default;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  margin-block-start: var(--space-6);
}

.actions .btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
