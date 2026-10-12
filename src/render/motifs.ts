import { Tone } from '@/core/Tone';

type Context = CanvasRenderingContext2D;
export type Motif = (ctx: Context, centre: number, radius: number) => void;

/*
 * One engraved motif per tone, so that colours never carry information on
 * their own (colour-blind players read the motif). Chroma tones, which are
 * the ones the rules depend on, get the four most distinct motifs.
 */
const dot: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c, c, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
};
const ring: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c, c, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
};
const bar: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c);
  ctx.lineTo(c + r, c);
  ctx.stroke();
};
const bars: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c - r * 0.4);
  ctx.lineTo(c + r, c - r * 0.4);
  ctx.moveTo(c - r, c + r * 0.4);
  ctx.lineTo(c + r, c + r * 0.4);
  ctx.stroke();
};
const slash: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c + r);
  ctx.lineTo(c + r, c - r);
  ctx.stroke();
};
const plus: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c);
  ctx.lineTo(c + r, c);
  ctx.moveTo(c, c - r);
  ctx.lineTo(c, c + r);
  ctx.stroke();
};
const cross: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r * 0.8, c - r * 0.8);
  ctx.lineTo(c + r * 0.8, c + r * 0.8);
  ctx.moveTo(c + r * 0.8, c - r * 0.8);
  ctx.lineTo(c - r * 0.8, c + r * 0.8);
  ctx.stroke();
};
const triangle: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r * 0.85);
  ctx.lineTo(c + r * 0.85, c + r * 0.65);
  ctx.lineTo(c - r * 0.85, c + r * 0.65);
  ctx.closePath();
  ctx.stroke();
};
const diamond: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r);
  ctx.lineTo(c + r, c);
  ctx.lineTo(c, c + r);
  ctx.lineTo(c - r, c);
  ctx.closePath();
  ctx.stroke();
};
const hatch: Motif = (ctx, c, r) => {
  ctx.beginPath();
  for (let offset = -r; offset <= r; offset += r * 0.66) {
    ctx.moveTo(c - r, c + offset - r * 0.5);
    ctx.lineTo(c + r, c + offset + r * 0.5);
  }
  ctx.stroke();
};

export const MOTIFS: Readonly<Record<Exclude<Tone, typeof Tone.Empty>, Motif>> = {
  [Tone.I]: bar,
  [Tone.O]: dot,
  [Tone.T]: triangle,
  [Tone.S]: slash,
  [Tone.Z]: ring,
  [Tone.J]: plus,
  [Tone.L]: diamond,
  [Tone.ChromaA]: dot,
  [Tone.ChromaB]: bars,
  [Tone.ChromaC]: triangle,
  [Tone.ChromaD]: cross,
  [Tone.Garbage]: hatch,
  [Tone.Water]: ring,
  [Tone.Fire]: triangle,
};
