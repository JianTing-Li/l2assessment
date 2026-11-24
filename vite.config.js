import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { runTriage, sendAlert } from './server/triage.js'

// Serves the same /api routes as the Vercel functions in api/, so `npm run dev`
// and `npm run preview` work without the Vercel CLI. Env vars come from .env.local.
function apiRoutes(env) {
  const routes = { '/api/triage': runTriage, '/api/alert': sendAlert }

  const middleware = async (req, res, next) => {
    const route = routes[req.url?.split('?')[0]]
    if (!route) return next()

    const send = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') return send(405, { error: 'method_not_allowed' })

    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 100_000) return send(413, { error: 'body_too_large' })
    }
    let input
    try {
      input = raw ? JSON.parse(raw) : {}
    } catch {
      return send(400, { error: 'invalid_json' })
    }
    const { status, body } = await route(input, env)
    send(status, body)
  }

  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  return {
    plugins: [react(), apiRoutes(env)],
  }
})
