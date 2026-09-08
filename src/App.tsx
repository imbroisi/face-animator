import { exportMov } from './export/exportMov'
import { isMovOutputSize, readMovOutputSize, writeMovOutputSize, type MovOutputSize } from './export/movSize'
import { flushSync } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { prepareAudio } from './audio/prepareAudio'
import { buildMouthCycles, cycleFaceAt } from './audio/mouthCycles'
import type { MouthTimeline } from './audio/mouthCycles'
import { faces, faceNames } from './faces/Faces'
import { eyes, eyeUrl } from './faces/eyes'
import { Alert, Box, Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, LinearProgress, Radio, RadioGroup, Stack, SvgIcon, ThemeProvider, Tooltip, Typography, createTheme } from '@mui/material'

const theme = createTheme({ palette: { mode: 'dark', background: { default: '#222222' }, primary: { main: '#58a6e7' } } })

type Track = { id: number; file: File; name: string; duration: number; peaks: Float32Array; mouthTimeline: MouthTimeline }

function Waveform({ peaks }: { peaks: Float32Array }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      const context = canvas.getContext('2d')
      if (!context || !width) return
      context.scale(ratio, ratio)
      context.fillStyle = '#1e3e68'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#508fc5'
      for (let x = 0; x < width; x++) {
        const start = Math.floor(x * peaks.length / width)
        const end = Math.min(peaks.length, Math.max(start + 1, Math.ceil((x + 1) * peaks.length / width)))
        let peak = 0
        for (let i = start; i < end; i++) peak = Math.max(peak, peaks[i])
        const amplitude = Math.max(1, peak * (height - 8))
        context.fillRect(x, height - amplitude, 1, amplitude)
      }
    }
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()
    return () => observer.disconnect()
  }, [peaks])

  return <canvas ref={ref} role="img" aria-label="Forma de onda mono do áudio carregado" style={{ display: 'block', width: '100%', height: 96 }} />
}

function TimeDisplay({ seconds }: { seconds: number }) {
  const hundredths = Math.max(0, Math.floor(seconds * 100))
  const wholeSeconds = Math.floor(hundredths / 100)
  const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, '0')
  const remainder = String(wholeSeconds % 60).padStart(2, '0')
  const fraction = String(hundredths % 100).padStart(2, '0')

  return <>{minutes}:{remainder}<Box component="span" sx={{ fontSize: '50%' }}>.{fraction}</Box></>
}

const EMPTY_TRACK = {
  file: null, name: '', duration: 0, peaks: new Float32Array(0),
  mouthTimeline: null,
}

