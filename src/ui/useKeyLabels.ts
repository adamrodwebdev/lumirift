import { shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

/** Keys drawn as symbols, whatever the layout. */
const SYMBOLS: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Backspace: '⌫',
};

/** Keys named for screen readers, by translation key. */
const NAMES: Readonly<Record<string, string>> = {
  ArrowLeft: 'keys.left',
  ArrowRight: 'keys.right',
  ArrowUp: 'keys.up',
  ArrowDown: 'keys.down',
  Backspace: 'keys.backspace',
  Space: 'keys.space',
  Enter: 'keys.enter',
};

interface KeyboardLayout {
  getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

/** What the player's keyboard prints on each key, once the browser tells (Chrome, Edge). */
const layout = shallowRef<ReadonlyMap<string, string> | null>(null);
let asked = false;

/**
 * The labels of the keys as the player sees them: the game binds keys by
 * their place (`KeyZ`), so on AZERTY the legend says W where QWERTY says Z.
 * Without the browser's layout map, the QWERTY letter is shown.
 */
export function useKeyLabels() {
  const { t } = useI18n();
  if (!asked) {
    asked = true;
    const keyboard = (navigator as Navigator & { keyboard?: KeyboardLayout }).keyboard;
    void keyboard
      ?.getLayoutMap()
      .then((map) => (layout.value = map))
      .catch(() => undefined);
  }

  /** The face of the key. */
  const label = (code: string): string => {
    const symbol = SYMBOLS[code];
    if (symbol) return symbol;
    const name = NAMES[code];
    if (name) return t(name);
    const printed = layout.value?.get(code);
    return printed ? printed.toUpperCase() : code.replace(/^(Key|Digit)/, '');
  };

  /** The key in words, for a screen reader. */
  const spoken = (code: string): string => {
    const name = NAMES[code];
    return name ? t(name) : label(code);
  };

  return { label, spoken };
}
