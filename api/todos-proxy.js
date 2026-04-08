/**
 * Vercel Serverless — vercel.json 이 /api/todos → 이 파일로 넘김
 * 환경 변수: TODO_API_BASE_URL (예: https://your-api.com/todos)
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function buildTargetUrl(req, backendBase) {
  const base = backendBase.replace(/\/$/, '')
  const rawPath = req.query.path
  const tail =
    rawPath === undefined || rawPath === null
      ? ''
      : Array.isArray(rawPath)
        ? rawPath.join('/')
        : String(rawPath)
  const segments = tail.split('/').filter(Boolean)
  const suffix = segments.map(encodeURIComponent).join('/')
  const upstreamPath = suffix ? `${base}/${suffix}` : base

  const url = new URL(req.url || '/', 'http://localhost')
  const searchParams = new URLSearchParams(url.search)
  searchParams.delete('path')
  const qs = searchParams.toString()
  return qs ? `${upstreamPath}?${qs}` : upstreamPath
}

export default async function handler(req, res) {
  const backendBase = process.env.TODO_API_BASE_URL?.trim()
  if (!backendBase) {
    res.status(503).json({
      error:
        'TODO_API_BASE_URL is not set. Add it in Vercel Environment Variables (e.g. https://your-api.com/todos).',
    })
    return
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const target = buildTargetUrl(req, backendBase)
  const skipBody = req.method === 'GET' || req.method === 'HEAD'

  const headers = new Headers()
  const ct = req.headers['content-type']
  if (ct) headers.set('content-type', ct)

  /** @type {RequestInit} */
  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
  }

  if (!skipBody) {
    const buf = await readBody(req)
    if (buf.length > 0) init.body = buf
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: `Upstream fetch failed: ${msg}` })
    return
  }

  res.status(upstream.status)
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k.startsWith('access-control-')) return
    if (HOP_BY_HOP.has(k)) return
    res.setHeader(key, value)
  })

  const bodyBuf = Buffer.from(await upstream.arrayBuffer())
  res.send(bodyBuf)
}