function AudioPlayer({ track: loadedTrack, onRemove, onLevelChange, onTimeChange }: { track: Track | null; onRemove: () => void; onLevelChange: (level: number) => void; onTimeChange: (time: number) => void }) {
  const track = loadedTrack ?? EMPTY_TRACK
  const audioRef = useRef<HTMLAudioElement>(null)
  const stopped = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(track.duration)
  const [playError, setPlayError] = useState('')

  useEffect(() => {
    const audio = audioRef.current!
    if (!track.file) return
    const url = URL.createObjectURL(track.file)
    audio.src = url
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
    }
  }, [track.file])

  const syncPosition = useCallback((time: number) => {
    setPosition(time)
    onTimeChange(time)
    const level = stopped.current || time >= track.duration ? 0 : cycleFaceAt(track.mouthTimeline, time)
    onLevelChange(level)
  }, [track, onLevelChange, onTimeChange])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const update = () => {
      syncPosition(audioRef.current?.currentTime ?? 0)
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [playing, syncPosition])

  async function togglePlayback() {
    const audio = audioRef.current!
    setPlayError('')
    if (!audio.paused) {
      audio.pause()
      return
    }
    stopped.current = false
    if (audio.ended) audio.currentTime = 0
    try {
      await audio.play()
    } catch {
      setPlayError('Não foi possível reproduzir o áudio. Tente novamente.')
    }
  }

  function stopPlayback() {
    stopped.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlaying(false)
    syncPosition(0)
  }

  const total = duration && Number.isFinite(duration) ? duration : track.duration
  const progress = total > 0 ? Math.min(1, position / total) : 0

  function seekTo(value: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    const next = Math.max(0, Math.min(total, value))
    stopped.current = false
    audio.currentTime = next
    syncPosition(next)
  }

  return <>
    <audio ref={audioRef} preload="auto" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); onLevelChange(0) }} onTimeUpdate={(event) => syncPosition(event.currentTarget.currentTime)} />
    <Box sx={{ display: 'flex', gap: 2, px: 2, mb: 1, fontVariantNumeric: 'tabular-nums' }}>
      <Typography component="span" variant="body2" sx={{ fontSize: '1.3125rem' }} aria-label="Tempo atual"><TimeDisplay seconds={position} /></Typography>
      <Typography component="span" variant="body2" sx={{ fontSize: '1.3125rem', color: '#909090' }} aria-label="Tempo total"><TimeDisplay seconds={total} /></Typography>
    </Box>
    <Box sx={{ position: 'relative', pt: 2, overflow: 'hidden', '&:focus-within': { outline: '2px solid #58a6e7', outlineOffset: '-2px' } }}>
      <Waveform peaks={track.peaks} />
      <Box aria-hidden="true" sx={{ position: 'absolute', top: 0, bottom: 0, left: `clamp(0px, ${progress * 100}%, calc(100% - 1px))`, width: '1px', bgcolor: '#29a7ff', pointerEvents: 'none', '&::before': { content: '""', position: 'absolute', top: 0, left: -5, width: 11, height: 14, bgcolor: '#29a7ff', clipPath: 'polygon(0 0, 100% 0, 100% 50%, 50% 100%, 0 50%)' } }} />
      <Box component="input" type="range" disabled={!loadedTrack} min={0} max={total} step="any" value={Math.min(position, total)} aria-label="Posição da reprodução" aria-valuetext={`${position.toFixed(1)} de ${total.toFixed(1)} segundos`} onChange={(event) => seekTo(Number(event.target.value))} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', m: 0, opacity: 0, cursor: 'ew-resize', touchAction: 'none' }} />
    </Box>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, py: 1 }}>
      <Tooltip title="Remover áudio">
        <IconButton aria-label="Remover áudio" onClick={onRemove} disabled={!loadedTrack}>
          <SvgIcon><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3-9h2v8H9v-8zm4 0h2v8h-2v-8zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" /></SvgIcon>
        </IconButton>
      </Tooltip>
      <IconButton disabled={!loadedTrack} onClick={() => void togglePlayback()} aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}>
        <SvgIcon>{playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</SvgIcon>
      </IconButton>
      <IconButton disabled={!loadedTrack} onClick={stopPlayback} aria-label="Parar e voltar ao início">
        <SvgIcon><path d="M6 6h12v12H6z" /></SvgIcon>
      </IconButton>
    </Stack>
    {playError && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{playError}</Alert>}
  </>
}

function suggestedMovName(name: string) {
  return `${name.replace(/\.[^.]+$/, '')}.mov`
}

