import type { AmbianceId } from '@/progression/Cosmetics';
import { SEASON_AMBIANCES } from '@/seasons/SeasonData';

/** What the stack breaks into at a defeat. */
export type DefeatMatter = 'dust' | 'ribbon' | 'bubble' | 'ember' | 'mote' | 'petal' | 'shard';

/** How that matter moves: out of the broken stack, then drifting behind the end window. */
export type DefeatMotion =
  'rise' | 'sweep' | 'bubble' | 'ember' | 'spiral' | 'petal' | 'burst' | 'drift';

/**
 * A defeat in an ambiance (1.31): the matter the stack breaks into, how it
 * bursts out, how it keeps drifting behind the end window, and whether a
 * void opens where the stack was. Its colours and its two lights are the
 * ambiance's tokens (`--defeat-matter-*`, `--defeat-light-*`, ambiances.css).
 */
export interface DefeatStyle {
  readonly matter: DefeatMatter;
  readonly burst: DefeatMotion;
  readonly drift: DefeatMotion;
  readonly opensVoid: boolean;
}

/** One defeat per ambiance: a new ambiance brings its own. */
export const DEFEAT_STYLES: Readonly<Record<AmbianceId, DefeatStyle>> = {
  night: { matter: 'dust', burst: 'rise', drift: 'rise', opensVoid: false },
  aurora: { matter: 'ribbon', burst: 'sweep', drift: 'sweep', opensVoid: false },
  abyss: { matter: 'bubble', burst: 'bubble', drift: 'bubble', opensVoid: false },
  forge: { matter: 'ember', burst: 'ember', drift: 'ember', opensVoid: false },
  cosmos: { matter: 'mote', burst: 'spiral', drift: 'drift', opensVoid: true },
  sakura: { matter: 'petal', burst: 'petal', drift: 'petal', opensVoid: false },
  rift: { matter: 'shard', burst: 'burst', drift: 'drift', opensVoid: false },
  // The four ambiances that crown a collection (1.35).
  synthwave: { matter: 'shard', burst: 'burst', drift: 'sweep', opensVoid: false },
  lantern: { matter: 'ember', burst: 'rise', drift: 'rise', opensVoid: false },
  gilded: { matter: 'dust', burst: 'burst', drift: 'rise', opensVoid: false },
  sanctum: { matter: 'shard', burst: 'spiral', drift: 'drift', opensVoid: true },
  // The seasons' ambiances (1.36), from their data.
  ...(Object.fromEntries(SEASON_AMBIANCES.map((look) => [look.id, look.defeat.style])) as Record<
    (typeof SEASON_AMBIANCES)[number]['id'],
    DefeatStyle
  >),
};

/** Grains of matter bursting out of the stack, and drifting behind the window. */
export const DEFEAT_BURST = 44;
export const DEFEAT_DRIFT = 14;
