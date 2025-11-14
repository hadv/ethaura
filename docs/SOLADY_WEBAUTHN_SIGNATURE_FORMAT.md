# Solady WebAuthn Signature Format

## Overview

EthAura has migrated from a custom WebAuthn implementation to **Solady's battle-tested WebAuthn library**. This brings significant security improvements including authenticator flags validation and type field verification.

## Signature Formats

### Owner-Only Signature (No Passkey)

For accounts that use only the owner address (Web3Auth wallet) without passkey authentication:

```
Format: ownerSig(65)
Size: 65 bytes
```

**Components:**
- `ownerSig`: ECDSA signature from Web3Auth wallet (r + s + v)

### Passkey Signature (Solady WebAuthn Compact Encoding)

For accounts using passkey authentication with optional 2FA:

```
Format: authDataLen(2) || authenticatorData || clientDataJSON || challengeIdx(2) || typeIdx(2) || r(32) || s(32) [|| ownerSig(65)]
Typical Size: ~286+ bytes (with 2FA), ~221+ bytes (passkey only)
```

**Components:**
1. `authDataLen` (2 bytes): Length of authenticatorData as uint16 big-endian
2. `authenticatorData` (37+ bytes): WebAuthn authenticator data including:
   - RP ID hash (32 bytes)
   - Flags (1 byte): User Present (UP) and User Verified (UV) bits
   - Counter (4 bytes)
3. `clientDataJSON` (87+ bytes): JSON string containing challenge and type
4. `challengeIdx` (2 bytes): Index of "challenge" field in clientDataJSON
5. `typeIdx` (2 bytes): Index of "type" field in clientDataJSON
6. `r` (32 bytes): P-256 signature r component
7. `s` (32 bytes): P-256 signature s component
8. `ownerSig` (65 bytes, optional): ECDSA signature from owner for 2FA

## Security Improvements

### What Solady's WebAuthn Adds

1. **Authenticator Flags Validation**
   - ✅ User Present (UP) flag verification
   - ✅ User Verified (UV) flag verification (enforced)

2. **Type Field Verification**
   - ✅ Ensures `"type":"webauthn.get"` is present in clientDataJSON
   - ✅ Prevents signature replay from registration flows

3. **Challenge Verification**
   - ✅ Base64url encoding validation
   - ✅ Proper JSON parsing with index-based verification

4. **Battle-Tested Code**
   - ✅ Used by Daimo and Coinbase
   - ✅ Audited by Cantina and Spearbit
   - ✅ Optimized assembly implementation

### What the Old Implementation Was Missing

- ❌ No User Present (UP) flag check
- ❌ No User Verified (UV) flag check
- ❌ No type field verification
- ❌ Less robust JSON parsing

## Gas Costs

| Signature Type | Size | Verification Gas | Notes |
|----------------|------|------------------|-------|
| Owner-Only | 65 bytes | ~10,895 gas | Web3Auth wallet only |
| Passkey + 2FA | ~286 bytes | ~22,105 gas | Passkey + Web3Auth (maximum security) |

**Additional cost for 2FA:** ~11,210 gas (~103% increase) - acceptable for the security benefits!

## Implementation

### Frontend (userOperation.js)

The signature encoding is handled by `signUserOperation()`:

```javascript
export function signUserOperation(userOp, passkeySignature, ownerSignature = null) {
  const { r, s, authenticatorData, clientDataJSON } = passkeySignature

  // Find indices
  const challengeIndex = clientDataJSON.indexOf('"challenge":"')
  const typeIndex = clientDataJSON.indexOf('"type":"')

  // Encode in Solady compact format
  const signature = abi.encodePacked(
    authDataLen,
    authenticatorData,
    clientDataJSON,
    challengeIndex,
    typeIndex,
    r,
    s,
    ownerSignature // Optional for 2FA
  )

  return { ...userOp, signature }
}
```

### Smart Contract (P256Account.sol)

The signature verification uses Solady's WebAuthn library:

```solidity
// Extract WebAuthn compact signature
bytes calldata webAuthnSig = sig[:sig.length - 65];

// Decode using Solady
WebAuthn.WebAuthnAuth memory auth = WebAuthn.tryDecodeAuthCompactCalldata(webAuthnSig);

// Verify with Solady
bool webAuthnValid = WebAuthn.verify(
    challenge,
    true, // requireUserVerification - enforce UV flag
    auth,
    _qx,
    _qy
);
```

## Migration Notes

### Breaking Changes

1. **Signature format changed** - Frontend must use new Solady compact encoding
2. **Minimum signature length** - Changed from 190 bytes to 192+ bytes
3. **User Verification enforced** - UV flag must be set in authenticatorData

### Backward Compatibility

- Old signatures will **NOT** work with the new contract
- Accounts must be redeployed or upgraded to use new format
- Frontend must be updated to encode signatures correctly

## References

- [Solady WebAuthn](https://github.com/vectorized/solady/blob/main/src/utils/WebAuthn.sol)
- [Solady Audits](https://github.com/vectorized/solady/tree/main/audits)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-2/)
- [EIP-7212: P256 Precompile](https://eips.ethereum.org/EIPS/eip-7212)

