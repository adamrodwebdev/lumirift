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

const drop: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r);
  ctx.quadraticCurveTo(c + r * 0.85, c + r * 0.1, c, c + r * 0.75);
  ctx.quadraticCurveTo(c - r * 0.85, c + r * 0.1, c, c - r);
  ctx.closePath();
  ctx.stroke();
};
const flake: Motif = (ctx, c, r) => {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    ctx.moveTo(c - Math.cos(a) * r, c - Math.sin(a) * r);
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.stroke();
};
const cloud: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c - r * 0.4, c + r * 0.1, r * 0.4, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(c, c - r * 0.2, r * 0.45, Math.PI, 0);
  ctx.arc(c + r * 0.45, c + r * 0.1, r * 0.38, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.stroke();
};
const leaf: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r * 0.8, c + r * 0.8);
  ctx.quadraticCurveTo(c - r * 0.6, c - r * 0.8, c + r * 0.8, c - r * 0.8);
  ctx.quadraticCurveTo(c + r * 0.6, c + r * 0.6, c - r * 0.8, c + r * 0.8);
  ctx.moveTo(c - r * 0.8, c + r * 0.8);
  ctx.lineTo(c + r * 0.2, c - r * 0.2);
  ctx.stroke();
};
const bubbles: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c - r * 0.35, c + r * 0.3, r * 0.38, 0, Math.PI * 2);
  ctx.moveTo(c + r * 0.75, c - r * 0.3);
  ctx.arc(c + r * 0.45, c - r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
};
const bolt: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c + r * 0.3, c - r);
  ctx.lineTo(c - r * 0.45, c + r * 0.1);
  ctx.lineTo(c + r * 0.15, c + r * 0.1);
  ctx.lineTo(c - r * 0.3, c + r);
  ctx.stroke();
};
const flame: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r);
  ctx.quadraticCurveTo(c + r, c, c + r * 0.4, c + r * 0.8);
  ctx.quadraticCurveTo(c, c + r, c - r * 0.4, c + r * 0.8);
  ctx.quadraticCurveTo(c - r, c, c, c - r);
  ctx.closePath();
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
  [Tone.Oil]: drop,
  [Tone.Ice]: flake,
  [Tone.Steam]: cloud,
  [Tone.Seed]: leaf,
  [Tone.Acid]: bubbles,
  [Tone.Lightning]: bolt,
  [Tone.Blaze]: flame,
};
