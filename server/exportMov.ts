import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Plugin, Connect } from 'vite'

const execute = promisify(execFile)
const LIMIT = 200 * 1024 * 1024

export function exportMovPlugin(): Plugin {
  let busy = false
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url !== '/api/export-mov') return next()
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return }
    if (busy) { res.writeHead(409, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Já existe uma exportação em andamento.' })); return }
    busy = true
    let directory: string | undefined
    const abort = new AbortController()
    const cancel = () => { if (!res.writableEnded) abort.abort() }
    res.on('close', cancel)
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk)
        size += bytes.length
        if (size > LIMIT) throw new Error('Limite de exportação: 200 MB por arquivo.')
        chunks.push(bytes)
      }
      const body = new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers['content-type'] || '' } })
      const form = await body.formData()
      const audio = form.get('audio')
      const raw = form.get('manifest')
      if (!(audio instanceof File) || typeof raw !== 'string') throw new Error('Arquivo de áudio ou animação ausente.')
      const { duration, width, height, segments } = JSON.parse(raw)
      if (!Number.isFinite(duration) || duration <= 0 || duration > 3600 || !Number.isInteger(width) || width < 1 || width > 8192 || !Number.isInteger(height) || height < 1 || height > 8192 || !Array.isArray(segments) || segments.length > 108000) throw new Error('Configuração de vídeo inválida.')
      let frames = 0
      const used = new Set<number>()
      for (const segment of segments) {
        if (!Number.isInteger(segment.face) || segment.face < 0 || segment.face > 1000 || !Number.isInteger(segment.frames) || segment.frames <= 0) throw new Error('Sequência de animação inválida.')
        frames += segment.frames
        used.add(segment.face)
      }
      if (frames !== Math.ceil(duration * 30)) throw new Error('Duração da animação inválida.')
      if (segments[0].face !== 0 || segments.at(-1).face !== 0) throw new Error('A animação deve começar e terminar com a face-0.')
      const tailFrames = 60
      if (segments.at(-1).frames < tailFrames) throw new Error('A animação deve terminar com 2 segundos da face-0.')
      const bodyParts = segments.map(segment => ({ face: segment.face, frames: segment.frames }))
      let remaining = tailFrames
      for (let i = bodyParts.length - 1; i >= 0 && remaining > 0; i--) {
        const take = Math.min(bodyParts[i].frames, remaining)
        bodyParts[i].frames -= take
        remaining -= take
      }
      const bodySegments = bodyParts.filter(segment => segment.frames > 0)
      const bodyFrames = bodySegments.reduce((sum, segment) => sum + segment.frames, 0)
      const lines = ['ffconcat version 1.0']
      for (const segment of bodySegments) {
        lines.push(`file face-${segment.face}.png`, 'option framerate 30', `duration ${(segment.frames / 30).toFixed(9)}`)
      }
      lines.push(`file face-${bodySegments.at(-1)?.face ?? 0}.png`, 'option framerate 30', 'duration 0.033333334', `file face-${bodySegments.at(-1)?.face ?? 0}.png`)
      directory = await mkdtemp(join(tmpdir(), 'face-animator-mov-'))
      for (const face of used) {
        const image = form.get(`face-${face}`)
        if (!(image instanceof File) || image.size > 20 * 1024 * 1024) throw new Error('Imagem inválida.')
        const png = Buffer.from(await image.arrayBuffer())
        if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw new Error('Dimensões da imagem não correspondem ao vídeo.')
        await writeFile(join(directory, `face-${face}.png`), png)
      }
      const sourceAudio = join(directory, 'audio')
      const bodyAudio = join(directory, 'body.wav')
      const tailAudio = join(directory, 'tail.wav')
      await writeFile(sourceAudio, Buffer.from(await audio.arrayBuffer()))
      await writeFile(join(directory, 'frames.txt'), lines.join('\n'))
      const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
      const ffprobe = process.env.FFPROBE_PATH || (ffmpeg.endsWith('ffmpeg') ? `${ffmpeg.slice(0, -6)}ffprobe` : 'ffprobe')
      const { stdout: probe } = await execute(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels,channel_layout', '-of', 'json', sourceAudio], { timeout: 30_000, maxBuffer: 1024 * 1024, signal: abort.signal })
      const stream = JSON.parse(probe).streams?.[0]
      const rate = Number(stream?.sample_rate) || 48000
      const channels = Number(stream?.channels) || 2
      const layout = stream?.channel_layout && stream.channel_layout !== 'unknown' ? stream.channel_layout : channels === 1 ? 'mono' : channels === 2 ? 'stereo' : `${channels}c`
      const format = `aformat=sample_rates=${rate}:channel_layouts=${layout}`
      const run = (args: string[]) => execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args], { timeout: 600_000, maxBuffer: 1024 * 1024, signal: abort.signal })
      const prores = ['-vf', 'format=rgba,fps=30,setsar=1', '-sws_flags', 'neighbor+accurate_rnd+full_chroma_int+full_chroma_inp', '-video_track_timescale', '30000', '-color_range', 'pc', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-c:a', 'pcm_s16le']
      // Head: digital silence. Tail: inaudible tone so Filmora does not trim the clip end.
      await run(['-f', 'lavfi', '-t', '2', '-i', `anullsrc=r=${rate}:cl=${layout}`, '-i', sourceAudio, '-filter_complex', `[0:a]${format}[s];[1:a]${format}[o];[s][o]concat=n=2:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'pcm_s16le', bodyAudio])
      await run(['-f', 'lavfi', '-t', '2', '-i', `sine=frequency=18:sample_rate=${rate}:duration=2`, '-af', `volume=0.0008,${format}`, '-c:a', 'pcm_s16le', tailAudio])
      const bodyMov = join(directory, 'body.mov')
      const tailMov = join(directory, 'tail.mov')
      await run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'frames.txt'), '-i', bodyAudio, '-map', '0:v:0', '-map', '1:a:0', '-t', (bodyFrames / 30).toFixed(9), ...prores, bodyMov])
      await run(['-loop', '1', '-framerate', '30', '-i', join(directory, 'face-0.png'), '-i', tailAudio, '-map', '0:v:0', '-map', '1:a:0', '-t', '2', ...prores, tailMov])
      await writeFile(join(directory, 'parts.txt'), 'ffconcat version 1.0\nfile body.mov\nfile tail.mov\n')
      const output = join(directory, 'animation.mov')
      await run(['-f', 'concat', '-safe', '0', '-i', join(directory, 'parts.txt'), '-c', 'copy', '-movflags', '+faststart', output])
      const video = await readFile(output)
      res.writeHead(200, { 'Content-Type': 'video/quicktime', 'Content-Length': video.length, 'Content-Disposition': 'attachment; filename="animation.mov"' }).end(video)
    } catch (error) {
      console.error('MOV export:', error)
      if (!res.destroyed) res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error instanceof Error && !('code' in error) ? error.message : 'Falha ao gerar o MOV. Verifique se o FFmpeg está instalado.' }))
    } finally {
      res.off('close', cancel)
      busy = false
      if (directory) await rm(directory, { recursive: true, force: true })
    }
  }
  return { name: 'export-mov', configureServer(server) { server.middlewares.use(middleware) }, configurePreviewServer(server) { server.middlewares.use(middleware) } }
}
