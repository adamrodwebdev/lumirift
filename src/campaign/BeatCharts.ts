/**
 * The part a level plays in the campaign's rhythm (1.33):
 * - `show`: the game's best, at once (the first level);
 * - `teach`: one new idea, made safe to try;
 * - `twist`: a known idea turned around;
 * - `breather`: a calm level after a peak;
 * - `test`: what was learnt, asked for;
 * - `spike`: a sharp climb in the middle of a chapter;
 * - `duel`, `boss`: a chapter's end;
 * - `finale`: the campaign's last two fights, for players who mastered the game.
 */
export type BeatRole =
  'show' | 'teach' | 'twist' | 'breather' | 'test' | 'spike' | 'duel' | 'boss' | 'finale';

/** What the player should feel. */
export type BeatEmotion =
  | 'wonder'
  | 'curiosity'
  | 'focus'
  | 'surprise'
  | 'pride'
  | 'urgency'
  | 'calm'
  | 'rivalry'
  | 'dread';

/** An intensity from 1 to 10 for each third of a level: its opening, middle and end. */
export type Intensity = readonly [number, number, number];

/**
 * A level's beat chart: its one idea, what the player should feel, its part
 * in the rhythm, and how intense each third of it is meant to be (the
 * pressure the curve bot measures, see `CurveBands`).
 */
export interface BeatChart {
  readonly idea: string;
  readonly emotion: BeatEmotion;
  readonly role: BeatRole;
  readonly intensity: Intensity;
  /** Games, out of the bot's six, where the player is meant to nearly lose (a danger survived). */
  readonly nearMisses?: number;
  /** Games, out of six, where the player is meant to hear the danger cues. */
  readonly cues?: number;
}

const chart = (
  role: BeatRole,
  emotion: BeatEmotion,
  intensity: Intensity,
  idea: string,
  extra: Pick<BeatChart, 'nearMisses' | 'cues'> = {},
): BeatChart => ({ idea, emotion, role, intensity, ...extra });

/**
 * The campaign's rhythm, level by level (1.33): a sawtooth in each chapter,
 * a calm after each peak, the chapter's end as its climax. Written as the
 * design asks, checked against the bot's measures by the curve test.
 */
export const BEAT_CHARTS: Readonly<Record<string, BeatChart>> = {
  // 1. Premiers blocs: the elements first, then the falling basics; a newcomer nearly loses by 1-3.
  '1-1': chart('show', 'wonder', [2, 3, 4], 'Link the walls with one colour; the elements react'),
  '1-2': chart('teach', 'curiosity', [4, 5, 6], 'The elements alone, on a bed of sand', {
    cues: 3,
  }),
  '1-3': chart('teach', 'focus', [3, 6, 7], 'Full rows clear; the first near miss', {
    nearMisses: 2,
    cues: 3,
  }),
  '1-4': chart('twist', 'surprise', [3, 6, 8], 'The well flips left to right every ten lines', {
    cues: 3,
  }),
  '1-5': chart('teach', 'pride', [3, 4, 6], 'Two lines at once'),
  '1-6': chart('duel', 'rivalry', [3, 5, 7], 'Lines cleared together attack the rival'),
  // 2. Courants: a spike, a valley, the climb to the first Guardian.
  '2-1': chart('spike', 'urgency', [4, 6, 8], 'Rows rise from below; clearing holds them back', {
    nearMisses: 2,
  }),
  '2-2': chart('teach', 'focus', [3, 5, 5], 'Turn the well over: the holes fall away'),
  '2-3': chart('breather', 'calm', [2, 3, 3], 'Six blocks of one colour fuse'),
  '2-4': chart('breather', 'calm', [2, 3, 3], 'Link the walls in the wind'),
  '2-5': chart('breather', 'focus', [2, 3, 4], 'Five links with the elements'),
  '2-6': chart('duel', 'rivalry', [3, 5, 6], 'A quicker rival'),
  '2-7': chart('boss', 'dread', [3, 5, 8], 'The Dune Wyrm: lightning on its head, links across it'),
  // 3. Mosaïques: the board without a fall, then the Golem.
  '3-1': chart('teach', 'focus', [2, 4, 5], 'Rows and columns clear on a board without a fall'),
  '3-2': chart('test', 'focus', [3, 5, 5], 'Clears in a row: the combo'),
  '3-3': chart('test', 'pride', [3, 5, 6], 'Three lines at once'),
  '3-4': chart('breather', 'calm', [2, 4, 5], 'Fill a silhouette'),
  '3-5': chart('teach', 'focus', [3, 4, 5], 'A line of one colour scores four times'),
  '3-6': chart('duel', 'rivalry', [4, 6, 9], 'A rival that builds its attacks'),
  '3-7': chart(
    'boss',
    'dread',
    [3, 5, 6],
    'The Ceramic Golem: parry its stones, break them with lines',
  ),
  // 4. Vertiges: the well that turns, the tower, the Eye.
  '4-1': chart(
    'twist',
    'surprise',
    [5, 5, 8],
    'The well turns a quarter: the walls become the floor',
    {
      nearMisses: 2,
    },
  ),
  '4-2': chart('breather', 'calm', [3, 4, 5], 'Lock on the beat'),
  '4-3': chart('teach', 'curiosity', [4, 5, 6], 'A well without walls, turned around'),
  '4-4': chart('test', 'focus', [4, 6, 6], 'Ten rings around the tower'),
  '4-5': chart('breather', 'calm', [2, 4, 5], 'Seven links: the elements all come'),
  '4-6': chart('duel', 'rivalry', [3, 6, 8], 'The rival of the middle'),
  '4-7': chart(
    'boss',
    'dread',
    [4, 4, 7],
    'The Eye of the Tower: blind it with the bombs of its gaze',
  ),
  // 5. Le Rift: everything again, harder, then the last two fights.
  '5-1': chart('breather', 'calm', [3, 3, 3], 'Fusions again, before the last climb'),
  '5-2': chart('spike', 'urgency', [4, 6, 8], 'The mirror at full speed', { nearMisses: 2 }),
  '5-3': chart('test', 'focus', [3, 5, 5], 'Twenty lines on the board'),
  '5-4': chart('test', 'focus', [4, 6, 5], 'Fourteen rings'),
  '5-5': chart('spike', 'urgency', [4, 7, 9], 'The tide, faster'),
  '5-6': chart('finale', 'rivalry', [4, 5, 6], 'The strongest rival'),
  '5-7': chart('finale', 'dread', [4, 5, 6], 'The Heart of the Rift, wounded by its own shards'),
};
