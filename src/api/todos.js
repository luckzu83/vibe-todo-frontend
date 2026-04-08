function isLoopbackApiUrl(url) {
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
    return false
  }
}

/**
 * 프로덕션: 공개 API URL(VITE) 또는 Vercel 프록시 `/api/todos`
 * VITE에 127.0.0.1/localhost가 박혀 있으면 무시하고 프록시 사용
 */
function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (envUrl) {
    const normalized = envUrl.replace(/\/$/, '')
    if (import.meta.env.PROD && isLoopbackApiUrl(normalized)) {
      return '/api/todos'
    }
    return normalized
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5001/todos'.replace(/\/$/, '')
  }
  return '/api/todos'
}

const API_BASE = resolveApiBase()

export const apiBaseUrl = API_BASE

export function isApiConfigured() {
  return Boolean(API_BASE)
}

export const missingApiUrlMessage =
  'API 주소를 확인할 수 없습니다. Vercel에는 TODO_API_BASE_URL(서버 전용)을 설정하고, 브라우저용 VITE_API_BASE_URL에는 127.0.0.1 대신 공개 HTTPS 주소를 쓰거나 비워 두세요.'

function assertApiBase() {
  if (!API_BASE) {
    throw new Error(
      import.meta.env.PROD ? missingApiUrlMessage : 'API 베이스 URL이 비어 있습니다.',
    )
  }
}

async function readErrorMessage(res) {
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* ignore */
  }
  return text.trim() || res.statusText || '요청에 실패했습니다.'
}

export async function fetchTodos() {
  assertApiBase()
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = await res.json()
  return Array.isArray(data.todos) ? data.todos : []
}

export async function createTodo(title) {
  assertApiBase()
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function updateTodo(id, updates) {
  assertApiBase()
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function removeTodo(id) {
  assertApiBase()
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}
