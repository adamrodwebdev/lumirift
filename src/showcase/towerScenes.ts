import { Board } from '@/families/falling/board/Board';
import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { TOWER_WELL, TowerMode } from '@/families/volume/TowerMode';
import { autoplay, FixedRandom } from './autoplay';
import type { Scene } from './Scene';

/**
 * The Eye of the Tower charging its gaze over the glass cylinder; the AI's I
 * clears the bottom ring all the way round, and the bomb in it blinds the Eye.
 */
export function towerEye(): Scene {
  const { width, height } = TOWER_WELL;
  // Four rings of the cylinder, open on the same four columns.
  const ring = (tones: string) =>
    Array.from({ length: width }, (_, x) => (x >= 8 && x < 12 ? '.' : tones[x % tones.length]!));
  const bottom = ring('ZJLOITS');
  // A bomb gem in the bottom ring, where the Eye looks.
  bottom[12] = '*';
  const rows = [ring('ITOSZJL'), ring('LJZSOTI'), ring('OSZTLIJ'), bottom].map((r) => r.join(''));
  const mode = new TowerMode({ boss: 'towerEye', bossDelayMs: 200 });
  const session = new FallingSession(
    'tower',
    new Game(mode, {
      random: new FixedRandom(),
      board: Board.fromRows(rows, width, height, true),
      lineClearDelayMs: 280,
    }),
    'volume',
  );
  const hand = autoplay(session);
  return {
    session,
    drive: hand.drive,
    dispose: () => {
      hand.dispose();
      session.dispose();
    },
  };
}

export const TOWER_SCENES = { towerEye } as const;
