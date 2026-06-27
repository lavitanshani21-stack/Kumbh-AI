// Display + privacy helpers. Privacy by design: we minimize what we render and
// mask contact details by default.

export function maskMobile(m) {
  if (!m) return '—'
  // keep country code + last 2 digits, mask the middle: +91 98xxxxxx21
  const digits = m.replace(/\D/g, '')
  if (digits.length < 6) return '••••'
  const cc = m.startsWith('+') ? '+' + digits.slice(0, 2) + ' ' : ''
  const rest = digits.slice(m.startsWith('+') ? 2 : 0)
  return cc + rest.slice(0, 2) + 'x'.repeat(Math.max(0, rest.length - 4)) + rest.slice(-2)
}

export function displayName(n) {
  return n && n.trim() ? n.trim() : 'Name not given'
}

export function ageEmoji(band) {
  if (band === '0-12' || band === '13-17') return '🧒'
  if (band === '61-70' || band === '71-80' || band === '80+') return '🧓'
  return '🧑'
}

export function statusColor(status) {
  switch (status) {
    case 'Reunited': return 'var(--low)'
    case 'Pending': return 'var(--high)'
    case 'Transferred to hospital': return 'var(--accent)'
    case 'Unresolved': return 'var(--crit)'
    default: return 'var(--muted)'
  }
}

export function fmtWhen(s) {
  if (!s) return '—'
  return s.replace('T', ' ').slice(0, 16)
}

export function hoursAgo(s) {
  const t = Date.parse((s || '').replace(' ', 'T'))
  if (Number.isNaN(t)) return null
  return Math.max(0, (Date.now() - t) / 3.6e6)
}
