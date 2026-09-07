// Approximate mapping: the current artwork varies opening, not lip shape.
export const VISEME_FACES = { A: 0, B: 1, C: 3, D: 5, E: 2, F: 1, X: 0 } as const
export type MouthCue = { start: number; end: number; value: keyof typeof VISEME_FACES }

export function faceAt(cues: MouthCue[], time: number) {
  let low = 0
  let high = cues.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const cue = cues[middle]
    if (time < cue.start) high = middle - 1
    else if (time >= cue.end) low = middle + 1
    else return VISEME_FACES[cue.value]
  }
  return 0
}

export async function analyzeVisemes(wav: ArrayBuffer, signal: AbortSignal): Promise<MouthCue[]> {
  const response = await fetch('/api/lip-sync', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Reinicie o servidor com npm run dev para habilitar a análise da fala.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Falha na análise da fala.')
  if (!Array.isArray(result.mouthCues)) throw new Error('Resposta inválida da análise da fala.')
  let previousEnd = 0
  for (const cue of result.mouthCues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previousEnd || cue.end <= cue.start || !Object.hasOwn(VISEME_FACES, cue.value)) {
      throw new Error('Sequência de visemas inválida.')
    }
    previousEnd = cue.end
  }
  return result.mouthCues
}
