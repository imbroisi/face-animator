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
      const lines = ['ffconcat version 1.0']
      for (const segment of segments) {
        if (!Number.isInteger(segment.face) || segment.face < 0 || segment.face > 1000 || !Number.isInteger(segment.frames) || segment.frames <= 0) throw new Error('Sequência de animação inválida.')
        frames += segment.frames
        used.add(segment.face)
        lines.push(`file face-${segment.face}.png`, 'option framerate 30', `duration ${(segment.frames / 30).toFixed(9)}`)
      }
      if (frames !== Math.ceil(duration * 30)) throw new Error('Duração da animação inválida.')
      if (segments.at(-1).face !== 0) throw new Error('A animação deve terminar com a face-0.')
      lines.push(`file face-${segments.at(-1).face}.png`, 'option framerate 30')
      directory = await mkdtemp(join(tmpdir(), 'face-animator-mov-'))
      for (const face of used) {
        const image = form.get(`face-${face}`)
        if (!(image instanceof File) || image.size > 20 * 1024 * 1024) throw new Error('Imagem inválida.')
        const png = Buffer.from(await image.arrayBuffer())
        if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) throw new Error('Dimensões da imagem não correspondem ao vídeo.')
        await writeFile(join(directory, `face-${face}.png`), png)
      }
      await writeFile(join(directory, 'audio'), Buffer.from(await audio.arrayBuffer()))
      await writeFile(join(directory, 'frames.txt'), lines.join('\n'))
      const output = join(directory, 'animation.mov')
      const videoDuration = (frames / 30).toFixed(9)
      await execute(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', join(directory, 'frames.txt'), '-i', join(directory, 'audio'), '-map', '0:v:0', '-map', '1:a:0', '-t', videoDuration, '-sws_flags', 'neighbor+accurate_rnd+full_chroma_int+full_chroma_inp', '-vf', 'format=rgba,setsar=1', '-r', '30', '-color_range', 'pc', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-c:a', 'pcm_s16le', '-movflags', '+faststart', output], { timeout: 600_000, maxBuffer: 1024 * 1024, signal: abort.signal })
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
