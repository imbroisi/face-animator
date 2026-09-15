import { Alert, Box, Button, CssBaseline, Stack, ThemeProvider, Typography } from '@mui/material';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { prepareAudio } from '../../audio/prepareAudio';
import { buildMouthCycles } from '../../audio/mouthCycles';
import { FACE_TYPES, faces, type FaceType } from '../../faces/Faces';
import { eyes, eyeUrl } from '../../faces/eyes';
import { exportMov } from '../../export/exportMov';
import { readMovOutputSize, writeMovOutputSize, type MovOutputSize } from '../../export/movSize';
import { useLocale } from '../../i18n/LocaleProvider';
import { translateThrown } from '../../i18n/translateError';
import { AudioPlayer } from '../audio/AudioPlayer';
import {
  DROP_SECONDS,
  clampDropEdge,
  dropBlocked,
  faceAtTime,
} from '../audio/dropGeometry';
import type { FaceDrop, PaletteDrag, Track } from '../audio/timelineTypes';
import { ExportDialog } from '../export/ExportDialog';
import { downloadMov, suggestedMovName } from '../export/downloadMov';
import { FacePalette } from '../faces/FacePalette';
import { FaceSetPicker } from '../faces/FaceSetPicker';
import { PreviewStage } from '../preview/PreviewStage';
import { LocaleSwitcher } from '../shared/LocaleSwitcher';
import { appTheme } from './appTheme';

