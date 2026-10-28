// MP4 videos without ffmpeg: Chrome encodes the frames in H.264 and the sound
// in AAC (WebCodecs), and this module writes them into an MP4 file (ISO/IEC
// 14496-12, -14 and -15). Playwright's ffmpeg only writes VP9, and some
// portals (Yandex Games) and the social apps take MP4. A video track at a
// constant frame rate, no B-frames (Baseline profile), an optional AAC track
// (the clip factory, 1.39), the index before the data ("fast start").
import { writeFileSync } from 'node:fs';

/** H.264 Constrained Baseline, level 4.0: up to 1920 × 1080 (or 1080 × 1920) at 30 frames a second. */
const CODEC = 'avc1.42E028';
/** AAC Low Complexity: what every phone and every app plays. */
const AUDIO_CODEC = 'mp4a.40.2';
/** An AAC frame holds this many samples per channel. */
const AAC_FRAME = 1024;
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
/** An MPEG-4 descriptor (ISO/IEC 14496-1): a tag, a length, its body (all ours are short). */
const descriptor = (tag, ...parts) => {
  const body = Buffer.concat(parts);
  if (body.length > 127) throw new Error(`Descriptor ${tag} too long for one length byte`);
  return Buffer.concat([Buffer.from([tag, body.length]), body]);
};

/** A track's sample tables: every sample in one chunk, at `offset` in the file. */
const sampleTables = ({ entry, count, delta, sizes, offset, keys }) =>
  box(
    'stbl',
    fullBox('stsd', 0, 0, u32(1), entry),
    fullBox('stts', 0, 0, u32(1), u32(count), u32(delta)),
    ...(keys ? [fullBox('stss', 0, 0, u32(keys.length), ...keys.map(u32))] : []),
    fullBox('stsc', 0, 0, u32(1), u32(1), u32(count), u32(1)),
    fullBox('stsz', 0, 0, u32(0), u32(count), ...sizes.map(u32)),
    fullBox('stco', 0, 0, u32(1), u32(offset)),
  );

/** A track: its header, its media header and handler, its sample tables. */
const track = ({
  id,
  durationMs,
  header,
  timescale,
  mediaDuration,
  handler,
  name,
  media,
  stbl,
  edit,
}) =>
  box(
    'trak',
    fullBox(
      'tkhd',
      0,
      3, // enabled, in the movie
      u32(0),
      u32(0),
      u32(id),
      u32(0),
      u32(durationMs),
      Buffer.alloc(8),
      u16(0),
      u16(0),
      header.volume,
      u16(0),
      MATRIX,
      u32(header.width * 0x10000),
      u32(header.height * 0x10000),
    ),
    ...(edit ? [edit] : []),
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
        Buffer.from(handler, 'latin1'),
        Buffer.alloc(12),
        Buffer.from(`${name}\0`, 'latin1'),
      ),
      box('minf', media, box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))), stbl),
    ),
  );

/**
 * The MP4 file: `ftyp`, then `moov` (the index: sizes, key frames, where the
 * data starts), then `mdat` (the frames, as H.264 length-prefixed units, then
 * the AAC frames).
 */
