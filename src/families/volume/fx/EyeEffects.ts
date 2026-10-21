import type { FallingSession } from '@/families/falling/FallingSession';
import type { Cell } from '@/families/falling/pieces/Shapes';
import type { TowerMode } from '../TowerMode';

/** The Eye flashes this long when hurt (ms). */
export const EYE_HURT_MS = 260;
/** A damage figure rises above the Eye this long (ms). */
export const EYE_POPUP_MS = 900;
/** The light of a strike, from the Eye to the stones it dropped (ms). */
export const STRIKE_MS = 380;

export interface EyePopup {
  readonly text: string;
  age: number;
}

export interface Strike {
  readonly cells: readonly Cell[];
  age: number;
}

/**
 * The visual state of the Eye of the Tower: its flash of pain, the damage
 * it takes rising above it, the light of its strikes. `TowerRenderer` draws it.
 */
export class EyeEffects {
  hurt = 0;
  readonly popups: EyePopup[] = [];
  readonly strikes: Strike[] = [];

  constructor(private readonly formatNumber: (value: number) => string) {}

  attach(session: FallingSession, mode: TowerMode): () => void {
    const offs = [
      mode.eyeEvents.on('boss', ({ event }) => {
        if (event.type !== 'hurt') return;
        this.hurt = EYE_HURT_MS;
        this.popups.push({ text: `−${this.formatNumber(event.damage)}`, age: 0 });
      }),
      session.onGame('stones', ({ cells }) => this.strikes.push({ cells, age: 0 })),
    ];
    return () => offs.forEach((off) => off());
  }

  update(deltaMs: number): void {
    this.hurt = Math.max(0, this.hurt - deltaMs);
    age(this.popups, deltaMs, EYE_POPUP_MS);
    age(this.strikes, deltaMs, STRIKE_MS);
  }
}

function age(items: { age: number }[], deltaMs: number, lifetime: number): void {
  let write = 0;
  for (const item of items) {
    item.age += deltaMs;
    if (item.age < lifetime) items[write++] = item;
  }
  items.length = write;
}
