import { describe, expect, it, vi } from 'vitest';
import { BrowserStorage, MemoryStorage } from '@/services/KeyValueStorage';
import { SCORES_KEY, ScoreBoard } from '@/services/ScoreBoard';
import { DEFAULT_KEYS, KeyBindings } from '@/families/falling/input/KeyBindings';
import { DEFAULT_REPEAT } from '@/families/falling/input/RepeatTiming';
import { SETTINGS_KEY, SettingsService } from '@/services/SettingsService';
import { ShareService } from '@/services/ShareService';

const DEFAULTS = {
  locale: 'fr',
  ghost: true,
  effects: 'full',
  shake: true,
  haptics: true,
  volume: 0.7,
  musicVolume: 0.5,
  controls: 'gestures',
  muted: false,
  keys: DEFAULT_KEYS,
  ...DEFAULT_REPEAT,
} as const;

describe('SettingsService', () => {
  it('starts from the defaults and saves every change', () => {
    const storage = new MemoryStorage();
    const settings = new SettingsService(storage, DEFAULTS);
    expect(settings.current.musicVolume).toBe(0.5);
    settings.setMusicVolume(0.2);
    settings.showGhost(false);
    expect(settings.current.musicVolume).toBe(0.2);
    expect(JSON.parse(storage.get(SETTINGS_KEY)!)).toEqual({
      ...DEFAULTS,
      musicVolume: 0.2,
      ghost: false,
    });
  });

  it('restores saved settings and ignores invalid fields', () => {
    const storage = new MemoryStorage();
    storage.set(
      SETTINGS_KEY,
      JSON.stringify({
        locale: 'id',
        theme: 'neon',
        ghost: 'yes',
        effects: 'reduced',
        musicVolume: 2,
        controls: 'joystick',
      }),
    );
    const settings = new SettingsService(storage, DEFAULTS);
    expect(settings.current).toEqual({ ...DEFAULTS, locale: 'id', effects: 'reduced' });
  });

  it('remembers the touch controls chosen: gestures or buttons', () => {
    const storage = new MemoryStorage();
    new SettingsService(storage, DEFAULTS).chooseControls('buttons');
    expect(new SettingsService(storage, DEFAULTS).current.controls).toBe('buttons');
  });

  it('remembers the keys and the repeat timing, within their bounds', () => {
    const storage = new MemoryStorage();
    const keys = KeyBindings.DEFAULT.with('rotateCw', 0, 'KeyK').toJSON();
    const settings = new SettingsService(storage, DEFAULTS);
    settings.bindKeys(keys);
    settings.setRepeat({ das: 120, arr: 0 });
    const saved = new SettingsService(storage, DEFAULTS).current;
    expect(saved.keys).toEqual(keys);
    expect([saved.das, saved.arr]).toEqual([120, 0]);

    storage.set(SETTINGS_KEY, JSON.stringify({ das: 5, arr: 500, keys: { left: ['Escape'] } }));
    const fixed = new SettingsService(storage, DEFAULTS).current;
    expect([fixed.das, fixed.arr]).toEqual([DEFAULT_REPEAT.das, DEFAULT_REPEAT.arr]);
    expect(KeyBindings.parse(fixed.keys).codes('left')).toEqual([]);
  });

  it('keeps every change valid: volumes, repeat, keys; a volume moved unmutes', () => {
    const settings = new SettingsService(new MemoryStorage(), DEFAULTS);
    settings.toggleMute();
    expect(settings.current.muted).toBe(true);
    settings.setVolume(1.7);
    expect([settings.current.volume, settings.current.muted]).toEqual([1, false]);
    settings.setMusicVolume(-3);
    expect(settings.current.musicVolume).toBe(0);
    settings.setRepeat({ das: 9999, arr: -10 });
    expect([settings.current.das, settings.current.arr]).toEqual([300, 0]);
    // A reserved key never sticks.
    settings.bindKeys({ ...DEFAULTS.keys, pause: ['Escape', null] });
    expect(KeyBindings.parse(settings.current.keys).codes('pause')).toEqual([]);
    settings.resetKeys();
    expect(settings.current.keys).toEqual(DEFAULTS.keys);
  });

  it('survives corrupt storage', () => {
    const storage = new MemoryStorage();
    storage.set(SETTINGS_KEY, '{not json');
    expect(new SettingsService(storage, DEFAULTS).current.locale).toBe('fr');
  });
});

describe('ScoreBoard', () => {
  it('keeps the best result per key', () => {
    const storage = new MemoryStorage();
    const scores = new ScoreBoard(storage);
    expect(scores.best('classic')).toBeNull();
    expect(scores.record('classic', 1200)).toEqual({ best: 1200, isNewBest: true });
    expect(scores.record('classic', 800)).toEqual({ best: 1200, isNewBest: false });
    expect(scores.record('classic', 1500)).toEqual({ best: 1500, isNewBest: true });
    expect(new ScoreBoard(storage).best('classic')).toBe(1500);
  });

  it('does not celebrate an empty first game', () => {
    expect(new ScoreBoard(new MemoryStorage()).record('tide', 0).isNewBest).toBe(false);
  });

  it('keys the daily challenge by day', () => {
    expect(ScoreBoard.dailyKey('20261012')).toBe('daily:20261012');
  });

  it('drops invalid stored values', () => {
    const storage = new MemoryStorage();
    storage.set(SCORES_KEY, JSON.stringify({ classic: 10, tide: -5, flip: 'x', chroma: null }));
    const scores = new ScoreBoard(storage);
    expect(scores.best('classic')).toBe(10);
    expect(scores.best('tide')).toBeNull();
    expect(scores.best('flip')).toBeNull();
  });
});

describe('BrowserStorage', () => {
  it('falls back to memory when the browser refuses to store', () => {
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    const storage = new BrowserStorage(refusing);
    storage.set('key', 'value');
    expect(storage.get('key')).toBe('value');
  });

  it('works without any backend', () => {
    const storage = new BrowserStorage(null);
    storage.set('key', 'value');
    expect(storage.get('key')).toBe('value');
  });
});

describe('ShareService', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn(() => Promise.resolve());
    expect(await new ShareService({ share }).share('hello')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('reports a cancelled share sheet', async () => {
    const share = () => Promise.reject(new DOMException('cancelled', 'AbortError'));
    expect(await new ShareService({ share }).share('hello')).toBe('cancelled');
  });

  it('copies to the clipboard otherwise', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    expect(await new ShareService({ clipboard: { writeText } }).share('hello')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('copies when the share sheet is refused', async () => {
    const share = () => Promise.reject(new Error('not allowed'));
    const writeText = () => Promise.resolve();
    expect(await new ShareService({ share, clipboard: { writeText } }).share('hi')).toBe('copied');
  });

  it('says when nothing is available', async () => {
    expect(await new ShareService({}).share('hello')).toBe('unavailable');
  });
});
