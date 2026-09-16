import { Box, ClickAwayListener, Popper, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';

const TAIL_HEIGHT = 12;
const DEFAULT_GAP = 5;

type BalloonPlacement = 'bottom' | 'bottom-start' | 'right-start' | 'left-start' | 'top' | 'top-start' | 'left';

export type BalloonAnchor = HTMLElement | {
  getBoundingClientRect: () => DOMRect;
  contextElement?: Element;
};

export function SpeechBalloon({
  open,
  anchorEl,
  children,
  placement = 'bottom-start',
  fallbackPlacements,
  gap = DEFAULT_GAP,
  disableClickAway = false,
  pointerEvents,
  onClose,
}: {
  open: boolean;
  anchorEl: BalloonAnchor | null;
  children: ReactNode;
  placement?: BalloonPlacement;
  fallbackPlacements?: BalloonPlacement[];
  gap?: number;
  disableClickAway?: boolean;
  pointerEvents?: 'none' | 'auto';
  onClose: () => void;
}) {
  const [arrow, setArrow] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const balloon = (
    <Box sx={{ pointerEvents }}>
      <Typography
        className="speech-balloon"
        variant="body1"
        sx={{
          position: 'relative',
          maxWidth: 320,
          px: 2,
          py: 1.75,
          whiteSpace: 'pre-line',
          bgcolor: '#fff',
          color: '#111',
          border: '1px solid #111',
          borderRadius: '18px',
          overflow: 'visible',
          filter: [
            'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.28))',
            'drop-shadow(0 16px 28px rgba(0, 0, 0, 0.34))',
          ].join(' '),
        }}
      >
        {children}
        <Box
          ref={setArrow}
          aria-hidden
          className="speech-balloon-tail"
          sx={{
            position: 'absolute',
            width: 16,
            height: TAIL_HEIGHT,
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              width: 0,
              height: 0,
            },
          }}
        />
      </Typography>
    </Box>
  );

  let content = balloon;
  if (!disableClickAway) {
    content = (
      <ClickAwayListener onClickAway={onClose}>
        {balloon}
      </ClickAwayListener>
    );
  }

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 2,
        pointerEvents: pointerEvents === 'none' ? 'none' : undefined,
        '&[data-popper-placement^="bottom"] .speech-balloon-tail': {
          top: -TAIL_HEIGHT,
          '&::before': {
            left: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: `${TAIL_HEIGHT}px solid #111`,
          },
          '&::after': {
            left: 1,
            top: 1,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: `${TAIL_HEIGHT - 1}px solid #fff`,
          },
        },
        '&[data-popper-placement^="top"] .speech-balloon-tail': {
          bottom: -TAIL_HEIGHT,
          '&::before': {
            left: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `${TAIL_HEIGHT}px solid #111`,
          },
          '&::after': {
            left: 1,
            bottom: 1,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `${TAIL_HEIGHT - 1}px solid #fff`,
          },
        },
        '&[data-popper-placement^="right"] .speech-balloon-tail': {
          left: -TAIL_HEIGHT,
          width: TAIL_HEIGHT,
          height: 16,
          '&::before': {
            top: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: `${TAIL_HEIGHT}px solid #111`,
          },
          '&::after': {
            top: 1,
            left: 1,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderRight: `${TAIL_HEIGHT - 1}px solid #fff`,
          },
        },
        '&[data-popper-placement^="left"] .speech-balloon-tail': {
          right: -TAIL_HEIGHT,
          width: TAIL_HEIGHT,
          height: 16,
          '&::before': {
            top: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: `${TAIL_HEIGHT}px solid #111`,
          },
          '&::after': {
            top: 1,
            right: 1,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderLeft: `${TAIL_HEIGHT - 1}px solid #fff`,
          },
        },
      }}
      modifiers={[
        {
          name: 'offset',
          options: { offset: [0, gap + TAIL_HEIGHT] },
        },
        {
          name: 'arrow',
          enabled: Boolean(arrow),
          options: { element: arrow, padding: 18 },
        },
        {
          name: 'flip',
          enabled: Boolean(fallbackPlacements?.length),
          options: {
            fallbackPlacements,
            padding: 12,
            boundary: 'viewport',
          },
        },
        {
          name: 'preventOverflow',
          options: {
            padding: 12,
            boundary: 'viewport',
            altAxis: true,
          },
        },
      ]}
    >
      {content}
    </Popper>
  );
}
