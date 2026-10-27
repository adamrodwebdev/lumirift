import type { SandView } from '@/families/sand/SandSession';
import type { Aim, DunesGame } from './engine/DunesGame';

/**
 * A game of Dunes as the Sand's renderer and effects read it (1.37): its
 * grains, its Wyrm, its chain; no falling piece. What a fire or lightning
 * piece would hit flickers where the player holds it (`aim`).
 */
export function sandViewOf(game: DunesGame, aim: () => Aim | null): SandView {
  return {
    get grid() {
      return game.grid;
    },
    active: null,
    preview: () => [],
    dropDistance: () => 0,
    elementTarget: () => {
      const at = aim();
      return at ? game.targetAt(at) : null;
    },
    spawnWarning: () => null,
    get worm() {
      return game.worm;
    },
    get isTeasing() {
      return game.isShowing;
    },
    get comboGauge() {
      return game.comboGauge;
    },
  };
}
