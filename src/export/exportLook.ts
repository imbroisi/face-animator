export const DEFAULT_BACKGROUND_HEX = '090b0d';
export const DEFAULT_BLUR_PX = 2;

const BACKGROUND_KEY = 'export-background-hex';
const BLUR_KEY = 'export-blur-px';

export function normalizeBackgroundHex(value: string) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) return null;
  return match[1].toLowerCase();
}

export function cssBackgroundHex(value: string) {
  return `#${normalizeBackgroundHex(value) ?? DEFAULT_BACKGROUND_HEX}`;
}

export function readExportBackgroundHex() {
  try {
    const raw = localStorage.getItem(BACKGROUND_KEY);
    if (raw) return normalizeBackgroundHex(raw) ?? DEFAULT_BACKGROUND_HEX;
  } catch { /* ignore quota / private mode */ }
  return DEFAULT_BACKGROUND_HEX;
}

export function writeExportBackgroundHex(value: string) {
  const hex = normalizeBackgroundHex(value);
  if (!hex) return;
  try {
    localStorage.setItem(BACKGROUND_KEY, hex);
  } catch { /* ignore quota / private mode */ }
}

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
