// Minimal dependency-free CSV parser. Handles quoted fields, escaped quotes,
// commas and newlines inside quotes, and CRLF. Returns array of row objects
// keyed by the header row.
export function parseCSV(text) {
  const rows = []
  let field = ''
  let record = []
  let inQuotes = false
  let i = 0
  const n = text.length

  function endField() {
    record.push(field)
    field = ''
  }
  function endRecord() {
    endField()
    // skip fully-empty trailing lines
    if (record.length > 1 || record[0] !== '') rows.push(record)
    record = []
  }

  while (i < n) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { endField(); i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { endRecord(); i++; continue }
    field += ch; i++
  }
  if (field.length > 0 || record.length > 0) endRecord()

  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const obj = {}
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim() })
    return obj
  })
}