function mp4File({ width, height, fps, config, frames, audio = null }) {
  const timescale = fps * 1000;
  const delta = 1000;
  const videoMs = Math.round((frames.length / fps) * 1000);
  const audioSamples = audio ? audio.chunks.length * AAC_FRAME - audio.delay : 0;
  const audioMs = audio ? Math.round((audioSamples / audio.sampleRate) * 1000) : 0;
  const movieDuration = Math.max(videoMs, audioMs);
  const ftyp = box(
    'ftyp',
    Buffer.from('isom', 'latin1'),
    u32(0x200),
    Buffer.from('isomiso2avc1mp41', 'latin1'),
  );
  const keys = frames.flatMap((frame, i) => (frame.key ? [i + 1] : []));
  const avc1 = box(
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
    Buffer.alloc(32), // compressor name
    u16(0x0018), // colour, no alpha
    u16(0xffff),
    box('avcC', Buffer.from(config)),
    box('pasp', u32(1), u32(1)),
  );
  const videoData = Buffer.concat(frames.map((frame) => Buffer.from(frame.data)));
  const audioData = audio ? Buffer.concat(audio.chunks.map((chunk) => Buffer.from(chunk))) : null;
  const mp4a =
    audio &&
    box(
      'mp4a',
      Buffer.alloc(6),
      u16(1), // data reference index
      Buffer.alloc(8), // reserved
      u16(audio.channels),
      u16(16), // sample size
      u16(0),
      u16(0),
      u32(audio.sampleRate * 0x10000),
      fullBox(
        'esds',
        0,
        0,
        descriptor(
          0x03, // elementary stream
          u16(2), // its id: the track
          Buffer.from([0]),
          descriptor(
            0x04, // decoder configuration
            Buffer.from([0x40, 0x15]), // AAC, an audio stream
            Buffer.from([0, 0, 0]), // buffer size
            u32(audio.bitrate),
            u32(audio.bitrate),
            descriptor(0x05, Buffer.from(audio.config)), // AudioSpecificConfig
          ),
          descriptor(0x06, Buffer.from([0x02])), // MP4 sync layer
        ),
      ),
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
        u32(audio ? 3 : 2), // next track id
      ),
      track({
        id: 1,
        durationMs: videoMs,
        header: { volume: u16(0), width, height },
        timescale,
        mediaDuration: frames.length * delta,
        handler: 'vide',
        name: 'VideoHandler',
        media: fullBox('vmhd', 0, 1, Buffer.alloc(8)),
        stbl: sampleTables({
          entry: avc1,
          count: frames.length,
          delta,
          sizes: frames.map((frame) => frame.data.length),
          offset: dataOffset,
          keys,
        }),
      }),
      ...(audio
        ? [
            track({
              id: 2,
              durationMs: audioMs,
              header: { volume: u16(0x0100), width: 0, height: 0 },
              timescale: audio.sampleRate,
              mediaDuration: audio.chunks.length * AAC_FRAME,
              handler: 'soun',
              name: 'SoundHandler',
              media: fullBox('smhd', 0, 0, u16(0), u16(0)),
              stbl: sampleTables({
                entry: mp4a,
                count: audio.chunks.length,
                delta: AAC_FRAME,
                sizes: audio.chunks.map((chunk) => chunk.length),
                offset: dataOffset + videoData.length,
              }),
              // The encoder's priming samples are skipped: the sound starts with the picture.
              edit: box(
                'edts',
                fullBox('elst', 0, 0, u32(1), u32(audioMs), u32(audio.delay), u16(1), u16(0)),
              ),
            }),
          ]
        : []),
    );
  // The data starts after ftyp, moov and mdat's own header; moov's size does not depend on it.
  const index = moov(ftyp.length + moov(0).length + 8);
  const data = audioData ? Buffer.concat([videoData, audioData]) : videoData;
  return Buffer.concat([ftyp, index, u32(8 + data.length), Buffer.from('mdat', 'latin1'), data]);
}

/** Bytes back to Node from the page, in batches: one call for a whole video would be hundreds of megabytes of text. */
async function collect(page, path) {
  const count = await page.evaluate((key) => window.encoding[key].length, path);
  const out = [];
  for (let start = 0; start < count; start += 60) {
    const batch = await page.evaluate(
      ({ key, start, end }) =>
        window.encoding[key].slice(start, end).map((chunk) => {
          let binary = '';
          for (let i = 0; i < chunk.data.length; i += 0x8000) {
            binary += String.fromCharCode(...chunk.data.subarray(i, i + 0x8000));
          }
          return { data: btoa(binary), key: chunk.key ?? false };
        }),
      { key: path, start, end: start + 60 },
    );
    for (const chunk of batch)
      out.push({ data: Buffer.from(chunk.data, 'base64'), key: chunk.key });
  }
  return out;
}

/**
 * A video being encoded in a Chrome tab: `add` a frame (a picture of the right
 * size, or layers drawn into the frame) as many times as it lasts, optionally
 * `setAudio`, then `save` the MP4.
 */
