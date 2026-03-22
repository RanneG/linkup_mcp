/**
 * Parse a .tab transcript file and return header + first few rows.
 * Speaker column (index 2) is masked for privacy in preview.
 */
const PREVIEW_LINES = 6
const SPEAKER_COL_INDEX = 2

function parseTabLine(line) {
  const parts = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && c === '\t') {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += c
  }
  if (current.length) parts.push(current.trim())
  return parts
}

export function parseTranscriptPreview(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { header: '', rows: [] }

  const header = lines[0]
  const rows = lines.slice(1, 1 + PREVIEW_LINES).map((line) => {
    const parts = parseTabLine(line)
    if (parts.length > SPEAKER_COL_INDEX) {
      parts[SPEAKER_COL_INDEX] = 'Speaker ●' // mask for privacy
    }
    return parts
  })

  return { header, rows }
}
