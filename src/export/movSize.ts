export const MOV_OUTPUT_SIZES = ['4k', '1080p', 'native'] as const;
export type MovOutputSize = (typeof MOV_OUTPUT_SIZES)[number];

const HEIGHTS: Record<Exclude<MovOutputSize, 'native'>, number> = {
  '4k': 2160,
  '1080p': 1080,
};

const STORAGE_KEY = 'mov-output-size';

export function isMovOutputSize(value: string): value is MovOutputSize {
  return (MOV_OUTPUT_SIZES as readonly string[]).includes(value);
}

export function readMovOutputSize(): MovOutputSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && isMovOutputSize(value)) return value;
  } catch { /* ignore quota / private mode */ }
  return '4k';
}

export function writeMovOutputSize(size: MovOutputSize) {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch { /* ignore quota / private mode */ }
}

function toEven(value: number) {
  const rounded = Math.floor(value);
  if (rounded < 2) return 2;
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/** Keeps the sprite width; only the frame height grows to the chosen resolution. */
export function frameSize(size: MovOutputSize, spriteWidth: number, spriteHeight: number) {
  const width = toEven(spriteWidth);
  if (size === 'native') return { width, height: toEven(spriteHeight) };
  const height = HEIGHTS[size];
  if (spriteHeight > height) throw new Error('errorFaceTooTall');
  return { width, height };
}