export class Mp4Encoder {
  #page;
  #options;
  #count = 0;
  #audio = null;
  /** The picture of each layer of the last frame: one shown again is not sent again. */
  #shown = [];

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
      const state = { video: [], config: null, error: null, audio: [], audioConfig: null };
      const encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          state.video.push({ data, key: chunk.type === 'key' });
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
      window.encoding = { encoder, state, video: state.video, audio: state.audio, shown: [] };
    }, options);
    return new Mp4Encoder(page, options);
  }

  /**
   * Encodes one frame: a picture of the video's size (bytes), or layers
   * (`{ picture, x, y, width, height }`, in the video's pixels) drawn over
   * `background`, each picture scaled into its place (and cropped by the
   * frame: a picture larger than the frame is a zoom).
   */
  async add(input, { background = null } = {}) {
    const index = this.#count++;
    const { fps, width, height } = this.#options;
    const layers = Buffer.isBuffer(input) ? [{ picture: input, x: 0, y: 0, width, height }] : input;
    // A picture shown again (a freeze, a still) crosses to the tab once: it keeps each layer's last.
    const again = layers.map(({ picture }, slot) => this.#shown[slot] === picture);
    this.#shown = layers.map(({ picture }) => picture);
    await this.#page.evaluate(
      async ({ layers, background, index, fps, every, width, height }) => {
        const { encoder, state, shown } = window.encoding;
        if (state.error) throw new Error(state.error);
        // Never more than a few frames waiting: the tab's memory stays flat.
        while (encoder.encodeQueueSize > 4) {
          await new Promise((resolve) =>
            encoder.addEventListener('dequeue', resolve, { once: true }),
          );
        }
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, width, height);
        }
        for (const [slot, layer] of layers.entries()) {
          if (layer.base64 !== null) {
            shown[slot]?.close();
            const bytes = Uint8Array.from(atob(layer.base64), (char) => char.charCodeAt(0));
            shown[slot] = await createImageBitmap(new Blob([bytes]));
          }
          ctx.drawImage(shown[slot], layer.x, layer.y, layer.width, layer.height);
        }
        const frame = new VideoFrame(canvas, {
          timestamp: Math.round((index * 1e6) / fps),
          duration: Math.round(1e6 / fps),
        });
        encoder.encode(frame, { keyFrame: index % every === 0 });
        frame.close();
      },
      {
        layers: layers.map(({ picture, x, y, width: w, height: h }, slot) => ({
          base64: again[slot] ? null : picture.toString('base64'),
          x,
          y,
          width: w,
          height: h,
        })),
        background,
        index,
        fps,
        every: fps * KEY_EVERY_SECONDS,
        width,
        height,
      },
    );
  }

  /** A still picture of the video's size (JPEG bytes), drawn like a frame: a clip's cover. */
  async still(layers, { background = null } = {}) {
    const { width, height } = this.#options;
    const base64 = await this.#page.evaluate(
      async ({ layers, background, width, height }) => {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        if (background) {
          ctx.fillStyle = background;
          ctx.fillRect(0, 0, width, height);
        }
        for (const layer of layers) {
          const bytes = Uint8Array.from(atob(layer.base64), (char) => char.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes]));
          ctx.drawImage(bitmap, layer.x, layer.y, layer.width, layer.height);
          bitmap.close();
        }
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      {
        layers: layers.map(({ picture, x, y, width: w, height: h }) => ({
          base64: picture.toString('base64'),
          x,
          y,
          width: w,
          height: h,
        })),
        background,
        width,
        height,
      },
    );
    return Buffer.from(base64, 'base64');
  }

  /**
   * The video's sound: `channels` of 32-bit float samples (Float32Array each)
   * at `sampleRate`, encoded in AAC. The encoder's priming (the samples it
   * puts before the sound) is measured: the AAC is decoded again and laid
   * against what went in, and the file skips exactly that many samples (its
   * edit list), so the sound starts with the picture. Returns the priming the
   * encoder `reported` (its first timestamp) and the one `measured`.
   */
  async setAudio({ channels, sampleRate, bitrate = 192_000 }) {
    const planar = Buffer.concat(
      channels.map((samples) =>
        Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength),
      ),
    );
    const frames = channels[0].length;
    const info = await this.#page.evaluate(
      async ({ base64, frames, channels, sampleRate, bitrate, codec }) => {
        const config = { codec, sampleRate, numberOfChannels: channels, bitrate };
        const support = await AudioEncoder.isConfigSupported(config);
        if (!support.supported) throw new Error(`This Chrome cannot encode ${codec}`);
        const { state } = window.encoding;
        let delay = 0;
        const encoder = new AudioEncoder({
          output: (chunk, metadata) => {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            state.audio.push({ data });
            const description = metadata?.decoderConfig?.description;
            if (description && !state.audioConfig) {
              state.audioConfig = ArrayBuffer.isView(description)
                ? new Uint8Array(
                    description.buffer,
                    description.byteOffset,
                    description.byteLength,
                  ).slice()
                : new Uint8Array(description).slice();
            }
            // A first chunk that starts before zero carries the encoder's priming.
            if (state.audio.length === 1 && chunk.timestamp < 0) {
              delay = Math.round((-chunk.timestamp / 1e6) * sampleRate);
            }
          },
          error: (error) => (state.error = String(error)),
        });
        encoder.configure(config);
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const all = new Float32Array(bytes.buffer);
        const block = 4800;
        for (let start = 0; start < frames; start += block) {
          const length = Math.min(block, frames - start);
          const data = new Float32Array(length * channels);
          for (let c = 0; c < channels; c++) {
            data.set(all.subarray(c * frames + start, c * frames + start + length), c * length);
          }
          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate,
            numberOfFrames: length,
            numberOfChannels: channels,
            timestamp: Math.round((start / sampleRate) * 1e6),
            data,
          });
          encoder.encode(audioData);
          audioData.close();
        }
        await encoder.flush();
        encoder.close();
        if (state.error) throw new Error(state.error);
        // Decoded again: where the first channel's sound comes out of the decoder.
        const parts = [];
        const decoder = new AudioDecoder({
          output: (data) => {
            const part = new Float32Array(data.numberOfFrames);
            data.copyTo(part, { planeIndex: 0, format: 'f32-planar' });
            parts.push(part);
            data.close();
          },
          error: (error) => (state.error = String(error)),
        });
        decoder.configure({ ...config, description: state.audioConfig });
        const duration = Math.round((1024 / sampleRate) * 1e6);
        state.audio.forEach((chunk, i) =>
          decoder.decode(
            new EncodedAudioChunk({ type: 'key', timestamp: i * duration, data: chunk.data }),
          ),
        );
        await decoder.flush();
        decoder.close();
        if (state.error) throw new Error(state.error);
        const output = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
        parts.reduce((at, part) => (output.set(part, at), at + part.length), 0);
        // The loudest half second that went in, then the shift where the decoded sound matches it best.
        const input = all.subarray(0, frames);
        const span = Math.min(frames, Math.round(sampleRate / 2));
        let start = 0;
        let loudest = -1;
        for (let from = 0; from + span <= frames; from += span >> 1) {
          let power = 0;
          for (let i = from; i < from + span; i++) power += input[i] * input[i];
          if (power > loudest) [loudest, start] = [power, from];
        }
        let measured = 0;
        let best = -Infinity;
        for (let shift = 0; shift <= 4096 && start + shift + span <= output.length; shift++) {
          let dot = 0;
          let power = 0;
          for (let i = 0; i < span; i++) {
            const value = output[start + shift + i];
            dot += input[start + i] * value;
            power += value * value;
          }
          const match = dot / Math.sqrt(power || 1);
          if (match > best) [best, measured] = [match, shift];
        }
        return { delay, measured, count: state.audio.length };
      },
      {
        base64: planar.toString('base64'),
        frames,
        channels: channels.length,
        sampleRate,
        bitrate,
        codec: AUDIO_CODEC,
      },
    );
    this.#audio = { sampleRate, channels: channels.length, bitrate, delay: info.measured };
    return { reported: info.delay, measured: info.measured };
  }

  /** Ends the video: the last frames are encoded, the file written. Returns its size in bytes. */
  async save(file) {
    await this.#page.evaluate(async () => {
      await window.encoding.encoder.flush();
      window.encoding.encoder.close();
    });
    await this.#page.evaluate(() => {
      if (window.encoding.state.error) throw new Error(window.encoding.state.error);
    });
    const frames = await collect(this.#page, 'video');
    const config = await this.#page.evaluate(() => {
      const bytes = window.encoding.state.config;
      return bytes ? btoa(String.fromCharCode(...bytes)) : null;
    });
    let audio = null;
    if (this.#audio) {
      const chunks = (await collect(this.#page, 'audio')).map((chunk) => chunk.data);
      const audioConfig = await this.#page.evaluate(() => {
        const bytes = window.encoding.state.audioConfig;
        return bytes ? btoa(String.fromCharCode(...bytes)) : null;
      });
      if (!audioConfig)
        throw new Error('The encoder gave no AAC configuration (AudioSpecificConfig)');
      audio = { ...this.#audio, chunks, config: Buffer.from(audioConfig, 'base64') };
    }
    await this.#page.close();
    if (!config) throw new Error('The encoder gave no H.264 configuration (avcC)');
    if (frames.length !== this.#count)
      throw new Error(`${this.#count} frames in, ${frames.length} out`);
    const bytes = mp4File({
      ...this.#options,
      config: Buffer.from(config, 'base64'),
      frames,
      audio,
    });
    writeFileSync(file, bytes);
    return bytes.length;
  }
}
