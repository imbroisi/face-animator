// ================= CONFIGURAÇÃO EDITÁVEL =================
export const EYE_OPEN_TIME = 8 // segundos com eye-open.
export const EYE_OPEN_TIME_SHORT = 0.2 // segundos com eye-open.
export const EYE_OPEN_TIME_SHORT_PERCENT = 0.25 // percent com eye-open.
export const EYE_CLOSE_TIME = 0.15 // segundos com eye-close.
// ========================================================

export type EyeState = 'open' | 'close'

const TYPES = ['normal'] as const
type FaceType = (typeof TYPES)[number]

const eyeImages = import.meta.glob<string>('./**/eye-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const eyes = Object.fromEntries(
  TYPES.map((type) => [type, {
    open: eyeImages[`./${type}/eye-open.png`] ?? '',
    close: eyeImages[`./${type}/eye-close.png`] ?? '',
  }]),
) as Record<FaceType, Record<EyeState, string>>

const cycles: { start: number; open: number }[] = []

function nextOpenDuration(cycleIndex: number) {
  if (cycleIndex === 0) return EYE_OPEN_TIME
  if (cycles[cycleIndex - 1]?.open === EYE_OPEN_TIME_SHORT) return EYE_OPEN_TIME
  return Math.random() < EYE_OPEN_TIME_SHORT_PERCENT ? EYE_OPEN_TIME_SHORT : EYE_OPEN_TIME
}

function ensureCycles(time: number) {
  if (cycles.length === 0) cycles.push({ start: 0, open: nextOpenDuration(0) })
  while (true) {
    const last = cycles[cycles.length - 1]
    const period = last.open + EYE_CLOSE_TIME
    if (period <= 0) break
    const end = last.start + period
    if (time < end) break
    cycles.push({ start: end, open: nextOpenDuration(cycles.length) })
  }
}

export function cycleEyeAt(time: number): EyeState {
  if (!Number.isFinite(time) || time < 0) return 'open'
  ensureCycles(time)
  let lo = 0
  let hi = cycles.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (cycles[mid].start <= time) lo = mid
    else hi = mid - 1
  }
  return time - cycles[lo].start < cycles[lo].open ? 'open' : 'close'
}

export function eyeUrl(type: FaceType, time: number) {
  return eyes[type][cycleEyeAt(time)]
}

export function eyeCompositeId(mouth: number, eye: EyeState) {
  return mouth * 2 + (eye === 'close' ? 1 : 0)
}

export function mouthFromCompositeId(id: number) {
  return Math.floor(id / 2)
}

export function eyeStateFromCompositeId(id: number): EyeState {
  return id % 2 === 1 ? 'close' : 'open'
}

export function applyEyeCycle(segments: { face: number; frames: number }[], fps: number) {
  const out: { face: number; frames: number }[] = []
  let frame = 0
  for (const segment of segments) {
    for (let i = 0; i < segment.frames; i++) {
      const face = eyeCompositeId(segment.face, cycleEyeAt(frame / fps))
      const previous = out.at(-1)
      if (previous?.face === face) previous.frames++
      else out.push({ face, frames: 1 })
      frame++
    }
  }
  return out
}
