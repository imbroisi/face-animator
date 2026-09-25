import { cycleFaceAt } from '../audio/mouthCycles';
import type { MouthTimeline } from '../audio/mouthCycles';
import { applyEyeCycle, eyes, eyeStateFromCompositeId, mouthFromCompositeId, typeFromCompositeId } from '../faces/eyes';
import { faces, type FaceType } from '../faces/Faces';
import type { Locale } from '../i18n/catalog';
import { encodeMovBrowser } from './encodeMovBrowser';
import { cssBackgroundHex } from './exportLook';
import { frameSize, type MovOutputSize } from './movSize';
import { assertMovSequence, parseMovManifest } from './movSequence';

function drawCentered(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  context.drawImage(
    image,
    Math.floor((width - sourceWidth) / 2),
    Math.floor((height - sourceHeight) / 2),
  );
}

function compositeFace(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  mouth: HTMLImageElement,
  eyesImage: HTMLImageElement | undefined,
  backgroundHex: string,
  blurPx: number,
) {
  context.filter = 'none';
  context.fillStyle = cssBackgroundHex(backgroundHex);
  context.fillRect(0, 0, width, height);
  const blur = Number.isFinite(blurPx) && blurPx > 0 ? blurPx : 0;
  if (blur === 0) {
    drawCentered(context, mouth, width, height, mouth.naturalWidth, mouth.naturalHeight);
    if (eyesImage) {
      drawCentered(
        context,
        eyesImage,
        width,
        height,
        eyesImage.naturalWidth,
        eyesImage.naturalHeight,
      );
    }
    return;
  }
  const pad = Math.ceil(blur * 3);
  const spriteWidth = Math.max(mouth.naturalWidth, eyesImage?.naturalWidth ?? 0) + pad * 2;
  const spriteHeight = Math.max(mouth.naturalHeight, eyesImage?.naturalHeight ?? 0) + pad * 2;
  const sprite = document.createElement('canvas');
  sprite.width = spriteWidth;
  sprite.height = spriteHeight;
  const spriteContext = sprite.getContext('2d', { alpha: true, colorSpace: 'srgb' });
  if (!spriteContext) throw new Error('errorPrepareImages');
  spriteContext.filter = `blur(${blur}px)`;
  drawCentered(
    spriteContext,
    mouth,
    spriteWidth,
    spriteHeight,
    mouth.naturalWidth,
    mouth.naturalHeight,
  );
  if (eyesImage) {
    drawCentered(
      spriteContext,
      eyesImage,
      spriteWidth,
      spriteHeight,
      eyesImage.naturalWidth,
      eyesImage.naturalHeight,
    );
  }
  drawCentered(context, sprite, width, height, spriteWidth, spriteHeight);
}

async function localExportAvailable(signal?: AbortSignal) {
  try {
    const response = await fetch('/api/export-mov-progress', { signal });
    return Boolean(
      response.ok && response.headers.get('content-type')?.includes('application/json'),
    );
  } catch {
    return false;
  }
}

