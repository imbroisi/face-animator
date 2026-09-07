import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { promisify } from 'node:util'
import type { Plugin, Connect } from 'vite'

const execute = promisify(execFile)

export function lipSyncPlugin(): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url !== '/api/lip-sync') return next()
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      res.writeHead(403).end(); return
    }
    let directory: string | undefined
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk)
        size += bytes.length
        if (size > 100 * 1024 * 1024) {
          res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Áudio muito grande para análise (limite de 100 MB em WAV).' }))
          return
        }
        chunks.push(bytes)
      }
      directory = await mkdtemp(join(tmpdir(), 'face-animator-'))
      const input = join(directory, 'audio.wav')
      await writeFile(input, Buffer.concat(chunks))
      const executable = process.env.RHUBARB_PATH || resolve('tools/rhubarb/Rhubarb-Lip-Sync-1.14.0-macOS/rhubarb')
      const { stdout } = await execute(executable, ['-r', 'phonetic', '-f', 'json', '--extendedShapes', 'X', '--threads', '2', '--quiet', input], { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 })
      const result = JSON.parse(stdout)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mouthCues: result.mouthCues }))
    } catch (error) {
      console.error('Rhubarb:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Não foi possível analisar a fala. Verifique a instalação do Rhubarb e tente novamente.' }))
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true })
    }
  }
  return {
    name: 'local-lip-sync',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
