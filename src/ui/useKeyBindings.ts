import { computed, type ComputedRef } from 'vue';
import { useServices } from '@/app/AppServices';
import { KeyBindings } from '@/families/falling/input/KeyBindings';

/** The player's keys, following the settings (a change applies at once, even mid-game). */
export function useKeyBindings(): ComputedRef<KeyBindings> {
  const { settings } = useServices();
  return computed(() => KeyBindings.parse(settings.current.keys));
}
