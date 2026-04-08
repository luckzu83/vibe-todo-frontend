/**
 * Vercel Serverless — vercel.json 이 /api/todos → 이 파일로 넘김
 *
 * 백엔드 베이스(…/todos 까지)는 아래 순서로 찾습니다. localhost/127.0.0.1 은 무시합니다.
 * TODO_API_BASE_URL → TODOS_API_BASE_URL → API_BASE_URL → VITE_API_BASE_URL
 * (Vercel은 빌드용 VITE_* 도 서버리스 런타임에 주입하므로, 공개 URL만 넣었다면 재사용됩니다.)
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

function isLoopbackUrl(url) {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '[::1]'
    )
  } catch {
    return true
  }
}

function resolveBackendBase() {
  const keys = [
    'TODO_API_BASE_URL',
    'TODOS_API_BASE_URL',
    'API_BASE_URL',
    'VITE_API_BASE_URL',
  ]
  for (const key of keys) {
    const raw = process.env[key]?.trim()
    if (!raw) continue
    const normalized = raw.replace(/\/$/, '')
    if (isLoopbackUrl(normalized)) continue
    return normalized
  }
  return ''
}

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
  const backendBase = resolveBackendBase()
  if (!backendBase) {
    res.status(503).json({
      error:
        '백엔드 API 주소가 설정되지 않았습니다. Vercel → Settings → Environment Variables 에 다음 중 하나를 추가하세요: TODO_API_BASE_URL (권장) 또는 공개 HTTPS 주소가 들어 있는 VITE_API_BASE_URL. 값 예: https://your-api.onrender.com/todos — localhost·127.0.0.1 은 Vercel 서버에서 접근할 수 없습니다.',
      errorEn:
        'Set TODO_API_BASE_URL (or a public VITE_API_BASE_URL) in Vercel env to your API base ending in /todos. Redeploy after saving.',
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
