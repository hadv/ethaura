# Two-Factor Authentication (2FA) for P256Account

> **⚠️ IMPORTANT:** This document describes the 2FA concept. The signature format has been updated to use Solady's WebAuthn library. For the latest signature format details, see [SOLADY_WEBAUTHN_SIGNATURE_FORMAT.md](./SOLADY_WEBAUTHN_SIGNATURE_FORMAT.md)

## 🔐 Overview

P256Account supports **optional Two-Factor Authentication (2FA)** mode, where transactions require **both** signatures:
1. **P-256 Passkey Signature** (biometric: Touch ID, Face ID, Windows Hello)
2. **Owner ECDSA Signature** (from owner's private key: MetaMask, hardware wallet, etc.)

This provides an additional layer of security for high-value transactions while maintaining the convenience of passkey authentication.

---

## 🎯 Use Cases

### ✅ When to Enable 2FA

- **High-value accounts**: Wallets holding significant assets
- **Corporate accounts**: Multi-stakeholder approval required
- **Compliance requirements**: Regulatory requirements for dual authorization
- **Shared devices**: When passkey device might be accessible to others
- **Extra security**: Peace of mind for critical operations

### ❌ When NOT to Enable 2FA

- **Daily transactions**: Frequent small transactions where convenience matters
- **Single-user accounts**: When you fully control both passkey and owner key
- **Testing/development**: During development and testing phases

---

## 🏗️ Architecture

### Storage

```solidity
bool public twoFactorEnabled;  // Toggle 2FA mode
```

### Signature Format

**Normal Mode (2FA disabled):**
```
signature = r (32 bytes) || s (32 bytes)
Total: 64 bytes
```

**2FA Mode (2FA enabled):**
```
signature = r (32 bytes) || s (32 bytes) || ownerSignature (65 bytes)
Total: 129 bytes

Where:
- r, s: P-256 signature from passkey
- ownerSignature: ECDSA signature (r || s || v) from owner's private key
```

### Validation Logic

```solidity
if (twoFactorEnabled) {
    // 1. Verify P-256 signature (passkey)
    require(P256.verify(messageHash, r, s, qx, qy), "Invalid passkey signature");
    
    // 2. Verify owner signature (ECDSA)
    address recovered = ecrecover(userOpHash, v, sigR, sigS);
    require(recovered == owner(), "Invalid owner signature");
} else {
    // Normal mode: only verify P-256 signature
    require(P256.verify(messageHash, r, s, qx, qy), "Invalid signature");
}
```

---

## 📖 Usage Guide

### 1. Enable 2FA

```solidity
// Only owner can enable 2FA
account.enableTwoFactor();
```

**Events emitted:**
```solidity
event TwoFactorEnabled(address indexed owner);
```

### 2. Disable 2FA

```solidity
// Only owner can disable 2FA
account.disableTwoFactor();
```

**Events emitted:**
```solidity
event TwoFactorDisabled(address indexed owner);
```

### 3. Check 2FA Status

```solidity
bool is2FAEnabled = account.twoFactorEnabled();
```

---

## 🔧 Implementation Examples

### Example 1: Enable 2FA via Owner Wallet

```javascript
// Using ethers.js or viem
const account = new ethers.Contract(accountAddress, P256AccountABI, ownerWallet);

// Enable 2FA
const tx = await account.enableTwoFactor();
await tx.wait();

console.log("2FA enabled!");
```

### Example 2: Sign Transaction with 2FA

```javascript
import { WebAuthn } from './utils/webauthn';

// 1. Create UserOperation
const userOp = {
  sender: accountAddress,
  nonce: await account.getNonce(),
  callData: executeCallData,
  // ... other fields
};

// 2. Get userOpHash from bundler
const userOpHash = await bundler.getUserOpHash(userOp);

// 3. Sign with Passkey (P-256)
const passkeySignature = await WebAuthn.sign(userOpHash, credential);
const { r, s } = passkeySignature;

// 4. Sign with Owner Wallet (ECDSA)
const ownerSignature = await ownerWallet.signMessage(userOpHash);

// 5. Combine signatures
const combinedSignature = ethers.utils.concat([
  r,  // 32 bytes
  s,  // 32 bytes
  ownerSignature  // 65 bytes
]);

// 6. Submit UserOperation
userOp.signature = combinedSignature;
await bundler.sendUserOperation(userOp);
```

### Example 3: Conditional 2FA Based on Transaction Value

```javascript
async function sendTransaction(to, value, data) {
  const is2FAEnabled = await account.twoFactorEnabled();
  const threshold = ethers.utils.parseEther("1.0"); // 1 ETH
  
  // Enable 2FA for high-value transactions
  if (value > threshold && !is2FAEnabled) {
    console.log("High-value transaction detected. Enabling 2FA...");
    const tx = await account.enableTwoFactor();
    await tx.wait();
  }
  
  // Create and sign transaction
  const userOp = await createUserOp(to, value, data);
  
  if (is2FAEnabled) {
    // Sign with both passkey and owner
    userOp.signature = await signWithBoth(userOp);
  } else {
    // Sign with passkey only
    userOp.signature = await signWithPasskey(userOp);
  }
  
  return await bundler.sendUserOperation(userOp);
}
```

---

## 🔒 Security Considerations

### ✅ Benefits

1. **Defense in Depth**: Two independent authentication factors
2. **Malleability Protection**: Owner signature uses EIP-2 malleability checks
3. **Replay Protection**: Both signatures are bound to the same userOpHash
4. **Flexible Security**: Can be toggled on/off based on needs

### ⚠️ Important Notes

1. **Owner Key Security**: 
   - Owner key should be stored securely (hardware wallet, multi-sig)
   - Compromised owner key + stolen passkey device = full account access

2. **Signature Order**:
   - Always: P-256 signature first (64 bytes), then owner signature (65 bytes)
   - Wrong order will cause validation failure

3. **Gas Costs**:
   - 2FA mode costs ~3,000 additional gas for `ecrecover` operation
   - Consider gas costs for frequent transactions

4. **Recovery**:
   - If passkey is lost, owner can still update public key
   - If owner key is lost, passkey alone cannot disable 2FA
   - **Recommendation**: Keep secure backup of owner key

---

## 📊 Gas Comparison

| Mode | Signature Size | Validation Gas | Total Gas |
|------|---------------|----------------|-----------|
| Normal (Passkey only) | 64 bytes | ~6,900 gas | ~21,000 + 6,900 = ~27,900 |
| 2FA (Passkey + Owner) | 129 bytes | ~9,900 gas | ~21,000 + 9,900 = ~30,900 |

**Gas Overhead**: ~3,000 gas (~10% increase)

---

## 🧪 Testing

### Run 2FA Tests

```bash
# Run all 2FA tests
forge test --match-test "test_.*TwoFactor"

# Run specific test
forge test --match-test "test_EnableTwoFactor" -vvv
```

### Test Coverage

- ✅ Enable/disable 2FA
- ✅ Only owner can toggle 2FA
- ✅ Cannot enable twice / disable when not enabled
- ✅ Validate dual signatures
- ✅ Reject single signature when 2FA enabled
- ✅ Backward compatibility (normal mode still works)

---

## 🚀 Migration Guide

### Upgrading Existing Accounts

If you have existing P256Account deployments:

1. **Deploy new implementation** with 2FA support
2. **Upgrade proxy** (if using proxy pattern)
3. **2FA is disabled by default** - existing accounts work as before
4. **Enable 2FA** when ready:
   ```solidity
   account.enableTwoFactor();
   ```

### Frontend Integration

Update your frontend to:

1. **Check 2FA status** before signing:
   ```javascript
   const is2FA = await account.twoFactorEnabled();
   ```

2. **Collect both signatures** if 2FA is enabled:
   ```javascript
   if (is2FA) {
     const passkeySignature = await signWithPasskey(userOpHash);
     const ownerSignature = await signWithOwner(userOpHash);
     signature = concat([passkeySignature, ownerSignature]);
   }
   ```

3. **Update UI** to show 2FA status and toggle

---

## 📚 API Reference

### Functions

```solidity
/// @notice Enable two-factor authentication
/// @dev Only owner can call. Emits TwoFactorEnabled event
function enableTwoFactor() external onlyOwner

/// @notice Disable two-factor authentication  
/// @dev Only owner can call. Emits TwoFactorDisabled event
function disableTwoFactor() external onlyOwner

/// @notice Check if 2FA is enabled
/// @return bool True if 2FA is enabled
function twoFactorEnabled() external view returns (bool)
```

### Events

```solidity
/// @notice Emitted when 2FA is enabled
/// @param owner The owner who enabled 2FA
event TwoFactorEnabled(address indexed owner);

/// @notice Emitted when 2FA is disabled
/// @param owner The owner who disabled 2FA
event TwoFactorDisabled(address indexed owner);
```

### Errors

```solidity
/// @notice Thrown when 2FA signature is required but not provided
error TwoFactorSignatureRequired();

/// @notice Thrown when owner signature is invalid
error InvalidOwnerSignature();
```

---

## 🎓 Best Practices

1. **Start without 2FA**: Test your account in normal mode first
2. **Use hardware wallet for owner**: Store owner key in Ledger/Trezor
3. **Enable 2FA for production**: Once comfortable, enable for mainnet accounts
4. **Monitor gas costs**: Consider 2FA overhead for high-frequency operations
5. **Backup owner key**: Securely backup owner private key for recovery
6. **Test thoroughly**: Test 2FA flow in testnet before mainnet

---

## 🔗 Related Documentation

- [Architecture Overview](../ARCHITECTURE.md)
- [Security Considerations](../SECURITY.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [API Reference](../README.md#api-reference)

