import { SEASON_AMBIANCES } from './SeasonData';

/**
 * The seasons' ambiances as a style sheet (1.36), from their data: the same
 * rules ambiances.css writes by hand for the game's own (their two lights in
 * the light and dark themes, a preview's, their defeat's colours), so that a
 * season's ambiance needs no stylesheet of its own.
 */
export function seasonAmbianceCss(): string {
  return SEASON_AMBIANCES.map(({ id, glow, defeat }) => {
    const self = `[data-ambiance='${id}']`;
    const preview = `[data-ambiance-preview='${id}']`;
    return [
      `:root${self},${preview}{--glow-1:${glow.light[0]};--glow-2:${glow.light[1]}}`,
      `:root[data-theme='dark']${self},:root[data-theme='dark'] ${preview}{--glow-1:${glow.dark[0]};--glow-2:${glow.dark[1]}}`,
      `:root${self}{--defeat-matter-1:${defeat.matter[0]};--defeat-matter-2:${defeat.matter[1]};--defeat-light-1:${defeat.light[0]};--defeat-light-2:${defeat.light[1]}}`,
    ].join('\n');
  }).join('\n');
}
