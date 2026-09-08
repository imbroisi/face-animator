import { cycleFaceAt } from '../audio/mouthCycles'
import type { MouthTimeline } from '../audio/mouthCycles'
import { applyEyeCycle, eyeStateFromCompositeId, mouthFromCompositeId, type EyeState } from '../faces/eyes'

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

export async function exportMov(file: File, timeline: MouthTimeline, images: readonly string[], eyeUrls: Record<EyeState, string>) {
  const fps = 30
  const mouths: { face: number; frames: number }[] = []
  for (let frame = 0; frame < Math.ceil(timeline.duration * fps); frame++) {
    const face = cycleFaceAt(timeline, frame / fps)
    const previous = mouths.at(-1)
    if (previous?.face === face) previous.frames++
    else mouths.push({ face, frames: 1 })
  }
  const pad = fps * 2
  if (mouths[0]?.face === 0) mouths[0].frames += pad
  else mouths.unshift({ face: 0, frames: pad })
  const last = mouths.at(-1)
  if (last?.face === 0) last.frames += pad
  else mouths.push({ face: 0, frames: pad })
  const segments = applyEyeCycle(mouths, fps)
  const decoded = new Map<number, HTMLImageElement>()
  let width = 0
  let height = 0
  for (const [face, url] of images.entries()) {
    if (!url) continue
    const image = new Image()
    image.src = url
    await image.decode()
    decoded.set(face, image)
    width = Math.max(width, image.naturalWidth)
    height = Math.max(height, image.naturalHeight)
  }
  if (!width || !height) throw new Error('Nenhuma imagem disponível para exportar.')
  const decodedEyes = new Map<EyeState, HTMLImageElement>()
  for (const state of ['open', 'close'] as const) {
    const url = eyeUrls[state]
    if (!url) continue
    const image = new Image()
    image.src = url
    await image.decode()
    decodedEyes.set(state, image)
    width = Math.max(width, image.naturalWidth)
    height = Math.max(height, image.naturalHeight)
  }
  const form = new FormData()
  form.set('audio', file)
  form.set('manifest', JSON.stringify({ duration: timeline.duration + 4, width, height, segments }))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true })
  if (!context) throw new Error('Não foi possível preparar as imagens.')
  context.imageSmoothingEnabled = false
  for (const face of new Set(segments.map(segment => segment.face))) {
    const image = decoded.get(mouthFromCompositeId(face))
    if (!image) throw new Error('Imagem da animação não encontrada.')
    context.clearRect(0, 0, width, height)
    // Copy pixels 1:1. Smaller images are centered on transparent padding.
    context.drawImage(image, Math.floor((width - image.naturalWidth) / 2), Math.floor((height - image.naturalHeight) / 2))
    const eyesImage = decodedEyes.get(eyeStateFromCompositeId(face))
    if (eyesImage) {
      context.drawImage(eyesImage, Math.floor((width - eyesImage.naturalWidth) / 2), Math.floor((height - eyesImage.naturalHeight) / 2))
    }
    holdChromaInTransparent(context, width, height)
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao preparar as imagens.')), 'image/png'))
    form.set(`face-${face}`, png, `face-${face}.png`)
  }
  const response = await fetch('/api/export-mov', { method: 'POST', body: form })
  if (!response.ok || !response.headers.get('content-type')?.includes('video/quicktime')) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error || 'Não foi possível exportar. Reinicie o servidor com npm run dev.')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${file.name.replace(/\.[^.]+$/, '')}.mov`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
