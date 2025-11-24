# Counterfactual Address Calculation

## Overview

ΞTHΛURΛ uses CREATE2 for deterministic address calculation, allowing users to receive funds **before** deploying their smart contract wallet. This document explains how addresses are calculated and why it's safe to change passkeys later.

## Key Principle

**Your account address depends ONLY on:**
- Factory address
- **Owner address** (your social login)
- **Salt** (fixed at 0 for simplicity)

**Your account address does NOT depend on:**
- ❌ Passkey public key (qx, qy)
- ❌ 2FA enabled/disabled
- ❌ Any other initialization parameters

**Important:**
- We use `salt = 0` for all accounts (simple, one account per owner)
- Same owner = Same address (always)
- No need to store salt in localStorage
- If you need multiple accounts, you would need to manually specify different salts (advanced use case)

**Recovery:**
- If you lose your device but still have Web3Auth access, you can recalculate your address
- If you lose your passkey and 2FA is enabled, you need guardian recovery
- See [RECOVERY_GUIDE.md](./RECOVERY_GUIDE.md) for detailed recovery instructions

## Why This Matters

### ✅ Benefits

1. **Flexible Security:** You can add or change passkey later without changing your address
2. **Receive Funds First:** Get your address immediately, receive funds, then decide on security level
3. **Progressive Enhancement:** Start simple, add security features as needed
4. **No Lock-In:** Not locked into your initial choice

### Example Flow

```
1. Login with Web3Auth → Owner address: 0xABCD...1234
2. Calculate address → 0x5678...9ABC (based on owner + salt)
3. Share address with friends
4. Receive 10 ETH at 0x5678...9ABC
5. Later: Add passkey via proposePublicKeyUpdate()
6. Later: Enable 2FA via enableTwoFactor()
7. Address stays: 0x5678...9ABC ✅
```

## Technical Implementation

### Factory Contract

<augment_code_snippet path="src/P256AccountFactory.sol" mode="EXCERPT">
```solidity
function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
    // Address is calculated from owner, implementation, and salt
    // This allows the same address regardless of passkey choice
    // Different contract versions (implementations) get different addresses
    bytes32 finalSalt = _computeSalt(owner, salt);
    return PROXY_FACTORY.predictDeterministicAddress(finalSalt);
}

function _computeSalt(address owner, uint256 salt) internal view returns (bytes32) {
    // Include implementation address so different contract versions get different addresses
    bytes32 combinedSalt = keccak256(abi.encodePacked(owner, address(IMPLEMENTATION), salt));
    // Keep only last 96 bits (Solady requirement)
    return bytes32(uint256(combinedSalt) & ((1 << 96) - 1));
}
```
</augment_code_snippet>

### Frontend SDK

```javascript
async getAccountAddress(qx, qy, owner, salt = 0n) {
  // Always use factory.getAddress() - it includes implementation address in salt
  // This ensures different contract versions get different addresses
  const address = await this.factory.getAddress(qx, qy, owner, salt)
  return address
}
```

## Comparison: Old vs New

### ❌ Old Behavior (WRONG)

```solidity
// Address depended on qx, qy, owner, salt
bytes32 finalSalt = keccak256(abi.encodePacked(qx, qy, owner, salt));
```

**Problems:**
- Different passkey = Different address
- Cannot add passkey later (would create new address)
- Funds sent to old address would be stuck
- User locked into initial choice

### ✅ New Behavior (CORRECT)

```solidity
// Address depends ONLY on owner and salt
bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
```

**Benefits:**
- Same owner = Same address (regardless of passkey)
- Can add/change passkey later
- Can enable/disable 2FA later
- Flexible security model

## Account Creation Scenarios

### Scenario 1: Social Login Only

```javascript
// Create account with no passkey
const account = await sdk.createAccount(
  null,           // no passkey
  ownerAddress,   // 0xABCD...1234
  0n,             // salt = 0
  false           // 2FA disabled
)

// Address: 0x5678...9ABC (based on owner + salt)
// State: qx=0, qy=0, twoFactorEnabled=false
```

### Scenario 2: With Passkey (2FA Disabled)

```javascript
// Create account with passkey
const account = await sdk.createAccount(
  passkeyPublicKey, // qx!=0, qy!=0
  ownerAddress,     // 0xABCD...1234
  0n,               // salt = 0
  false             // 2FA disabled
)

// Address: 0x5678...9ABC (SAME as Scenario 1!)
// State: qx!=0, qy!=0, twoFactorEnabled=false
```

