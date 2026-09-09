import { exportMov } from './export/exportMov'
import { isMovOutputSize, readMovOutputSize, writeMovOutputSize, type MovOutputSize } from './export/movSize'
import { flushSync } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { prepareAudio } from './audio/prepareAudio'
import { buildMouthCycles, cycleFaceAt } from './audio/mouthCycles'
import type { MouthTimeline } from './audio/mouthCycles'
import { FACE_TYPES, faces, faceNames, isFaceType, type FaceType } from './faces/Faces'
import { eyes, eyeUrl } from './faces/eyes'
import { Alert, Box, Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, LinearProgress, Radio, RadioGroup, Stack, SvgIcon, ThemeProvider, Tooltip, Typography, createTheme } from '@mui/material'

const theme = createTheme({ palette: { mode: 'dark', background: { default: '#222222' }, primary: { main: '#58a6e7' } } })

type Track = { id: number; file: File; name: string; duration: number; peaks: Float32Array; mouthTimeline: MouthTimeline }

const DROP_SECONDS = 2
const WAVEFORM_BG = '#1e3e68'
const WAVEFORM_HIGHLIGHT = '#2d5a8f'
const WAVEFORM_PEAK = '#508fc5'
const PLAYHEAD = '#29a7ff'
const PLAYHEAD_HANDLE = 22
const EDGE_HIT = 2
const MOVE_THRESHOLD = 6
const MIN_DROP = 0.5
const SELECT_ORANGE = '#ffd56a'
const CURSOR_LEFT = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" stroke="#111" stroke-linejoin="round" stroke-width="1.5" d="M14.5 3.5 3.5 12l11 8.5v-6h7v-5h-7z"/></svg>')}") 4 12, w-resize`
const CURSOR_RIGHT = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#fff" stroke="#111" stroke-linejoin="round" stroke-width="1.5" d="M9.5 3.5 20.5 12l-11 8.5v-6h-7v-5h7z"/></svg>')}") 20 12, e-resize`

type FaceDrop = { id: number; start: number; end: number; face: FaceType }
type PaletteDrag = { width: number; height: number; hotX: number; hotY: number }

