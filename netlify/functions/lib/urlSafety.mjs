const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

function isPrivateIPv4(host) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(host))
}

function isPrivateIPv6(host) {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase()

  if (normalized === '::1' || normalized === '::') return true

  const mapped = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mapped) {
    const n1 = parseInt(mapped[1], 16)
    const n2 = parseInt(mapped[2], 16)
    const ipv4 = [n1 >> 8, n1 & 0xff, n2 >> 8, n2 & 0xff].join('.')
    return isPrivateIPv4(ipv4)
  }

  if (/^fe80:/.test(normalized)) return true
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true

  return false
}

export function isUrlAllowed(urlString) {
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  if (hostname === 'localhost') return false
  if (hostname.includes(':')) return !isPrivateIPv6(hostname)
  return !isPrivateIPv4(hostname)
}
