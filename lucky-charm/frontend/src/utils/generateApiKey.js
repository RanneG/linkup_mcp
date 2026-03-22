/** Generate a demo API key (sk-...). Not for production. */
export function generateApiKey() {
  const prefix = 'sk-'
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let body = ''
  for (let i = 0; i < 32; i++) {
    body += chars[Math.floor(Math.random() * chars.length)]
  }
  return prefix + body
}

export function maskKey(key) {
  if (!key || key.length < 12) return 'sk-...'
  return key.slice(0, 3) + '...' + key.slice(-4)
}
