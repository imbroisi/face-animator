import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Alert, Box, Divider, IconButton, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { cycleFaceAt } from '../../../audio/mouthCycles';
import { faces, type FaceType } from '../../../faces/Faces';
import { eyes } from '../../../faces/eyes';
import { useLocale } from '../../../i18n/LocaleProvider';
import { FaceThumb } from '../../faces/FaceThumb';
import { TimeDisplay } from '../TimeDisplay';
import { TimeRuler, RULER_HEIGHT } from '../TimeRuler';
import { Waveform } from '../Waveform';
import {
  clampDropStart,
  dropBlocked,
  rectsOverlap,
} from '../dropGeometry';
import type { FaceDrop, PaletteDrag, Track } from '../timelineTypes';

const PLAYHEAD = '#29a7ff';
const PLAYHEAD_HANDLE = 22;
const PLAYHEAD_TO_LABELS = 6;
const EMPTY_RULER_SECONDS = 10;
const PIN_LANE = 46;
const EDGE_HIT = 2;
const EDGE_OUTSIDE = 3;
const MOVE_THRESHOLD = 6;
const SELECT_ORANGE = '#ffd56a';
const CURSOR_LEFT = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" stroke="#111" stroke-linejoin="round" stroke-width="1.5" d="M14.5 3.5 3.5 12l11 8.5v-6h7v-5h-7z"/></svg>')}") 4 12, w-resize`;
const CURSOR_RIGHT = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" stroke="#111" stroke-linejoin="round" stroke-width="1.5" d="M9.5 3.5 20.5 12l-11 8.5v-6h-7v-5h7z"/></svg>')}") 20 12, e-resize`;

export type AudioPlayerProps = {
  track: Track | null;
  drops: readonly FaceDrop[];
  paletteDrag: PaletteDrag | null;
  onRemove: () => void;
  onLevelChange: (level: number) => void;
  onTimeChange: (time: number) => void;
  onDropFace: (time: number, face: FaceType) => void;
  onRemoveDrop: (id: number) => void;
  onMoveDrop: (id: number, start: number) => void;
  onResizeDrop: (id: number, edge: 'start' | 'end', time: number) => void;
  onPlayButton?: (el: HTMLElement | null) => void;
  onSpeechArea?: (el: HTMLElement | null) => void;
  onPlaybackEnded?: () => void;
};

const EMPTY_TRACK = {
  file: null, name: '', duration: 0, peaks: new Float32Array(0),
  mouthTimeline: null,
};

