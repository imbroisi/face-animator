export const DEFAULT_BLUR_PX = 2;

const BLUR_KEY = 'export-blur-px';

export function readExportBlurPx() {
  try {
    const raw = localStorage.getItem(BLUR_KEY);
    if (raw == null) return DEFAULT_BLUR_PX;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return value;
  } catch { /* ignore quota / private mode */ }
  return DEFAULT_BLUR_PX;
}

export function writeExportBlurPx(blurPx: number) {
  if (!Number.isFinite(blurPx) || blurPx < 0) return;
  try {
    localStorage.setItem(BLUR_KEY, String(blurPx));
  } catch { /* ignore quota / private mode */ }
}
