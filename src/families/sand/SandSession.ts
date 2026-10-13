import { Emitter, type Listener } from '@/core/Emitter';
import type { FallingCommand } from '@/families/falling/FallingSession';
import type {
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { PieceSpec, SandEventMap, SandGame } from './engine/SandGame';
import type { SandGrid } from './engine/SandGrid';
import type { SandPiece } from './engine/SandPiece';

/** Read-only view of a Sand game, for the renderer. */
export interface SandView {
  readonly grid: SandGrid;
  readonly active: SandPiece | null;
  preview(count?: number): readonly PieceSpec[];
  dropDistance(): number;
  /** Grains the falling fire would burn where it would land, or null. */
  fireTarget(): readonly number[] | null;
}

type Handlers = {
  readonly [K in FallingCommand['type']]: (
    command: Extract<FallingCommand, { type: K }>,
  ) => boolean;
};

/**
 * Adapts a Sand game to the common `GameSession` contract. It speaks the
 * falling family's commands, so the same keyboard and touch controls drive it;
 * holding a piece and abilities do not exist here.
 */
export class SandSession implements GameSession<FallingCommand> {
  readonly family = 'sand';
  readonly events = new Emitter<SessionEventMap>();
  readonly view: SandView;

  private readonly handlers: Handlers = {
    move: ({ direction }) => (direction < 0 ? this.game.moveLeft() : this.game.moveRight()),
    rotate: ({ direction }) => this.game.rotate(direction),
    softDrop: ({ active }) => {
      this.game.setSoftDrop(active);
      return true;
    },
    hardDrop: () => {
      this.game.hardDrop();
      return true;
    },
    hold: () => false,
    ability: () => false,
  };

  constructor(
    readonly modeId: ModeId,
    private readonly game: SandGame,
  ) {
    this.view = game;
    this.forwardEvents();
  }

  get state(): SessionState {
    return this.game.state;
  }

  onGame<K extends keyof SandEventMap>(type: K, listener: Listener<SandEventMap[K]>): () => void {
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

  execute(command: FallingCommand): boolean {
    if (this.game.state !== 'running') return false;
    const handle = this.handlers[command.type] as (command: FallingCommand) => boolean;
    return handle(command);
  }

  indicators(): readonly Indicator[] {
    const game = this.game;
    const indicators: Indicator[] = [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'regions', value: game.clears, format: 'count' },
      { id: 'level', value: game.level, format: 'count' },
      { id: 'windIn', value: game.windInMs, format: 'duration' },
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

  dispose(): void {
    this.game.events.clear();
    this.events.clear();
  }

  private forwardEvents(): void {
    const { events } = this.game;
    events.on('state', (event) => this.events.emit('state', event));
    events.on('clear', ({ regions, points }) =>
      this.events.emit('clear', { lines: regions, points, combo: 0 }),
    );
    events.on('burn', ({ grains }) => this.events.emit('notice', { id: 'burn', value: grains }));
    events.on('quench', () => this.events.emit('notice', { id: 'quench' }));
    events.on('rescue', () => this.events.emit('notice', { id: 'rescue' }));
    events.on('levelUp', (event) => this.events.emit('levelUp', event));
    events.on('notice', (event) => this.events.emit('notice', event));
    events.on('over', ({ reason }) => this.events.emit('over', { reason }));
  }
}