export function AudioPlayer({
  track: loadedTrack,
  drops,
  paletteDrag,
  onRemove,
  onLevelChange,
  onTimeChange,
  onDropFace,
  onRemoveDrop,
  onMoveDrop,
  onResizeDrop,
  onPlayButton,
  onSpeechArea,
  onPlaybackEnded,
}: AudioPlayerProps) {
  const { copy } = useLocale();
  const track = loadedTrack ?? EMPTY_TRACK;
  const audioRef = useRef<HTMLAudioElement>(null);
  const playButton = useRef<HTMLDivElement>(null);
  const stopped = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(track.duration);
  const [playError, setPlayError] = useState(false);

  useLayoutEffect(() => {
    onPlayButton?.(loadedTrack ? playButton.current : null);
    return () => onPlayButton?.(null);
  }, [loadedTrack, onPlayButton]);

  useEffect(() => {
    const audio = audioRef.current!;
    if (!track.file) return;
    const url = URL.createObjectURL(track.file);
    audio.src = url;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    };
  }, [track.file]);

  const syncPosition = useCallback((time: number) => {
    setPosition(time);
    onTimeChange(time);
    const level = stopped.current || time >= track.duration
      ? 0
      : cycleFaceAt(track.mouthTimeline, time);
    onLevelChange(level);
  }, [track, onLevelChange, onTimeChange]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const update = () => {
      syncPosition(audioRef.current?.currentTime ?? 0);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [playing, syncPosition]);

  async function togglePlayback() {
    const audio = audioRef.current!;
    setPlayError(false);
    if (!audio.paused) {
      audio.pause();
      return;
    }
    stopped.current = false;
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      setPlayError(true);
    }
  }

  function stopPlayback() {
    stopped.current = true;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    syncPosition(0);
  }

  const total = duration && Number.isFinite(duration) ? duration : track.duration;
  const progress = total > 0 ? Math.min(1, position / total) : 0;
  const rulerDuration = loadedTrack && total > 0 ? total : EMPTY_RULER_SECONDS;

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(total, value));
    stopped.current = false;
    audio.currentTime = next;
    syncPosition(next);
  }

  function stepFrame(delta: number) {
    const audio = audioRef.current;
    if (!audio || !loadedTrack) return;
    if (!audio.paused) audio.pause();
    const fps = 30;
    const frame = Math.round((audio.currentTime || position) * fps);
    const last = Math.max(0, Math.round(total * fps));
    seekTo(Math.max(0, Math.min(last, frame + delta)) / fps);
  }

  const waveRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    onSpeechArea?.(loadedTrack ? waveRef.current : null);
    return () => onSpeechArea?.(null);
  }, [loadedTrack, onSpeechArea]);
  const [pinDraggingId, setPinDraggingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pinDrag = useRef<{
    id: number;
    origin: number;
    grab: number;
    startX: number;
    startY: number;
  } | null>(null);
  const edgeDrag = useRef<{ id: number; edge: 'start' | 'end'; startX: number; startY: number } | null>(null);
  const moved = useRef(false);
  const pressingArea = useRef(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const scrubbing = useRef(false);

  function timeFromClientX(clientX: number) {
    const box = waveRef.current?.getBoundingClientRect();
    if (!box || !box.width || total <= 0) return null;
    return Math.max(0, Math.min(total, (clientX - box.left) / box.width * total));
  }

  useEffect(() => {
    if (!paletteDrag || !loadedTrack) return;
    const { hotX, hotY, width, height, face: dragFace } = paletteDrag;

    function touchesWave(clientX: number, clientY: number) {
      const wave = waveRef.current?.getBoundingClientRect();
      if (!wave) return false;
      return rectsOverlap(wave, clientX - hotX, clientY - hotY, width, height);
    }

    function dropTimeAt(clientX: number, clientY: number) {
      if (!touchesWave(clientX, clientY)) return null;
      const box = waveRef.current?.getBoundingClientRect();
      if (!box || !box.width || total <= 0) return null;
      const time = Math.max(0, Math.min(total, (clientX - box.left) / box.width * total));
      if (dropBlocked(time, total, drops)) return null;
      return time;
    }

    function handleDragOver(event: globalThis.DragEvent) {
      if (!touchesWave(event.clientX, event.clientY)) return;
      event.preventDefault();
      const transfer = event.dataTransfer;
      if (transfer) {
        transfer.dropEffect = dropTimeAt(event.clientX, event.clientY) === null ? 'none' : 'copy';
      }
    }

    function handleDrop(event: globalThis.DragEvent) {
      if (!touchesWave(event.clientX, event.clientY)) return;
      event.preventDefault();
      const time = dropTimeAt(event.clientX, event.clientY);
      if (time !== null) onDropFace(time, dragFace);
    }

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragenter', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragenter', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [paletteDrag, loadedTrack, drops, total, onDropFace]);

  function beginPress(event: PointerEvent<HTMLElement>) {
    moved.current = false;
    pressingArea.current = true;
    pressStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePlayheadPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !loadedTrack || paletteDrag) return;
    event.preventDefault();
    event.stopPropagation();
    scrubbing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const time = timeFromClientX(event.clientX);
    if (time !== null) seekTo(time);
  }

  function handlePlayheadPointerMove(event: PointerEvent<HTMLElement>) {
    if (!scrubbing.current || event.buttons !== 1) {
      if (event.buttons !== 1) scrubbing.current = false;
      return;
    }
    const time = timeFromClientX(event.clientX);
    if (time !== null) seekTo(time);
  }

  function handlePlayheadPointerUp(event: PointerEvent<HTMLElement>) {
    scrubbing.current = false;
    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  function handleWavePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !loadedTrack || paletteDrag) return;
    if (event.target instanceof Element && event.target.closest('[data-drop-pin]')) return;
    event.preventDefault();
    beginPress(event);
  }

  function handlePinPointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop) {
    if (event.button !== 0 || paletteDrag) return;
    event.preventDefault();
    event.stopPropagation();
    beginPress(event);
    setSelectedId(drop.id);
    const time = timeFromClientX(event.clientX) ?? drop.start;
    pinDrag.current = {
      id: drop.id,
      origin: drop.start,
      grab: time - drop.start,
      startX: event.clientX,
      startY: event.clientY,
    };
    setPinDraggingId(drop.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleAreaPointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop) {
    if (event.button !== 0 || paletteDrag) return;
    event.preventDefault();
    event.stopPropagation();
    beginPress(event);
    setSelectedId(null);
    const time = timeFromClientX(event.clientX) ?? drop.start;
    pinDrag.current = {
      id: drop.id,
      origin: drop.start,
      grab: time - drop.start,
      startX: event.clientX,
      startY: event.clientY,
    };
    setPinDraggingId(drop.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePinPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.buttons !== 1 || edgeDrag.current) return;
    const drag = pinDrag.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!moved.current && distance < MOVE_THRESHOLD) return;
    moved.current = true;
    const time = timeFromClientX(event.clientX);
    if (time === null) return;
    onMoveDrop(drag.id, clampDropStart(time - drag.grab, total, drops, drag.id, drag.origin));
  }

  function handlePinPointerUp(event: PointerEvent<HTMLElement>) {
    const target = event.currentTarget;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  function handleEdgePointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop, edge: 'start' | 'end') {
    if (event.button !== 0 || paletteDrag) return;
    event.preventDefault();
    event.stopPropagation();
    beginPress(event);
    setSelectedId(null);
    pinDrag.current = null;
    edgeDrag.current = { id: drop.id, edge, startX: event.clientX, startY: event.clientY };
    setPinDraggingId(drop.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleEdgePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.buttons !== 1) return;
    const drag = edgeDrag.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!moved.current && distance < MOVE_THRESHOLD) return;
    moved.current = true;
    const time = timeFromClientX(event.clientX);
    if (time === null) return;
    onResizeDrop(drag.id, drag.edge, time);
  }

  function handlePinDoubleClick(id: number) {
    if (selectedId === id) setSelectedId(null);
    onRemoveDrop(id);
  }

  useEffect(() => {
    function onPointerMove(event: globalThis.PointerEvent) {
      const start = pressStart.current;
      if (!pressingArea.current || moved.current || !start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) >= MOVE_THRESHOLD) moved.current = true;
    }

    function onPointerUp(event: globalThis.PointerEvent) {
      if (event.button !== 0 || !pressingArea.current) return;
      pressingArea.current = false;
      pressStart.current = null;
      if (!moved.current) {
        const box = waveRef.current?.getBoundingClientRect();
        const audio = audioRef.current;
        if (box && box.width && total > 0 && audio) {
          const time = Math.max(0, Math.min(total, (event.clientX - box.left) / box.width * total));
          stopped.current = false;
          audio.currentTime = time;
          syncPosition(time);
        }
      }
      moved.current = false;
      pinDrag.current = null;
      edgeDrag.current = null;
      setPinDraggingId(null);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [total, syncPosition]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-drop-pin]')) return;
      setSelectedId(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    const id = selectedId;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.closest('.MuiDialog-root') || target.isContentEditable || target.tagName === 'TEXTAREA') return;
        if (target instanceof HTMLInputElement && target.type !== 'range') return;
      }
      event.preventDefault();
      onRemoveDrop(id);
      setSelectedId(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onRemoveDrop]);

  return (
    <>
      <audio
        ref={audioRef}
        preload="auto"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          const audio = audioRef.current;
          if (audio) audio.currentTime = 0;
          setPlaying(false);
          syncPosition(0);
          onPlaybackEnded?.();
        }}
        onTimeUpdate={(event) => syncPosition(event.currentTarget.currentTime)}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.75 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
          <Typography
            component="span"
            variant="body2"
            sx={{ fontSize: '1.3125rem' }}
            aria-label={copy.currentTime}
          >
            <TimeDisplay seconds={position} />
          </Typography>
          <Typography
            component="span"
            variant="body2"
            sx={{ fontSize: '1.3125rem', color: '#909090' }}
            aria-label={copy.totalTime}
          >
            <TimeDisplay seconds={total} />
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title={copy.stepBack}>
            <span>
              <IconButton
                disabled={!loadedTrack}
                onClick={() => stepFrame(-1)}
                aria-label={copy.stepBack}
              >
                <SvgIcon><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></SvgIcon>
              </IconButton>
            </span>
          </Tooltip>
          <Box ref={playButton} sx={{ display: 'inline-flex' }}>
            <IconButton
              disabled={!loadedTrack}
              onClick={() => void togglePlayback()}
              aria-label={playing ? copy.pauseAudio : copy.playAudio}
            >
              <SvgIcon>{playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</SvgIcon>
            </IconButton>
          </Box>
          <Tooltip title={copy.stepForward}>
            <span>
              <IconButton
                disabled={!loadedTrack}
                onClick={() => stepFrame(1)}
                aria-label={copy.stepForward}
              >
                <SvgIcon><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></SvgIcon>
              </IconButton>
            </span>
          </Tooltip>
          <IconButton disabled={!loadedTrack} onClick={stopPlayback} aria-label={copy.stopAudio}>
            <SvgIcon><path d="M6 6h12v12H6z" /></SvgIcon>
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title={copy.removeAudio}>
            <IconButton aria-label={copy.removeAudio} onClick={onRemove} disabled={!loadedTrack}>
              <SvgIcon><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3-9h2v8H9v-8zm4 0h2v8h-2v-8zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" /></SvgIcon>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Divider sx={{ mx: '12px', borderColor: 'rgba(255,255,255,0.12)' }} />
      <Box sx={{ position: 'relative', mx: '12px', mt: '12px' }}>
        <Box
          onPointerDown={handleWavePointerDown}
          onPointerUp={handlePlayheadPointerUp}
          onPointerCancel={handlePlayheadPointerUp}
          sx={{
            position: 'absolute', left: 0, right: 0,
            top: 0,
            height: `${PIN_LANE + PLAYHEAD_HANDLE + PLAYHEAD_TO_LABELS + RULER_HEIGHT}px`,
            zIndex: 0, pointerEvents: paletteDrag ? 'none' : 'auto', touchAction: 'none',
          }}
        />
        <Box sx={{ height: PIN_LANE, position: 'relative', pointerEvents: 'none' }}>
          {loadedTrack && total > 0 && drops.map((drop) => (
            <Box
              key={drop.id}
              data-drop-pin=""
              aria-selected={selectedId === drop.id}
              onPointerDown={(event) => handlePinPointerDown(event, drop)}
              onPointerMove={handlePinPointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              onDoubleClick={() => handlePinDoubleClick(drop.id)}
              sx={{
                position: 'absolute', left: `${drop.start / total * 100}%`, bottom: 0, transform: 'translateX(-50%)', width: 40,
                display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: selectedId === drop.id || pinDraggingId === drop.id ? 3 : 2,
                pointerEvents: paletteDrag ? 'none' : 'auto', cursor: 'default',
                touchAction: 'none', userSelect: 'none',
              }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: '6px', boxShadow: selectedId === drop.id ? `0 0 0 2px ${SELECT_ORANGE}` : 'none' }}>
                <Box sx={{ width: '100%', height: '100%', borderRadius: '6px', bgcolor: '#909090', overflow: 'hidden' }}>
                  <FaceThumb mouth={faces[drop.face][0]} eye={eyes[drop.face].open} />
                </Box>
              </Box>
              <Box aria-hidden="true" sx={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #909090' }} />
            </Box>
          ))}
        </Box>
        <Box sx={{ height: PLAYHEAD_HANDLE, position: 'relative', pointerEvents: 'none' }} />
        <Box
          onPointerDown={handleWavePointerDown}
          onPointerMove={handlePlayheadPointerMove}
          onPointerUp={handlePlayheadPointerUp}
          onPointerCancel={handlePlayheadPointerUp}
          onLostPointerCapture={handlePlayheadPointerUp}
          sx={{ pt: `${PLAYHEAD_TO_LABELS}px`, touchAction: 'none' }}
        >
          <TimeRuler duration={rulerDuration} />
        </Box>
        <Box
          ref={waveRef}
          onPointerDown={handleWavePointerDown}
          onPointerMove={handlePlayheadPointerMove}
          onPointerUp={handlePlayheadPointerUp}
          onPointerCancel={handlePlayheadPointerUp}
          onLostPointerCapture={handlePlayheadPointerUp}
          sx={{ position: 'relative', overflow: 'hidden' }}
        >
          <Waveform peaks={track.peaks} duration={total} highlights={drops} />
          {loadedTrack && total > 0 && drops.map((drop) => (
            <Box
              key={`area-${drop.id}`}
              onPointerDown={(event) => handleAreaPointerDown(event, drop)}
              onPointerMove={handlePinPointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              sx={{
                position: 'absolute', top: 0, bottom: 0, left: `${drop.start / total * 100}%`,
                width: `${(drop.end - drop.start) / total * 100}%`,
                zIndex: 1, cursor: 'default',
                pointerEvents: paletteDrag ? 'none' : 'auto', touchAction: 'none', userSelect: 'none',
              }}
            />
          ))}
          {loadedTrack && total > 0 && drops.flatMap((drop) => ([
            <Box
              key={`edge-start-${drop.id}`}
              onPointerDown={(event) => handleEdgePointerDown(event, drop, 'start')}
              onPointerMove={handleEdgePointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              sx={{
                position: 'absolute', top: 0, bottom: 0,
                left: `calc(${drop.start / total * 100}% - ${EDGE_OUTSIDE}px)`,
                width: `${EDGE_HIT + EDGE_OUTSIDE}px`, cursor: CURSOR_LEFT, zIndex: 3,
                pointerEvents: paletteDrag ? 'none' : 'auto', touchAction: 'none',
              }}
            />,
            <Box
              key={`edge-end-${drop.id}`}
              onPointerDown={(event) => handleEdgePointerDown(event, drop, 'end')}
              onPointerMove={handleEdgePointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              sx={{
                position: 'absolute', top: 0, bottom: 0,
                left: `calc(${drop.end / total * 100}% - ${EDGE_HIT}px)`,
                width: `${EDGE_HIT + EDGE_OUTSIDE}px`, cursor: CURSOR_RIGHT, zIndex: 3,
                pointerEvents: paletteDrag ? 'none' : 'auto', touchAction: 'none',
              }}
            />,
          ]))}
        </Box>
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
          <Box aria-hidden="true" sx={{ position: 'absolute', top: PIN_LANE + PLAYHEAD_HANDLE, bottom: 0, left: `clamp(0px, ${progress * 100}%, calc(100% - 2px))`, width: '2px', bgcolor: PLAYHEAD }} />
          <Box
            role="slider"
            aria-label={copy.playhead}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.min(position, total)}
            aria-valuetext={copy.playheadValue(position, total)}
            tabIndex={loadedTrack ? 0 : -1}
            onPointerDown={handlePlayheadPointerDown}
            onPointerMove={handlePlayheadPointerMove}
            onPointerUp={handlePlayheadPointerUp}
            onPointerCancel={handlePlayheadPointerUp}
            sx={{
              position: 'absolute', top: PIN_LANE, left: `clamp(0px, ${progress * 100}%, calc(100% - 2px))`,
              width: 16, height: PLAYHEAD_HANDLE, ml: '-7px', bgcolor: PLAYHEAD,
              clipPath: 'polygon(0 0, 100% 0, 100% 52%, 50% 100%, 0 52%)',
              pointerEvents: loadedTrack && !paletteDrag ? 'auto' : 'none',
              cursor: loadedTrack ? 'ew-resize' : 'default', touchAction: 'none',
            }}
          />
        </Box>
      </Box>
      {playError && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {copy.errorPlayAudio}
        </Alert>
      )}
    </>
  );
}
