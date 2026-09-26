import { Alert, Box, Button, CssBaseline, Stack, ThemeProvider, Typography } from '@mui/material';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { exampleSpeechUrl } from '../../audio/exampleSpeechUrl';
import { fetchAudioFile } from '../../audio/fetchAudioFile';
import { limitPeakGain } from '../../audio/limitPeakGain';
import { prepareAudio } from '../../audio/prepareAudio';
import { buildMouthCycles } from '../../audio/mouthCycles';
import { FACE_TYPES, faces, type FaceType } from '../../faces/Faces';
import { eyes, eyeUrl } from '../../faces/eyes';
import { exportMov } from '../../export/exportMov';
import { pcmWav } from '../../export/pcmWav';
import { readMovOutputSize, writeMovOutputSize, type MovOutputSize } from '../../export/movSize';
import {
  readExportBlurPx,
  writeExportBlurPx,
} from '../../export/exportLook';
import { useLocale } from '../../i18n/LocaleProvider';
import { translateThrown } from '../../i18n/translateError';
import { AudioPlayer } from '../audio/AudioPlayer';
import { LoadAudioDialog } from '../audio/LoadAudioDialog';
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
import { SpeechBalloon, type BalloonAnchor } from '../tutorial/SpeechBalloon';
import { rememberWelcomeSeen, shouldShowWelcome } from '../tutorial/firstVisit';
import { appTheme } from './appTheme';

const DROP_HINT_SECONDS = 5;

function speechDropAnchor(area: HTMLElement | null, duration: number): BalloonAnchor | null {
  if (!area || duration <= 0) return null;
  const seconds = Math.min(DROP_HINT_SECONDS, duration);
  return {
    contextElement: area,
    getBoundingClientRect() {
      const box = area.getBoundingClientRect();
      const x = box.left + (seconds / duration) * box.width;
      const y = box.top + box.height / 2;
      return new DOMRect(x, y, 0, 0);
    },
  };
}

