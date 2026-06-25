import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Serve the api/ Scout reader during `npm run dev` (Vite normally doesn't run
// api/ functions — only Vercel does). This makes the reliable server-side PDF
// read available locally without needing `vercel dev`.
function scoutApiDev() {
  return {
    name: 'scout-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/scout-pdf', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed') }
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          const send = (code, obj) => {
            res.statusCode = code
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
            // native node import (no Vite transform) so pdf.js loads cleanly
            const mod = await import(pathToFileURL(path.resolve('api/scout-pdf.js')).href)
            const mockRes = {
              statusCode: 200,
              status(c) { this.statusCode = c; return this },
              json(o) { send(this.statusCode, o) },
            }
            await mod.default({ method: 'POST', body }, mockRes)
          } catch (e) {
            send(500, { error: e?.message || String(e) })
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), scoutApiDev()],
})
