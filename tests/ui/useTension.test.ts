import { describe, expect, it, vi } from 'vitest';
import type * as Vue from 'vue';
import { ref } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import type { GameSession } from '@/session/GameSession';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { CALM_BPM } from '@/services/audio/Music';
import type { Haptics } from '@/services/Haptics';
import { useTension } from '@/ui/screens/useTension';

// The composable runs here outside a component: its unmount hook is not needed.
vi.mock('vue', async (original) => ({
  ...(await original<typeof Vue>()),
  onBeforeUnmount: vi.fn(),
}));

const FRAME = 16;

/** What the music hears of the danger. */
function fakeAudio() {
  const heard = { danger: 0, tempo: CALM_BPM, intensity: 0, reliefs: 0 };
  const audio = {
    play: () => {},
    relief: () => heard.reliefs++,
    setIntensity: (value: number) => (heard.intensity = value),
    setDanger: (value: number) => (heard.danger = value),
    setTempo: (value: number) => (heard.tempo = value),
  } as unknown as AudioEngine;
  return { audio, heard };
}

/** A game whose stack stands at `height` of its well. */
function game(height: number, state: GameSession['state'] = 'running') {
  return { state, pressure: () => height } as unknown as GameSession;
}

function tension() {
  const { audio, heard } = fakeAudio();
  const shown = useTension({
    audio,
    haptics: { pulse: () => {} } as unknown as Haptics,
    clock: { slow: () => {} } as unknown as FrameClock,
    level: () => 'full',
    root: ref(null),
  });
  /** Frames of the game, played or not. */
  const frames = (session: GameSession, count: number, playing = true) => {
    for (let k = 0; k < count; k++) shown.update(session, FRAME, [], playing);
  };
  return { shown, heard, frames };
}

describe('The tension shown on the game screen (useTension)', () => {
  it('rests while the game is paused, and comes back with it, without a relief', () => {
    const { shown, heard, frames } = tension();
    frames(game(0.93), 90);
    expect(shown.amount.value).toBeGreaterThan(0.8);
    expect(heard.danger).toBeGreaterThan(0.8);
    expect(heard.tempo).toBeGreaterThan(CALM_BPM);
    // The pause stops the clock: no frame comes, the danger rests at once.
    shown.rest();
    expect(shown.amount.value).toBe(0);
    expect(heard.danger).toBe(0);
    expect(heard.tempo).toBe(CALM_BPM);
    frames(game(0.93), 1);
    expect(shown.amount.value).toBeGreaterThan(0.8);
    expect(heard.reliefs).toBe(0);
  });

  it('shows no danger once the game is decided, while a Guardian’s show keeps it running', () => {
    const { shown, heard, frames } = tension();
    frames(game(0.93), 90);
    shown.end('goal');
    // The 1-1's end: the Dune Wyrm shows itself, the world moves, the stack is still high.
    frames(game(0.93), 240, false);
    expect(shown.amount.value).toBe(0);
    expect(heard.danger).toBe(0);
    expect(heard.tempo).toBe(CALM_BPM);
    expect(shown.broken.value).toBe(false);
  });

  it('keeps a broken well broken after a defeat, its heartbeat stopped', () => {
    const { shown, heard, frames } = tension();
    frames(game(0.95), 90);
    shown.end('topOut');
    frames(game(0.95, 'over'), 30, false);
    expect(shown.broken.value).toBe(true);
    expect(shown.amount.value).toBeGreaterThan(0.8);
    expect(heard.danger).toBe(0);
    expect(heard.tempo).toBe(CALM_BPM);
  });

  it('starts every new game calm', () => {
    const { shown, heard, frames } = tension();
    frames(game(0.95), 90);
    shown.end('topOut');
    shown.reset();
    frames(game(0.1), 1);
    expect(shown.amount.value).toBe(0);
    expect(shown.broken.value).toBe(false);
    expect(heard.danger).toBe(0);
    expect(heard.tempo).toBe(CALM_BPM);
  });
});
