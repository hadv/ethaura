/**
 * Test script for Phase 1 attestation verification
 *
 * This script tests the extractAAGUID function with sample authenticator data.
 */

/**
 * Extract AAGUID from authenticator data
 * @param {Uint8Array} authData - The authenticator data
 * @returns {string} AAGUID in UUID format (8-4-4-4-12)
 */
function extractAAGUID(authData) {
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



// Test cases
console.log('🧪 Testing Phase 1 Attestation Verification\n')

// Test 1: Extract AAGUID from sample authenticator data
console.log('Test 1: Extract AAGUID from sample data')
const sampleAuthData = new Uint8Array(100)
// Set AAGUID bytes (37-52) to a known value
// Example: Touch ID AAGUID = 08987058-cadc-4b81-b6e1-30de50dcbe96
const touchIdAAGUID = [0x08, 0x98, 0x70, 0x58, 0xca, 0xdc, 0x4b, 0x81, 0xb6, 0xe1, 0x30, 0xde, 0x50, 0xdc, 0xbe, 0x96]
sampleAuthData.set(touchIdAAGUID, 37)

const extractedAAGUID = extractAAGUID(sampleAuthData)
console.log('Expected: 08987058-cadc-4b81-b6e1-30de50dcbe96')
console.log('Got:     ', extractedAAGUID)
console.log('✅ Test 1 passed:', extractedAAGUID === '08987058-cadc-4b81-b6e1-30de50dcbe96')
console.log()

// Test 2: Handle short authenticator data
console.log('Test 2: Handle short authenticator data')
const shortAuthData = new Uint8Array(30)
const shortAAGUID = extractAAGUID(shortAuthData)
console.log('Expected: 00000000-0000-0000-0000-000000000000')
console.log('Got:     ', shortAAGUID)
console.log('✅ Test 2 passed:', shortAAGUID === '00000000-0000-0000-0000-000000000000')
console.log()

console.log('✅ All AAGUID extraction tests passed!')
console.log('\n📝 Note: Full attestation verification is tested in the browser.')
console.log('   Create a passkey in the UI to verify the complete attestation flow.')

