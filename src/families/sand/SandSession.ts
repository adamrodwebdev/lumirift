import { Emitter, type Listener } from '@/core/Emitter';
import type { BossId, BossStatus } from '@/session/GameSession';
import { WORM_HEALTH, type DuneWorm } from './engine/DuneWorm';
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
  /** Grains the falling fire would burn, or the lightning strike, where it would land; or null. */
  elementTarget(): readonly number[] | null;
  /** The Guardian of a boss level, or the one passing by in a teaser; or null. */
  readonly worm: DuneWorm | null;
  /** The next chapter's Guardian is passing under the sand (the level is won). */
  readonly isTeasing: boolean;
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

  pressure(): number {
    const { grid } = this.view;
    return Math.min(1, grid.sandHeight() / grid.height);
  }

  indicators(): readonly Indicator[] {
    const game = this.game;
    const indicators: Indicator[] = [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'regions', value: game.clears, format: 'count' },
      { id: 'level', value: game.level, format: 'count' },
    ];
    const windIn = game.windInMs;
    if (windIn !== null) indicators.push({ id: 'windIn', value: windIn, format: 'duration' });
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
    const worm = this.game.worm;
    // A worm passing by in a teaser is not a fight.
    if (!worm || this.game.isTeasing) return null;
    return { id: 'duneWorm', health: worm.health, maxHealth: WORM_HEALTH };
  }

  /** A Guardian passes under the sand: the game is over, its world still moves. */
  get teasing(): boolean {
    return this.game.isTeasing;
  }

  /** Only the Dune Wyrm lives in sand. */
  tease(boss: BossId): boolean {
    return boss === 'duneWorm' && this.game.tease();
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
    // The Guardian speaks through notices: each of its moves is named the first time.
    const told = new Set<string>();
    const tell = (id: string, once = true) => {
      if (once && told.has(id)) return;
      told.add(id);
      this.events.emit('notice', { id: `boss.${id}` });
    };
    events.on('tease', () => this.events.emit('notice', { id: 'boss.tease' }));
    events.on('boss', ({ event }) => {
      if (event.type === 'warn') tell('warn');
      else if (event.type === 'surge') tell('exposed');
      else if (event.type === 'swallow') tell('swallow');
      else if (event.type === 'storm') tell('storm');
      else if (event.type === 'phase') tell(`phase${event.phase}`, false);
      else if (event.type === 'hurt' && event.hit === 'shock') tell('stunned');
      else if (event.type === 'hurt' && event.hit === 'boltHead') tell('critical');
      else if (event.type === 'defeated') tell('defeated', false);
    });
  }
}
