const TYPES = ['normal', 'upset', 'sad'] as const;

export type FaceType = (typeof TYPES)[number];
export const FACE_TYPES = TYPES;

export function isFaceType(value: string): value is FaceType {
  return (TYPES as readonly string[]).includes(value);
}

const MOUTHS = ['mouth-close.png', 'mouth-semi.png', 'mouth-open.png'] as const;

export const MOUTH_SLOTS = MOUTHS.length;

const mouthImages = import.meta.glob<string>('../**/mouth-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const faceNames = Object.fromEntries(
  TYPES.map((type) => [type, [] as string[]]),
) as Record<FaceType, string[]>;

export const faces = Object.fromEntries(
  TYPES.map((type) => {
    const collection: string[] = [];
    const prefix = `../${type}/`;

    for (const name of MOUTHS) {
      const url = mouthImages[`${prefix}${name}`];
      if (!url) continue;
      collection.push(url);
      faceNames[type].push(name);
    }

    return [type, collection];
  }),
) as Record<FaceType, string[]>;
