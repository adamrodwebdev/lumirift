import { Tone } from '../pieces/PieceType';

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const FALLBACK: Rgb = { r: 128, g: 128, b: 128 };

export function parseHex(value: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  if (!match) return FALLBACK;
  return {
    r: parseInt(match[1]!, 16),
    g: parseInt(match[2]!, 16),
    b: parseInt(match[3]!, 16),
  };
}

/** Lightens (amount > 0) towards white or darkens (amount < 0) towards black. */
export function shade({ r, g, b }: Rgb, amount: number): string {
  const mix = (channel: number) =>
    Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

/** Relative luminance (WCAG), to pick a motif colour that stands out. */
export function luminance({ r, g, b }: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Colours of the current theme, read from the CSS tokens (`--tone-N`, `--well-*`). */
export class TonePalette {
  private constructor(
    private readonly tones: ReadonlyMap<Tone, Rgb>,
    readonly wellBackground: string,
    readonly wellGrid: string,
    /** Crack lines, accents (points, waves) and the danger glow. */
    readonly crack: string,
    readonly accent: string,
    readonly danger: string,
  ) {}

  static fromElement(element: Element): TonePalette {
    const style = getComputedStyle(element);
    const read = (name: string) => style.getPropertyValue(name).trim();
    const tones = new Map<Tone, Rgb>();
    for (const tone of Object.values(Tone)) {
      if (tone !== Tone.Empty) tones.set(tone, parseHex(read(`--tone-${tone}`)));
    }
    return new TonePalette(
      tones,
      read('--well-bg'),
      read('--well-grid'),
      read('--crack'),
      read('--accent-fill'),
      read('--danger'),
    );
  }

  color(tone: Tone): Rgb {
    return this.tones.get(tone) ?? FALLBACK;
  }
}
