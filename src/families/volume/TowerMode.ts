import { Emitter } from '@/core/Emitter';
import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import type { Game } from '@/families/falling/game/Game';
import { AbstractMode, type ModeOptions } from '@/families/falling/modes/AbstractMode';
import type { BlastSize, WellSize } from '@/families/falling/modes/GameMode';
import type { BossStatus } from '@/session/GameSession';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import { TowerEye, type EyeEvent } from './TowerEye';

/** The well rolled into a cylinder: 20 columns around, 16 rows high. */
export const TOWER_WELL: WellSize = { width: 20, height: 16, wraps: true };

/** A bomb blows away 5 columns of the tower, its ring's height and three rows above. */
export const TOWER_BLAST: BlastSize = { radius: 2, above: 3, below: 1 };
/** Bombs start after a few pieces, then come about one piece in five, never two in a row. */
export const BOMBS_AFTER = 4;
export const BOMB_CHANCE = 0.2;
/** Against the Eye, bombs are the weapon: they come sooner and more often. */
export const EYE_BOMBS_AFTER = 2;
export const EYE_BOMB_CHANCE = 0.32;

export interface TowerOptions extends ModeOptions {
  /** The Eye of the Tower to defeat (the boss level of the Vertigos). */
  readonly boss?: 'towerEye';
}

export interface EyeEventMap {
  boss: { readonly event: EyeEvent };
}

/**
 * The Tower: the falling rules on a well without side walls. Column 19 touches
 * column 0, and a line is a whole ring of 20 cells. Some pieces carry a bomb
 * gem: clearing its ring sets it off, and it blows away a sector of the tower.
 * On its boss level, the Eye of the Tower circles it.
 */
export class TowerMode extends AbstractMode {
  readonly id = 'tower';
  override readonly well = TOWER_WELL;
  override readonly blast = TOWER_BLAST;
  /** What the Eye does, for the stage's effects and sounds. */
  readonly eyeEvents = new Emitter<EyeEventMap>();
  private lastBomb = -BOMBS_AFTER;
  private readonly withEye: boolean;
  private _eye: TowerEye | null = null;
  private game: Game | null = null;
  private readonly told = new Set<string>();

  constructor(options: TowerOptions = {}) {
    super(options);
    this.withEye = options.boss === 'towerEye';
  }

  /** The Guardian of the boss level, or null. */
  get eye(): TowerEye | null {
    return this._eye;
  }

  override bombFor(random: RandomSource, rank: number): number | null {
    const after = this.withEye ? EYE_BOMBS_AFTER : BOMBS_AFTER;
    const chance = this.withEye ? EYE_BOMB_CHANCE : BOMB_CHANCE;
    if (rank < after || rank - this.lastBomb < 2 || random.next() >= chance) return null;
    this.lastBomb = rank;
    return random.nextInt(4);
  }

  override attach(game: Game): void {
    if (!this.withEye) return;
    this.game = game;
    // It starts face on, where the camera looks, so that it is seen at once.
    this._eye = new TowerEye(TOWER_WELL.width, game.random, TOWER_WELL.width / 2);
    game.events.on('clear', ({ lines }) => {
      this._eye?.ringsCleared(lines);
      this.flush();
    });
    game.events.on('blast', ({ x }) => {
      this._eye?.bombAt(x);
      this.flush();
    });
  }

  boss(): BossStatus | null {
    const eye = this._eye;
    return eye ? { id: 'towerEye', health: eye.health, maxHealth: GUARDIAN_HEALTH } : null;
  }

  protected override tick(_game: Game, deltaMs: number): void {
    if (!this._eye) return;
    this._eye.update(deltaMs).forEach((event) => this.apply(event));
  }

  private flush(): void {
    this._eye?.drain().forEach((event) => this.apply(event));
  }

  /** Applies a move of the Eye to the game, names it the first time, and publishes it. */
  private apply(event: EyeEvent): void {
    const game = this.game;
    if (!game) return;
    this.eyeEvents.emit('boss', { event });
    switch (event.type) {
      case 'charge':
        this.tell('charge');
        break;
      case 'strike':
        game.dropStones(event.columns, Tone.Stone);
        if (event.rubble) {
          this.tell('rubble');
          game.raiseGarbage(Math.floor(this._eye?.centre ?? 0));
        }
        this.tell('strike');
        break;
      case 'blinded':
        this.tell('blinded');
        break;
      case 'phase':
        this.tell(`phase${event.phase}`, false);
        break;
      case 'defeated':
        this.tell('defeated', false);
        game.finish('victory');
        break;
      default:
        break;
    }
  }

  private tell(id: string, once = true): void {
    if (once && this.told.has(id)) return;
    this.told.add(id);
    this.game?.notify(`boss.eye.${id}`);
  }
}
