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
  ShiftLeft: 'keymap.shift',
  ShiftRight: 'keymap.shift',
  Escape: 'keymap.escape',
};

/** The keys the game refuses, named as most keyboards print them (the keys window says why). */
const PRINTED: Readonly<Record<string, string>> = {
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
};

/** What a US keyboard prints, for the browsers that cannot tell the layout (Firefox, Safari). */
const QWERTY: Readonly<Record<string, string>> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
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
    const printed = layout.value?.get(code) ?? QWERTY[code];
    if (printed) return printed.toUpperCase();
    return PRINTED[code] ?? code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
  };

  /** The key in words, for a screen reader. */
  const spoken = (code: string): string => {
    const name = NAMES[code];
    return name ? t(name) : label(code);
  };

  return { label, spoken };
}
