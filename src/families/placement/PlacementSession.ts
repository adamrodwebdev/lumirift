import { Emitter, type Listener } from '@/core/Emitter';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import type {
  BossStatus,
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { GolemView } from './engine/CeramicGolem';
import type { OfferedPiece } from './engine/Dealer';
import type { Grid } from './engine/Grid';
import type { Lines } from './engine/Grid';
import type { MosaicEventMap, MosaicGame, SlotId } from './engine/MosaicGame';
import type { JokerId } from './jokers/Joker';

/** Player intentions of the placement family. */
export type MosaicCommand =
  | { readonly type: 'place'; readonly slot: SlotId; readonly x: number; readonly y: number }
  | {
      readonly type: 'joker';
      readonly index: number;
      readonly slot?: SlotId;
      readonly x?: number;
      readonly y?: number;
    };

/** Read-only view of a Mosaic game, for the renderer and the stage. */
export interface MosaicView {
  readonly grid: Grid;
  readonly jokers: readonly JokerId[];
  readonly canUndo: boolean;
  /** The Guardian of a boss level, or null. */
  readonly golem: GolemView | null;
  pieceAt(slot: SlotId): OfferedPiece | null;
  pieces(): { slot: SlotId; piece: OfferedPiece }[];
  canPlace(slot: SlotId, x: number, y: number): boolean;
  linesIfPlaced(slot: SlotId, x: number, y: number): Lines;
}

/** Adapts a Mosaic game to the common `GameSession` contract. */
export class PlacementSession implements GameSession<MosaicCommand> {
  readonly family = 'placement';
  readonly events = new Emitter<SessionEventMap>();
  readonly view: MosaicView;

  constructor(
    readonly modeId: ModeId,
    private readonly game: MosaicGame,
  ) {
    this.view = game;
    this.forwardEvents();
  }

  get state(): SessionState {
    return this.game.state;
  }

  /** Engine events, for the family's effects and sounds (subscribe only). */
  onGame<K extends keyof MosaicEventMap>(
    type: K,
    listener: Listener<MosaicEventMap[K]>,
  ): () => void {
    return this.game.events.on(type, listener);
  }

  start(): void {
    this.game.start();
  }

  pause(): void {
    this.game.pause();
  }

  resume(): void {
    this.game.resume();
  }

  update(deltaMs: number): void {
    this.game.update(deltaMs);
  }

  execute(command: MosaicCommand): boolean {
    if (this.game.state !== 'running') return false;
    if (command.type === 'place') return this.game.place(command.slot, command.x, command.y);
    const { index, ...target } = command;
    return this.game.useJoker(index, target);
  }

  /** A full tray is the danger of the Mosaic. */
  pressure(): number {
    const { grid } = this.view;
    return grid.tileCount() / (grid.size * grid.size);
  }

  indicators(): readonly Indicator[] {
    const game = this.game;
    const indicators: Indicator[] = [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'lines', value: game.lines, format: 'count' },
      { id: 'streak', value: game.streak, format: 'count' },
    ];
    const timeLeft = game.timeLeftMs;
    if (timeLeft !== null)
      indicators.splice(1, 0, { id: 'timeLeft', value: timeLeft, format: 'duration' });
    return indicators;
  }

  result(): SessionResult {
    return { modeId: this.modeId, kind: 'score', value: this.game.score };
  }

  subtitleKey(): null {
    return null;
  }

  boss(): BossStatus | null {
    const golem = this.game.golem;
    return golem ? { id: 'ceramicGolem', health: golem.health, maxHealth: GUARDIAN_HEALTH } : null;
  }

  dispose(): void {
    this.game.events.clear();
    this.events.clear();
  }

  /** Republishes engine events in the vocabulary shared by every family. */
  private forwardEvents(): void {
    const { events } = this.game;
    events.on('state', (event) => this.events.emit('state', event));
    events.on('clear', ({ lines, points, streak }) =>
      this.events.emit('clear', { lines, points, combo: streak - 1 }),
    );
    events.on('rescue', () => this.events.emit('notice', { id: 'rescue' }));
    events.on('perfect', ({ points }) =>
      this.events.emit('notice', { id: 'perfectGrid', value: points }),
    );
    events.on('jokerGained', ({ joker }) =>
      this.events.emit('notice', { id: `jokerGained.${joker}` }),
    );
    events.on('over', ({ reason }) => this.events.emit('over', { reason }));
    // The Guardian speaks through notices: each of its moves is named the first time.
    const told = new Set<string>();
    const tell = (id: string, once = true) => {
      if (once && told.has(id)) return;
      told.add(id);
      this.events.emit('notice', { id: `boss.golem.${id}` });
    };
    events.on('boss', ({ event }) => {
      if (event.type === 'aim') tell('aim');
      else if (event.type === 'throw' && event.stones.length > 0) tell('throw');
      else if (event.type === 'parry') tell('parry');
      else if (event.type === 'hurt' && event.hit === 'shatter') tell('shatter');
      else if (event.type === 'phase') tell(`phase${event.phase}`, false);
      else if (event.type === 'defeated') tell('defeated', false);
    });
  }
}
