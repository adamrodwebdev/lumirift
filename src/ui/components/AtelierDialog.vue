<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { Tone } from '@/core/Tone';
import { blockSprites } from '@/families/falling/render/materials';
import {
  COSMETIC_KINDS,
  COSMETICS,
  type Cosmetic,
  type CosmeticKind,
  type MaterialId,
} from '@/progression/Cosmetics';
import { TonePalette } from '@/render/TonePalette';
import { useProgressText } from '../useProgressText';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The Atelier: every cosmetic, worn ones marked, locked ones with how to
 * earn them. Nothing here changes the game.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { profile, theme } = useServices();
const text = useProgressText();

const sections = computed(() =>
  COSMETIC_KINDS.map((kind) => ({
    kind,
    items: COSMETICS.filter((c) => c.kind === kind).map((cosmetic) => ({
      cosmetic,
      unlocked: profile.model.isUnlocked(cosmetic),
      worn: profile.current.equipment[kind] === cosmetic.id,
    })),
  })),
);

const wear = (kind: CosmeticKind, cosmetic: Cosmetic) => profile.equip(kind, cosmetic.id);

// --- Material previews: one block of each, drawn with the material itself ---

const swatches = ref<Record<string, HTMLCanvasElement | null>>({});
const PREVIEW_CSS = 40;

const drawMaterials = async () => {
  await nextTick();
  const palette = TonePalette.fromElement(document.documentElement);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const size = Math.round(PREVIEW_CSS * ratio);
  for (const cosmetic of COSMETICS.filter((c) => c.kind === 'material')) {
    const canvas = swatches.value[cosmetic.id];
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) continue;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(blockSprites(cosmetic.id as MaterialId, size, palette).get(Tone.T), 0, 0);
  }
};

watch(
  () => [props.open, theme.resolved.value] as const,
  ([open]) => {
    if (open) void drawMaterials();
  },
  { immediate: true },
);
</script>

<template>
  <ModalDialog :open="open" :title="t('cosmetics.title')" @dismiss="emit('close')">
    <p class="intro">{{ t('cosmetics.intro') }}</p>
    <section
      v-for="section in sections"
      :key="section.kind"
      class="kind"
      :aria-labelledby="`atelier-${section.kind}`"
    >
      <h3 :id="`atelier-${section.kind}`" class="kind__title">
        {{ t(`cosmetics.kinds.${section.kind}`) }}
      </h3>
      <p v-if="section.kind !== 'ambiance'" class="kind__note">
        {{ t(`cosmetics.scope.${section.kind}`) }}
      </p>
      <ul class="tiles">
        <li v-for="item in section.items" :key="item.cosmetic.id">
          <button
            type="button"
            class="tile"
            :class="{ 'tile--worn': item.worn, 'tile--locked': !item.unlocked }"
            :aria-pressed="item.worn"
            :aria-disabled="!item.unlocked"
            @click="item.unlocked && wear(section.kind, item.cosmetic)"
          >
            <canvas
              v-if="section.kind === 'material'"
              :ref="(el) => (swatches[item.cosmetic.id] = el as HTMLCanvasElement | null)"
              class="swatch"
              aria-hidden="true"
            />
            <span
              v-else-if="section.kind === 'ambiance'"
              class="swatch swatch--ambiance"
              :data-ambiance-preview="item.cosmetic.id"
              aria-hidden="true"
            />
            <span
              v-else
              class="swatch swatch--shatter"
              :class="`swatch--${item.cosmetic.id}`"
              aria-hidden="true"
            >
              <i /><i /><i />
            </span>
            <span class="tile__name">{{ text.cosmeticName(item.cosmetic) }}</span>
            <span class="tile__state">
              <AppIcon v-if="!item.unlocked" name="lock" :size="16" />
              <AppIcon v-else-if="item.worn" name="check" :size="16" />
              {{
                !item.unlocked
                  ? text.unlockRule(item.cosmetic)
                  : item.worn
                    ? t('cosmetics.worn')
                    : t('cosmetics.wear')
              }}
            </span>
          </button>
        </li>
      </ul>
    </section>
    <div class="actions">
      <button type="button" class="btn btn--primary" @click="emit('close')">
        {{ t('cosmetics.close') }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.intro,
.kind__note {
  color: var(--text-muted);
}

.kind__note {
  font-size: 0.85rem;
}

.kind {
  display: grid;
  gap: var(--space-2);
  margin-block-start: var(--space-4);
}

.kind__title {
  font-size: 1.05rem;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tile {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  width: 100%;
  min-height: var(--touch);
  padding: var(--space-3) var(--space-2);
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  text-align: center;
}

.tile--worn {
  border-color: var(--accent-fill);
}

.tile--locked {
  cursor: not-allowed;
}

.tile--locked .swatch,
.tile--locked .tile__name {
  opacity: 0.45;
}

.tile__name {
  font-weight: 700;
}

.tile__state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.swatch {
  display: block;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border-radius: var(--radius-sm);
}

.swatch--ambiance {
  background:
    radial-gradient(70% 70% at 25% 25%, var(--glow-1), transparent 75%),
    radial-gradient(70% 70% at 80% 80%, var(--glow-2), transparent 75%), var(--bg);
  border: 1px solid var(--border);
}

.swatch--shatter {
  position: relative;
  background: var(--well-bg);
}

.swatch--shatter i {
  position: absolute;
  inline-size: 0.8rem;
  block-size: 0.8rem;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}

.swatch--shatter i:nth-child(1) {
  inset: 0.3rem auto auto 0.35rem;
  transform: rotate(-20deg);
}
.swatch--shatter i:nth-child(2) {
  inset: 1.1rem auto auto 1.3rem;
  transform: rotate(35deg);
}
.swatch--shatter i:nth-child(3) {
  inset: 0.5rem auto auto 1.5rem;
  transform: rotate(160deg);
}

.swatch--shards i {
  background: var(--tone-2);
}
.swatch--confetti i:nth-child(1) {
  background: var(--tone-1);
}
.swatch--confetti i:nth-child(2) {
  background: var(--tone-5);
}
.swatch--confetti i:nth-child(3) {
  background: var(--tone-3);
}
.swatch--petals i {
  background: var(--fx-petal);
  clip-path: ellipse(50% 30% at 50% 50%);
}
.swatch--gold i {
  background: var(--fx-gold);
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-block-start: var(--space-6);
}
</style>
