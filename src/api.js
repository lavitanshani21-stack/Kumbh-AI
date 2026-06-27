// Client for the Express proxy. The browser never sees the API key.
async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `Request failed (${res.status})`)
  }
  return res.json()
}

// candidates: [{ record, score, reasons }]
export const matchPersons = (query, candidates) => post('/api/match', { query, candidates })
export const dedupeRecord = (record, candidates) => post('/api/dedupe', { record, candidates })
export const parseIntake = (text) => post('/api/parse-intake', { text })

export async function getHealth() {
  try {
    const res = await fetch('/api/health')
    return await res.json()
  } catch {
    return { ok: false, claude: false, model: 'offline' }
  }
}
