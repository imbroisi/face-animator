export const MOUTH_SLOTS = 3;
export const TAIL_FRAMES = 60;
export const MOV_FPS = 30;

export type MovSegment = {
  face: number;
  frames: number;
};

export type MovManifest = {
  duration: number;
  width: number;
  height: number;
  segments: MovSegment[];
};

export const PRORES_ENCODE_ARGS = [
  '-vf', 'format=rgba,fps=30,setsar=1',
  '-sws_flags', 'neighbor+accurate_rnd+full_chroma_int+full_chroma_inp',
  '-video_track_timescale', '30000',
  '-color_range', 'pc',
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'iec61966-2-1',
  '-c:v', 'prores_ks',
  '-profile:v', '4',
  '-pix_fmt', 'yuva444p10le',
  '-alpha_bits', '16',
  '-c:a', 'pcm_s16le',
] as const;

export function parseMovManifest(raw: string): MovManifest {
  const parsed = JSON.parse(raw) as Partial<MovManifest>;
  const { duration, width, height, segments } = parsed;
  if (
    !Number.isFinite(duration)
    || duration == null
    || duration <= 0
    || duration > 3600
    || !Number.isInteger(width)
    || width == null
    || width < 1
    || width > 8192
    || !Number.isInteger(height)
    || height == null
    || height < 1
    || height > 8192
    || !Array.isArray(segments)
    || segments.length > 108000
  ) {
    throw new Error('errorExportInvalidVideo');
  }
  return { duration, width, height, segments };
}

export function assertMovSequence(duration: number, segments: MovSegment[]) {
  let frames = 0;
  for (const segment of segments) {
    if (
      !Number.isInteger(segment.face)
      || segment.face < 0
      || segment.face > 1000
      || !Number.isInteger(segment.frames)
      || segment.frames <= 0
    ) {
      throw new Error('errorExportInvalidSequence');
    }
    frames += segment.frames;
  }
  if (frames !== Math.ceil(duration * MOV_FPS)) throw new Error('errorExportInvalidDuration');
  if (segments[0].face % (MOUTH_SLOTS * 2) !== 0) {
    throw new Error('errorExportMustStartClosed');
  }
  if (frames < TAIL_FRAMES) throw new Error('errorExportMustEndClosed');
}

export function splitBodyTail(segments: MovSegment[]) {
  const bodyParts = segments.map((segment) => ({ face: segment.face, frames: segment.frames }));
  const tailParts: MovSegment[] = [];
  let remaining = TAIL_FRAMES;
  for (let i = bodyParts.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const take = Math.min(bodyParts[i].frames, remaining);
    bodyParts[i].frames -= take;
    tailParts.unshift({ face: bodyParts[i].face, frames: take });
    remaining -= take;
  }
  if (tailParts.some((segment) => Math.floor(segment.face / 2) % MOUTH_SLOTS !== 0)) {
    throw new Error('errorExportMustEndClosed');
  }
  const bodySegments = bodyParts.filter((segment) => segment.frames > 0);
  const bodyFrames = bodySegments.reduce((sum, segment) => sum + segment.frames, 0);
  return { bodySegments, tailParts, bodyFrames };
}

export function concatLines(parts: MovSegment[]) {
  const lines = ['ffconcat version 1.0'];
  for (const segment of parts) {
    lines.push(
      `file face-${segment.face}.png`,
      'option framerate 30',
      `duration ${(segment.frames / MOV_FPS).toFixed(9)}`,
    );
  }
  const lastFace = parts.at(-1)?.face ?? 0;
  lines.push(
    `file face-${lastFace}.png`,
    'option framerate 30',
    'duration 0.033333334',
    `file face-${lastFace}.png`,
  );
  return lines.join('\n');
}

export function audioChannelLayout(streamLayout: unknown, channels: number) {
  if (typeof streamLayout === 'string' && streamLayout && streamLayout !== 'unknown') {
    return streamLayout;
  }
  if (channels === 1) return 'mono';
  if (channels === 2) return 'stereo';
  return `${channels}c`;
}
