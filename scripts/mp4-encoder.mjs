// MP4 videos without ffmpeg: Chrome encodes the frames in H.264 (WebCodecs),
// and this module writes them into an MP4 file (ISO/IEC 14496-12 and -15).
// Playwright's ffmpeg only writes VP9, and some portals (Yandex Games) take MP4
// only. One video track, a constant frame rate, no B-frames (Baseline
// profile), the index before the data ("fast start").
import { writeFileSync } from 'node:fs';

/** H.264 Constrained Baseline, level 4.0: up to 1920 × 1080 (or 1080 × 1920) at 30 frames a second. */
const CODEC = 'avc1.42E028';
/** A key frame every two seconds: a portal's player can seek in the preview. */
const KEY_EVERY_SECONDS = 2;
/** Any localhost page is a secure context, where WebCodecs exists; no server answers it. */
const ENCODER_PAGE = 'http://localhost:5198/';

const u16 = (n) => {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(n);
  return bytes;
};
const u32 = (n) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(n);
  return bytes;
};
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]);
};
/** A box with a version and flags. */
const fullBox = (type, version, flags, ...parts) =>
  box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
/** The identity transformation matrix of the movie and track headers. */
const MATRIX = Buffer.concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));
/** The language code "und" (undetermined), packed as ISO 639-2/T in three 5-bit letters. */
const UNDETERMINED = 0x55c4;

/**
 * The MP4 file: `ftyp`, then `moov` (the index: sizes, key frames, where the
 * data starts), then `mdat` (the frames, as H.264 length-prefixed units).
 */
function mp4File({ width, height, fps, config, frames }) {
  const timescale = fps * 1000;
  const delta = 1000;
  const mediaDuration = frames.length * delta;
  const movieDuration = Math.round((frames.length / fps) * 1000);
  const ftyp = box(
    'ftyp',
    Buffer.from('isom', 'latin1'),
    u32(0x200),
    Buffer.from('isomiso2avc1mp41', 'latin1'),
  );
  const keys = frames.flatMap((frame, i) => (frame.key ? [i + 1] : []));
  const compressor = Buffer.alloc(32);
  const sampleEntry = box(
    'avc1',
    Buffer.alloc(6),
    u16(1), // data reference index
    Buffer.alloc(16), // pre-defined and reserved
    u16(width),
    u16(height),
    u32(0x00480000), // 72 dpi
    u32(0x00480000),
    u32(0),
    u16(1), // one frame per sample
    compressor,
    u16(0x0018), // colour, no alpha
    u16(0xffff),
    box('avcC', Buffer.from(config)),
    box('pasp', u32(1), u32(1)),
  );
  const moov = (dataOffset) =>
    box(
      'moov',
      fullBox(
        'mvhd',
        0,
        0,
        u32(0),
        u32(0),
        u32(1000),
        u32(movieDuration),
        u32(0x00010000), // rate 1.0
        u16(0x0100), // volume 1.0
        Buffer.alloc(10),
        MATRIX,
        Buffer.alloc(24),
        u32(2), // next track id
      ),
      box(
        'trak',
        fullBox(
          'tkhd',
          0,
          3, // enabled, in the movie
          u32(0),
          u32(0),
          u32(1), // track id
          u32(0),
          u32(movieDuration),
          Buffer.alloc(8),
          u16(0),
          u16(0),
          u16(0), // no sound
          u16(0),
          MATRIX,
          u32(width * 0x10000),
          u32(height * 0x10000),
        ),
        box(
          'mdia',
          fullBox(
            'mdhd',
            0,
            0,
            u32(0),
            u32(0),
            u32(timescale),
            u32(mediaDuration),
            u16(UNDETERMINED),
            u16(0),
          ),
          fullBox(
            'hdlr',
            0,
            0,
            u32(0),
            Buffer.from('vide', 'latin1'),
            Buffer.alloc(12),
            Buffer.from('VideoHandler\0', 'latin1'),
          ),
          box(
            'minf',
            fullBox('vmhd', 0, 1, Buffer.alloc(8)),
            box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
            box(
              'stbl',
              fullBox('stsd', 0, 0, u32(1), sampleEntry),
              fullBox('stts', 0, 0, u32(1), u32(frames.length), u32(delta)),
              fullBox('stss', 0, 0, u32(keys.length), ...keys.map(u32)),
              // Every frame in one chunk.
              fullBox('stsc', 0, 0, u32(1), u32(1), u32(frames.length), u32(1)),
              fullBox(
                'stsz',
                0,
                0,
                u32(0),
                u32(frames.length),
                ...frames.map((frame) => u32(frame.data.length)),
              ),
              fullBox('stco', 0, 0, u32(1), u32(dataOffset)),
            ),
          ),
        ),
      ),
    );
  // The data starts after ftyp, moov and mdat's own header; moov's size does not depend on it.
  const index = moov(ftyp.length + moov(0).length + 8);
  const data = Buffer.concat(frames.map((frame) => Buffer.from(frame.data)));
  return Buffer.concat([ftyp, index, u32(8 + data.length), Buffer.from('mdat', 'latin1'), data]);
}

