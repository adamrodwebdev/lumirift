import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { SaveSlot } from '@/services/SaveSlot';

const KEY = 'stackrift:test';
const LIMIT = 64;

/** A storage holding `stored` under the slot's key (nothing for null). */
function storageWith(stored: string | null): MemoryStorage {
  const storage = new MemoryStorage();
  if (stored !== null) storage.set(KEY, stored);
  return storage;
}

/** A save's text padded to exactly `length` characters with a field the game ignores. */
const padded = (length: number): string => `{"pad":"${'x'.repeat(length - 10)}"}`;

describe('SaveSlot: a save read back through the door', () => {
  it('reads a stored record', () => {
    const slot = new SaveSlot(storageWith('{"level":3}'), KEY, LIMIT);
    expect(slot.saved?.number('level', { min: 1, max: 9, integer: true })).toBe(3);
  });

  it('reads a stored text exactly as long as its limit', () => {
    expect(padded(LIMIT)).toHaveLength(LIMIT);
    expect(new SaveSlot(storageWith(padded(LIMIT)), KEY, LIMIT).saved).not.toBeNull();
  });

  it('has nothing to read when nothing was saved, and saves what the game notes', () => {
    const storage = storageWith(null);
    const slot = new SaveSlot(storage, KEY, LIMIT);
    expect(slot.saved).toBeNull();
    slot.note({ level: 1 });
    expect(storage.get(KEY)).toBe('{"level":1}');
  });

  it.each([
    { name: 'text that is not JSON', stored: '{level: 3' },
    { name: 'a JSON null', stored: 'null' },
    { name: 'a JSON number', stored: '42' },
    { name: 'a JSON text', stored: '"level"' },
    { name: 'a JSON list', stored: '[1, 2]' },
    { name: 'a JSON boolean', stored: 'true' },
    { name: 'a text one character over its limit', stored: padded(LIMIT + 1) },
  ])('keeps $name: nothing read, nothing the game notes written over it', ({ stored }) => {
    const storage = storageWith(stored);
    const slot = new SaveSlot(storage, KEY, LIMIT);
    expect(slot.saved).toBeNull();
    slot.note({ level: 1 });
    expect(storage.get(KEY)).toBe(stored);
  });

  it('replaces a value it could not read with the player’s progress, then notes again', () => {
    const storage = storageWith('{level: 3');
    const slot = new SaveSlot(storage, KEY, LIMIT);
    slot.write({ level: 2 });
    expect(storage.get(KEY)).toBe('{"level":2}');
    slot.note({ level: 3 });
    expect(storage.get(KEY)).toBe('{"level":3}');
  });

  it('never writes a save longer than it would read back, keeping the last one', () => {
    const storage = storageWith('{"level":3}');
    const slot = new SaveSlot(storage, KEY, LIMIT);
    slot.write({ pad: 'x'.repeat(LIMIT) });
    expect(storage.get(KEY)).toBe('{"level":3}');
  });

  it('lists the saved record’s own names, in their order, the prototype key included', () => {
    const slot = new SaveSlot(storageWith('{"b":1,"__proto__":2,"a":3}'), KEY, LIMIT);
    expect(slot.names).toEqual(['b', '__proto__', 'a']);
  });

  it('lists no names for a value it could not read', () => {
    expect(new SaveSlot(storageWith('[1, 2]'), KEY, LIMIT).names).toEqual([]);
  });
});
