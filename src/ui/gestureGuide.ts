import type { ControlScheme } from '@/services/SettingsService';
import type { FamilyId } from '@/session/ModeId';
import type { IconName } from './components/AppIcon.vue';

/** Where a gesture is drawn on the guide's phone. */
export type GestureMark =
  | 'drag'
  | 'tapRight'
  | 'tapLeft'
  | 'tap'
  | 'softDrop'
  | 'drop'
  | 'hold'
  | 'second'
  | 'pair'
  | 'turn';

/** A gesture of the guide: its drawing, its icon, and what it is and does (translation keys). */
export interface GestureRow {
  readonly mark: GestureMark;
  readonly icon: IconName;
  readonly gesture: string;
  readonly action: string;
}

/** The touch settings the guide follows. */
export interface GuidePrefs {
  readonly controls: ControlScheme;
  readonly tapSides: boolean;
}

const row = (mark: GestureMark, icon: IconName, gesture: string, action: string): GestureRow => ({
  mark,
  icon,
  gesture,
  action,
});

const ROWS = {
  drag: row('drag', 'gestureDrag', 'gestures.drag', 'controls.move'),
  tapRight: row('tapRight', 'gestureTap', 'gestures.tapRight', 'controls.rotateCw'),
  tapLeft: row('tapLeft', 'gestureTap', 'gestures.tapLeft', 'controls.rotateCcw'),
  tap: row('tap', 'gestureTap', 'gestures.tap', 'controls.rotateCw'),
  softDrop: row('softDrop', 'gestureSlow', 'gestures.dragDown', 'controls.softDrop'),
  drop: row('drop', 'gestureDown', 'gestures.flickDown', 'controls.hardDrop'),
  hold: row('hold', 'gestureUp', 'gestures.flickUp', 'controls.hold'),
  second: row('second', 'gestureTap', 'gestures.secondFinger', 'gestures.secondFingerAction'),
  pair: row('pair', 'gestureTwo', 'gestures.twoFingers', 'controls.rotateCcw'),
  turn: row('turn', 'gestureTurn', 'gestures.twoFingerDrag', 'tower.turn'),
} as const satisfies Readonly<Record<GestureMark, GestureRow>>;

/**
 * The gestures a family plays with (1.32), as the player set them: taps by
 * side or always right, flicks only with the gestures alone (with the buttons
 * too, the buttons drop and hold). The Tower's second finger turns the tower;
 * the Sand keeps no piece aside; the Mosaic is dragged, and the buttons alone
 * leave only the Tower's turn. A guide outside a game shows the falling well's.
 */
export function gestureRows(family: FamilyId | null, prefs: GuidePrefs): readonly GestureRow[] {
  if (family === 'placement') return [];
  const tower = family === 'volume';
  if (prefs.controls === 'buttons') return tower ? [ROWS.turn] : [];
  const flicks = prefs.controls === 'gestures';
  return [
    ROWS.drag,
    ...(prefs.tapSides ? [ROWS.tapRight, ROWS.tapLeft] : [ROWS.tap]),
    ROWS.softDrop,
    ...(flicks ? [ROWS.drop] : []),
    ...(flicks && family !== 'sand' ? [ROWS.hold] : []),
    // A second finger: a turn during a drag, or the tower's in the Tower.
    ...(tower ? [ROWS.turn] : [ROWS.second]),
    // The other way by two fingers, where no side does it.
    ...(prefs.tapSides ? [] : [ROWS.pair]),
  ];
}
