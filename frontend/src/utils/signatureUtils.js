import { hexToBytes, bytesToHex, concat } from 'viem';

/**
 * Combine P-256 passkey signature with owner ECDSA signature for 2FA
 * @param {Object} passkeySignature - P-256 signature from WebAuthn { r, s }
 * @param {string} ownerSignature - ECDSA signature from Web3Auth wallet (0x-prefixed hex)
 * @returns {string} Combined signature in format: r (32) || s (32) || ownerSig (65) = 129 bytes
 */
export function combineTwoFactorSignatures(passkeySignature, ownerSignature) {
  const { r, s } = passkeySignature;

  // Ensure r and s are 32 bytes each
  const rBytes = hexToBytes(r);
  const sBytes = hexToBytes(s);

  if (rBytes.length !== 32) {
    throw new Error(`Invalid r length: expected 32 bytes, got ${rBytes.length}`);
  }

  if (sBytes.length !== 32) {
    throw new Error(`Invalid s length: expected 32 bytes, got ${sBytes.length}`);
  }

  // Parse owner signature (should be 65 bytes: r + s + v)
  const ownerSigBytes = hexToBytes(ownerSignature);

  if (ownerSigBytes.length !== 65) {
    throw new Error(`Invalid owner signature length: expected 65 bytes, got ${ownerSigBytes.length}`);
  }

  // Combine: P-256 (r + s) + Owner ECDSA (r + s + v)
  const combined = concat([rBytes, sBytes, ownerSigBytes]);

  // Should be 129 bytes total
  if (combined.length !== 129) {
    throw new Error(`Invalid combined signature length: expected 129 bytes, got ${combined.length}`);
  }

  return bytesToHex(combined);
}

/**
 * Create single-factor signature (passkey only) for normal mode
 * @param {Object} passkeySignature - P-256 signature from WebAuthn { r, s }
 * @returns {string} Signature in format: r (32) || s (32) = 64 bytes
 */
export function createSingleFactorSignature(passkeySignature) {
  const { r, s } = passkeySignature;

  // Ensure r and s are 32 bytes each
  const rBytes = hexToBytes(r);
  const sBytes = hexToBytes(s);

  if (rBytes.length !== 32) {
    throw new Error(`Invalid r length: expected 32 bytes, got ${rBytes.length}`);
  }

  if (sBytes.length !== 32) {
    throw new Error(`Invalid s length: expected 32 bytes, got ${sBytes.length}`);
  }

  // Combine: P-256 (r + s)
  const combined = concat([rBytes, sBytes]);

  // Should be 64 bytes total
  if (combined.length !== 64) {
    throw new Error(`Invalid signature length: expected 64 bytes, got ${combined.length}`);
  }

  return bytesToHex(combined);
}

/**
 * Parse ECDSA signature from viem format to r, s, v components
 * @param {string} signature - ECDSA signature (0x-prefixed hex, 65 bytes)
 * @returns {Object} { r, s, v }
 */
export function parseECDSASignature(signature) {
  const sigBytes = hexToBytes(signature);

  if (sigBytes.length !== 65) {
    throw new Error(`Invalid ECDSA signature length: expected 65 bytes, got ${sigBytes.length}`);
  }

  const r = bytesToHex(sigBytes.slice(0, 32));
  const s = bytesToHex(sigBytes.slice(32, 64));
  const v = sigBytes[64];

  return { r, s, v };
}

/**
 * Validate signature format
 * @param {string} signature - Signature to validate
 * @param {boolean} is2FA - Whether this is a 2FA signature
 * @returns {boolean} True if valid
 */
export function validateSignatureFormat(signature, is2FA = false) {
  try {
    const sigBytes = hexToBytes(signature);
    const expectedLength = is2FA ? 129 : 64;

    if (sigBytes.length !== expectedLength) {
      console.error(`Invalid signature length: expected ${expectedLength} bytes, got ${sigBytes.length}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

/**
 * Format signature for display
 * @param {string} signature - Signature to format
 * @returns {string} Formatted signature
 */
export function formatSignatureForDisplay(signature) {
  if (!signature) return 'N/A';

  const sigBytes = hexToBytes(signature);
  const length = sigBytes.length;

  if (length === 64) {
    return `${signature.slice(0, 10)}...${signature.slice(-8)} (64 bytes - Single Factor)`;
  } else if (length === 129) {
    return `${signature.slice(0, 10)}...${signature.slice(-8)} (129 bytes - Two Factor)`;
  } else {
    return `${signature.slice(0, 10)}...${signature.slice(-8)} (${length} bytes)`;
  }
}

