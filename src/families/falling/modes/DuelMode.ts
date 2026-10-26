import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';

/** Rows sent for 0, 1, 2, 3 and 4 lines cleared at once. */
export const ATTACK_FOR_LINES: readonly number[] = [0, 0, 1, 2, 4];
/** Received rows wait this long before rising: time to clear lines and cancel them. */
export const INCOMING_DELAY_MS = 1000;

interface IncomingBatch {
  rows: number;
  timer: number;
}

/**
 * One side of a duel. Clearing lines attacks: rows are sent to the opponent,
 * after cancelling the rows on their way to this side first. Received rows
 * wait a second, then rise from the bottom with a single hole.
 */
export class DuelMode extends AbstractMode {
  readonly id = 'duel';

  private readonly incoming: IncomingBatch[] = [];
  private opponent: DuelMode | null = null;
  private sent = 0;

  /** Links the two sides of the duel. */
  connect(opponent: DuelMode): void {
    this.opponent = opponent;
  }

  /** Rows on their way to this side. */
  get incomingRows(): number {
    return this.incoming.reduce((sum, batch) => sum + batch.rows, 0);
  }

  receive(rows: number): void {
    if (rows > 0) {
      this.incoming.push({ rows, timer: INCOMING_DELAY_MS + this.boosts.garbageDelayMs });
    }
  }

  override attach(game: Game): void {
    game.events.on('clear', ({ lines, combo, cascade }) => {
      if (cascade) return;
      const attack = this.cancel(ATTACK_FOR_LINES[Math.min(lines, 4)]! + combo);
      if (attack <= 0 || !this.opponent) return;
      this.opponent.receive(attack);
      this.sent += attack;
      game.notify('sent', attack);
    });
  }

  protected override tick(game: Game, deltaMs: number): void {
    for (const batch of [...this.incoming]) {
      // Near the top, the early campaign's mercy holds the rows back.
      batch.timer -= deltaMs * game.mercyPace;
      if (batch.timer > 0) continue;
      this.incoming.splice(this.incoming.indexOf(batch), 1);
      const hole = game.random.nextInt(game.board.width);
      for (let i = 0; i < batch.rows && game.state === 'running'; i++) game.raiseGarbage(hole);
    }
  }

  protected override ownIndicators(): Indicator[] {
    return [
      { id: 'incoming', value: this.incomingRows, format: 'count' },
      { id: 'sent', value: this.sent, format: 'count' },
    ];
  }

  /** Uses an attack to cancel incoming rows first; returns what is left to send. */
  private cancel(attack: number): number {
    let left = attack;
    while (left > 0 && this.incoming.length > 0) {
      const batch = this.incoming[0]!;
      const used = Math.min(left, batch.rows);
      batch.rows -= used;
      left -= used;
      if (batch.rows === 0) this.incoming.shift();
    }
    return left;
  }
}
