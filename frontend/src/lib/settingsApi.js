// Simple API client for user RPC configuration

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function buildAuthPayload(ownerAddress, signature, message, timestamp) {
  return {
    userId: ownerAddress.toLowerCase(), // We use owner address as user-level id
    ownerAddress: ownerAddress.toLowerCase(),
    signature,
    message,
    timestamp,
  }
}

async function signAuth(ownerAddress, signMessage) {
  const timestamp = Date.now()
  const message = `EthAura RPC config auth\nOwner: ${ownerAddress}\nTimestamp: ${timestamp}`
  const signature = await signMessage(message)
  return buildAuthPayload(ownerAddress, signature, message, timestamp)
}

export async function fetchRpcConfigs(ownerAddress, signMessage) {
  const { ownerAddress: addr, signature, message, timestamp } = await signAuth(ownerAddress, signMessage)
  const url = new URL(`${API_BASE}/api/rpc-config/${addr}`)
  url.searchParams.set('ownerAddress', addr)
  url.searchParams.set('signature', signature)
  url.searchParams.set('message', message)
  url.searchParams.set('timestamp', String(timestamp))

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch RPC configs (${res.status}): ${text}`)
  }
  return res.json()
}

export async function saveRpcConfig(ownerAddress, chainId, rpcUrl, signMessage) {
  const auth = await signAuth(ownerAddress, signMessage)
  const res = await fetch(`${API_BASE}/api/rpc-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, chainId, rpcUrl }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to save RPC config (${res.status}): ${text}`)
  }
  return res.json()
}

export async function clearRpcConfig(ownerAddress, chainId, signMessage) {
  const auth = await signAuth(ownerAddress, signMessage)
  const res = await fetch(`${API_BASE}/api/rpc-config`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, chainId }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to delete RPC config (${res.status}): ${text}`)
  }
  return res.json()
}

