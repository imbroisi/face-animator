import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import {
  PRORES_ENCODE_ARGS,
  concatLines,
  splitBodyTail,
  type MovSegment,
} from './movSequence';
import { concatChannels, pcmWav, silentChannels, toneChannels } from './pcmWav';

export type BrowserFacePng = {
  face: number;
  bytes: Uint8Array;
};

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function loadFfmpeg(signal?: AbortSignal) {
  if (ffmpeg?.loaded) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      const instance = new FFmpeg();
      const base = `${self.location.origin}${import.meta.env.BASE_URL}ffmpeg`;
      await instance.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      }, { signal });
      return instance;
    })();
  }
  try {
    ffmpeg = await loading;
    return ffmpeg;
  } catch (error) {
    loading = null;
    throw error;
  }
}

async function execOrThrow(instance: FFmpeg, args: string[], signal?: AbortSignal) {
  const code = await instance.exec(args, 600_000, { signal });
  if (code !== 0) throw new Error('errorExportFfmpeg');
}

async function decodeAudio(file: File) {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from(
      { length: buffer.numberOfChannels },
      (_, index) => new Float32Array(buffer.getChannelData(index)),
    );
    return { channels, sampleRate: buffer.sampleRate };
  } finally {
    void context.close().catch(() => {});
  }
}

export async function encodeMovBrowser(
  audio: File,
  segments: MovSegment[],
  faces: readonly BrowserFacePng[],
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
) {
  const report = (percent: number) => onProgress?.(Math.max(0, Math.min(100, Math.round(percent))));
  report(4);
  const { bodySegments, tailParts, bodyFrames } = splitBodyTail(segments);
  const instance = await loadFfmpeg(signal);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  report(20);

  const abortEncode = () => {
    instance.terminate();
    ffmpeg = null;
    loading = null;
  };
  signal?.addEventListener('abort', abortEncode, { once: true });

  try {
    const { channels, sampleRate } = await decodeAudio(audio);
    const channelCount = channels.length || 1;
    const bodyWav = pcmWav(
      concatChannels(silentChannels(2, sampleRate, channelCount), channels),
      sampleRate,
    );
    const tailWav = pcmWav(
      toneChannels(2, sampleRate, channelCount, 18, 0.0008),
      sampleRate,
    );
    report(28);

    await instance.writeFile('frames.txt', concatLines(bodySegments), { signal });
    await instance.writeFile('tail.txt', concatLines(tailParts), { signal });
    await instance.writeFile('body.wav', bodyWav, { signal });
    await instance.writeFile('tail.wav', tailWav, { signal });
    for (const face of faces) {
      await instance.writeFile(`face-${face.face}.png`, face.bytes, { signal });
    }
    report(32);

    const onProgressEvent = ({ progress }: { progress: number }) => {
      report(32 + Math.min(1, Math.max(0, progress)) * 52);
    };
    instance.on('progress', onProgressEvent);
    await execOrThrow(instance, [
      '-f', 'concat',
      '-safe', '0',
      '-i', 'frames.txt',
      '-i', 'body.wav',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-t', (bodyFrames / 30).toFixed(9),
      ...PRORES_ENCODE_ARGS,
      'body.mov',
    ], signal);
    instance.off('progress', onProgressEvent);
    report(86);

    await execOrThrow(instance, [
      '-f', 'concat',
      '-safe', '0',
      '-i', 'tail.txt',
      '-i', 'tail.wav',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-t', '2',
      ...PRORES_ENCODE_ARGS,
      'tail.mov',
    ], signal);
    report(94);

    await instance.writeFile(
      'parts.txt',
      'ffconcat version 1.0\nfile body.mov\nfile tail.mov\n',
      { signal },
    );
    await execOrThrow(instance, [
      '-f', 'concat',
      '-safe', '0',
      '-i', 'parts.txt',
      '-c', 'copy',
      '-movflags', '+faststart',
      'animation.mov',
    ], signal);
    report(98);

    const data = await instance.readFile('animation.mov', undefined, { signal });
    if (typeof data === 'string') throw new Error('errorExportFfmpeg');
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    report(100);
    return new Blob([copy], { type: 'video/quicktime' });
  } finally {
    signal?.removeEventListener('abort', abortEncode);
    const leftovers = [
      'frames.txt', 'tail.txt', 'body.wav', 'tail.wav', 'parts.txt',
      'body.mov', 'tail.mov', 'animation.mov',
      ...faces.map((face) => `face-${face.face}.png`),
    ];
    await Promise.all(leftovers.map((path) => instance.deleteFile(path).catch(() => {})));
  }
}