/**
 * A video being encoded in a Chrome tab: `add` a frame (a JPEG or PNG picture
 * of the right size) as many times as it lasts, then `save` the MP4.
 */
export class Mp4Encoder {
  #page;
  #options;
  #count = 0;

  constructor(page, options) {
    this.#page = page;
    this.#options = options;
  }

  /** Opens the encoder; `bitrate` in bits per second. */
  static async open(browser, { width, height, fps, bitrate = 10_000_000 }) {
    const page = await browser.newPage();
    await page.route(`${ENCODER_PAGE}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Encoder</title>' }),
    );
    await page.goto(ENCODER_PAGE);
    const options = { codec: CODEC, width, height, fps, bitrate };
    await page.evaluate(async (config) => {
      const support = await VideoEncoder.isConfigSupported({
        codec: config.codec,
        width: config.width,
        height: config.height,
        bitrate: config.bitrate,
        framerate: config.fps,
        avc: { format: 'avc' },
      });
      if (!support.supported) throw new Error(`This Chrome cannot encode ${config.codec}`);
      const state = { chunks: [], config: null, error: null };
      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          state.chunks.push({ data, key: chunk.type === 'key' });
          const description = metadata?.decoderConfig?.description;
          if (description) {
            state.config = ArrayBuffer.isView(description)
              ? new Uint8Array(
                  description.buffer,
                  description.byteOffset,
                  description.byteLength,
                ).slice()
              : new Uint8Array(description).slice();
          }
        },
        error: (error) => (state.error = String(error)),
      });
      encoder.configure({
        codec: config.codec,
        width: config.width,
        height: config.height,
        bitrate: config.bitrate,
        framerate: config.fps,
        latencyMode: 'quality',
        avc: { format: 'avc' },
      });
      window.encoding = { encoder, state };
    }, options);
    return new Mp4Encoder(page, options);
  }

  /** Encodes one frame (a picture, as bytes). */
  async add(picture) {
    const index = this.#count++;
    const { fps } = this.#options;
    await this.#page.evaluate(
      async ({ base64, index, fps, every }) => {
        const { encoder, state } = window.encoding;
        if (state.error) throw new Error(state.error);
        // Never more than a few frames waiting: the tab's memory stays flat.
        while (encoder.encodeQueueSize > 4) {
          await new Promise((resolve) =>
            encoder.addEventListener('dequeue', resolve, { once: true }),
          );
        }
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes]));
        const frame = new VideoFrame(bitmap, {
          timestamp: Math.round((index * 1e6) / fps),
          duration: Math.round(1e6 / fps),
        });
        encoder.encode(frame, { keyFrame: index % every === 0 });
        frame.close();
        bitmap.close();
      },
      { base64: picture.toString('base64'), index, fps, every: fps * KEY_EVERY_SECONDS },
    );
  }

  /** Ends the video: the last frames are encoded, the file written. Returns its size in bytes. */
  async save(file) {
    await this.#page.evaluate(async () => {
      await window.encoding.encoder.flush();
      window.encoding.encoder.close();
    });
    const count = await this.#page.evaluate(() => {
      if (window.encoding.state.error) throw new Error(window.encoding.state.error);
      return window.encoding.state.chunks.length;
    });
    // Back to Node in batches: one call for a whole video would be hundreds of megabytes of text.
    const frames = [];
    for (let start = 0; start < count; start += 60) {
      const batch = await this.#page.evaluate(
        ({ start, end }) =>
          window.encoding.state.chunks.slice(start, end).map((chunk) => {
            let binary = '';
            for (let i = 0; i < chunk.data.length; i += 0x8000) {
              binary += String.fromCharCode(...chunk.data.subarray(i, i + 0x8000));
            }
            return { data: btoa(binary), key: chunk.key };
          }),
        { start, end: start + 60 },
      );
      for (const chunk of batch)
        frames.push({ data: Buffer.from(chunk.data, 'base64'), key: chunk.key });
    }
    const config = await this.#page.evaluate(() => {
      const bytes = window.encoding.state.config;
      return bytes ? btoa(String.fromCharCode(...bytes)) : null;
    });
    await this.#page.close();
    if (!config) throw new Error('The encoder gave no H.264 configuration (avcC)');
    if (frames.length !== this.#count)
      throw new Error(`${this.#count} frames in, ${frames.length} out`);
    const bytes = mp4File({ ...this.#options, config: Buffer.from(config, 'base64'), frames });
    writeFileSync(file, bytes);
    return bytes.length;
  }
}
