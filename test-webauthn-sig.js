/**
 * Test script to verify WebAuthn signature format
 * Run with: node test-webauthn-sig.js
 */

import crypto from 'crypto'

// Real data from your console logs
const r = '0xf12c42a78f0efa2d3ad69dbede63603389dc1ba944d300b087ea1cd195b98ba6'
const s = '0xa96e19599f04290a77fc7e4ce8ef8b3dc9d3b0a6f77c74c90d96e673b6434ede'
const authenticatorDataHex = '49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000'
const clientDataJSON = '{"type":"webauthn.get","challenge":"xk3SGdn5s_QE8zuWN3Yn33G81_DI7oLsdqO8RGwthSo","origin":"http://localhost:3000","crossOrigin":false}'

// Public key from factoryData
const qx = '0xcd64d312c53f5d6773debcfe7031bd1074d9082b072cc71ca0fffab2735a5ec1'
const qy = '0x8e657ad708338e9021127ae67e90f98875342d4d6c38d5f90ff7cf1841669f13'

// Convert to bytes
const authenticatorData = Buffer.from(authenticatorDataHex, 'hex')
const clientDataBytes = Buffer.from(clientDataJSON, 'utf8')

// Compute what WebAuthn signs
const clientDataHash = crypto.createHash('sha256').update(clientDataBytes).digest()
const messageHash = crypto.createHash('sha256').update(Buffer.concat([authenticatorData, clientDataHash])).digest()

console.log('=== WebAuthn Signature Verification ===\n')
console.log('Public Key:')
console.log('  qx:', qx)
console.log('  qy:', qy)
console.log('\nSignature:')
console.log('  r:', r)
console.log('  s:', s)
console.log('\nWebAuthn Data:')
console.log('  authenticatorData:', authenticatorDataHex)
console.log('  authenticatorData length:', authenticatorData.length, 'bytes')
console.log('  clientDataJSON:', clientDataJSON)
console.log('  clientDataJSON length:', clientDataBytes.length, 'bytes')
console.log('\nHashes:')
console.log('  clientDataHash:', '0x' + clientDataHash.toString('hex'))
console.log('  messageHash (what was signed):', '0x' + messageHash.toString('hex'))

// Build signature as contract expects
const authDataLen = authenticatorData.length
const authDataLenHex = authDataLen.toString(16).padStart(4, '0')

const rClean = r.startsWith('0x') ? r.slice(2) : r
const sClean = s.startsWith('0x') ? s.slice(2) : s

const signature = '0x' + rClean + sClean + authDataLenHex + authenticatorDataHex + Buffer.from(clientDataJSON, 'utf8').toString('hex')

console.log('\n=== Signature Format ===')
console.log('Total signature length:', signature.length / 2 - 1, 'bytes')
console.log('Breakdown:')
console.log('  r:', rClean.length / 2, 'bytes')
console.log('  s:', sClean.length / 2, 'bytes')
console.log('  authDataLen:', authDataLenHex, '=', authDataLen, 'bytes')
console.log('  authenticatorData:', authenticatorData.length, 'bytes')
console.log('  clientDataJSON:', clientDataBytes.length, 'bytes')
console.log('\nFull signature:', signature.slice(0, 100) + '...')

// Decode the challenge from clientDataJSON
const challengeMatch = clientDataJSON.match(/"challenge":"([^"]+)"/)
if (challengeMatch) {
  const challengeB64 = challengeMatch[1]
  console.log('\n=== Challenge ===')
  console.log('Base64url challenge:', challengeB64)

  // Decode base64url
  const challengeB64Padded = challengeB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(challengeB64.length + (4 - challengeB64.length % 4) % 4, '=')
  const challengeBytes = Buffer.from(challengeB64Padded, 'base64')
  console.log('Decoded challenge (hex):', '0x' + challengeBytes.toString('hex'))
  console.log('Decoded challenge length:', challengeBytes.length, 'bytes')
}