function dropTimeOk(start: number, duration: number) {
  return Number.isFinite(start) && start >= 0 && start < duration
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

function dropBlocked(start: number, duration: number, drops: readonly FaceDrop[], ignoreId?: number) {
  if (!dropTimeOk(start, duration)) return true
  const end = Math.min(start + DROP_SECONDS, duration)
  return drops.some(drop => drop.id !== ignoreId && rangesOverlap(start, end, drop.start, drop.end))
}

function clampDropStart(start: number, duration: number, drops: readonly FaceDrop[], ignoreId: number, originStart: number) {
  const moving = drops.find(drop => drop.id === ignoreId)
  const span = moving ? moving.end - moving.start : DROP_SECONDS
  const others = drops.filter(drop => drop.id !== ignoreId)
  let prev: FaceDrop | undefined
  let next: FaceDrop | undefined
  for (const drop of others) {
    if (drop.start <= originStart) {
      if (!prev || drop.start > prev.start) prev = drop
    } else if (!next || drop.start < next.start) {
      next = drop
    }
  }
  const lo = prev ? prev.end : 0
  const hi = next ? next.start - span : duration - span
  if (hi < lo) return originStart
  return Math.min(Math.max(start, lo), Math.max(lo, hi))
}

function clampDropEdge(drop: FaceDrop, edge: 'start' | 'end', time: number, duration: number, drops: readonly FaceDrop[]) {
  const others = drops.filter(other => other.id !== drop.id)
  let prev: FaceDrop | undefined
  let next: FaceDrop | undefined
  for (const other of others) {
    if (other.start <= drop.start) {
      if (!prev || other.start > prev.start) prev = other
    } else if (!next || other.start < next.start) {
      next = other
    }
  }
  if (edge === 'start') {
    const lo = prev ? prev.end : 0
    const hi = drop.end - MIN_DROP
    const start = Math.min(Math.max(time, lo), Math.max(lo, hi))
    return { start, end: drop.end }
  }
  const lo = drop.start + MIN_DROP
  const hi = next ? next.start : duration
  const end = Math.min(Math.max(time, lo), Math.max(lo, hi))
  return { start: drop.start, end }
}

function rectsOverlap(a: DOMRect, left: number, top: number, width: number, height: number) {
  return left < a.right && left + width > a.left && top < a.bottom && top + height > a.top
}

function faceAtTime(time: number, drops: readonly FaceDrop[]) {
  for (const drop of drops) {
    if (time >= drop.start && time < drop.end) return drop.face
  }
  return 'normal' as const
}

function FaceThumb({ mouth, eye }: { mouth: string; eye: string }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box component="img" src={mouth} alt="" draggable={false} sx={{ position: 'absolute', inset: 0, m: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      {eye && <Box component="img" src={eye} alt="" draggable={false} sx={{ position: 'absolute', inset: 0, m: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
    </Box>
  )
}

function Waveform({ peaks, duration, highlights }: { peaks: Float32Array; duration: number; highlights: readonly FaceDrop[] }) {
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
      context.fillStyle = WAVEFORM_BG
      context.fillRect(0, 0, width, height)
      if (duration > 0) {
        context.fillStyle = WAVEFORM_HIGHLIGHT
        for (const drop of highlights) {
          const left = drop.start / duration * width
          const right = drop.end / duration * width
          context.fillRect(left, 0, Math.max(1, right - left), height)
        }
      }
      context.fillStyle = WAVEFORM_PEAK
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
  }, [peaks, duration, highlights])

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

function AudioPlayer({ track: loadedTrack, drops, paletteDrag, mouth, eye, onRemove, onLevelChange, onTimeChange, onDropFace, onRemoveDrop, onMoveDrop, onResizeDrop }: {
  track: Track | null
  drops: readonly FaceDrop[]
  paletteDrag: PaletteDrag | null
  mouth: string
  eye: string
  onRemove: () => void
  onLevelChange: (level: number) => void
  onTimeChange: (time: number) => void
  onDropFace: (time: number) => void
  onRemoveDrop: (id: number) => void
  onMoveDrop: (id: number, start: number) => void
  onResizeDrop: (id: number, edge: 'start' | 'end', time: number) => void
}) {
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

  function stepFrame(delta: number) {
    const audio = audioRef.current
    if (!audio || !loadedTrack) return
    if (!audio.paused) audio.pause()
    const fps = 30
    const frame = Math.round((audio.currentTime || position) * fps)
    const last = Math.max(0, Math.round(total * fps))
    seekTo(Math.max(0, Math.min(last, frame + delta)) / fps)
  }

  const waveRef = useRef<HTMLDivElement>(null)
  const [pinDraggingId, setPinDraggingId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const pinDrag = useRef<{ id: number; origin: number; grab: number; startX: number; startY: number } | null>(null)
  const edgeDrag = useRef<{ id: number; edge: 'start' | 'end'; startX: number; startY: number } | null>(null)
  const moved = useRef(false)
  const pressingArea = useRef(false)
  const scrubbing = useRef(false)

  function timeFromClientX(clientX: number) {
    const box = waveRef.current?.getBoundingClientRect()
    if (!box || !box.width || total <= 0) return null
    return Math.max(0, Math.min(total, (clientX - box.left) / box.width * total))
  }

  useEffect(() => {
    if (!paletteDrag || !loadedTrack) return
    const { hotX, hotY, width, height } = paletteDrag

    function touchesWave(clientX: number, clientY: number) {
      const wave = waveRef.current?.getBoundingClientRect()
      if (!wave) return false
      return rectsOverlap(wave, clientX - hotX, clientY - hotY, width, height)
    }

    function dropTimeAt(clientX: number, clientY: number) {
      if (!touchesWave(clientX, clientY)) return null
      const box = waveRef.current?.getBoundingClientRect()
      if (!box || !box.width || total <= 0) return null
      const time = Math.max(0, Math.min(total, (clientX - box.left) / box.width * total))
      if (dropBlocked(time, total, drops)) return null
      return time
    }

    function handleDragOver(event: globalThis.DragEvent) {
      if (!touchesWave(event.clientX, event.clientY)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = dropTimeAt(event.clientX, event.clientY) === null ? 'none' : 'copy'
    }

    function handleDrop(event: globalThis.DragEvent) {
      if (!touchesWave(event.clientX, event.clientY)) return
      event.preventDefault()
      const time = dropTimeAt(event.clientX, event.clientY)
      if (time !== null) onDropFace(time)
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragenter', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragenter', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [paletteDrag, loadedTrack, drops, total, onDropFace])

  function handlePlayheadPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !loadedTrack || paletteDrag) return
    event.preventDefault()
    event.stopPropagation()
    scrubbing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const time = timeFromClientX(event.clientX)
    if (time !== null) seekTo(time)
  }

  function handlePlayheadPointerMove(event: PointerEvent<HTMLElement>) {
    if (!scrubbing.current || event.buttons !== 1) {
      if (event.buttons !== 1) scrubbing.current = false
      return
    }
    const time = timeFromClientX(event.clientX)
    if (time !== null) seekTo(time)
  }

  function handlePlayheadPointerUp(event: PointerEvent<HTMLElement>) {
    scrubbing.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleWavePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !loadedTrack || paletteDrag) return
    if (event.target instanceof Element && event.target.closest('[data-drop-pin]')) return
    event.preventDefault()
    scrubbing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const time = timeFromClientX(event.clientX)
    if (time !== null) seekTo(time)
  }

  function handlePinPointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop) {
    if (event.button !== 0 || paletteDrag) return
    event.preventDefault()
    event.stopPropagation()
    moved.current = false
    pressingArea.current = true
    setSelectedId(drop.id)
    const time = timeFromClientX(event.clientX) ?? drop.start
    pinDrag.current = { id: drop.id, origin: drop.start, grab: time - drop.start, startX: event.clientX, startY: event.clientY }
    setPinDraggingId(drop.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleAreaPointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop) {
    if (event.button !== 0 || paletteDrag) return
    event.preventDefault()
    event.stopPropagation()
    moved.current = false
    pressingArea.current = true
    setSelectedId(null)
    const time = timeFromClientX(event.clientX) ?? drop.start
    pinDrag.current = { id: drop.id, origin: drop.start, grab: time - drop.start, startX: event.clientX, startY: event.clientY }
    setPinDraggingId(drop.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePinPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.buttons !== 1 || edgeDrag.current) return
    const drag = pinDrag.current
    if (!drag) return
    if (!moved.current && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < MOVE_THRESHOLD) return
    moved.current = true
    const time = timeFromClientX(event.clientX)
    if (time === null) return
    onMoveDrop(drag.id, clampDropStart(time - drag.grab, total, drops, drag.id, drag.origin))
  }

  function handlePinPointerUp(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function handleEdgePointerDown(event: PointerEvent<HTMLElement>, drop: FaceDrop, edge: 'start' | 'end') {
    if (event.button !== 0 || paletteDrag) return
    event.preventDefault()
    event.stopPropagation()
    moved.current = false
    pressingArea.current = true
    setSelectedId(null)
    pinDrag.current = null
    edgeDrag.current = { id: drop.id, edge, startX: event.clientX, startY: event.clientY }
    setPinDraggingId(drop.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleEdgePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.buttons !== 1) return
    const drag = edgeDrag.current
    if (!drag) return
    if (!moved.current && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < MOVE_THRESHOLD) return
    moved.current = true
    const time = timeFromClientX(event.clientX)
    if (time === null) return
    onResizeDrop(drag.id, drag.edge, time)
  }

  function handlePinDoubleClick(id: number) {
    if (selectedId === id) setSelectedId(null)
    onRemoveDrop(id)
  }

  useEffect(() => {
    function onPointerUp(event: globalThis.PointerEvent) {
      if (event.button !== 0 || !pressingArea.current) return
      pressingArea.current = false
      if (!moved.current) {
        const box = waveRef.current?.getBoundingClientRect()
        const audio = audioRef.current
        if (box && box.width && total > 0 && audio) {
          const time = Math.max(0, Math.min(total, (event.clientX - box.left) / box.width * total))
          stopped.current = false
          audio.currentTime = time
          syncPosition(time)
        }
      }
      moved.current = false
      pinDrag.current = null
      edgeDrag.current = null
      setPinDraggingId(null)
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [total, syncPosition])

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (event.button !== 0) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-drop-pin]')) return
      setSelectedId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (selectedId === null) return
    const id = selectedId
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.closest('.MuiDialog-root') || target.isContentEditable || target.tagName === 'TEXTAREA') return
        if (target instanceof HTMLInputElement && target.type !== 'range') return
      }
      event.preventDefault()
      onRemoveDrop(id)
      setSelectedId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, onRemoveDrop])

  return <>
    <audio ref={audioRef} preload="auto" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); onLevelChange(0) }} onTimeUpdate={(event) => syncPosition(event.currentTarget.currentTime)} />
    <Box sx={{ display: 'flex', gap: 2, px: 2, mb: 1, fontVariantNumeric: 'tabular-nums' }}>
      <Typography component="span" variant="body2" sx={{ fontSize: '1.3125rem' }} aria-label="Tempo atual"><TimeDisplay seconds={position} /></Typography>
      <Typography component="span" variant="body2" sx={{ fontSize: '1.3125rem', color: '#909090' }} aria-label="Tempo total"><TimeDisplay seconds={total} /></Typography>
    </Box>
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ height: PLAYHEAD_HANDLE, position: 'relative', pointerEvents: 'none' }} />
      <Box sx={{ height: 46, position: 'relative', pointerEvents: 'none' }}>
        {loadedTrack && total > 0 && drops.map(drop => (
          <Box
            key={drop.id}
            data-drop-pin=""
            aria-selected={selectedId === drop.id}
            onPointerDown={event => handlePinPointerDown(event, drop)}
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
                <FaceThumb mouth={mouth} eye={eye} />
              </Box>
            </Box>
            <Box aria-hidden="true" sx={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #909090' }} />
          </Box>
        ))}
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
        {loadedTrack && total > 0 && drops.map(drop => (
          <Box
            key={`area-${drop.id}`}
            onPointerDown={event => handleAreaPointerDown(event, drop)}
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
          >
            <Box
              onPointerDown={event => handleEdgePointerDown(event, drop, 'start')}
              onPointerMove={handleEdgePointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${EDGE_HIT}px`, cursor: CURSOR_LEFT, zIndex: 2 }}
            />
            <Box
              onPointerDown={event => handleEdgePointerDown(event, drop, 'end')}
              onPointerMove={handleEdgePointerMove}
              onPointerUp={handlePinPointerUp}
              onPointerCancel={handlePinPointerUp}
              onLostPointerCapture={handlePinPointerUp}
              sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${EDGE_HIT}px`, cursor: CURSOR_RIGHT, zIndex: 2 }}
            />
          </Box>
        ))}
      </Box>
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
        <Box aria-hidden="true" sx={{ position: 'absolute', top: PLAYHEAD_HANDLE, bottom: 0, left: `clamp(0px, ${progress * 100}%, calc(100% - 2px))`, width: '2px', bgcolor: PLAYHEAD }} />
        <Box
          role="slider"
          aria-label="Posição da reprodução"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(position, total)}
          aria-valuetext={`${position.toFixed(1)} de ${total.toFixed(1)} segundos`}
          tabIndex={loadedTrack ? 0 : -1}
          onPointerDown={handlePlayheadPointerDown}
          onPointerMove={handlePlayheadPointerMove}
          onPointerUp={handlePlayheadPointerUp}
          onPointerCancel={handlePlayheadPointerUp}
          sx={{
            position: 'absolute', top: 0, left: `clamp(0px, ${progress * 100}%, calc(100% - 2px))`,
            width: 16, height: PLAYHEAD_HANDLE, ml: '-7px', bgcolor: PLAYHEAD,
            clipPath: 'polygon(0 0, 100% 0, 100% 52%, 50% 100%, 0 52%)',
            pointerEvents: loadedTrack && !paletteDrag ? 'auto' : 'none',
            cursor: loadedTrack ? 'ew-resize' : 'default', touchAction: 'none',
          }}
        />
      </Box>
    </Box>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, py: 1 }}>
      <Tooltip title="Recuar 1 quadro">
        <span>
          <IconButton disabled={!loadedTrack} onClick={() => stepFrame(-1)} aria-label="Recuar 1 quadro">
            <SvgIcon><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></SvgIcon>
          </IconButton>
        </span>
      </Tooltip>
      <IconButton disabled={!loadedTrack} onClick={() => void togglePlayback()} aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}>
        <SvgIcon>{playing ? <path d="M6 5h4v14H6zm8 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</SvgIcon>
      </IconButton>
      <Tooltip title="Avançar 1 quadro">
        <span>
          <IconButton disabled={!loadedTrack} onClick={() => stepFrame(1)} aria-label="Avançar 1 quadro">
            <SvgIcon><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></SvgIcon>
          </IconButton>
        </span>
      </Tooltip>
      <IconButton disabled={!loadedTrack} onClick={stopPlayback} aria-label="Parar e voltar ao início">
        <SvgIcon><path d="M6 6h12v12H6z" /></SvgIcon>
      </IconButton>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Remover áudio">
        <IconButton aria-label="Remover áudio" onClick={onRemove} disabled={!loadedTrack}>
          <SvgIcon><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3-9h2v8H9v-8zm4 0h2v8h-2v-8zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" /></SvgIcon>
        </IconButton>
      </Tooltip>
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
  const [face, setFace] = useState<FaceType>('normal')
  const [faceLevel, setFaceLevel] = useState(0)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [savePercent, setSavePercent] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [movSize, setMovSize] = useState<MovOutputSize>(() => readMovOutputSize())
  const [track, setTrack] = useState<Track | null>(null)
  const [drops, setDrops] = useState<FaceDrop[]>([])
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null)
  const dropId = useRef(0)
  const [loading, setLoading] = useState(false)
  const [choosingFile, setChoosingFile] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [hideTrackName, setHideTrackName] = useState(false)
  const [error, setError] = useState('')
  const abortExport = useRef<AbortController | null>(null)
  const request = useRef(0)

  useEffect(() => {
    // Warm the browser image cache before the first playback.
    for (const type of FACE_TYPES) {
      for (const url of [...faces[type], eyes[type].open, eyes[type].close]) {
        if (!url) continue
        const image = new Image()
        image.src = url
        void image.decode().catch(() => {})
      }
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
    setFace('normal')
    setFaceLevel(0)
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
        setDrops([])
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
    setDrops([])
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
      const blob = await exportMov(track.file, track.mouthTimeline, faces[face], eyes[face], movSize, setSavePercent, abort.signal)
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

  function handleFaceDragStart(event: DragEvent) {
    if (!track) {
      event.preventDefault()
      return
    }
    const node = event.currentTarget
    if (!(node instanceof HTMLElement)) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', 'upset')
    event.dataTransfer.setDragImage(node, node.clientWidth / 2, node.clientHeight / 2)
    setPaletteDrag({ width: node.clientWidth, height: node.clientHeight, hotX: node.clientWidth / 2, hotY: node.clientHeight / 2 })
  }

  function handleFaceDragEnd() {
    setPaletteDrag(null)
  }

  const handleDropFace = useCallback((time: number) => {
    setDrops(current => {
      const duration = track?.duration
      if (duration == null || dropBlocked(time, duration, current)) return current
      dropId.current += 1
      return [...current, { id: dropId.current, start: time, end: Math.min(time + DROP_SECONDS, duration), face: 'upset' }]
    })
  }, [track])

  const handleRemoveDrop = useCallback((id: number) => {
    setDrops(current => current.filter(drop => drop.id !== id))
  }, [])

  function handleMoveDrop(id: number, start: number) {
    setDrops(current => current.map(drop => {
      if (drop.id !== id) return drop
      const span = drop.end - drop.start
      return { ...drop, start, end: start + span }
    }))
  }

  function handleResizeDrop(id: number, edge: 'start' | 'end', time: number) {
    if (!track) return
    setDrops(current => {
      const drop = current.find(item => item.id === id)
      if (!drop) return current
      const next = clampDropEdge(drop, edge, time, track.duration, current)
      return current.map(item => item.id === id ? { ...item, ...next } : item)
    })
  }

  const previewFace = faceAtTime(playbackTime, drops)
  const eyeOverlay = eyeUrl(previewFace, playbackTime)

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
            <Typography aria-label="Nome da imagem">{faceNames[previewFace][faceLevel]}</Typography>
            <Button variant="outlined" aria-label="Próxima imagem" sx={{ minWidth: 40 }} onClick={() => {
              const indices = faces[face].flatMap((url, index) => url ? [index] : [])
              setFaceLevel(current => indices[(indices.indexOf(current) + 1) % indices.length] ?? 0)
            }}>+</Button>
          </Stack>
          <FormControl component="fieldset" sx={{ flexShrink: 0 }}>
            <RadioGroup row name="face-set" value={face} onChange={(_, value) => { if (isFaceType(value)) setFace(value) }} aria-label="Conjunto de faces">
              <FormControlLabel value="normal" control={<Radio size="small" />} label="Normal" />
              <FormControlLabel value="upset" control={<Radio size="small" />} label="Upset" />
            </RadioGroup>
          </FormControl>
        </Stack>
        {error && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{error}</Alert>}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', bgcolor: '#c0c0c0' }}>
            <Box sx={{ position: 'absolute', inset: 0, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                <Box component="img" src={faces[previewFace][faceLevel]} alt="Boca" sx={{ display: 'block', width: 'auto', height: 'auto', maxWidth: 'none', flexShrink: 0, objectFit: 'contain' }} />
                {eyeOverlay && <Box component="img" src={eyeOverlay} alt="" sx={{ position: 'absolute', inset: 0, m: 'auto', display: 'block', width: 'auto', height: 'auto', maxWidth: 'none', pointerEvents: 'none' }} />}
              </Box>
            </Box>
          </Box>
          <Box component="aside" aria-label="Opções de face" sx={{ width: 89, flexShrink: 0, bgcolor: '#2a2a2a', px: '20px', py: 1.25, overflow: 'auto' }}>
            <Box
              draggable={Boolean(track)}
              onDragStart={handleFaceDragStart}
              onDragEnd={handleFaceDragEnd}
              aria-label="Face upset, boca fechada"
              sx={{ width: '100%', aspectRatio: '1', borderRadius: '12px', bgcolor: '#c0c0c0', overflow: 'hidden', cursor: 'default', position: 'relative', opacity: track ? 1 : 0.45 }}
            >
              <FaceThumb mouth={faces.upset[0]} eye={eyes.upset.open} />
            </Box>
          </Box>
        </Box>
        <Box component="section" aria-label="Área de áudio" sx={{ width: '100%', flexShrink: 0, pt: 2.5 }}>
          <AudioPlayer key={track?.id ?? 'empty'} track={track} drops={drops} paletteDrag={paletteDrag} mouth={faces.upset[0]} eye={eyes.upset.open} onRemove={removeAudio} onLevelChange={setFaceLevel} onTimeChange={setPlaybackTime} onDropFace={handleDropFace} onRemoveDrop={handleRemoveDrop} onMoveDrop={handleMoveDrop} onResizeDrop={handleResizeDrop} />
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
