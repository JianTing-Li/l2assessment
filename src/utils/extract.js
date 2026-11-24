/**
 * Pulling structure out of raw text: reference IDs in a message, several
 * messages from a pasted batch or CSV, and CSV export.
 */

const ID_PATTERNS = [
  // "order #12345", "invoice no. INV-2024-001", "ticket: 88812", "account ID AB12CD"
  /\b(?:order|invoice|ticket|case|account|acct|customer|transaction|ref(?:erence)?)\s*(?:id|no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi,
  // "#12345"
  /(?:^|\s)#(\d{4,})\b/g,
  // "INV-2041", "ORD-55512"
  /\b([A-Z]{2,5}-\d{3,})\b/g,
]

/** Order numbers, invoice numbers and similar IDs mentioned in a message. */
export function extractIds(message) {
  const found = new Set()
  for (const pattern of ID_PATTERNS) {
    for (const match of message.matchAll(pattern)) {
      const id = match[1].replace(/-+$/, '')
      // Skip plain words that slipped through ("account details")
      if (/\d/.test(id)) found.add(id.toUpperCase())
    }
  }
  return [...found].slice(0, 10)
}

export const MAX_BATCH = 50

/** Messages separated by one or more blank lines. */
export function splitBatch(text) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map(part => part.trim())
    .filter(Boolean)
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines in quotes. */
export function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(cell => cell.trim()))
}

const MESSAGE_HEADERS = ['message', 'body', 'text', 'content', 'description', 'customer message']

/**
 * Messages from a CSV file: the column named message/body/text/content,
 * otherwise the first column (treating row 1 as data if it has no header).
 */
export function messagesFromCsv(text) {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  const column = header.findIndex(h => MESSAGE_HEADERS.includes(h))
  const dataRows = column >= 0 ? rows.slice(1) : rows
  const index = column >= 0 ? column : 0
  return dataRows.map(r => (r[index] || '').trim()).filter(Boolean)
}

function csvCell(value) {
  const textValue = Array.isArray(value) ? value.join(' ') : String(value ?? '')
  return /[",\n\r]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue
}

/** CSV text from objects, using the given [header, key or getter] columns. */
export function toCsv(rows, columns) {
  const lines = [columns.map(([header]) => csvCell(header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map(([, get]) => csvCell(typeof get === 'function' ? get(row) : row[get])).join(','))
  }
  return lines.join('\r\n')
}

/** Run an async task over items with at most `limit` running at once. */
export async function runWithLimit(items, limit, task, onDone = () => {}) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index], index)
      onDone(results[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
