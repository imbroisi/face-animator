import { Box } from '@mui/material';
import { useLocale } from '../../../i18n/LocaleProvider';

export function FacePreview({
  width,
  height,
  mouthSrc,
  eyeSrc,
}: {
  width: number;
  height: number;
  mouthSrc: string;
  eyeSrc: string | undefined;
}) {
  const { copy } = useLocale();
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <Box sx={{ position: 'relative', width, height, flexShrink: 0 }}>
        <Box
          component="img"
          src={mouthSrc}
          alt={copy.mouth}
          sx={{ display: 'block', width, height, objectFit: 'contain' }}
        />
        {eyeSrc && (
          <Box
            component="img"
            src={eyeSrc}
            alt=""
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              pointerEvents: 'none',
              objectFit: 'contain',
            }}
          />
        )}
      </Box>
    </Box>
  );
}
