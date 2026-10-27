import { Emitter } from '@/core/Emitter';
import type { BossStatus, Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode, type ModeOptions } from './AbstractMode';
import { RiftHeart, type HeartEvent } from './RiftHeart';

export interface RiftHeartOptions extends ModeOptions {
  /** The Heart's first beat after this long (ms); by default the player can start building. */
  readonly bossDelayMs?: number;
  /** The Heart comes with this much health (a race's, a third); full by default. */
  readonly bossHealth?: number;
}

export interface HeartEventMap {
  boss: { readonly event: HeartEvent };
}

/**
 * The last Guardian's level: the classic well, with the Heart of the Rift
 * beating under it. Its rows of rubble rise with a shard of the rift each
 * (a gem of the board); clearing a shard's row wounds it deeply.
 */
export class RiftHeartMode extends AbstractMode {
  readonly id = 'classic';
  /** What the Heart does, for the stage's scenery and sounds. */
  readonly heartEvents = new Emitter<HeartEventMap>();
  private _heart: RiftHeart | null = null;
  private game: Game | null = null;
  private readonly told = new Set<string>();
  private readonly bossDelayMs: number | undefined;
  private readonly bossHealth: number | undefined;

  constructor(options: RiftHeartOptions = {}) {
    super(options);
    this.bossDelayMs = options.bossDelayMs;
    this.bossHealth = options.bossHealth;
  }

  /** The Guardian. */
  get heart(): RiftHeart | null {
    return this._heart;
  }

  override attach(game: Game): void {
    this.game = game;
    this._heart = new RiftHeart(game.board.width, game.random, {
      ...(this.bossDelayMs === undefined ? {} : { firstBeatMs: this.bossDelayMs }),
      ...(this.bossHealth === undefined ? {} : { health: this.bossHealth }),
    });
    game.events.on('clear', ({ lines, rows }) => {
      const shards = rows.reduce((sum, row) => sum + row.bombs.length, 0);
      this._heart?.cleared(lines, shards);
      this._heart?.drain().forEach((event) => this.apply(event));
    });
  }

  boss(): BossStatus | null {
    const heart = this._heart;
    return heart ? { id: 'riftHeart', health: heart.health, maxHealth: heart.maxHealth } : null;
  }

  /** The Heart leaves the well for good (a race's, its time up): no more beats, the game goes on. */
  dismiss(): void {
    this._heart = null;
  }

  protected override tick(_game: Game, deltaMs: number): void {
    this._heart?.update(deltaMs).forEach((event) => this.apply(event));
  }

  protected override ownIndicators(): Indicator[] {
    const heart = this._heart;
    if (!heart || heart.defeated) return [];
    return [{ id: 'nextBeat', value: heart.nextBeatMs, format: 'duration' }];
  }

  /** Applies a move of the Heart to the game, names it the first time, and publishes it. */
  private apply(event: HeartEvent): void {
    const game = this.game;
    if (!game) return;
    this.heartEvents.emit('boss', { event });
    switch (event.type) {
      case 'swell':
        this.tell('swell');
        break;
      case 'beat':
        // The well turns first, so that the holes rise where they glowed.
        if (event.mirror) {
          game.mirrorWell();
          this.tell('mirror');
        }
        for (const row of event.rows) game.raiseGarbage(row.hole, row.shard);
        this.tell('shard');
        break;
      case 'hurt':
        if (event.hit === 'shard') this.tell('wounded');
        break;
      case 'phase':
        this.tell(`phase${event.phase}`, false);
        break;
      case 'defeated':
        this.tell('defeated', false);
        game.finish('victory');
        break;
    }
  }

  private tell(id: string, once = true): void {
    if (once && this.told.has(id)) return;
    this.told.add(id);
    this.game?.notify(`boss.heart.${id}`);
  }
}
