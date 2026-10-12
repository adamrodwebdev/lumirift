import { describe, expect, it } from 'vitest';
import { DAILY_TIME_LIMIT_MS, DailyChallenge } from '@/session/DailyChallenge';
import { ModeCatalog } from '@/session/ModeCatalog';
import { MODE_IDS } from '@/session/ModeId';

describe('ModeCatalog', () => {
  const catalog = new ModeCatalog();

  it('describes every implemented mode, once', () => {
    expect(catalog.list().map((mode) => mode.id)).toEqual([...MODE_IDS]);
  });

  it('rejects an unknown mode', () => {
    expect(() => catalog.get('nope' as 'classic')).toThrow();
  });

  it('lists the modes the daily challenge can draw', () => {
    expect(catalog.dailyEligible()).toEqual([
      'classic',
      'chroma',
      'mirror',
      'fusion',
      'rhythm',
      'mosaic',
    ]);
  });

  it('loads the family on demand and creates a session', async () => {
    const session = await catalog.create('mirror', {
      random: new DailyChallenge(new Date(2026, 9, 12), ['mirror']).sessionOptions().random,
      timeLimitMs: null,
    });
    expect(session.modeId).toBe('mirror');
    expect(session.family).toBe('falling');
    expect(session.state).toBe('ready');
  });

  it('fails clearly when a family is not available', async () => {
    const empty = new ModeCatalog(catalog.list(), new Map());
    await expect(empty.create('classic', dailyOptions())).rejects.toThrow(/falling/);
  });
});

function dailyOptions() {
  return new DailyChallenge(new Date(2026, 9, 12), ['classic']).sessionOptions();
}

describe('DailyChallenge', () => {
  const eligible = ['classic', 'chroma', 'mirror'] as const;

  it('uses the local date as its key', () => {
    expect(new DailyChallenge(new Date(2026, 0, 5, 23, 59), eligible).key).toBe('20260105');
  });

  it('draws the same mode for everybody on the same day', () => {
    const morning = new DailyChallenge(new Date(2026, 9, 12, 8), eligible);
    const evening = new DailyChallenge(new Date(2026, 9, 12, 22), eligible);
    expect(morning.modeId).toBe(evening.modeId);
    expect(eligible).toContain(morning.modeId);
  });

  it('varies the mode from day to day', () => {
    const modes = new Set(
      Array.from(
        { length: 30 },
        (_, day) => new DailyChallenge(new Date(2026, 9, day + 1), eligible).modeId,
      ),
    );
    expect(modes.size).toBe(eligible.length);
  });

  it('replays the same pieces on every attempt, for two minutes', () => {
    const challenge = new DailyChallenge(new Date(2026, 9, 12), eligible);
    const first = challenge.sessionOptions();
    const second = challenge.sessionOptions();
    expect([first.random.next(), first.random.next()]).toEqual([
      second.random.next(),
      second.random.next(),
    ]);
    expect(first.timeLimitMs).toBe(DAILY_TIME_LIMIT_MS);
  });

  it('needs at least one eligible mode', () => {
    expect(() => new DailyChallenge(new Date(), [])).toThrow();
  });
});
