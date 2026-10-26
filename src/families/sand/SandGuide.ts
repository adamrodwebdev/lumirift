import { Tone } from '@/core/Tone';
import type { GuideLine, TrainingStage } from '@/session/GameSession';
import type { WormState } from './engine/DuneWorm';
import type { SandGame } from './engine/SandGame';

/** What to do with an element's piece: place it, or drop it on its partner. */
const ELEMENT_LINES: Readonly<Partial<Record<Tone, GuideLine>>> = {
  [Tone.Water]: { text: 'training.guide.placeWater', action: 'move' },
  [Tone.Lightning]: { text: 'training.guide.dropLightning', action: 'drop' },
  [Tone.Oil]: { text: 'training.guide.placeOil', action: 'move' },
  [Tone.Fire]: { text: 'training.guide.dropFire', action: 'drop' },
  [Tone.Seed]: { text: 'training.guide.placeSeed', action: 'move' },
};
/** Water over a seed makes it grow. */
const ON_SEED: GuideLine = { text: 'training.guide.dropWater', action: 'drop' };
/** A piece of sand: the goal of the step. */
const LINK: GuideLine = { text: 'training.guide.link', action: 'move' };

/** What to do as the Dune Wyrm moves. */
const WYRM_LINES: Readonly<Record<WormState, GuideLine | null>> = {
  roam: { text: 'training.guide.roam', action: null },
  warn: { text: 'training.guide.warn', action: 'move' },
  surge: { text: 'training.guide.exposed', action: 'drop' },
  exposed: { text: 'training.guide.exposed', action: 'drop' },
  dive: { text: 'training.guide.missed', action: null },
  dead: null,
};
/** Back under the sand after a first surge: the next cracks will come. */
const WAIT: GuideLine = { text: 'training.guide.missed', action: null };
/** Struck: it leaves the well. */
const HIT: GuideLine = { text: 'training.guide.hit', action: null };

/** Every line of a stage, each sentence once. */
function distinct(lines: readonly (GuideLine | null | undefined)[]): readonly GuideLine[] {
  const texts = new Map<string, GuideLine>();
  for (const line of lines) if (line && !texts.has(line.text)) texts.set(line.text, line);
  return [...texts.values()];
}
const STAGE_LINES: Readonly<Record<TrainingStage, readonly GuideLine[]>> = {
  hook: distinct([
    ...Object.values(ELEMENT_LINES),
    ON_SEED,
    LINK,
    ...Object.values(WYRM_LINES),
    WAIT,
    HIT,
  ]),
};

/**
 * The guide of the portals' training in the Sand (1.29, one game since
 * 1.33): what to do with the piece in play, until the Dune Wyrm first
 * cracks the sand; then what to do as it moves. Read from the game as it
 * stands, every frame. The same line is the same object, so the screen
 * redraws it only when it changes.
 */
export class SandGuide {
  /** The element that landed last: its partner is dropped on it. */
  private landed: Tone | null = null;
  /** The Wyrm has warned once: from then on, the guide speaks of it. */
  private woken = false;
  /** The Wyrm has come out once: under the sand again, it got away. */
  private surfaced = false;
  private readonly offs: (() => void)[];

  constructor(
    private readonly game: SandGame,
    private readonly stage: TrainingStage,
  ) {
    this.offs = [
      game.events.on('lock', ({ piece }) => (this.landed = piece.tone)),
      game.events.on('boss', ({ event }) => {
        if (event.type === 'warn') this.woken = true;
        if (event.type === 'surge') this.surfaced = true;
      }),
    ];
  }

  line(): GuideLine | null {
    return this.woken ? this.encounter() : this.elements();
  }

  /** Every line this stage may say. */
  lines(): readonly GuideLine[] {
    return STAGE_LINES[this.stage];
  }

  dispose(): void {
    this.offs.forEach((off) => off());
  }

  private elements(): GuideLine | null {
    const tone = this.game.active?.tone;
    if (tone === undefined) return null;
    if (tone === Tone.Water && this.landed === Tone.Seed) return ON_SEED;
    return ELEMENT_LINES[tone] ?? LINK;
  }

  private encounter(): GuideLine | null {
    if (this.game.isTeasing) return HIT;
    const worm = this.game.worm;
    if (!worm) return null;
    if (worm.state === 'roam' && this.surfaced) return WAIT;
    return WYRM_LINES[worm.state];
  }
}