export function App() {
  const { locale, copy } = useLocale();
  const [face, setFace] = useState<FaceType>('normal');
  const [faceLevel, setFaceLevel] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [savePercent, setSavePercent] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [movSize, setMovSize] = useState<MovOutputSize>(() => readMovOutputSize());
  const [blurPx, setBlurPx] = useState(() => String(readExportBlurPx()));
  const [track, setTrack] = useState<Track | null>(null);
  const [drops, setDrops] = useState<FaceDrop[]>([]);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const dropId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [choosingFile, setChoosingFile] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadId, setLoadId] = useState(0);
  const [exampleLoad, setExampleLoad] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [exampleAnchor, setExampleAnchor] = useState<HTMLElement | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(() => shouldShowWelcome());
  const [welcomeAnchor, setWelcomeAnchor] = useState<HTMLElement | null>(null);
  const [exampleUrlHint, setExampleUrlHint] = useState(false);
  const [urlAnchor, setUrlAnchor] = useState<HTMLElement | null>(null);
  const [examplePlayHint, setExamplePlayHint] = useState(false);
  const [playAnchor, setPlayAnchor] = useState<HTMLElement | null>(null);
  const [exampleMoodHint, setExampleMoodHint] = useState(false);
  const [upsetAnchor, setUpsetAnchor] = useState<HTMLElement | null>(null);
  const [exampleDropHint, setExampleDropHint] = useState(false);
  const [exampleSaveHint, setExampleSaveHint] = useState(false);
  const [saveAnchor, setSaveAnchor] = useState<HTMLElement | null>(null);
  const [speechArea, setSpeechArea] = useState<HTMLElement | null>(null);
  const [examplePlayKind, setExamplePlayKind] = useState<'load' | 'replay'>('load');
  const exampleHasMoodDrop = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadAudioButton = useRef<HTMLButtonElement>(null);
  const exampleButton = useRef<HTMLButtonElement>(null);
  const saveMovButton = useRef<HTMLButtonElement>(null);
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
    const cancel = () => {
      setChoosingFile(false);
      setHideTrackName(false);
    };
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);

  useEffect(() => () => {
    request.current += 1;
  }, []);

  useLayoutEffect(() => {
    if (!welcomeOpen) return;
    setWelcomeAnchor(exampleButton.current);
  }, [welcomeOpen]);

  function dismissWelcome() {
    rememberWelcomeSeen();
    setWelcomeOpen(false);
  }

  async function applyAudioFile(file: File, id: number) {
    setDownloading(false);
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
      const decoded = Array.from(
        { length: buffer.numberOfChannels },
        (_, index) => buffer.getChannelData(index),
      );
      const limited = limitPeakGain(decoded);
      const { peaks, mono } = prepareAudio(limited.channels, buffer.sampleRate);
      const mouthTimeline = buildMouthCycles(mono, buffer.sampleRate, faces.normal);
      let playback = file;
      if (limited.changed) {
        playback = new File(
          [pcmWav(limited.channels, buffer.sampleRate)],
          file.name,
          { type: 'audio/wav' },
        );
      }
      if (id === request.current) {
        setFaceLevel(0);
        setPlaybackTime(0);
        setHideTrackName(false);
        setDrops([]);
        setTrack({
          id,
          file: playback,
          name: file.name,
          duration: buffer.duration,
          peaks,
          mouthTimeline,
        });
        setExamplePlayHint(exampleLoad);
        setExamplePlayKind('load');
        setExampleMoodHint(false);
        setExampleDropHint(false);
        setExampleSaveHint(false);
        exampleHasMoodDrop.current = false;
      }
    } catch (loadError) {
      if (id === request.current) {
        setError(translateThrown(copy, loadError, 'errorLoadAudio'));
      }
    } finally {
      if (context) void context.close().catch(() => {});
      if (id === request.current) {
        setDownloading(false);
        setLoading(false);
      }
    }
  }

  function loadAudio(file: File) {
    request.current += 1;
    void applyAudioFile(file, request.current);
  }

  async function loadAudioFromUrl(url: string) {
    request.current += 1;
    const id = request.current;
    setLoadOpen(false);
    setDownloading(true);
    setLoading(true);
    setHideTrackName(true);
    setError('');
    try {
      const file = await fetchAudioFile(url);
      if (id !== request.current) return;
      await applyAudioFile(file, id);
    } catch (loadError) {
      if (id !== request.current) return;
      setError(translateThrown(copy, loadError, 'errorLoadAudio'));
      setDownloading(false);
      setLoading(false);
      setHideTrackName(false);
    }
  }

  function chooseLocalAudio() {
    flushSync(() => {
      setChoosingFile(true);
      setHideTrackName(true);
      setLoadOpen(false);
    });
    fileInput.current?.click();
  }

  function removeAudio() {
    request.current += 1;
    setTrack(null);
    setDrops([]);
    setHideTrackName(false);
    setFaceLevel(0);
    setPlaybackTime(0);
    setError('');
    setDownloading(false);
    setLoading(false);
    setExamplePlayHint(false);
    setExampleMoodHint(false);
    setExampleDropHint(false);
    setExampleSaveHint(false);
    exampleHasMoodDrop.current = false;
  }

  function closeExportDialog() {
    if (exporting) return;
    setExportOpen(false);
  }

  async function confirmExport() {
    if (!track) return;
    const blur = Number(blurPx);
    if (!Number.isFinite(blur) || blur < 0) return;
    writeMovOutputSize(movSize);
    writeExportBlurPx(blur);
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
        blur,
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
    if (exampleLoad && type === 'upset' && !exampleHasMoodDrop.current) {
      setExampleMoodHint(false);
      setExampleDropHint(true);
    }
  }

  function handleFaceNode(type: FaceType, node: HTMLElement | null) {
    if (type === 'upset') setUpsetAnchor(node);
  }

  const handleDropFace = useCallback((time: number, nextFace: FaceType) => {
    if (!track) return;
    const duration = track.duration;
    let placed = false;
    setDrops((current) => {
      if (dropBlocked(time, duration, current)) return current;
      placed = true;
      dropId.current += 1;
      return [...current, {
        id: dropId.current,
        start: time,
        end: Math.min(time + DROP_SECONDS, duration),
        face: nextFace,
      }];
    });
    if (!placed || !exampleLoad || nextFace !== 'upset') return;
    exampleHasMoodDrop.current = true;
    setExampleDropHint(false);
    setExampleMoodHint(false);
    setExamplePlayKind('replay');
    setExamplePlayHint(true);
  }, [track, exampleLoad]);

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
  const dropAnchor = useMemo(
    () => speechDropAnchor(speechArea, track?.duration ?? 0),
    [speechArea, track?.duration],
  );
  let audioStatus = track?.name ?? copy.noAudioLoaded;
  if (downloading) audioStatus = copy.downloadingAudio;
  else if (loading) audioStatus = copy.analyzingSpeech;
  else if (hideTrackName) audioStatus = '';

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box
        component="main"
        sx={{
          width: '100%',
          height: '100dvh',
          pt: 2,
          pb: '32px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ px: 2, mb: 3, alignItems: 'center', overflowX: 'auto', flexShrink: 0 }}
        >
          <Button
            ref={loadAudioButton}
            variant="outlined"
            disabled={loading || choosingFile}
            onClick={() => {
              setExampleLoad(exampleOpen);
              setExampleUrlHint(exampleOpen);
              setExamplePlayHint(false);
              setExampleMoodHint(false);
              setExampleDropHint(false);
              setExampleSaveHint(false);
              setExampleOpen(false);
              setError('');
              setLoadId((id) => id + 1);
              setLoadOpen(true);
            }}
            sx={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
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
            ref={saveMovButton}
            variant="outlined"
            disabled={!track || loading || choosingFile || exporting}
            onClick={() => {
              setExampleSaveHint(false);
              setMovSize(readMovOutputSize());
              setExportOpen(true);
            }}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {exporting ? copy.processingPercent(savePercent) : copy.saveMov}
          </Button>
          <Box sx={{ flex: 1, minWidth: 0 }} />
          <Button
            ref={exampleButton}
            variant="outlined"
            onClick={() => {
              dismissWelcome();
              setExampleAnchor(loadAudioButton.current);
              setExampleOpen(true);
            }}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {copy.example}
          </Button>
          <Box sx={{ flex: 1, minWidth: 0 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {import.meta.env.DEV && !track && (
              <FaceSetPicker
                face={face}
                faceLevel={faceLevel}
                previewFace={previewFace}
                onFaceChange={setFace}
                onNextMouth={handleNextMouth}
              />
            )}
            <Box sx={{ ml: import.meta.env.DEV && !track ? '100px' : 0 }}>
              <LocaleSwitcher />
            </Box>
          </Box>
        </Stack>
        {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <PreviewStage
            mouthSrc={faces[previewFace][faceLevel]}
            eyeSrc={eyeOverlay}
          />
          <FacePalette
            enabled={Boolean(track)}
            onDragStart={handleFaceDragStart}
            onDragEnd={() => {
              setPaletteDrag(null);
              setExampleDropHint(false);
              if (exampleLoad && !exampleHasMoodDrop.current) setExampleMoodHint(true);
            }}
            onFaceNode={handleFaceNode}
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
            onPlayButton={setPlayAnchor}
            onSpeechArea={setSpeechArea}
            onPlaybackEnded={() => {
              if (!exampleLoad) return;
              setExamplePlayHint(false);
              setExampleMoodHint(false);
              setExampleDropHint(false);
              if (exampleHasMoodDrop.current) {
                setSaveAnchor(saveMovButton.current);
                setExampleSaveHint(true);
                return;
              }
              setExampleMoodHint(true);
            }}
          />
        </Box>
      </Box>
      <SpeechBalloon
        open={welcomeOpen && Boolean(welcomeAnchor)}
        anchorEl={welcomeAnchor}
        placement="bottom"
        onClose={dismissWelcome}
      >
        {copy.welcomeHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={exampleOpen}
        anchorEl={exampleAnchor}
        onClose={() => setExampleOpen(false)}
      >
        {copy.exampleLoadHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={exampleUrlHint && Boolean(urlAnchor)}
        anchorEl={urlAnchor}
        placement="left-start"
        fallbackPlacements={['right-start']}
        onClose={() => setExampleUrlHint(false)}
      >
        {copy.exampleUrlHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={examplePlayHint && Boolean(playAnchor)}
        anchorEl={playAnchor}
        placement="top"
        onClose={() => setExamplePlayHint(false)}
      >
        {examplePlayKind === 'replay' ? copy.exampleReplayHint : copy.examplePlayHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={exampleMoodHint && Boolean(upsetAnchor)}
        anchorEl={upsetAnchor}
        placement="left"
        onClose={() => setExampleMoodHint(false)}
      >
        {copy.exampleMoodHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={exampleDropHint && Boolean(dropAnchor)}
        anchorEl={dropAnchor}
        placement="top"
        gap={0}
        disableClickAway
        pointerEvents="none"
        onClose={() => setExampleDropHint(false)}
      >
        {copy.exampleDropHint}
      </SpeechBalloon>
      <SpeechBalloon
        open={exampleSaveHint && Boolean(saveAnchor)}
        anchorEl={saveAnchor}
        onClose={() => setExampleSaveHint(false)}
      >
        {copy.exampleSaveHint}
      </SpeechBalloon>
      <LoadAudioDialog
        key={loadId}
        open={loadOpen}
        initialWebUrl={exampleLoad ? exampleSpeechUrl(locale) : undefined}
        onClose={() => {
          setLoadOpen(false);
          setExampleUrlHint(false);
        }}
        onUrlField={setUrlAnchor}
        onChooseLocal={chooseLocalAudio}
        onChooseWeb={(url) => void loadAudioFromUrl(url)}
      />
      <ExportDialog
        open={exportOpen}
        exporting={exporting}
        savePercent={savePercent}
        movSize={movSize}
        blurPx={blurPx}
        onClose={closeExportDialog}
        onCancelExport={cancelExport}
        onConfirm={() => void confirmExport()}
        onMovSizeChange={setMovSize}
        onBlurPxChange={setBlurPx}
      />
    </ThemeProvider>
  );
}
