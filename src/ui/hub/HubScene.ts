import { Tone } from '@/core/Tone';
import type { BlockSprites } from '@/families/falling/render/BlockSprites';
import { fitCanvas, type GemArt } from './GemArt';

/** The shapes of the seven pieces, in cells (one rotation each, turned by the scene). */
const SHAPES: readonly {
  readonly tone: Tone;
  readonly cells: readonly (readonly [number, number])[];
}[] = [
  {
    tone: Tone.I,
    cells: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  },
  {
    tone: Tone.O,
    cells: [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
  },
  {
    tone: Tone.T,
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  {
    tone: Tone.S,
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    tone: Tone.Z,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  },
  {
    tone: Tone.J,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
  {
    tone: Tone.L,
    cells: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
];
const PIECES = 12;
/** The scene runs at half the screen's density at most: it is a backdrop. */
const MAX_RATIO = 1.5;
/** One image every two of a 60 Hz screen (a little less, for timing jitter). */
const FRAME_MS = 30;
/** Three depths, far (small, dim, slow) to near: three sizes of gems to draw. */
const LAYERS = [0.15, 0.5, 0.9] as const;
const cellOf = (depth: number) => 8 + depth * 15;
/** The rift's strokes at their brightest (glow, light, core); it breathes below. */
const RIFT_STROKES = [
  { width: 30, alpha: 0.08 },
  { width: 7, alpha: 0.15 },
  { width: 1.4, alpha: 0.42 },
] as const;

interface Falling {
  shape: (typeof SHAPES)[number];
  cells: (readonly [number, number])[];
  /** Its depth: an index of `LAYERS`. */
  layer: number;
  depth: number;
  cell: number;
  x: number;
  y: number;
  speed: number;
  turnIn: number;
  sparked: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

const turn = (cells: readonly (readonly [number, number])[]) =>
  cells.map(([x, y]) => [2 - y, x] as const);

/**
 * The title screen's living backdrop: the game's gems drifting down at
 * several depths, turning now and then, past the rift, which breathes and
 * throws sparks when a near piece crosses it. It only draws while shown.
 */
export class HubScene {
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private rift: [number, number][] = [];
  /** The rift, painted once per size; each frame only sets how bright it is. */
  private riftLayer: HTMLCanvasElement | null = null;
  /** The gems of each depth, at the screen's density. */
  private layerSprites: BlockSprites[] = [];
  private readonly pieces: Falling[] = [];
  /** A piece came back at another depth: the far ones must be drawn first again. */
  private unsorted = true;
  private sparks: Spark[] = [];
  private running = false;
  private generation = 0;
  private last = 0;
  private clock = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly art: GemArt,
    /** Still pictures only (reduced motion): one frame, no animation. */
    private readonly still: boolean,
  ) {}

  resize(): void {
    const fit = fitCanvas(this.canvas);
    if (!fit) return;
    this.ratio = Math.min(MAX_RATIO, fit.ratio);
    this.canvas.width = Math.round(fit.width * this.ratio);
    this.canvas.height = Math.round(fit.height * this.ratio);
    fit.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.ctx = fit.ctx;
    this.width = fit.width;
    this.height = fit.height;
    this.rift = this.makeRift();
    this.riftLayer = this.paintRift(fit.ctx);
    this.layerSprites = LAYERS.map((depth) =>
      this.art.sprites('crystal', cellOf(depth) * this.ratio),
    );
    if (this.pieces.length === 0)
      for (let i = 0; i < PIECES; i++) this.pieces.push(this.spawn(true));
    this.draw();
  }

  /** Paints the rift's three strokes on a canvas of the scene's size. */
  private paintRift(like: CanvasRenderingContext2D): HTMLCanvasElement | null {
    const layer = document.createElement('canvas');
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const ctx = layer.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(like.getTransform());
    const { palette } = this.art;
    const colours = [palette.effects.rift, palette.accent, palette.crack];
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    this.rift.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    RIFT_STROKES.forEach(({ width, alpha }, i) => {
      ctx.strokeStyle = colours[i]!;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    });
    return layer;
  }

  start(): void {
    if (this.running || this.still) {
      this.draw();
      return;
    }
    this.running = true;
    const generation = ++this.generation;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running || generation !== this.generation) return;
      requestAnimationFrame(frame);
      // A slow backdrop: 30 images a second are enough, and cost half.
      if (now - this.last < FRAME_MS) return;
      this.step(Math.min(50, now - this.last));
      this.last = now;
      this.draw();
    };
    requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
  }

  /** The rift: a jagged line down the screen, right of the title (between the columns in landscape). */
  private makeRift(): [number, number][] {
    const landscape = this.width > this.height;
    const x0 = this.width * (landscape ? 0.535 : 0.8);
    const points: [number, number][] = [];
    for (let y = -10, i = 0; y < this.height + 60; y += 55 + ((i * 37) % 50), i++)
      points.push([x0 + (((i * 53) % 17) / 17 - 0.5) * this.width * 0.08, y]);
    return points;
  }

  private spawn(anywhere: boolean): Falling {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]!;
    const layer = Math.floor(Math.random() * LAYERS.length);
    const depth = LAYERS[layer]!;
    const cell = cellOf(depth);
    this.unsorted = true;
    let cells = [...shape.cells];
    for (let r = Math.floor(Math.random() * 4); r > 0; r--) cells = turn(cells);
    return {
      shape,
      cells,
      layer,
      depth,
      cell,
      x: Math.random() * this.width,
      y: anywhere ? Math.random() * this.height : -cell * 4,
      speed: 10 + depth * 30,
      turnIn: 1 + Math.random() * 3,
      sparked: false,
    };
  }

  private riftX(y: number): number {
    const points = this.rift;
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i]!;
      if (y1 < y) continue;
      const [x0, y0] = points[i - 1]!;
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return points.at(-1)?.[0] ?? 0;
  }

  private step(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.clock += dt;
    for (const piece of this.pieces) {
      piece.y += piece.speed * dt;
      piece.turnIn -= dt;
      if (piece.turnIn <= 0) {
        piece.cells = turn(piece.cells);
        piece.turnIn = 1.5 + Math.random() * 3;
      }
      const middle = piece.x + piece.cell * 1.5;
      if (
        !piece.sparked &&
        piece.depth > 0.4 &&
        Math.abs(middle - this.riftX(piece.y)) < piece.cell * 1.2
      ) {
        piece.sparked = true;
        this.burst(this.riftX(piece.y), piece.y + piece.cell);
      }
      if (piece.y > this.height + piece.cell * 4) Object.assign(piece, this.spawn(false));
    }
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 60 * dt;
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 50;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        age: 0,
        life: 0.6 + Math.random() * 0.5,
      });
    }
  }

  private draw(): void {
    const { ctx } = this;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    const breath = 0.5 + 0.5 * Math.sin(this.clock * 2.2);

    if (this.riftLayer) {
      ctx.globalAlpha = (2 + breath) / 3;
      ctx.drawImage(this.riftLayer, 0, 0, this.width, this.height);
    }

    if (this.unsorted) {
      this.pieces.sort((a, b) => a.depth - b.depth);
      this.unsorted = false;
    }
    for (const piece of this.pieces) {
      const sprite = this.layerSprites[piece.layer]?.get(piece.shape.tone);
      if (!sprite) continue;
      ctx.globalAlpha = 0.18 + piece.depth * 0.5;
      for (const [x, y] of piece.cells)
        ctx.drawImage(
          sprite,
          piece.x + x * piece.cell,
          piece.y + y * piece.cell,
          piece.cell,
          piece.cell,
        );
    }
    ctx.fillStyle = this.art.palette.accent;
    for (const spark of this.sparks) {
      ctx.globalAlpha = 1 - spark.age / spark.life;
      ctx.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}
