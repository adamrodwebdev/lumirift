import { describe, expect, it } from 'vitest';
import { COSMETICS, type CosmeticKind } from '@/progression/Cosmetics';
import { MODE_IDS } from '@/session/ModeId';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import { WornLook } from '@/services/WornLook';

const look = (kind: CosmeticKind, id: string) =>
  COSMETICS.find((cosmetic) => cosmetic.kind === kind && cosmetic.id === id)!;

describe('WornLook', () => {
  it('wears a look tried for an ad for one game, then the player’s own again', () => {
    const profile = new ProfileService(new MemoryStorage(), () => MODE_IDS);
    const worn = new WornLook(profile);
    expect(worn.current.value.ambiance).toBe('night');

    worn.tryOn(look('ambiance', 'cosmos'));
    // It shows at once, around the menus, and the next game wears it.
    expect(worn.current.value.ambiance).toBe('cosmos');
    expect(worn.trying).toBe(look('ambiance', 'cosmos'));
    worn.gameStarted();
    expect(worn.current.value.ambiance).toBe('cosmos');
    // The game after wears the player's own look again.
    worn.gameStarted();
    expect(worn.current.value.ambiance).toBe('night');
    expect(worn.trying).toBeNull();
  });

  it('ends a worn trial when the game screen is left, never one not worn yet', () => {
    const profile = new ProfileService(new MemoryStorage(), () => MODE_IDS);
    const worn = new WornLook(profile);
    worn.tryOn(look('material', 'neon'));
    worn.gameLeft();
    expect(worn.current.value.material).toBe('neon');
    worn.gameStarted();
    worn.gameLeft();
    expect(worn.current.value.material).toBe(profile.current.equipment.material);
  });
});
