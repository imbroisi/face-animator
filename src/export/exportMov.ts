import { cycleFaceAt } from '../audio/mouthCycles'
import type { MouthTimeline } from '../audio/mouthCycles'
import { applyEyeCycle, eyes, eyeStateFromCompositeId, mouthFromCompositeId, typeFromCompositeId } from '../faces/eyes'
import { faces, type FaceType } from '../faces/Faces'
import { frameSize, type MovOutputSize } from './movSize'

function isChromaYellow(r: number, g: number, b: number) {
  return r > 160 && g > 120 && b < 90 && r + g > 2.2 * (b + 8)
}

/** Keep transparent pixels in the key color so ProRes/YUV bleed stays keyable in Filmora. */
function holdChromaInTransparent(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height)
  const pixels = image.data
  let chromaR = 250
  let chromaG = 193
  let chromaB = 15
  let count = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 255 && isChromaYellow(pixels[i], pixels[i + 1], pixels[i + 2])) {
      sumR += pixels[i]
      sumG += pixels[i + 1]
      sumB += pixels[i + 2]
      count++
    }
  }
  if (count) {
    chromaR = Math.round(sumR / count)
    chromaG = Math.round(sumG / count)
    chromaB = Math.round(sumB / count)
  }
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (a === 0 || (a < 255 && isChromaYellow(r, g, b))) {
      pixels[i] = chromaR
      pixels[i + 1] = chromaG
      pixels[i + 2] = chromaB
      pixels[i + 3] = 0
    }
  }
  context.putImageData(image, 0, 0)
}

export async function exportMov(file: File, timeline: MouthTimeline, faceAt: (time: number) => FaceType, size: MovOutputSize, onProgress?: (percent: number) => void, signal?: AbortSignal) {
  const report = (percent: number) => {
    shown = Math.max(shown, Math.min(100, Math.round(percent)))
    onProgress?.(shown)
  }
  let shown = 0
  const stopIfAborted = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError') }
  report(1)
  const fps = 30
  const mouths: { mouth: number; type: FaceType; frames: number }[] = []
  for (let frame = 0; frame < Math.ceil(timeline.duration * fps); frame++) {
    if (frame % 30 === 0) stopIfAborted()
    const time = frame / fps
    const mouth = cycleFaceAt(timeline, time)
    const type = faceAt(time)
    const previous = mouths.at(-1)
    if (previous?.mouth === mouth && previous.type === type) previous.frames++
    else mouths.push({ mouth, type, frames: 1 })
  }
  const pad = fps * 2
  const headType = faceAt(0)
  if (mouths[0]?.mouth === 0 && mouths[0].type === headType) mouths[0].frames += pad
  else mouths.unshift({ mouth: 0, type: headType, frames: pad })
  const tailType = faceAt(timeline.duration)
  const last = mouths.at(-1)
  if (last?.mouth === 0 && last.type === tailType) last.frames += pad
  else mouths.push({ mouth: 0, type: tailType, frames: pad })
  const segments = applyEyeCycle(mouths, fps)
  const uniqueFaces = [...new Set(segments.map(segment => segment.face))]
  const layers = new Map(uniqueFaces.map(face => {
    const type = typeFromCompositeId(face)
    return [face, { mouth: faces[type][mouthFromCompositeId(face)] ?? '', eye: eyes[type][eyeStateFromCompositeId(face)] ?? '' }]
  }))
  const sources = [...new Set([...layers.values()].flatMap(layer => [layer.mouth, layer.eye]).filter(Boolean))]
  const decoded = new Map<string, HTMLImageElement>()
  let width = 0
  let height = 0
  let loaded = 0
  for (const url of sources) {
    stopIfAborted()
    const image = new Image()
    image.src = url
    await image.decode()
    decoded.set(url, image)
    width = Math.max(width, image.naturalWidth)
    height = Math.max(height, image.naturalHeight)
    loaded++
    report(1 + (loaded / sources.length) * 7)
  }
  if (!width || !height) throw new Error('Nenhuma imagem disponível para exportar.')
  report(8)
  // The sprite keeps its width and sits centered in a taller transparent frame.
  const output = frameSize(size, width, height)
  width = output.width
  height = output.height
  const form = new FormData()
  form.set('audio', file)
  form.set('manifest', JSON.stringify({ duration: timeline.duration + 4, width, height, segments }))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true })
  if (!context) throw new Error('Não foi possível preparar as imagens.')
  context.imageSmoothingEnabled = false
  for (const [index, face] of uniqueFaces.entries()) {
    stopIfAborted()
    const layer = layers.get(face)
    const image = layer && decoded.get(layer.mouth)
    if (!image) throw new Error('Imagem da animação não encontrada.')
    context.clearRect(0, 0, width, height)
    context.drawImage(image, Math.floor((width - image.naturalWidth) / 2), Math.floor((height - image.naturalHeight) / 2))
    const eyesImage = decoded.get(layer.eye)
    if (eyesImage) {
      context.drawImage(eyesImage, Math.floor((width - eyesImage.naturalWidth) / 2), Math.floor((height - eyesImage.naturalHeight) / 2))
    }
    holdChromaInTransparent(context, width, height)
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao preparar as imagens.')), 'image/png'))
    form.set(`face-${face}`, png, `face-${face}.png`)
    report(8 + ((index + 1) / uniqueFaces.length) * 7)
  }
  report(16)
  const poll = window.setInterval(() => {
    void fetch('/api/export-mov-progress', { signal }).then(async response => {
      if (!response.ok) return
      const data = await response.json() as { percent?: number }
      if (typeof data.percent === 'number') report(16 + data.percent * 0.84)
    }).catch(() => {})
  }, 250)
  try {
    const response = await fetch('/api/export-mov', { method: 'POST', body: form, signal })
    if (!response.ok || !response.headers.get('content-type')?.includes('video/quicktime')) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.error || 'Não foi possível exportar. Reinicie o servidor com npm run dev.')
    }
    const blob = await response.blob()
    report(100)
    return blob
  } finally {
    window.clearInterval(poll)
  }
}
