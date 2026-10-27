import { Emitter, type Listener } from '@/core/Emitter';
import type { SandEventMap, SandEventSource } from '@/families/sand/engine/SandGame';
import { DEED_OF, POURED } from '@/families/sand/SandSession';
import { CONTINUE_FREES } from '@/session/ContinueRule';
import type {
  BossStatus,
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { DunesEventMap, DunesGame } from './engine/DunesGame';

/** What the player does in Dunes: put a piece of the hand down, or swap the hand. */
export type DunesCommand =
  | { readonly type: 'place'; readonly slot: number; readonly x: number; readonly y: number }
  | { readonly type: 'swap' };

type Handlers = {
  readonly [K in DunesCommand['type']]: (command: Extract<DunesCommand, { type: K }>) => boolean;
};

/**
 * Adapts a game of Dunes (1.37) to the common `GameSession` contract. It
 * publishes the Sand's events too, so that the Sand's effects and sounds
 * play its grains.
 */
export class DunesSession implements GameSession<DunesCommand>, SandEventSource {
  readonly family = 'dunes';
  readonly events = new Emitter<SessionEventMap>();

  private readonly handlers: Handlers = {
    place: ({ slot, x, y }) => this.game.place(slot, x, y),
    swap: () => this.game.swap(),
  };

  constructor(
    readonly modeId: ModeId,
    readonly game: DunesGame,
  ) {
    this.forwardEvents();
  }

  get state(): SessionState {
    return this.game.state;
  }

  onGame<K extends keyof SandEventMap>(type: K, listener: Listener<SandEventMap[K]>): () => void {
    return this.game.events.on(type, listener);
  }

  /** The events of the hand (a deal, a piece put down, a goal reached, the swaps). */
  onDunes<K extends keyof DunesEventMap>(
    type: K,
    listener: Listener<DunesEventMap[K]>,
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

  execute(command: DunesCommand): boolean {
    if (this.game.state !== 'running') return false;
    const handle = this.handlers[command.type] as (command: DunesCommand) => boolean;
    return handle(command);
  }

  pressure(): number {
    return this.game.pressure();
  }

  /** The score first; the level and the swaps are shown by the stage (goal card, swap button). */
  indicators(): readonly Indicator[] {
    const { game } = this;
    return [
      { id: 'score', value: game.score, format: 'count' },
      { id: 'regions', value: game.clears, format: 'count' },
      { id: 'level', value: game.level.number, format: 'count' },
      { id: 'swaps', value: game.swaps, format: 'count' },
    ];
  }

  result(): SessionResult {
    return { modeId: this.modeId, kind: 'score', value: this.game.score };
  }

  subtitleKey(): null {
    return null;
  }

  boss(): BossStatus | null {
    const worm = this.game.worm;
    if (!worm || this.game.isShowing) return null;
    return { id: 'duneWorm', health: worm.health, maxHealth: worm.maxHealth };
  }

  get revivable(): boolean {
    return this.game.revivable;
  }

  revive(): void {
    this.game.revive(CONTINUE_FREES.dunes);
  }

  dispose(): void {
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
    // Each element's deed, for the week's goal (1.36): the Sand's deeds.
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
    events.on('goal', ({ level }) => this.events.emit('notice', { id: 'dunesGoal', value: level }));
    events.on('notice', (event) => this.events.emit('notice', event));
    events.on('closeCall', (event) => this.events.emit('closeCall', event));
    // No piece of the hand fits any more: the Mosaic's words.
    events.on('over', () => this.events.emit('over', { reason: 'noMoves' }));
    // The Wyrm speaks through notices: each of its moves is named the first time.
    const told = new Set<string>();
    const tell = (id: string, once = true) => {
      if (once && told.has(id)) return;
      told.add(id);
      this.events.emit('notice', { id: `boss.${id}` });
    };
    events.on('tease', () => this.events.emit('notice', { id: 'boss.tease' }));
    events.on('boss', ({ event }) => {
      // A Wyrm only showing itself is no fight: none of the fight's words.
      if (this.game.isShowing) return;
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