export async function exportMov(
  file: File,
  timeline: MouthTimeline,
  faceAt: (time: number) => FaceType,
  size: MovOutputSize,
  backgroundHex: string,
  blurPx: number,
  locale: Locale,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
) {
  const report = (percent: number) => {
    shown = Math.max(shown, Math.min(100, Math.round(percent)));
    onProgress?.(shown);
  };
  let shown = 0;
  const stopIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  report(1);
  const fps = 30;
  const mouths: { mouth: number; type: FaceType; frames: number }[] = [];
  for (let frame = 0; frame < Math.ceil(timeline.duration * fps); frame += 1) {
    if (frame % 30 === 0) stopIfAborted();
    const time = frame / fps;
    const mouth = cycleFaceAt(timeline, time);
    const type = faceAt(time);
    const previous = mouths.at(-1);
    if (previous?.mouth === mouth && previous.type === type) previous.frames += 1;
    else mouths.push({ mouth, type, frames: 1 });
  }
  const pad = fps * 2;
  const headType = faceAt(0);
  if (mouths[0]?.mouth === 0 && mouths[0].type === headType) mouths[0].frames += pad;
  else mouths.unshift({ mouth: 0, type: headType, frames: pad });
  const tailType = faceAt(timeline.duration);
  const last = mouths.at(-1);
  if (last?.mouth === 0 && last.type === tailType) last.frames += pad;
  else mouths.push({ mouth: 0, type: tailType, frames: pad });
  const segments = applyEyeCycle(mouths, fps);
  const uniqueFaces = [...new Set(segments.map((segment) => segment.face))];
  const layers = new Map(uniqueFaces.map((face) => {
    const type = typeFromCompositeId(face);
    return [face, {
      mouth: faces[type][mouthFromCompositeId(face)] ?? '',
      eye: eyes[type][eyeStateFromCompositeId(face)] ?? '',
    }];
  }));
  const sources = [...new Set(
    [...layers.values()].flatMap((layer) => [layer.mouth, layer.eye]).filter(Boolean),
  )];
  const decoded = new Map<string, HTMLImageElement>();
  let width = 0;
  let height = 0;
  let loaded = 0;
  for (const url of sources) {
    stopIfAborted();
    const image = new Image();
    image.src = url;
    await image.decode();
    decoded.set(url, image);
    width = Math.max(width, image.naturalWidth);
    height = Math.max(height, image.naturalHeight);
    loaded += 1;
    report(1 + (loaded / sources.length) * 7);
  }
  if (!width || !height) throw new Error('errorNoImages');
  report(8);
  const output = frameSize(size, width, height);
  width = output.width;
  height = output.height;
  const duration = timeline.duration + 4;
  const manifest = JSON.stringify({ duration, width, height, segments });
  parseMovManifest(manifest);
  assertMovSequence(duration, segments);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb', willReadFrequently: true });
  if (!context) throw new Error('errorPrepareImages');
  context.imageSmoothingEnabled = false;
  const pngs: { face: number; bytes: Uint8Array; blob: Blob }[] = [];
  for (const [index, face] of uniqueFaces.entries()) {
    stopIfAborted();
    const layer = layers.get(face);
    const image = layer && decoded.get(layer.mouth);
    if (!image) throw new Error('errorMissingFrame');
    compositeFace(
      context,
      width,
      height,
      image,
      decoded.get(layer.eye),
      backgroundHex,
      blurPx,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((png) => {
        if (png) resolve(png);
        else reject(new Error('errorPrepareImages'));
      }, 'image/png');
    });
    pngs.push({ face, bytes: new Uint8Array(await blob.arrayBuffer()), blob });
    report(8 + ((index + 1) / uniqueFaces.length) * 7);
  }
  report(16);

  try {
    return await encodeMovBrowser(
      file,
      segments,
      pngs,
      (percent) => report(16 + percent * 0.84),
      signal,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (!(await localExportAvailable(signal))) throw error;
    return postLocalExport(file, locale, manifest, pngs, report, signal);
  }
}

async function postLocalExport(
  file: File,
  locale: Locale,
  manifest: string,
  pngs: { face: number; blob: Blob }[],
  report: (percent: number) => void,
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.set('audio', file);
  form.set('locale', locale);
  form.set('manifest', manifest);
  for (const png of pngs) {
    form.set(`face-${png.face}`, png.blob, `face-${png.face}.png`);
  }
  const poll = window.setInterval(() => {
    void fetch('/api/export-mov-progress', { signal }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { percent?: number };
      if (typeof data.percent === 'number') report(16 + data.percent * 0.84);
    }).catch(() => {});
  }, 250);
  try {
    const response = await fetch('/api/export-mov', {
      method: 'POST',
      body: form,
      signal,
      headers: { 'Accept-Language': locale },
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('video/mp4')) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || 'errorExportRestart');
    }
    const blob = await response.blob();
    report(100);
    return blob;
  } finally {
    window.clearInterval(poll);
  }
}
