import { Emitter } from '@/core/Emitter';
import type { RandomSource } from '@/core/Random';
import type {
  GameSession,
  Indicator,
  SessionEventMap,
  SessionResult,
  SessionState,
} from '@/session/GameSession';
import { AI_PROFILES, AiPlayer, type AiLevel } from './ai/AiPlayer';
import { FallingSession, type FallingCommand } from './FallingSession';
import type { Game } from './game/Game';
import { DuelMode } from './modes/DuelMode';

export type DuelOutcome = 'victory' | 'defeat';

/**
 * A duel: the player's game and the AI's game, linked by their attacks. Both
 * get the same pieces. The first to overflow loses; both games then stop.
 * The screen sees one session: the player's, plus the opponent to watch.
 */
export class DuelSession implements GameSession<FallingCommand> {
  readonly modeId = 'duel';
  readonly family = 'falling';
  readonly events = new Emitter<SessionEventMap>();
  /** The player's side, driven by the screen's commands. */
  readonly player: FallingSession;
  /** The AI's side, shown as a thumbnail. */
  readonly opponent: FallingSession;

  private readonly ai: AiPlayer;
  private readonly detach: (() => void)[];
  private outcome: DuelOutcome | null = null;

  constructor(
    private readonly playerGame: Game,
    private readonly opponentGame: Game,
    readonly level: AiLevel,
    aiRandom: RandomSource,
  ) {
    const playerMode = playerGame.mode;
    const opponentMode = opponentGame.mode;
    if (!(playerMode instanceof DuelMode) || !(opponentMode instanceof DuelMode)) {
      throw new Error('A duel needs two games in duel mode');
    }
    playerMode.connect(opponentMode);
    opponentMode.connect(playerMode);

    this.player = new FallingSession('duel', playerGame);
    this.opponent = new FallingSession('duel', opponentGame);
    this.ai = new AiPlayer(this.opponent, AI_PROFILES[level], aiRandom);

    const { events } = this.player;
    this.detach = [
      this.ai.attach(),
      events.on('state', (event) => this.events.emit('state', event)),
      events.on('clear', (event) => this.events.emit('clear', event)),
      events.on('levelUp', (event) => this.events.emit('levelUp', event)),
      events.on('notice', (event) => this.events.emit('notice', event)),
      events.on('over', () => this.end('defeat')),
      this.opponent.events.on('over', () => this.end('victory')),
    ];
  }

  get state(): SessionState {
    return this.outcome ? 'over' : this.player.state;
  }

  start(): void {
    this.player.start();
    this.opponent.start();
  }

  pause(): void {
    this.player.pause();
    this.opponent.pause();
  }

  resume(): void {
    this.player.resume();
    this.opponent.resume();
  }

  update(deltaMs: number): void {
    if (this.outcome) return;
    this.player.update(deltaMs);
    this.opponent.update(deltaMs);
    this.ai.update(deltaMs);
  }

  execute(command: FallingCommand): boolean {
    return this.outcome ? false : this.player.execute(command);
  }

  pressure(): number {
    return this.player.pressure();
  }

  indicators(): readonly Indicator[] {
    return [
      ...this.player.indicators(),
      { id: 'opponentLines', value: this.opponentGame.lines, format: 'count' },
    ];
  }

  result(): SessionResult {
    return { modeId: 'duel', kind: 'score', value: this.playerGame.score };
  }

  subtitleKey(): string {
    return `variants.duel.${this.level}`;
  }

  dispose(): void {
    this.detach.forEach((off) => off());
    this.player.dispose();
    this.opponent.dispose();
    this.events.clear();
  }

  /** The first overflow decides; the other game is stopped. */
  private end(outcome: DuelOutcome): void {
    if (this.outcome) return;
    this.outcome = outcome;
    // Stopping the other side fires its own "over": ignored, the duel is decided.
    if (outcome === 'victory') this.playerGame.finish('topOut');
    else this.opponentGame.finish('topOut');
    this.events.emit('state', { state: 'over' });
    this.events.emit('over', { reason: outcome });
  }
}
