import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin, Connect } from 'vite';
import { catalogText, catalogs, isLocale, type Locale } from '../src/i18n/catalog.ts';
import {
  assertMovSequence,
  audioChannelLayout,
  concatLines,
  parseMovManifest,
  PRORES_ENCODE_ARGS,
  splitBodyTail,
} from '../src/export/movSequence.ts';

const execute = promisify(execFile);
const LIMIT = 200 * 1024 * 1024;

function localeFromHeader(header: string | string[] | undefined): Locale {
  const value = Array.isArray(header) ? header[0] : header;
  if (value && value.toLowerCase().includes('pt-br')) return 'pt-BR';
  return 'en';
}

function localize(locale: Locale, key: string) {
  return catalogText(catalogs[locale], key) ?? catalogs[locale].errorExportFfmpeg;
}

function runFfmpeg(
  ffmpeg: string,
  args: string[],
  abort: AbortController,
  onTime?: (seconds: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const progressArgs = onTime ? ['-progress', 'pipe:1'] : [];
    const child = spawn(
      ffmpeg,
      ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', ...progressArgs, ...args],
      { stdio: ['ignore', onTime ? 'pipe' : 'ignore', 'pipe'] },
    );
    const timer = setTimeout(() => child.kill('SIGKILL'), 600_000);
    const stop = () => child.kill('SIGTERM');
    abort.signal.addEventListener('abort', stop);
    if (abort.signal.aborted) stop();
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString().replace(/\r/g, '\n');
      const lines = stdout.split('\n');
      stdout = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('out_time_us=')) continue;
        const seconds = Number(line.slice(12)) / 1e6;
        if (Number.isFinite(seconds) && seconds >= 0) onTime?.(seconds);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', stop);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', stop);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || 'errorExportFfmpeg'));
    });
  });
}

export function exportMovPlugin(): Plugin {
  let busy = false;
  let percent = 0;
  const setPercent = (value: number) => {
    percent = Math.max(percent, Math.min(100, Math.round(value)));
  };
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url === '/api/export-mov-progress') {
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }).end(JSON.stringify({ percent }));
      return;
    }
    if (req.url !== '/api/export-mov') return next();
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      res.writeHead(403).end();
      return;
    }
    if (busy) {
      const locale = localeFromHeader(req.headers['accept-language']);
      res.writeHead(409, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: localize(locale, 'errorExportBusy') }));
      return;
    }
    busy = true;
    percent = 0;
    let directory: string | undefined;
    let locale = localeFromHeader(req.headers['accept-language']);
    const abort = new AbortController();
    const cancel = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.on('close', cancel);
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > LIMIT) throw new Error('errorExportTooLarge');
        chunks.push(bytes);
      }
      const body = new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type'] || '' } });
      const form = await body.formData();
      const formLocale = form.get('locale');
      if (isLocale(formLocale)) locale = formLocale;
      const audio = form.get('audio');
      const raw = form.get('manifest');
      if (!(audio instanceof File) || typeof raw !== 'string') {
        throw new Error('errorExportMissingFiles');
      }
      const { duration, width, height, segments } = parseMovManifest(raw);
      assertMovSequence(duration, segments);
      const used = new Set(segments.map((segment) => segment.face));
      const { bodySegments, tailParts, bodyFrames } = splitBodyTail(segments);
      directory = await mkdtemp(join(tmpdir(), 'face-animator-mov-'));
      for (const face of used) {
        const image = form.get(`face-${face}`);
        if (!(image instanceof File) || image.size > 20 * 1024 * 1024) {
          throw new Error('errorExportInvalidImage');
        }
        const png = Buffer.from(await image.arrayBuffer());
        if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
          throw new Error('errorExportImageSize');
        }
        await writeFile(join(directory, `face-${face}.png`), png);
      }
      const sourceAudio = join(directory, 'audio');
      const bodyAudio = join(directory, 'body.wav');
      const tailAudio = join(directory, 'tail.wav');
      await writeFile(sourceAudio, Buffer.from(await audio.arrayBuffer()));
      await writeFile(join(directory, 'frames.txt'), concatLines(bodySegments));
      await writeFile(join(directory, 'tail.txt'), concatLines(tailParts));
      const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffprobe = process.env.FFPROBE_PATH || (ffmpeg.endsWith('ffmpeg') ? `${ffmpeg.slice(0, -6)}ffprobe` : 'ffprobe');
      const { stdout: probe } = await execute(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels,channel_layout', '-of', 'json', sourceAudio], { timeout: 30_000, maxBuffer: 1024 * 1024, signal: abort.signal });
      const stream = JSON.parse(probe).streams?.[0];
      const rate = Number(stream?.sample_rate) || 48000;
      const channels = Number(stream?.channels) || 2;
      const layout = audioChannelLayout(stream?.channel_layout, channels);
      const format = [
        `aformat=sample_rates=${rate}`,
        `channel_layouts=${layout}`,
      ].join(':');
      const run = (
        args: string[],
        onTime?: (seconds: number) => void,
      ) => runFfmpeg(ffmpeg, args, abort, onTime);
      const encode = [...PRORES_ENCODE_ARGS];
      const bodySeconds = bodyFrames / 30;
      setPercent(6);
      // Head: digital silence. Tail: inaudible tone so Filmora does not trim the clip end.
      await run(['-f', 'lavfi', '-t', '2', '-i', `anullsrc=r=${rate}:cl=${layout}`, '-i', sourceAudio, '-filter_complex', `[0:a]${format}[s];[1:a]${format}[o];[s][o]concat=n=2:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'pcm_s16le', bodyAudio]);
      await run(['-f', 'lavfi', '-t', '2', '-i', `sine=frequency=18:sample_rate=${rate}:duration=2`, '-af', `volume=0.0008,${format}`, '-c:a', 'pcm_s16le', tailAudio]);
      setPercent(10);
      const bodyMov = join(directory, 'body.mov');
      const tailMov = join(directory, 'tail.mov');
      await run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'frames.txt'), '-i', bodyAudio, '-map', '0:v:0', '-map', '1:a:0', '-t', bodySeconds.toFixed(9), ...encode, bodyMov], (seconds) => {
        setPercent(10 + Math.min(1, seconds / Math.max(bodySeconds, 0.001)) * 75);
      });
      setPercent(85);
      await run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'tail.txt'), '-i', tailAudio, '-map', '0:v:0', '-map', '1:a:0', '-t', '2', ...encode, tailMov], (seconds) => {
        setPercent(85 + Math.min(1, seconds / 2) * 10);
      });
      setPercent(95);
      await writeFile(join(directory, 'parts.txt'), 'ffconcat version 1.0\nfile body.mov\nfile tail.mov\n');
      const output = join(directory, 'animation.mov');
      await run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'parts.txt'), '-c', 'copy', '-movflags', '+faststart', output]);
      const video = await readFile(output);
      setPercent(100);
      res.writeHead(200, { 'Content-Type': 'video/quicktime', 'Content-Length': video.length, 'Content-Disposition': 'attachment; filename="animation.mov"' }).end(video);
    } catch (error) {
      console.error('MOV export:', error);
      const key = error instanceof Error && !('code' in error)
        ? error.message
        : 'errorExportFfmpeg';
      if (!res.destroyed) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: localize(locale, key) }));
      }
    } finally {
      res.off('close', cancel);
      busy = false;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  };
  return {
    name: 'export-mov',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
