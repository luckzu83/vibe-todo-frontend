function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (envUrl) return envUrl.replace(/\/$/, '')
  if (import.meta.env.DEV) return 'http://localhost:5001/todos'.replace(/\/$/, '')
  return ''
}

const API_BASE = resolveApiBase()

export const apiBaseUrl = API_BASE

export function isApiConfigured() {
  return Boolean(API_BASE)
}

export const missingApiUrlMessage =
  '배포 환경에서 API 주소가 없습니다. Vercel(또는 호스팅) 환경 변수에 VITE_API_BASE_URL을 설정하세요. 예: https://api.example.com/todos — 127.0.0.1·localhost는 방문자 본인 PC를 가리키므로 배포 사이트에서는 동작하지 않습니다.'

function assertApiBase() {
  if (!API_BASE) {
    throw new Error(
      import.meta.env.PROD ? missingApiUrlMessage : 'VITE_API_BASE_URL이 비어 있습니다.',
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
