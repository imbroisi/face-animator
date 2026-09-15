// ================= CONFIGURAÇÃO EDITÁVEL =================
export const TRIGGER_OPENING = 30; // Percentual do pico para abrir.
export const TRIGGER_CLOSING = 30; // Fecha após 20 ms abaixo deste percentual do pico.
export const FADEOUT = 10; // ms para abrir.
export const LINEAR_FADEOUT = false;
export const OPENED_TIME = 100; // ms mantendo a abertura máxima.
export const FADEIN = 100; // ms para fechar.
export const LINEAR_FADEIN = true;
export const CLOSED_TIME = 1; // ms fechado antes de rearmar.
// ========================================================

export type MouthOptions = {
  triggerOpening: number;
  triggerClosing: number;
  fadeout: number;
  linearFadeout: boolean;
  openedTime: number;
  fadein: number;
  linearFadein: boolean;
  closedTime: number;
};
export type MouthTimeline = {
  starts: number[];
  closingStarts: number[];
  faceIndices: number[];
  duration: number;
  options: MouthOptions;
};

export function buildMouthCycles(
  mono: Float32Array,
  sampleRate: number,
  images: readonly string[],
  overrides: Partial<MouthOptions> = {},
): MouthTimeline {
  const options = {
    triggerOpening: TRIGGER_OPENING,
    triggerClosing: TRIGGER_CLOSING,
    fadeout: FADEOUT,
    linearFadeout: LINEAR_FADEOUT,
    openedTime: OPENED_TIME,
    fadein: FADEIN,
    linearFadein: LINEAR_FADEIN,
    closedTime: CLOSED_TIME,
    ...overrides,
  };
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('errorInvalidSampleRate');
  }
  for (const value of [options.triggerOpening, options.triggerClosing]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('errorInvalidTriggers');
    }
  }
  const durations = [options.fadeout, options.openedTime, options.fadein, options.closedTime];
  if (durations.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('errorInvalidTimes');
  }
  const cycleSeconds = durations.reduce((sum, value) => sum + value, 0) / 1000;
  if (cycleSeconds <= 0) throw new Error('errorInvalidCycle');
  const faceIndices = images.flatMap((url, index) => (url ? [index] : []));
  if (faceIndices[0] !== 0) throw new Error('errorMouthCloseRequired');
  const starts: number[] = [];
  const closingStarts: number[] = [];
  let peak = 0;
  for (const value of mono) peak = Math.max(peak, Math.abs(value));
  const openingThreshold = peak * options.triggerOpening / 100;
  const closingThreshold = peak * options.triggerClosing / 100;
  if (peak > 0 && faceIndices.length > 1) {
    for (let sample = 0; sample < mono.length;) {
      const amplitude = Math.abs(mono[sample]);
      if (amplitude > 0 && amplitude >= openingThreshold) {
        starts.push(sample / sampleRate);
        const start = sample;
        let closingSample = sample
          + Math.ceil((options.fadeout + options.openedTime) / 1000 * sampleRate);
        // Require 20 ms below the threshold; individual waveform zero crossings
        // must not close the mouth while speech is still present.
        const quietSamples = Math.max(1, Math.ceil(0.02 * sampleRate));
        let quiet = 0;
        while (closingSample < mono.length) {
          const value = Math.abs(mono[closingSample]);
          quiet = value > 0 && value >= closingThreshold ? 0 : quiet + 1;
          closingSample += 1;
          if (quiet >= quietSamples) break;
        }
        closingStarts.push(Math.min(closingSample, mono.length) / sampleRate);
        // Closing and closed phases remain insensitive to new triggers.
        sample = Math.max(
          start + 1,
          closingSample + Math.ceil((options.fadein + options.closedTime) / 1000 * sampleRate),
        );
      } else sample += 1;
    }
  }
  return { starts, closingStarts, faceIndices, duration: mono.length / sampleRate, options };
}

export function cycleFaceAt(timeline: MouthTimeline | null, time: number) {
  if (!timeline || !Number.isFinite(time) || time < 0 || time >= timeline.duration) return 0;
  const { starts, closingStarts, faceIndices, options } = timeline;
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (starts[middle] <= time) low = middle + 1;
    else high = middle - 1;
  }
  if (high < 0) return 0;
  const elapsed = (time - starts[high]) * 1000 + 1e-7;
  const topMouth = faceIndices.length - 1;
  if (elapsed < options.fadeout) {
    const fadeIndex = options.linearFadeout
      ? Math.floor(topMouth * elapsed / options.fadeout)
      : topMouth;
    return faceIndices[fadeIndex];
  }
  const closing = (time - closingStarts[high]) * 1000 + 1e-7;
  if (closing < 0) return faceIndices[topMouth];
  if (closing < options.fadein) {
    const fadeIndex = options.linearFadein
      ? Math.ceil(topMouth * (1 - closing / options.fadein))
      : 0;
    return faceIndices[fadeIndex];
  }
  return 0;
}
