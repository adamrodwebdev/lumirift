import { Emitter, type Listener } from '@/core/Emitter';
import { Tone } from '@/core/Tone';
import type { ComboView } from '@/session/ComboGauge';
import { CONTINUE_FREES } from '@/session/ContinueRule';
import type { BossId, BossStatus, GuideLine, TrainingStage } from '@/session/GameSession';
import type { DuneWorm } from './engine/DuneWorm';
import type { FallingCommand } from '@/families/falling/FallingSession';
import type {
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import type { ElementName } from '@/session/Elements';
import type { ModeId } from '@/session/ModeId';
import type { PieceSpec, SandEventMap, SandGame } from './engine/SandGame';
import type { ReactionKind } from './engine/SandReactions';
import { GRAINS_PER_CELL, type SandGrid } from './engine/SandGrid';
import type { SandPiece } from './engine/SandPiece';
import { SandGuide } from './SandGuide';

/**
 * What counts as an element's deed (1.36), measured on the curve bot's free
 * games: fire's burns and lightning's bolts have events of their own; seeds
 * sprouting and acid eating a grain are reactions. Water and oil meet fire
 * too rarely (under once a game), and ice freezes water only for those who
 * aim it (a newcomer took six times as long): pouring one counts.
 */
const DEED_OF: Readonly<Partial<Record<ReactionKind, ElementName>>> = {
  sprout: 'seed',
  dissolve: 'acid',
};
const POURED: Readonly<Partial<Record<Tone, ElementName>>> = {
  [Tone.Water]: 'water',
  [Tone.Oil]: 'oil',
  [Tone.Ice]: 'ice',
};

/** Read-only view of a Sand game, for the renderer. */
export interface SandView {
  readonly grid: SandGrid;
  readonly active: SandPiece | null;
  preview(count?: number): readonly PieceSpec[];
  dropDistance(): number;
  /** Grains the falling fire would burn, or the lightning strike, where it would land; or null. */
  elementTarget(): readonly number[] | null;
  /** The next piece where it would appear, when it has no room to enter; or null. */
  spawnWarning(): SandPiece | null;
  /** The Guardian of a boss level, or the one passing by in a teaser; or null. */
  readonly worm: DuneWorm | null;
  /** The next chapter's Guardian is passing under the sand (the level is won). */
  readonly isTeasing: boolean;
  /** The combo gauge: what the next clear would score with, and how full it is. */
  readonly comboGauge: ComboView;
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

  /** The training's guide, in a training step (1.29). */
  private readonly trainingGuide: SandGuide | null;

  constructor(
    readonly modeId: ModeId,
    private readonly game: SandGame,
    /** A step of the portals' training, or null. */
    private readonly training: TrainingStage | null = null,
  ) {
    this.view = game;
    this.trainingGuide = training ? new SandGuide(game, training) : null;
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
    return this.game.pressure();
  }

  awardBonus(points: number, reason: string): void {
    this.game.awardPoints(Math.round(points), reason);
  }

  indicators(): readonly Indicator[] {
    const game = this.game;
    const indicators: Indicator[] = [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'regions', value: game.clears, format: 'count' },
    ];
    // A training has no levels to climb: the step is its level.
    if (!this.training) indicators.push({ id: 'level', value: game.level, format: 'count' });
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
    return { id: 'duneWorm', health: worm.health, maxHealth: worm.maxHealth };
  }

  dismiss(): void {
    this.game.dismissBoss();
  }

  /** The cells of sand left in the well. */
  remains(): number {
    return Math.round(this.game.grid.grainCount() / (GRAINS_PER_CELL * GRAINS_PER_CELL));
  }

  get revivable(): boolean {
    return this.game.revivable;
  }

  revive(): void {
    this.game.revive(CONTINUE_FREES.sand);
  }

  /** A Guardian passes under the sand: the game is over, its world still moves. */
  get teasing(): boolean {
    return this.game.isTeasing;
  }

  /** Only the Dune Wyrm lives in sand. */
  tease(boss: BossId): number {
    return boss === 'duneWorm' ? this.game.tease() : 0;
  }

  guide(): GuideLine | null {
    return this.trainingGuide?.line() ?? null;
  }

  guideLines(): readonly GuideLine[] {
    return this.trainingGuide?.lines() ?? [];
  }

  dispose(): void {
    this.trainingGuide?.dispose();
    this.game.events.clear();
    this.events.clear();
  }

  private forwardEvents(): void {
    const { events } = this.game;
    events.on('state', (event) => this.events.emit('state', event));
    events.on('clear', ({ regions, points, multiplier }) =>
      this.events.emit('clear', { lines: regions, points, combo: multiplier - 1 }),
    );
    events.on('burn', ({ grains }) => this.events.emit('notice', { id: 'burn', value: grains }));
    events.on('quench', () => this.events.emit('notice', { id: 'quench' }));
    // Each element's deed, for the week's goal (1.36): a burn, a bolt, a grain eaten…
    events.on('burn', () => this.events.emit('element', { element: 'fire' }));
    events.on('strike', () => this.events.emit('element', { element: 'lightning' }));
    events.on('react', ({ kind }) => {
      const element = DEED_OF[kind];
      if (element) this.events.emit('element', { element });
    });
    events.on('lock', ({ piece }) => {
      const element = POURED[piece.tone];
      if (element) this.events.emit('element', { element });
    });
    events.on('rescue', () => this.events.emit('notice', { id: 'rescue' }));
    events.on('levelUp', (event) => this.events.emit('levelUp', event));
    events.on('notice', (event) => this.events.emit('notice', event));
    events.on('overflow', () => this.events.emit('overflow', {}));
    events.on('closeCall', (event) => this.events.emit('closeCall', event));
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
      // A Guardian showing itself in a teaser is no fight: none of the fight's words.
      // In a training, the guide speaks instead.
      if (this.game.isTeasing || this.training) return;
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
