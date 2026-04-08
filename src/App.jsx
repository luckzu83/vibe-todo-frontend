import { useCallback, useEffect, useState } from 'react'
import {
  createTodo,
  fetchTodos,
  removeTodo,
  updateTodo,
} from './api/todos'
import './App.css'

function App() {
  const [todos, setTodos] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [listLoading, setListLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [actionError, setActionError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [busyIds, setBusyIds] = useState(() => new Set())

  const withBusy = useCallback(async (id, fn) => {
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      await fn()
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoadError(null)
    setListLoading(true)
    try {
      const list = await fetchTodos()
      setTodos(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  async function handleAdd(e) {
    e.preventDefault()
    setActionError(null)
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const created = await createTodo(trimmed)
      setTodos((prev) => [created, ...prev])
      setNewTitle('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  function handleToggle(todo) {
    setActionError(null)
    const id = todo._id
    void withBusy(id, async () => {
      const updated = await updateTodo(id, { completed: !todo.completed })
      setTodos((prev) =>
        prev.map((t) => (t._id === id ? { ...t, ...updated } : t)),
      )
    }).catch((e) => {
      setActionError(e instanceof Error ? e.message : String(e))
    })
  }

  function startEdit(todo) {
    setActionError(null)
    setEditingId(todo._id)
    setEditDraft(todo.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft('')
  }

  function saveEdit(id) {
    setActionError(null)
    const trimmed = editDraft.trim()
    if (!trimmed) {
      setActionError('제목은 비울 수 없습니다.')
      return
    }
    void withBusy(id, async () => {
      const updated = await updateTodo(id, { title: trimmed })
      setTodos((prev) =>
        prev.map((t) => (t._id === id ? { ...t, ...updated } : t)),
      )
      cancelEdit()
    }).catch((e) => {
      setActionError(e instanceof Error ? e.message : String(e))
    })
  }

  function handleDelete(id) {
    setActionError(null)
    void withBusy(id, async () => {
      await removeTodo(id)
      setTodos((prev) => prev.filter((t) => t._id !== id))
      setEditingId((cur) => {
        if (cur === id) {
          setEditDraft('')
          return null
        }
        return cur
      })
    }).catch((e) => {
      setActionError(e instanceof Error ? e.message : String(e))
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">할 일</h1>
        <p className="app-sub">
          서버:{' '}
          <code className="app-code">
            {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/todos'}
          </code>
        </p>
      </header>

      <form className="add-form" onSubmit={handleAdd}>
        <label className="sr-only" htmlFor="new-todo">
          새 할 일
        </label>
        <input
          id="new-todo"
          className="input"
          type="text"
          placeholder="할 일을 입력하세요"
          maxLength={500}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={adding}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding ? '추가 중…' : '추가'}
        </button>
      </form>

      {actionError ? (
        <p className="banner banner-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {listLoading ? (
        <p className="muted">불러오는 중…</p>
      ) : loadError ? (
        <div className="banner banner-error">
          <p>{loadError}</p>
          <button type="button" className="btn btn-ghost" onClick={loadList}>
            다시 시도
          </button>
        </div>
      ) : todos.length === 0 ? (
        <p className="muted">등록된 할 일이 없습니다.</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => {
            const id = todo._id
            const busy = busyIds.has(id)
            const editing = editingId === id
            return (
              <li key={id} className="todo-item">
                {editing ? (
                  <div className="todo-edit">
                    <label className="sr-only" htmlFor={`edit-${id}`}>
                      제목 수정
                    </label>
                    <input
                      id={`edit-${id}`}
                      className="input input-grow"
                      value={editDraft}
                      maxLength={500}
                      onChange={(e) => setEditDraft(e.target.value)}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                    />
                    <div className="todo-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => saveEdit(id)}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={cancelEdit}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="todo-check">
                      <input
                        type="checkbox"
                        checked={Boolean(todo.completed)}
                        disabled={busy}
                        onChange={() => handleToggle(todo)}
                      />
                      <span
                        className={
                          todo.completed ? 'todo-title done' : 'todo-title'
                        }
                      >
                        {todo.title}
                      </span>
                    </label>
                    <div className="todo-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => startEdit(todo)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => handleDelete(id)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default App
