export function prepareAudio(channels: Float32Array[], sampleRate: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('Taxa de áudio inválida.')
  const length = channels[0]?.length ?? 0
  const peaks = new Float32Array(Math.min(length, 16384))
  const mono = new Float32Array(length)
  for (let sample = 0; sample < length; sample++) {
    let value = 0
    for (const channel of channels) value += channel[sample] / channels.length
    mono[sample] = Math.max(-1, Math.min(1, value))
    const bucket = Math.min(peaks.length - 1, Math.floor(sample * peaks.length / length))
    peaks[bucket] = Math.max(peaks[bucket], Math.abs(mono[sample]))
  }
  return { peaks, mono }
}
