/**
 * WebAuthn utilities for P-256 signature handling
 */

/**
 * Parse public key from attestation object
 * @param {ArrayBuffer} attestationObject - The attestation object from credential creation
 * @returns {Object} Public key with x and y coordinates as hex strings
 */
export function parsePublicKey(attestationObject) {
  // Decode CBOR attestation object
  const attestationBuffer = new Uint8Array(attestationObject)
  
  // This is a simplified parser - in production use a proper CBOR library
  // For demo purposes, we'll generate mock coordinates
  // In real implementation, parse the COSE key from attestationObject
  
  // Mock P-256 public key (in production, extract from attestationObject)
  const x = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  const y = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return {
    x: '0x' + x,
    y: '0x' + y,
  }
}

/**
 * Sign a message with passkey
 * @param {Object} credential - The credential info from passkey creation
 * @param {Uint8Array} message - The message to sign (32 bytes)
 * @returns {Promise<Object>} Signature data including authenticatorData, clientDataJSON, and signature
 */
export async function signWithPasskey(credential, message) {
  // Create assertion options
  const getCredentialOptions = {
    publicKey: {
      challenge: message,
      rpId: window.location.hostname,
      allowCredentials: [{
        type: 'public-key',
        id: new Uint8Array(credential.credentialId),
      }],
      userVerification: 'preferred',
      timeout: 60000,
    },
  }

  // Get assertion (sign)
  const assertion = await navigator.credentials.get(getCredentialOptions)

  if (!assertion) {
    throw new Error('Failed to get assertion')
  }

  return {
    authenticatorData: new Uint8Array(assertion.response.authenticatorData),
    clientDataJSON: new TextDecoder().decode(assertion.response.clientDataJSON),
    signature: new Uint8Array(assertion.response.signature),
  }
}

/**
 * Decode DER-encoded ECDSA signature to raw r,s components
 * @param {Uint8Array} derSignature - DER-encoded signature
 * @returns {Object} Object with r and s as hex strings (without 0x prefix)
 */
export function derToRS(derSignature) {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  
  let offset = 0
  
  // Check sequence tag
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: missing sequence tag')
  }
  
  // Skip total length
  offset++
  
  // Check integer tag for r
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing r integer tag')
  }
  
  // Get r length
  let rLength = derSignature[offset++]
  
  // Extract r (skip leading zero if present)
  let rOffset = offset
  if (derSignature[rOffset] === 0x00) {
    rOffset++
    rLength--
  }
  
  const r = derSignature.slice(rOffset, rOffset + rLength)
  offset = rOffset + rLength
  
  // Check integer tag for s
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing s integer tag')
  }
  
  // Get s length
  let sLength = derSignature[offset++]
  
  // Extract s (skip leading zero if present)
  let sOffset = offset
  if (derSignature[sOffset] === 0x00) {
    sOffset++
    sLength--
  }
  
  const s = derSignature.slice(sOffset, sOffset + sLength)
  
  // Pad to 32 bytes if needed
  const rPadded = padTo32Bytes(r)
  const sPadded = padTo32Bytes(s)
  
  return {
    r: Array.from(rPadded).map(b => b.toString(16).padStart(2, '0')).join(''),
    s: Array.from(sPadded).map(b => b.toString(16).padStart(2, '0')).join(''),
  }
}

/**
 * Pad byte array to 32 bytes
 * @param {Uint8Array} bytes - Input bytes
 * @returns {Uint8Array} Padded bytes
 */
function padTo32Bytes(bytes) {
  if (bytes.length === 32) {
    return bytes
  }
  
  if (bytes.length > 32) {
    // Should not happen for P-256, but handle it
    return bytes.slice(bytes.length - 32)
  }
  
  // Pad with leading zeros
  const padded = new Uint8Array(32)
  padded.set(bytes, 32 - bytes.length)
  return padded
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string (with or without 0x prefix)
 * @returns {Uint8Array} Byte array
 */
export function hexToBytes(hex) {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
  }
  
  return bytes
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Hex string with 0x prefix
 */
export function bytesToHex(bytes) {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Compute SHA-256 hash
 * @param {Uint8Array} data - Data to hash
 * @returns {Promise<Uint8Array>} Hash
 */
export async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hashBuffer)
}

/**
 * Verify WebAuthn signature format
 * @param {Object} signatureData - Signature data from signWithPasskey
 * @returns {boolean} True if format is valid
 */
export function verifySignatureFormat(signatureData) {
  const { authenticatorData, clientDataJSON, signature } = signatureData
  
  // Check authenticatorData is at least 37 bytes
  if (authenticatorData.length < 37) {
    return false
  }
  
  // Check clientDataJSON is valid JSON
  try {
    JSON.parse(clientDataJSON)
  } catch {
    return false
  }
  
  // Check signature is DER-encoded (starts with 0x30)
  if (signature[0] !== 0x30) {
    return false
  }
  
  return true
}

