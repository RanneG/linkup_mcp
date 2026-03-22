/**
 * Wallet-based auth (MetaMask, Coinbase, etc.) — no email/password.
 * Mirrors autonomi wallet-connect.js pattern.
 */

const DOMAIN = 'lucky-charm'

/**
 * Detect injected EIP-1193 provider. Returns { provider, walletName } or null.
 */
export function getProvider() {
  const ethereum = typeof window !== 'undefined' && window.ethereum
  if (!ethereum) return null
  if (!ethereum.providers) {
    return { provider: ethereum, walletName: getWalletName(ethereum) }
  }
  const providers = ethereum.providers
  const metaMask = providers.find((p) => p.isMetaMask && !p.isRabby)
  const coinbase = providers.find((p) => p.isCoinbaseWallet)
  const rabby = providers.find((p) => p.isRabby)
  const chosen = metaMask || coinbase || rabby || providers[0]
  return { provider: chosen, walletName: getWalletName(chosen) }
}

function getWalletName(provider) {
  if (!provider) return 'Wallet'
  if (provider.isMetaMask && provider.isRabby) return 'Rabby'
  if (provider.isMetaMask) return 'MetaMask'
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet'
  if (provider.isBraveWallet) return 'Brave Wallet'
  if (provider.isRabby) return 'Rabby'
  if (provider.isPhantom) return 'Phantom'
  if (provider.isTrust) return 'Trust Wallet'
  if (provider.isRainbow) return 'Rainbow'
  return provider.provider?.name || provider.name || 'Web3'
}

/**
 * Connect wallet — eth_requestAccounts. Returns address or throws.
 */
export async function connectWallet() {
  const info = getProvider()
  if (!info) {
    throw new Error('No Web3 wallet found. Install MetaMask or Coinbase Wallet.')
  }
  const accounts = await info.provider.request({ method: 'eth_requestAccounts' })
  if (!accounts?.[0]) throw new Error('No account selected')
  return accounts[0]
}

/**
 * Sign a message with the connected wallet (optional proof of ownership).
 */
export async function signMessage(address, message) {
  const info = getProvider()
  if (!info || !address || !message) {
    throw new Error('Wallet not available')
  }
  return info.provider.request({
    method: 'personal_sign',
    params: [message, address],
  })
}

/**
 * Derive opaque participant ID from wallet address (SHA-256 for privacy/unlinkability).
 */
export async function deriveParticipantIdFromAddress(address) {
  const normalized = (address || '').toLowerCase().replace(/^0x/, '')
  if (!normalized || normalized.length !== 40) return null
  const input = `${DOMAIN}:${normalized}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `wallet_${hex.slice(0, 48)}`
}

/**
 * Generate one-time nullifier for wallet mode (client-side, no SSO).
 */
export async function generateClientNullifier(participantId) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const input = `${participantId}:${Date.now()}:${rand}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function truncateAddress(address) {
  if (!address || address.length < 10) return address || '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
