export const PREVIEW_SIZES = {
  large: { width: 108, height: 150 },
  small: { width: 65, height: 90 },
} as const;

export type PreviewSize = keyof typeof PREVIEW_SIZES;

const BALL_LARGE = 200;
export const BALL_GAP = 100;
const PREVIEW_LAYOUT_KEY = 'preview-layout';

export const BALL_KEY_DELTA: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export function isPreviewSize(value: unknown): value is PreviewSize {
  return value === 'large' || value === 'small';
}

function migratePreviewSize(value: unknown): PreviewSize | null {
  if (isPreviewSize(value)) return value;
  if (value === 'grande') return 'large';
  if (value === 'pequeno') return 'small';
  return null;
}

export function ballDiameter(size: PreviewSize) {
  return Math.round(BALL_LARGE * PREVIEW_SIZES[size].height / PREVIEW_SIZES.large.height);
}

export function readPreviewLayout(): {
  previewSize: PreviewSize;
  ball: { x: number; y: number };
} | null {
  try {
    const raw = localStorage.getItem(PREVIEW_LAYOUT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { previewSize?: unknown; ball?: { x?: unknown; y?: unknown } };
    const previewSize = migratePreviewSize(data.previewSize);
    if (!previewSize) return null;
    const x = data.ball?.x;
    const y = data.ball?.y;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { previewSize, ball: { x, y } };
  } catch {
    return null;
  }
}

export function writePreviewLayout(previewSize: PreviewSize, ball: { x: number; y: number }) {
  try {
    localStorage.setItem(PREVIEW_LAYOUT_KEY, JSON.stringify({ previewSize, ball }));
  } catch { /* ignore quota / private mode */ }
}