function downloadMov(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function App() {
  const [faceLevel, setFaceLevel] = useState(0)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [savePercent, setSavePercent] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [movSize, setMovSize] = useState<MovOutputSize>(() => readMovOutputSize())
  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(false)
  const [choosingFile, setChoosingFile] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [hideTrackName, setHideTrackName] = useState(false)
  const [error, setError] = useState('')
  const abortExport = useRef<AbortController | null>(null)
  const request = useRef(0)

  useEffect(() => {
    // Warm the browser image cache before the first playback.
    for (const url of [...faces.normal, eyes.normal.open, eyes.normal.close]) {
      if (!url) continue
      const image = new Image()
      image.src = url
      void image.decode().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const input = fileInput.current
    const cancel = () => setChoosingFile(false)
    input?.addEventListener('cancel', cancel)
    return () => input?.removeEventListener('cancel', cancel)
  }, [])

  useEffect(() => () => { request.current++ }, [])

  async function loadAudio(file: File) {
    const id = ++request.current
    setLoading(true)
    setHideTrackName(true)
    setError('')
    let context: AudioContext | undefined
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
      if (id !== request.current) return
      context = new AudioContext()
      const buffer = await context.decodeAudioData(await file.arrayBuffer())
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
      const { peaks, mono } = prepareAudio(channels, buffer.sampleRate)
      const mouthTimeline = buildMouthCycles(mono, buffer.sampleRate, faces.normal)
      if (id === request.current) {
        setFaceLevel(0)
        setPlaybackTime(0)
        setHideTrackName(false)
        setTrack({ id, file, name: file.name, duration: buffer.duration, peaks, mouthTimeline })
      }
    } catch (error) {
      if (id === request.current) setError(error instanceof Error ? error.message : 'Não foi possível carregar este áudio.')
    } finally {
      if (context) void context.close().catch(() => {})
      if (id === request.current) setLoading(false)
    }
  }

  function removeAudio() {
    request.current++
    setTrack(null)
    setHideTrackName(false)
    setFaceLevel(0)
    setPlaybackTime(0)
    setError('')
    setLoading(false)
  }

  function closeExportDialog() {
    if (exporting) return
    setExportOpen(false)
  }

  async function confirmExport() {
    if (!track) return
    writeMovOutputSize(movSize)
    setError('')
    const name = suggestedMovName(track.name)
    const abort = new AbortController()
    abortExport.current = abort
    flushSync(() => {
      setSavePercent(0)
      setExporting(true)
    })
    try {
      const blob = await exportMov(track.file, track.mouthTimeline, faces.normal, eyes.normal, movSize, setSavePercent, abort.signal)
      if (!blob.size) throw new Error('O vídeo gerado está vazio.')
      const file = blob.type === 'video/quicktime' ? blob : new Blob([blob], { type: 'video/quicktime' })
      downloadMov(file, name)
      setExportOpen(false)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExportOpen(false)
        return
      }
      setError(error instanceof Error ? error.message : 'Falha ao exportar o vídeo.')
      setExportOpen(false)
    } finally {
      abortExport.current = null
      setExporting(false)
    }
  }

  function cancelExport() {
    abortExport.current?.abort()
  }

  const eyeOverlay = eyeUrl('normal', playbackTime)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box component="main" sx={{ width: '100%', height: '100dvh', pt: 2, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={2} sx={{ px: 2, mb: 3, alignItems: 'center', flexShrink: 0 }}>
          <Button variant="outlined" disabled={loading || choosingFile} onClick={() => {
            flushSync(() => {
              setChoosingFile(true)
              setHideTrackName(true)
            })
            fileInput.current?.click()
          }}>
            Carregar áudio
          </Button>
          <input ref={fileInput} type="file" accept="audio/*" aria-label="Carregar arquivo de áudio" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            setChoosingFile(false)
            if (file) void loadAudio(file)
          }} />
          <Typography role="status" variant="body2" noWrap title={hideTrackName ? undefined : track?.name} sx={{ minWidth: 0, color: !loading && !hideTrackName && !track ? '#909090' : 'text.primary' }}>{loading ? 'Analisando a fala…' : hideTrackName ? '' : track?.name ?? 'Nenhum áudio carregado'}</Typography>
          <Button variant="outlined" disabled={!track || loading || choosingFile || exporting} onClick={() => {
            setMovSize(readMovOutputSize())
            setExportOpen(true)
          }} sx={{ flexShrink: 0 }}>
            {exporting ? `Processando… ${savePercent}%` : 'Salvar MOV'}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Typography aria-label="Nome da imagem">{faceNames.normal[faceLevel]}</Typography>
            <Button variant="outlined" aria-label="Próxima imagem" sx={{ minWidth: 40 }} onClick={() => {
              const indices = faces.normal.flatMap((url, index) => url ? [index] : [])
              setFaceLevel(current => indices[(indices.indexOf(current) + 1) % indices.length] ?? 0)
            }}>+</Button>
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: '#c0c0c0' }}>
          <Box sx={{ position: 'absolute', inset: 0, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              <Box component="img" src={faces.normal[faceLevel]} alt="Boca" sx={{ display: 'block', width: 'auto', height: 'auto', maxWidth: 'none', flexShrink: 0, objectFit: 'contain' }} />
              {eyeOverlay && <Box component="img" src={eyeOverlay} alt="" sx={{ position: 'absolute', inset: 0, m: 'auto', display: 'block', width: 'auto', height: 'auto', maxWidth: 'none', pointerEvents: 'none' }} />}
            </Box>
          </Box>
        </Box>
        <Box component="section" aria-label="Área de áudio" sx={{ width: '100%', flexShrink: 0 }}>
          <AudioPlayer key={track?.id ?? 'empty'} track={track} onRemove={removeAudio} onLevelChange={setFaceLevel} onTimeChange={setPlaybackTime} />
        </Box>
      </Box>
      <Dialog open={exportOpen} onClose={closeExportDialog} aria-labelledby={exporting ? 'processing-title' : 'export-size-title'}>
        {exporting ? <>
          <DialogTitle id="processing-title">Processando…</DialogTitle>
          <DialogContent sx={{ minWidth: 320 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>{savePercent}%</Typography>
            <LinearProgress variant="determinate" value={savePercent} />
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelExport}>Cancelar</Button>
          </DialogActions>
        </> : <>
          <DialogTitle id="export-size-title">Tamanho do vídeo</DialogTitle>
          <DialogContent>
            <FormControl>
              <RadioGroup name="mov-output-size" value={movSize} onChange={(_, value) => { if (isMovOutputSize(value)) setMovSize(value) }}>
                <FormControlLabel value="4k" control={<Radio />} label="4K (altura 2160)" />
                <FormControlLabel value="1080p" control={<Radio />} label="1080p (altura 1080)" />
                <FormControlLabel value="native" control={<Radio />} label="Nativo (resolução da face)" />
              </RadioGroup>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeExportDialog}>Cancelar</Button>
            <Button variant="contained" onClick={() => void confirmExport()}>Salvar MOV</Button>
          </DialogActions>
        </>}
      </Dialog>
    </ThemeProvider>
  )
}