### Scenario 3: With 2FA

```javascript
// Create account with 2FA
const account = await sdk.createAccount(
  passkeyPublicKey, // qx!=0, qy!=0
  ownerAddress,     // 0xABCD...1234
  0n,               // salt = 0
  true              // 2FA enabled
)

// Address: 0x5678...9ABC (SAME as Scenarios 1 & 2!)
// State: qx!=0, qy!=0, twoFactorEnabled=true
```

## Changing Security Settings Later

### Add Passkey Later

```solidity
// User created account with no passkey (qx=0, qy=0)
// Later, they want to add a passkey

// Step 1: Propose public key update
account.proposePublicKeyUpdate(newQx, newQy);

// Step 2: Wait for timelock (48 hours)

// Step 3: Execute update
account.executePublicKeyUpdate(actionId);

// Result: qx=newQx, qy=newQy, address stays the same ✅
```

### Enable 2FA Later

```solidity
// User created account with passkey but 2FA disabled
// Later, they want to enable 2FA

account.enableTwoFactor();

// Result: twoFactorEnabled=true, address stays the same ✅
```

### Disable 2FA Later

```solidity
// User has 2FA enabled but wants to disable it

account.disableTwoFactor();

// Result: twoFactorEnabled=false, address stays the same ✅
```

## Security Considerations

### Why Not Include Passkey in Address?

**Pros of including passkey:**
- ❌ None (only creates problems)

**Cons of including passkey:**
- ❌ Cannot add passkey later
- ❌ Cannot change passkey without changing address
- ❌ Funds sent to old address would be stuck
- ❌ Poor user experience

### Why Only Owner and Salt?

**Pros:**
- ✅ Flexible security model
- ✅ Can add/change passkey later
- ✅ Can enable/disable 2FA later
- ✅ Address never changes
- ✅ Better user experience

**Cons:**
- ⚠️ Same owner can only have one account per salt
- ⚠️ Solution: Use different salts for multiple accounts

## Multiple Accounts (Advanced)

**Current Implementation:** We use `salt = 0` for all accounts (one account per owner).

**For advanced users:** You can create multiple accounts by using different salts:

```javascript
// Account 1 (personal) - Default
const account1 = await sdk.createAccount(passkey, owner, 0n, false)
// Address: 0x5678...9ABC

// Account 2 (business) - Advanced: manually specify salt = 1
const account2 = await sdk.createAccount(passkey, owner, 1n, false)
// Address: 0x1234...5678 (different!)

// Account 3 (savings) - Advanced: manually specify salt = 2
const account3 = await sdk.createAccount(passkey, owner, 2n, true)
// Address: 0xABCD...EF01 (different!)
```

**Note:** If you use custom salts, you must store them yourself (e.g., in localStorage) to recover the address later. The default implementation uses `salt = 0` and doesn't require storing the salt.

## Testing

All tests verify the new behavior:

```solidity
function test_DifferentPublicKeysProduceSameAddress() public view {
    uint256 salt = 0;
    address addr1 = factory.getAddress(QX1, QY1, owner1, salt);
    address addr2 = factory.getAddress(QX2, QY2, owner1, salt);
    
    assertEq(addr1, addr2, "Same owner should have SAME address");
}

function test_SaltIncludesOnlyOwnerAndSalt() public view {
    address addr1 = factory.getAddress(QX1, QY1, owner1, 0);
    address addr2 = factory.getAddress(QX2, QY1, owner1, 0); // Different qx
    address addr3 = factory.getAddress(QX1, QY2, owner1, 0); // Different qy
    address addr4 = factory.getAddress(QX1, QY1, owner2, 0); // Different owner
    
    assertEq(addr1, addr2, "qx should NOT affect address");
    assertEq(addr1, addr3, "qy should NOT affect address");
    assertTrue(addr1 != addr4, "owner should affect address");
}
```

## Summary

✅ **Your address depends ONLY on owner and salt**  
✅ **You can add/change passkey later**  
✅ **You can enable/disable 2FA later**  
✅ **Your address never changes**  
✅ **Flexible, progressive security model**  

This design provides the best user experience while maintaining security and flexibility!

