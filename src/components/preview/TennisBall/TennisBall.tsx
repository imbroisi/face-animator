import { Box } from '@mui/material';
import type { PointerEvent, Ref } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';

export function TennisBall({
  src,
  size,
  x,
  y,
  ballRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  src: string;
  size: number;
  x: number;
  y: number;
  ballRef: Ref<HTMLImageElement>;
  onPointerDown: (event: PointerEvent<HTMLImageElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLImageElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLImageElement>) => void;
}) {
  const { copy } = useLocale();
  return (
    <Box
      ref={ballRef}
      component="img"
      src={src}
      alt=""
      draggable={false}
      aria-label={copy.ball}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      sx={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        objectFit: 'contain',
        zIndex: 1,
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        '&:active': { cursor: 'grabbing' },
      }}
    />
  );
}
