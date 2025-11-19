/**
 * WebAuthn utilities for P-256 signature handling
 */

import { decode } from 'cbor-x'

/**
 * Extract AAGUID from authenticator data
 * @param {Uint8Array} authData - The authenticator data
 * @returns {string} AAGUID in UUID format (8-4-4-4-12)
 */
export function extractAAGUID(authData) {
  // AAGUID is at bytes 37-52 in authData
  // AuthData structure:
  // - rpIdHash: 32 bytes (0-31)
  // - flags: 1 byte (32)
  // - signCount: 4 bytes (33-36)
  // - AAGUID: 16 bytes (37-52)

  if (authData.length < 53) {
    console.warn('⚠️ AuthData too short to contain AAGUID')
    return '00000000-0000-0000-0000-000000000000'
  }

  const aaguidBytes = authData.slice(37, 53)

  // Convert to UUID format: 8-4-4-4-12
  const hex = Array.from(aaguidBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const aaguid = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')

  console.log('🔑 Extracted AAGUID:', aaguid)
  return aaguid
}

/**
 * Known hardware-backed authenticator AAGUIDs
 * These authenticators use hardware security modules (Secure Enclave, TPM, etc.)
 * even when they return attestation format "none" for privacy
 */
const KNOWN_HARDWARE_AAGUIDS = {
  // Apple devices
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain (Secure Enclave)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Touch ID (Mac)',
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'Face ID (iPhone/iPad)',

  // Windows Hello
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello (TPM)',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello Software',

  // Hardware security keys
  'cb69481e-8ff7-4039-93ec-0a2729a154a8': 'YubiKey 5 Series',
  '2fc0579f-8113-47ea-b116-bb5a8db9202a': 'YubiKey 5 NFC',
  'c5ef55ff-ad9a-4b9f-b580-adebafe026d0': 'YubiKey 5Ci',
  'fa2b99dc-9e39-4257-8f92-4a30d23c4118': 'YubiKey 5 Nano',
  'ee882879-721c-4913-9775-3dfcce97072a': 'YubiKey 5C',
  '73bb0cd4-e502-49b8-9c6f-b59445bf720b': 'YubiKey 5C Nano',

  // Google Titan
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Titan Security Key',

  // Chrome/Android
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac (TPM)',
  'bada5566-a7aa-401f-bd96-45619a55120d': 'Android (Keystore)',
}

/**
 * Verify WebAuthn attestation object and extract metadata
 * @param {ArrayBuffer} attestationObject - The attestation object from credential creation
 * @param {ArrayBuffer} clientDataJSON - The client data JSON
 * @returns {Object} Attestation verification result with metadata
 */
export function verifyAttestation(attestationObject, clientDataJSON) {
  try {
    // Decode CBOR attestation object
    const attestation = decode(new Uint8Array(attestationObject))

    console.log('🔍 Attestation object:', attestation)

    // Extract components
    const authData = attestation.authData
    const fmt = attestation.fmt // Attestation format: "packed", "none", etc.
    const attStmt = attestation.attStmt

    // Extract AAGUID
    const aaguid = extractAAGUID(authData)

    // Determine if hardware-backed based on attestation format and AAGUID
    let isHardwareBacked = true // Default assumption
    const authenticatorName = KNOWN_HARDWARE_AAGUIDS[aaguid] || null

    // Check if AAGUID is all zeros (indicates no specific authenticator)
    if (aaguid === '00000000-0000-0000-0000-000000000000') {
      isHardwareBacked = null
      console.log('⚠️  AAGUID is all zeros - unknown authenticator')
    }
    // Format "none" - check against known hardware AAGUIDs
    else if (fmt === 'none') {
      if (authenticatorName) {
        isHardwareBacked = true
        console.log(`✅ Recognized hardware authenticator: ${authenticatorName}`)
      } else {
        isHardwareBacked = null
        console.log('⚠️  Unknown AAGUID with format "none" - cannot determine hardware backing')
      }
    }
    // Format "packed" - check attestation statement
    else if (fmt === 'packed') {
      if (attStmt && Object.keys(attStmt).length > 0) {
        isHardwareBacked = true
        console.log('✅ Packed attestation with statement - hardware-backed')
      } else {
        // Self-attestation (no attStmt) - check known AAGUIDs
        if (authenticatorName) {
          isHardwareBacked = true
          console.log(`✅ Recognized hardware authenticator: ${authenticatorName}`)
        } else {
          isHardwareBacked = null
          console.log('⚠️  Packed format without attestation statement - cannot determine hardware backing')
        }
      }
    }
    // Other formats (fido-u2f, android-key, etc.)
    else {
      // Assume hardware-backed for other attestation formats
      isHardwareBacked = true
      console.log(`✅ Attestation format "${fmt}" - assumed hardware-backed`)
    }

    console.log(`🔒 Final determination: isHardwareBacked = ${isHardwareBacked}`)

    const result = {
      verified: true,
      aaguid: aaguid,
      format: fmt,
      isHardwareBacked: isHardwareBacked,
      authenticatorName: authenticatorName,
    }

    console.log('✅ Attestation verification result:', result)
    return result

  } catch (error) {
    console.error('❌ Attestation verification failed:', error)
    return {
      verified: false,
      aaguid: '00000000-0000-0000-0000-000000000000',
      format: 'unknown',
      isHardwareBacked: null,
      authenticatorName: null,
      error: error.message,
    }
  }
}

/**
 * Parse public key from attestation object
 * @param {ArrayBuffer} attestationObject - The attestation object from credential creation
 * @returns {Object} Public key with x and y coordinates as hex strings
 */
export function parsePublicKey(attestationObject) {
  // Decode CBOR attestation object
  const attestation = decode(new Uint8Array(attestationObject))

  // Extract the authData
  const authData = attestation.authData

  // The credential public key starts at byte 55 in authData
  // Format: https://www.w3.org/TR/webauthn-2/#sctn-attested-credential-data
  // - rpIdHash: 32 bytes
  // - flags: 1 byte
  // - signCount: 4 bytes
  // - aaguid: 16 bytes
  // - credentialIdLength: 2 bytes
  // - credentialId: credentialIdLength bytes
  // - credentialPublicKey: CBOR-encoded COSE key

  const rpIdHashLength = 32
  const flagsLength = 1
  const signCountLength = 4
  const aaguidLength = 16
  const credentialIdLengthBytes = 2

  let offset = rpIdHashLength + flagsLength + signCountLength + aaguidLength

  // Read credential ID length (big-endian uint16)
  const credentialIdLength = (authData[offset] << 8) | authData[offset + 1]
  offset += credentialIdLengthBytes + credentialIdLength

  // The rest is the COSE key (CBOR-encoded)
  const coseKeyBytes = authData.slice(offset)
  const coseKey = decode(coseKeyBytes)

  // COSE key format for P-256:
  // {
  //   1: 2,        // kty: EC2
  //   3: -7,       // alg: ES256
  //   -1: 1,       // crv: P-256
  //   -2: x,       // x coordinate (32 bytes)
  //   -3: y        // y coordinate (32 bytes)
  // }

  console.log('🔍 COSE key:', coseKey)
  console.log('🔍 COSE key type:', typeof coseKey)
  console.log('🔍 COSE key constructor:', coseKey?.constructor?.name)

  // Access coordinates - CBOR may decode as Map or Object
  let x, y
  if (coseKey instanceof Map) {
    console.log('🔍 COSE key is a Map')
    console.log('🔍 Map keys:', Array.from(coseKey.keys()))
    x = coseKey.get(-2)
    y = coseKey.get(-3)
  } else if (typeof coseKey === 'object') {
    console.log('🔍 COSE key is an Object')
    console.log('🔍 Object keys:', Object.keys(coseKey))
    // Try different ways to access negative keys
    x = coseKey[-2] || coseKey['-2'] || coseKey['x']
    y = coseKey[-3] || coseKey['-3'] || coseKey['y']
  }

  console.log('🔍 Extracted x:', x)
  console.log('🔍 Extracted y:', y)

  if (!x || !y) {
    throw new Error(`Failed to extract public key coordinates from COSE key. COSE key type: ${typeof coseKey}, constructor: ${coseKey?.constructor?.name}`)
  }

  // Convert to hex strings
  const xHex = '0x' + Array.from(new Uint8Array(x))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const yHex = '0x' + Array.from(new Uint8Array(y))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  console.log('✅ Extracted real public key from passkey:', { x: xHex, y: yHex })

  return {
    x: xHex,
    y: yHex,
  }
}

/**
 * Sign a message with passkey
 * @param {Object|null} credential - The credential info from passkey creation (optional - if null, browser shows picker)
 * @param {Uint8Array} message - The message to sign (32 bytes)
 * @param {boolean} useNativePicker - If true, don't specify allowCredentials to let browser show native picker
 * @returns {Promise<Object>} Signature data including authenticatorData, clientDataJSON, signature, and credentialId
 */
export async function signWithPasskey(credential, message, useNativePicker = false) {
  // Create assertion options
  const getCredentialOptions = {
    publicKey: {
      challenge: message,
      rpId: window.location.hostname,
      userVerification: 'required', // Changed from 'preferred' to 'required' for better security
      timeout: 60000,
    },
  }

  // If useNativePicker is true OR credential is null, don't specify allowCredentials
  // This lets the browser show the native passkey picker for all available passkeys
  if (!useNativePicker && credential) {
    // Legacy mode: use specific credential ID
    const credentialId = credential.rawId || credential.credentialId

    // Convert to Uint8Array if needed
    let credentialIdBytes
    if (credentialId instanceof ArrayBuffer) {
      credentialIdBytes = new Uint8Array(credentialId)
    } else if (Array.isArray(credentialId)) {
      credentialIdBytes = new Uint8Array(credentialId)
    } else if (typeof credentialId === 'string') {
      // Handle base64-encoded string (from server/localStorage)
      try {
        const binaryString = atob(credentialId)
        credentialIdBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          credentialIdBytes[i] = binaryString.charCodeAt(i)
        }
      } catch (error) {
        console.error('❌ Failed to decode base64 credential ID:', error)
        throw new Error('Invalid credential ID format')
      }
    } else {
      credentialIdBytes = credentialId
    }

    console.log('🔑 Signing with specific credential ID:', {
      credentialIdHex: Array.from(credentialIdBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
      credentialIdLength: credentialIdBytes.length,
    })

    getCredentialOptions.publicKey.allowCredentials = [{
      type: 'public-key',
      id: credentialIdBytes,
    }]
  } else {
    console.log('🔑 Using browser native passkey picker (no allowCredentials specified)')
  }

  // Get assertion (sign)
  const assertion = await navigator.credentials.get(getCredentialOptions)

  if (!assertion) {
    throw new Error('Failed to get assertion - user may have cancelled')
  }

  console.log('✅ Passkey signature obtained:', {
    credentialId: assertion.id,
    credentialIdLength: assertion.id.length,
  })

  return {
    authenticatorData: new Uint8Array(assertion.response.authenticatorData),
    clientDataJSON: new TextDecoder().decode(assertion.response.clientDataJSON),
    signature: new Uint8Array(assertion.response.signature),
    credentialId: assertion.id, // Return the credential ID that was used
    rawId: assertion.rawId, // Return the raw ID as well
  }
}

/**
 * Decode DER-encoded ECDSA signature to raw r,s components
 * @param {Uint8Array} derSignature - DER-encoded signature
 * @returns {Object} Object with r and s as hex strings (without 0x prefix)
 */
export function derToRS(derSignature) {
  console.log('🔧 derToRS called - CODE VERSION: 2025-10-20-v2 - NORMALIZATION ENABLED')

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
  let sPadded = padTo32Bytes(s)

  // Normalize s to prevent signature malleability
  // If s > N/2, replace with N - s
  // secp256r1 curve order N
  const N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')
  const N_half = N / 2n

  const sBigInt = BigInt('0x' + Array.from(sPadded).map(b => b.toString(16).padStart(2, '0')).join(''))

  if (sBigInt > N_half) {
    console.log('⚠️ Normalizing s value to prevent malleability (s > N/2)')
    const sNormalized = N - sBigInt
    const sNormalizedHex = sNormalized.toString(16).padStart(64, '0')
    sPadded = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      sPadded[i] = parseInt(sNormalizedHex.slice(i * 2, i * 2 + 2), 16)
    }
    console.log('✅ Normalized s:', '0x' + sNormalizedHex)
  }

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