export function App() {
  const { locale, copy } = useLocale();
  const [face, setFace] = useState<FaceType>('normal');
  const [faceLevel, setFaceLevel] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [savePercent, setSavePercent] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [movSize, setMovSize] = useState<MovOutputSize>(() => readMovOutputSize());
  const [track, setTrack] = useState<Track | null>(null);
  const [drops, setDrops] = useState<FaceDrop[]>([]);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const dropId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [choosingFile, setChoosingFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [hideTrackName, setHideTrackName] = useState(false);
  const [error, setError] = useState('');
  const abortExport = useRef<AbortController | null>(null);
  const request = useRef(0);

  useEffect(() => {
    for (const type of FACE_TYPES) {
      for (const url of [...faces[type], eyes[type].open, eyes[type].close]) {
        if (!url) continue;
        const image = new Image();
        image.src = url;
        void image.decode().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const input = fileInput.current;
    const cancel = () => setChoosingFile(false);
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);

  useEffect(() => () => {
    request.current += 1;
  }, []);

  async function loadAudio(file: File) {
    request.current += 1;
    const id = request.current;
    setLoading(true);
    setHideTrackName(true);
    setError('');
    setFace('normal');
    setFaceLevel(0);
    let context: AudioContext | undefined;
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      if (id !== request.current) return;
      context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from(
        { length: buffer.numberOfChannels },
        (_, i) => buffer.getChannelData(i),
      );
      const { peaks, mono } = prepareAudio(channels, buffer.sampleRate);
      const mouthTimeline = buildMouthCycles(mono, buffer.sampleRate, faces.normal);
      if (id === request.current) {
        setFaceLevel(0);
        setPlaybackTime(0);
        setHideTrackName(false);
        setDrops([]);
        setTrack({ id, file, name: file.name, duration: buffer.duration, peaks, mouthTimeline });
      }
    } catch (loadError) {
      if (id === request.current) {
        setError(translateThrown(copy, loadError, 'errorLoadAudio'));
      }
    } finally {
      if (context) void context.close().catch(() => {});
      if (id === request.current) setLoading(false);
    }
  }

  function removeAudio() {
    request.current += 1;
    setTrack(null);
    setDrops([]);
    setHideTrackName(false);
    setFaceLevel(0);
    setPlaybackTime(0);
    setError('');
    setLoading(false);
  }

  function closeExportDialog() {
    if (exporting) return;
    setExportOpen(false);
  }

  async function confirmExport() {
    if (!track) return;
    writeMovOutputSize(movSize);
    setError('');
    const name = suggestedMovName(track.name);
    const abort = new AbortController();
    abortExport.current = abort;
    flushSync(() => {
      setSavePercent(0);
      setExporting(true);
    });
    try {
      const blob = await exportMov(
        track.file,
        track.mouthTimeline,
        (time) => faceAtTime(time, drops),
        movSize,
        locale,
        setSavePercent,
        abort.signal,
      );
      if (!blob.size) throw new Error('errorEmptyVideo');
      const file = blob.type === 'video/quicktime'
        ? blob
        : new Blob([blob], { type: 'video/quicktime' });
      downloadMov(file, name);
      setExportOpen(false);
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === 'AbortError') {
        setExportOpen(false);
        return;
      }
      setError(translateThrown(copy, exportError, 'errorExport'));
      setExportOpen(false);
    } finally {
      abortExport.current = null;
      setExporting(false);
    }
  }

  function cancelExport() {
    abortExport.current?.abort();
  }

  function handleFaceDragStart(event: DragEvent, type: FaceType) {
    if (!track) {
      event.preventDefault();
      return;
    }
    const node = event.currentTarget;
    if (!(node instanceof HTMLElement)) {
      event.preventDefault();
      return;
    }
    const transfer = event.dataTransfer;
    transfer.effectAllowed = 'copy';
    transfer.setData('text/plain', type);
    transfer.setDragImage(node, node.clientWidth / 2, node.clientHeight / 2);
    setPaletteDrag({
      width: node.clientWidth,
      height: node.clientHeight,
      hotX: node.clientWidth / 2,
      hotY: node.clientHeight / 2,
      face: type,
    });
  }

  const handleDropFace = useCallback((time: number, nextFace: FaceType) => {
    setDrops((current) => {
      const duration = track?.duration;
      if (duration == null || dropBlocked(time, duration, current)) return current;
      dropId.current += 1;
      return [...current, {
        id: dropId.current,
        start: time,
        end: Math.min(time + DROP_SECONDS, duration),
        face: nextFace,
      }];
    });
  }, [track]);

  const handleRemoveDrop = useCallback((id: number) => {
    setDrops((current) => current.filter((drop) => drop.id !== id));
  }, []);

  function handleMoveDrop(id: number, start: number) {
    setDrops((current) => current.map((drop) => {
      if (drop.id !== id) return drop;
      const span = drop.end - drop.start;
      return { ...drop, start, end: start + span };
    }));
  }

  function handleResizeDrop(id: number, edge: 'start' | 'end', time: number) {
    if (!track) return;
    setDrops((current) => {
      const drop = current.find((item) => item.id === id);
      if (!drop) return current;
      const next = clampDropEdge(drop, edge, time, track.duration, current);
      return current.map((item) => (item.id === id ? { ...item, ...next } : item));
    });
  }

  function handleNextMouth() {
    const indices = faces[face].flatMap((url, index) => (url ? [index] : []));
    setFaceLevel((current) => {
      const next = indices[(indices.indexOf(current) + 1) % indices.length];
      return next ?? 0;
    });
  }

  const previewFace = track ? faceAtTime(playbackTime, drops) : face;
  const eyeOverlay = eyeUrl(previewFace, playbackTime);
  let audioStatus = track?.name ?? copy.noAudioLoaded;
  if (loading) audioStatus = copy.analyzingSpeech;
  else if (hideTrackName) audioStatus = '';

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box
        component="main"
        sx={{ width: '100%', height: '100dvh', pt: 2, display: 'flex', flexDirection: 'column' }}
      >
        <Stack direction="row" spacing={2} sx={{ px: 2, mb: 3, alignItems: 'center', flexShrink: 0, overflowX: 'auto' }}>
          <Button
            variant="outlined"
            disabled={loading || choosingFile}
            onClick={() => {
              flushSync(() => {
                setChoosingFile(true);
                setHideTrackName(true);
              });
              fileInput.current?.click();
            }}
          >
            {copy.loadAudio}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            aria-label={copy.loadAudioFile}
            hidden
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              input.value = '';
              setChoosingFile(false);
              if (file) void loadAudio(file);
            }}
          />
          <Typography
            role="status"
            variant="body2"
            noWrap
            title={hideTrackName ? undefined : track?.name}
            sx={{
              minWidth: 0,
              color: !loading && !hideTrackName && !track ? '#909090' : 'text.primary',
            }}
          >
            {audioStatus}
          </Typography>
          <Button
            variant="outlined"
            disabled={!track || loading || choosingFile || exporting}
            onClick={() => {
              setMovSize(readMovOutputSize());
              setExportOpen(true);
            }}
            sx={{ flexShrink: 0 }}
          >
            {exporting ? copy.processingPercent(savePercent) : copy.saveMov}
          </Button>
          <Box sx={{ flex: 1, minWidth: 0 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {!track && (
              <FaceSetPicker
                face={face}
                faceLevel={faceLevel}
                previewFace={previewFace}
                onFaceChange={setFace}
                onNextMouth={handleNextMouth}
              />
            )}
            <Box sx={{ ml: track ? 0 : '100px' }}>
              <LocaleSwitcher />
            </Box>
          </Box>
        </Stack>
        {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <PreviewStage
            mouthSrc={faces[previewFace][faceLevel]}
            eyeSrc={eyeOverlay}
          />
          <FacePalette
            enabled={Boolean(track)}
            onDragStart={handleFaceDragStart}
            onDragEnd={() => setPaletteDrag(null)}
          />
        </Box>
        <Box component="section" aria-label={copy.audioArea} sx={{ width: '100%', flexShrink: 0, pt: 0.5 }}>
          <AudioPlayer
            key={track?.id ?? 'empty'}
            track={track}
            drops={drops}
            paletteDrag={paletteDrag}
            onRemove={removeAudio}
            onLevelChange={setFaceLevel}
            onTimeChange={setPlaybackTime}
            onDropFace={handleDropFace}
            onRemoveDrop={handleRemoveDrop}
            onMoveDrop={handleMoveDrop}
            onResizeDrop={handleResizeDrop}
          />
        </Box>
      </Box>
      <ExportDialog
        open={exportOpen}
        exporting={exporting}
        savePercent={savePercent}
        movSize={movSize}
        onClose={closeExportDialog}
        onCancelExport={cancelExport}
        onConfirm={() => void confirmExport()}
        onMovSizeChange={setMovSize}
      />
    </ThemeProvider>
  );
}
