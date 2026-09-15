import { Box } from '@mui/material';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import tennisBall from '../../../faces/bola-tenis.png';
import { FacePreview } from '../FacePreview';
import { PreviewSizePanel } from '../PreviewSizePanel';
import { TennisBall } from '../TennisBall';
import {
  BALL_GAP,
  BALL_KEY_DELTA,
  PREVIEW_SIZES,
  ballDiameter,
  readPreviewLayout,
  writePreviewLayout,
  type PreviewSize,
} from '../previewLayout';

export function PreviewStage({
  mouthSrc,
  eyeSrc,
}: {
  mouthSrc: string;
  eyeSrc: string | undefined;
}) {
  const [previewSize, setPreviewSize] = useState<PreviewSize>(
    () => readPreviewLayout()?.previewSize ?? 'large',
  );
  const [ballPos, setBallPos] = useState(() => readPreviewLayout()?.ball ?? { x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const sizePanelRef = useRef<HTMLDivElement>(null);
  const ballDrag = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const ballNode = useRef<HTMLImageElement>(null);
  const ballPlaced = useRef(readPreviewLayout() != null);
  const prevBallSize = useRef(ballDiameter(readPreviewLayout()?.previewSize ?? 'large'));
  const previewBox = PREVIEW_SIZES[previewSize];
  const ballSize = ballDiameter(previewSize);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    const panel = sizePanelRef.current;
    if (!ballPlaced.current) {
      if (!preview || !panel) return;
      const area = preview.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const x = box.right - area.left - ballSize;
      const y = box.top - area.top - BALL_GAP - ballSize;
      setBallPos({ x: Math.max(0, x), y: Math.max(0, y) });
      ballPlaced.current = true;
      prevBallSize.current = ballSize;
      return;
    }
    const previous = prevBallSize.current;
    if (previous === ballSize) return;
    const shift = (ballSize - previous) / 2;
    setBallPos((pos) => {
      const area = previewRef.current;
      const nextX = pos.x - shift;
      const nextY = pos.y - shift;
      if (!area) return { x: nextX, y: nextY };
      return {
        x: Math.max(0, Math.min(area.clientWidth - ballSize, nextX)),
        y: Math.max(0, Math.min(area.clientHeight - ballSize, nextY)),
      };
    });
    prevBallSize.current = ballSize;
  }, [ballSize]);

  useEffect(() => {
    if (!ballPlaced.current) return;
    writePreviewLayout(previewSize, ballPos);
  }, [previewSize, ballPos]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (
        target instanceof HTMLInputElement
        && target.type !== 'radio'
        && target.type !== 'checkbox'
        && target.type !== 'button'
      ) return;
      const delta = BALL_KEY_DELTA[event.key];
      if (!delta) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const preview = previewRef.current;
      if (!preview) return;
      setBallPos((pos) => ({
        x: Math.max(0, Math.min(preview.clientWidth - ballSize, pos.x + delta.x)),
        y: Math.max(0, Math.min(preview.clientHeight - ballSize, pos.y + delta.y)),
      }));
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [ballSize]);

  function endBallDrag(pointerId: number) {
    if (ballDrag.current?.pointer !== pointerId) return;
    ballDrag.current = null;
    const node = ballNode.current;
    if (node?.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
  }

  function handleBallPointerDown(event: PointerEvent<HTMLImageElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    ballDrag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: ballPos.x,
      top: ballPos.y,
    };
  }

  function handleBallPointerMove(event: PointerEvent<HTMLImageElement>) {
    const drag = ballDrag.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    if ((event.buttons & 1) === 0) {
      endBallDrag(event.pointerId);
      return;
    }
    const preview = previewRef.current;
    if (!preview) return;
    const nextX = drag.left + event.clientX - drag.x;
    const nextY = drag.top + event.clientY - drag.y;
    setBallPos({
      x: Math.max(0, Math.min(preview.clientWidth - ballSize, nextX)),
      y: Math.max(0, Math.min(preview.clientHeight - ballSize, nextY)),
    });
  }

  function handleBallPointerUp(event: PointerEvent<HTMLImageElement>) {
    endBallDrag(event.pointerId);
  }

  return (
    <Box
      ref={previewRef}
      sx={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', bgcolor: '#c0c0c0' }}
    >
      <TennisBall
        src={tennisBall}
        size={ballSize}
        x={ballPos.x}
        y={ballPos.y}
        ballRef={ballNode}
        onPointerDown={handleBallPointerDown}
        onPointerMove={handleBallPointerMove}
        onPointerUp={handleBallPointerUp}
      />
      <FacePreview
        width={previewBox.width}
        height={previewBox.height}
        mouthSrc={mouthSrc}
        eyeSrc={eyeSrc}
      />
      <PreviewSizePanel
        panelRef={sizePanelRef}
        value={previewSize}
        onChange={setPreviewSize}
      />
    </Box>
  );
}
