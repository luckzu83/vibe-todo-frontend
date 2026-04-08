const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/todos'
).replace(/\/$/, '')

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
  const res = await fetch(API_BASE)
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = await res.json()
  return Array.isArray(data.todos) ? data.todos : []
}

export async function createTodo(title) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function updateTodo(id, updates) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function removeTodo(id) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}
