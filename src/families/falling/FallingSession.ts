import { Emitter, type Listener } from '@/core/Emitter';
import type {
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import type { EngineModeId, FamilyId } from '@/session/ModeId';
import type { Board, RemovedCell } from './board/Board';
import type { Game, PieceSpec } from './game/Game';
import type { GameEventMap } from './game/GameEvents';
import type { AbilityId, GameMode } from './modes/GameMode';
import type { Piece } from './pieces/Piece';
import type { RotationDirection } from './pieces/PieceType';

/** Player intentions of the falling family. */
export type FallingCommand =
  | { readonly type: 'move'; readonly direction: -1 | 1 }
  | { readonly type: 'rotate'; readonly direction: RotationDirection }
  | { readonly type: 'softDrop'; readonly active: boolean }
  | { readonly type: 'hardDrop' }
  | { readonly type: 'hold' }
  | { readonly type: 'ability' };

type CommandHandlers = {
  readonly [K in FallingCommand['type']]: (
    command: Extract<FallingCommand, { type: K }>,
  ) => boolean;
};

/** Read-only view of a game, for the renderer: it can look, never act. */
export interface FallingView {
  readonly board: Board;
  /** The mode, for scenery that depends on its state (the silhouette to fill). */
  readonly mode: GameMode;
  readonly active: Piece | null;
  readonly held: PieceSpec | null;
  readonly canHold: boolean;
  preview(count?: number): readonly PieceSpec[];
  dropDistance(): number;
  /** Blocks the bombs would blow away if the piece landed where its ghost is (the Tower). */
  blastPreview(): readonly RemovedCell[];
}

/** Adapts a falling-family `Game` to the common `GameSession` contract. */
export class FallingSession implements GameSession<FallingCommand> {
  readonly events = new Emitter<SessionEventMap>();
  readonly view: FallingView;
  readonly ability: AbilityId | null;

  private readonly handlers: CommandHandlers = {
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
    hold: () => this.game.hold(),
    ability: () => this.game.useAbility(),
  };

  constructor(
    readonly modeId: EngineModeId,
    private readonly game: Game,
    /** The volume family plays the same engine on a cylinder. */
    readonly family: FamilyId = 'falling',
  ) {
    this.view = game;
    this.ability = game.mode.ability;
    this.forwardEvents();
  }

  /**
   * Engine events, for the family's effects and sounds (subscribe only: the
   * stage can watch the game, never drive it). Returns the unsubscribe function.
   */
  onGame<K extends keyof GameEventMap>(type: K, listener: Listener<GameEventMap[K]>): () => void {
    return this.game.events.on(type, listener);
  }

  get state(): SessionState {
    return this.game.state;
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
    const { board } = this.view;
    return Math.min(1, board.stackHeight() / (board.height - board.hiddenRows));
  }

  indicators(): readonly Indicator[] {
    const game = this.game;
    const common: Indicator[] = [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'lines', value: game.lines, format: 'count' },
      { id: 'level', value: game.level, format: 'count' },
    ];
    if (game.mode.result === 'time') {
      common.unshift({ id: 'time', value: game.elapsedMs, format: 'duration' });
    }
    return [...common, ...game.mode.indicators(game)];
  }

  result(): SessionResult {
    const mode = this.game.mode;
    return { modeId: this.modeId, kind: mode.result, value: mode.resultValue(this.game) };
  }

  subtitleKey(): string | null {
    return this.game.mode.subtitleKey();
  }

  dispose(): void {
    this.game.events.clear();
    this.events.clear();
  }

  /** Republishes engine events in the vocabulary shared by every family. */
  private forwardEvents(): void {
    const { events } = this.game;
    events.on('state', (event) => this.events.emit('state', event));
    events.on('clear', ({ lines, points, combo }) =>
      this.events.emit('clear', { lines, points, combo }),
    );
    events.on('levelUp', (event) => this.events.emit('levelUp', event));
    events.on('notice', (event) => this.events.emit('notice', event));
    events.on('rescue', () => this.events.emit('notice', { id: 'rescue' }));
    events.on('flip', ({ lines }) => this.events.emit('notice', { id: 'flip', value: lines }));
    events.on('mirror', () => this.events.emit('notice', { id: 'mirror' }));
    events.on('tilt', () => this.events.emit('notice', { id: 'tilt' }));
    events.on('blast', ({ cells, bombs }) =>
      this.events.emit('notice', {
        id: bombs > 1 ? 'blastChain' : 'blast',
        value: bombs > 1 ? bombs : cells.length,
      }),
    );
    events.on('over', ({ reason }) => this.events.emit('over', { reason }));
  }
}
