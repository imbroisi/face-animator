export const SPEECH_MARK_STEP = 0.5;

const LABEL_STEPS = [1, 2, 5, 10, 15, 30, 60];

export function speechMarkTimes(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const times: number[] = [];
  const steps = Math.floor(duration / SPEECH_MARK_STEP + 1e-9);
  for (let i = 0; i <= steps; i++) {
    times.push(i * SPEECH_MARK_STEP);
  }
  return times;
}

export function isWholeSecond(time: number) {
  return Math.abs(time - Math.round(time)) < 1e-6;
}

export function formatSpeechSecond(time: number) {
  const seconds = Math.round(time);
  if (seconds < 60) return String(seconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function speechLabelStep(duration: number, width: number, labelWidth: number) {
  const pxPerSecond = width / duration;
  const minPx = labelWidth + 8;
  for (const step of LABEL_STEPS) {
    if (step * pxPerSecond >= minPx) return step;
  }
  return LABEL_STEPS[LABEL_STEPS.length - 1];
}
