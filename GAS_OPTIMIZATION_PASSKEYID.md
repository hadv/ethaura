# Gas Optimization: Client-Specified PasskeyId

## Problem

In the initial implementation, signature verification looped through all active passkeys to find a match:

```solidity
// O(n) - loops through all passkeys
for (uint256 i = 0; i < passkeyIds.length && !webAuthnValid; i++) {
    PasskeyInfo storage passkeyInfo = passkeys[passkeyIds[i]];
    if (passkeyInfo.active) {
        webAuthnValid = WebAuthn.verify(challenge, true, auth, passkeyInfo.qx, passkeyInfo.qy);
    }
}
```

**Gas Cost:**
- Best case (first passkey): ~100k gas
- Average case (5 passkeys): ~500k gas
- Worst case (10 passkeys): ~1M gas

## Solution

Client specifies which passkey they're using via `passkeyId` parameter in the signature:

```solidity
// O(1) - direct lookup
bytes32 passkeyId = bytes32(sig[sig.length - 97:sig.length - 65]);
PasskeyInfo storage passkeyInfo = passkeys[passkeyId];

if (passkeyInfo.active && passkeyInfo.qx != bytes32(0)) {
    webAuthnValid = WebAuthn.verify(challenge, true, auth, passkeyInfo.qx, passkeyInfo.qy);
}
```

**Gas Cost:**
- All cases: ~100k gas (constant time)

## Signature Format Changes

### validateUserOp (2FA Mode)

**Before (192 bytes minimum):**
```
authDataLen(2) || authenticatorData || clientDataJSON || 
challengeIdx(2) || typeIdx(2) || r(32) || s(32) || ownerSig(65)
```

**After (224 bytes minimum):**
```
authDataLen(2) || authenticatorData || clientDataJSON || 
challengeIdx(2) || typeIdx(2) || r(32) || s(32) || passkeyId(32) || ownerSig(65)
```

### isValidSignature (EIP-1271)

**Optimized Format (96 bytes):**
```
r(32) || s(32) || passkeyId(32)
```
- O(1) direct lookup
- Recommended for production use

**Legacy Format (64 bytes):**
```
r(32) || s(32)
```
- O(n) loop through all passkeys
- Maintained for backward compatibility

## Gas Savings

| Number of Passkeys | Before (worst case) | After | Savings |
|-------------------|---------------------|-------|---------|
| 1                 | ~100k gas           | ~100k | 0       |
| 2                 | ~200k gas           | ~100k | ~100k   |
| 5                 | ~500k gas           | ~100k | ~400k   |
| 10                | ~1M gas             | ~100k | ~900k   |

## Security Considerations

### ✅ Security Maintained

1. **Cannot fake passkeyId**: Signature must still be cryptographically valid for the specified passkey
2. **Existence check**: Contract verifies passkey exists and is active
3. **Same verification**: Uses identical WebAuthn.verify() logic
4. **No bypass**: Invalid passkeyId results in failed verification

### 🔒 Additional Checks

```solidity
// SECURITY: Verify passkey exists and is active
if (passkeyInfo.active && passkeyInfo.qx != bytes32(0)) {
    // Only then verify signature
}
```

## Client Implementation

### How to Calculate PasskeyId

```javascript
// JavaScript/TypeScript
import { keccak256, encodePacked } from 'viem';

const passkeyId = keccak256(encodePacked(['bytes32', 'bytes32'], [qx, qy]));
```

```solidity
// Solidity
bytes32 passkeyId = keccak256(abi.encodePacked(qx, qy));
```

### Building the Signature

```javascript
// 1. Get WebAuthn signature (Solady compact format)
const webAuthnSig = await getWebAuthnSignature(challenge);

// 2. Calculate passkeyId for the passkey being used
const passkeyId = keccak256(encodePacked(['bytes32', 'bytes32'], [qx, qy]));

// 3. Get owner signature
const ownerSig = await wallet.signMessage(userOpHash);

// 4. Concatenate: webAuthnSig || passkeyId || ownerSig
const fullSignature = concat([webAuthnSig, passkeyId, ownerSig]);
```

## Backward Compatibility

### validateUserOp
- **Breaking change**: Requires new 224-byte format with passkeyId
- **Reason**: UserOp validation is always new transactions, no legacy support needed
- **Migration**: Update client SDK to include passkeyId in signatures

### isValidSignature (EIP-1271)
- **Non-breaking**: Supports both 64-byte (legacy) and 96-byte (optimized) formats
- **Reason**: External contracts may use old format
- **Recommendation**: Use 96-byte format for new implementations

## Testing Considerations

### Test Cases to Add

1. **Correct passkeyId**: Signature with valid passkeyId should pass
2. **Wrong passkeyId**: Signature with incorrect passkeyId should fail
3. **Inactive passkey**: Signature with passkeyId of inactive passkey should fail
4. **Non-existent passkeyId**: Signature with random passkeyId should fail
5. **Legacy format**: 64-byte EIP-1271 signature should still work (loops through passkeys)
6. **Optimized format**: 96-byte EIP-1271 signature should work (direct lookup)

## Benefits Summary

✅ **Massive gas savings**: Up to 900k gas saved per transaction
✅ **Predictable costs**: Constant gas regardless of passkey count
✅ **No security trade-offs**: Same cryptographic guarantees
✅ **Backward compatible**: Legacy EIP-1271 format still supported
✅ **Simple client implementation**: Just append passkeyId to signature
✅ **Scales better**: Gas cost doesn't increase with more passkeys

## Implementation Commits

- Initial implementation: ce9596b
- Gas optimization: 511dfca

