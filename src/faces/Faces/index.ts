const TYPES = ['normal'] as const;

type FaceType = (typeof TYPES)[number];

const images = import.meta.glob<string>('../*/face-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const faces = Object.fromEntries(
  TYPES.map((type) => {
    const collection: string[] = [];
    const prefix = `../${type}/`;

    for (const [path, url] of Object.entries(images)) {
      if (!path.startsWith(prefix)) continue;
      const match = /^face-(\d+)\.png$/.exec(path.slice(prefix.length));
      if (match) collection[Number(match[1])] = url;
    }

    return [type, collection];
  }),
) as Record<FaceType, string[]>;
