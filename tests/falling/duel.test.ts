import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { createFallingSession, createSoloSession, DuelSession } from '@/families/falling';
import { AI_PROFILES, AiPlayer, isAiLevel } from '@/families/falling/ai/AiPlayer';
import { measure } from '@/families/falling/ai/BoardFeatures';
import { Evaluator } from '@/families/falling/ai/Evaluator';
import { searchPlacements } from '@/families/falling/ai/PlacementSearch';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ATTACK_FOR_LINES, DuelMode, INCOMING_DELAY_MS } from '@/families/falling/modes/DuelMode';
import { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';
import { ConstantRandom } from './helpers';

describe('BoardFeatures', () => {
  it('measures heights, holes and bumpiness', () => {
    const board = Board.fromRows(['#.........', '.#........', '##.......#']);
    expect(measure(board)).toEqual({
      aggregateHeight: 3 + 2 + 1,
      maxHeight: 3,
      holes: 1,
      bumpiness: 1 + 2 + 1, // 3→2, 2→0, then 0→1 at the right wall
    });
  });
});

describe('placement search and evaluation', () => {
  it('lists every reachable placement, and prefers the one that clears a line', () => {
    const board = Board.fromRows(['#########.', '#########.', '#########.', '#########.']);
    const piece = Piece.spawn('I', Tone.I, board.width);
    const placements = searchPlacements(board, piece);
    expect(placements.length).toBeGreaterThan(10);
    const best = new Evaluator().rank(placements)[0]!;
    expect(best.lines).toBe(4);
    expect(best.rotation % 2).toBe(1); // upright
  });

  it('counts the O piece once per spot', () => {
    const board = new Board();
    const placements = searchPlacements(board, Piece.spawn('O', Tone.O, board.width));
    expect(placements).toHaveLength(9);
  });
});

describe('AiPlayer', () => {
  it('knows its levels', () => {
    expect(isAiLevel('expert')).toBe(true);
    expect(isAiLevel('godlike')).toBe(false);
    expect(AI_PROFILES.easy.thinkMs).toBeGreaterThan(AI_PROFILES.expert.thinkMs);
  });

  it('plays on its own through the same commands as a player, and survives', () => {
    const session = createSoloSession('classic', {
      random: new SeededRandom(7),
      timeLimitMs: null,
    });
    const execute = vi.spyOn(session, 'execute');
    const ai = new AiPlayer(session, AI_PROFILES.expert, new SeededRandom(1));
    ai.attach();
    session.start();
    for (let t = 0; t < 120_000 && session.state === 'running'; t += 16) {
      session.update(16);
      ai.update(16);
    }
    expect(session.state).toBe('running');
    expect(execute).toHaveBeenCalledWith({ type: 'hardDrop' });
    expect(session.indicators().find((item) => item.id === 'lines')?.value).toBeGreaterThan(20);
  });

  it('thinks longer and moves slower when easier', () => {
    const run = (level: 'easy' | 'expert') => {
      const session = createSoloSession('classic', {
        random: new SeededRandom(3),
        timeLimitMs: null,
      });
      const ai = new AiPlayer(session, AI_PROFILES[level], new SeededRandom(1));
      ai.attach();
      let locks = 0;
      session.onGame('lock', () => locks++);
      session.start();
      for (let t = 0; t < 20_000; t += 16) {
        session.update(16);
        ai.update(16);
      }
      return locks;
    };
    expect(run('expert')).toBeGreaterThan(run('easy'));
  });
});

describe('DuelMode', () => {
  const pair = () => {
    const left = new DuelMode();
    const right = new DuelMode();
    left.connect(right);
    right.connect(left);
    const leftGame = new Game(left, {
      random: new ConstantRandom(),
      board: Board.fromRows(['#####.....', '#####.....']),
    });
    const rightGame = new Game(right, { random: new ConstantRandom() });
    leftGame.start();
    rightGame.start();
    return { left, right, leftGame, rightGame };
  };

  it('sends rows for multi-line clears, with a bonus per combo', () => {
    expect(ATTACK_FOR_LINES).toEqual([0, 0, 1, 2, 4]);
    const { right, leftGame } = pair();
    leftGame.events.emit('clear', {
      lines: 2,
      pureLines: 0,
      points: 300,
      combo: 0,
      cascade: false,
      rows: [],
    });
    expect(right.incomingRows).toBe(1);
    leftGame.events.emit('clear', {
      lines: 4,
      pureLines: 0,
      points: 800,
      combo: 2,
      cascade: false,
      rows: [],
    });
    expect(right.incomingRows).toBe(1 + 4 + 2);
  });

  it('cancels incoming rows before attacking', () => {
    const { left, right, leftGame } = pair();
    left.receive(3);
    leftGame.events.emit('clear', {
      lines: 3,
      pureLines: 0,
      points: 500,
      combo: 0,
      cascade: false,
      rows: [],
    });
    expect(left.incomingRows).toBe(1);
    expect(right.incomingRows).toBe(0);
  });

  it('raises the received rows after a delay', () => {
    const { right, rightGame } = pair();
    const onGarbage = vi.fn();
    rightGame.events.on('garbage', onGarbage);
    right.receive(2);
    rightGame.update(INCOMING_DELAY_MS - 1);
    expect(onGarbage).not.toHaveBeenCalled();
    rightGame.update(1);
    expect(onGarbage).toHaveBeenCalledTimes(2);
    expect(right.incomingRows).toBe(0);
  });
});

describe('DuelSession', () => {
  const duel = () => {
    const session = createFallingSession('duel', {
      random: new ConstantRandom(),
      timeLimitMs: null,
      variant: 'expert',
    });
    if (!(session instanceof DuelSession)) throw new Error('not a duel');
    session.start();
    return session;
  };
  const gameOf = (session: DuelSession, side: 'playerGame' | 'opponentGame') =>
    (session as unknown as Record<string, Game>)[side]!;

  it('deals the same pieces to both sides', () => {
    const session = duel();
    expect(session.player.view.active?.type).toBe(session.opponent.view.active?.type);
    expect(session.player.view.preview().map((p) => p.type)).toEqual(
      session.opponent.view.preview().map((p) => p.type),
    );
    expect(session.subtitleKey()).toBe('variants.duel.expert');
  });

  it('wins when the opponent overflows, and stops both games', () => {
    const session = duel();
    const onOver = vi.fn();
    session.events.on('over', onOver);
    gameOf(session, 'opponentGame').finish('topOut');
    expect(onOver).toHaveBeenCalledWith({ reason: 'victory' });
    expect(onOver).toHaveBeenCalledOnce();
    expect(session.state).toBe('over');
    expect(session.player.state).toBe('over');
    expect(session.execute({ type: 'hardDrop' })).toBe(false);
  });

  it('loses when the player overflows', () => {
    const session = duel();
    const onOver = vi.fn();
    session.events.on('over', onOver);
    gameOf(session, 'playerGame').finish('blockOut');
    expect(onOver).toHaveBeenCalledWith({ reason: 'defeat' });
    expect(session.opponent.state).toBe('over');
  });

  it('plays the player’s commands on the player’s side only', () => {
    const session = duel();
    const before = session.opponent.view.active?.x;
    session.execute({ type: 'move', direction: -1 });
    expect(session.player.view.active?.x).toBe(2);
    expect(session.opponent.view.active?.x).toBe(before);
  });

  it('falls back to the normal level for an unknown variant', () => {
    const session = createFallingSession('duel', {
      random: new ConstantRandom(),
      timeLimitMs: null,
      variant: 'x',
    });
    expect((session as DuelSession).level).toBe('normal');
  });
});
