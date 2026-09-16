import { Box } from '@mui/material';
import type { DragEvent } from 'react';
import { FACE_TYPES, faces, type FaceType } from '../../../faces/Faces';
import { eyes } from '../../../faces/eyes';
import { useLocale } from '../../../i18n/LocaleProvider';
import { FaceThumb } from '../FaceThumb';

const PALETTE_FACES = FACE_TYPES.filter((type) => type !== 'normal');

export function FacePalette({
  enabled,
  onDragStart,
  onDragEnd,
  onFaceNode,
}: {
  enabled: boolean;
  onDragStart: (event: DragEvent, type: FaceType) => void;
  onDragEnd: () => void;
  onFaceNode?: (type: FaceType, node: HTMLElement | null) => void;
}) {
  const { copy } = useLocale();
  return (
    <Box
      component="aside"
      aria-label={copy.faceOptions}
      sx={{
        width: 89,
        flexShrink: 0,
        bgcolor: '#2a2a2a',
        px: '20px',
        py: 1.25,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {PALETTE_FACES.map((type) => (
        <Box
          key={type}
          ref={(node) => {
            onFaceNode?.(type, node instanceof HTMLElement ? node : null);
          }}
          draggable={enabled}
          onDragStart={(event) => onDragStart(event, type)}
          onDragEnd={onDragEnd}
          aria-label={copy.faceClosed(copy.faces[type])}
          sx={{
            width: '100%',
            aspectRatio: '1',
            flexShrink: 0,
            borderRadius: '12px',
            bgcolor: '#c0c0c0',
            overflow: 'hidden',
            cursor: 'default',
            position: 'relative',
            opacity: enabled ? 1 : 0.45,
          }}
        >
          <FaceThumb mouth={faces[type][0]} eye={eyes[type].open} />
        </Box>
      ))}
    </Box>
  );
}
