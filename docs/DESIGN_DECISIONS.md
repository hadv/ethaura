# ΞTHΛURΛ Design Decisions

This document explains key design decisions made in the ΞTHΛURΛ project.

## 1. Counterfactual Address Calculation

### Decision: Address depends ONLY on owner and salt (NOT passkey)

**Implementation:**
```solidity
function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
    bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
    return Create2.computeAddress(
        finalSalt, keccak256(abi.encodePacked(type(P256Account).creationCode, abi.encode(ENTRYPOINT)))
    );
}
```

**Rationale:**
- ✅ Users can add/change passkey later without changing address
- ✅ Users can receive funds before deciding on security level
- ✅ Flexible, progressive security model
- ✅ Better user experience

**Alternative Considered:**
```solidity
// Include passkey in address calculation
bytes32 finalSalt = keccak256(abi.encodePacked(qx, qy, owner, salt));
```

**Why Rejected:**
- ❌ Different passkey = different address
- ❌ Cannot add passkey later (would create new address)
- ❌ Funds sent to old address would be stuck
- ❌ Poor user experience

**Important Note:**
After deployment, the contract address is fixed. Users can then:
- Change passkey via `proposePublicKeyUpdate()` (48-hour timelock)
- Enable/disable 2FA via `enableTwoFactor()` / `disableTwoFactor()`
- Change owner via recovery mechanism

The address calculation only matters **before deployment** (counterfactual phase).

---

## 2. Fixed Salt = 0

### Decision: Use salt = 0 for all accounts (one account per owner)

**Implementation:**
```javascript
const accountData = await sdk.createAccount(
  passkeyPublicKey,
  ownerAddress,
  0n, // salt = 0 (fixed)
  enable2FA
)
```

**Rationale:**
- ✅ Simple - no need to store salt in localStorage
- ✅ Deterministic - same owner always gets same address
- ✅ Can recalculate address if user has Web3Auth access
- ✅ Most users only need one account

**Trade-offs:**
- ⚠️ One account per owner (cannot create multiple accounts easily)
- ⚠️ Advanced users can manually specify different salts, but must store them

**Recovery Scenarios:**

| What User Lost | Can Recalculate Address? | Can Access Funds? | Recovery Method |
|----------------|-------------------------|-------------------|-----------------|
| **Device only (2FA disabled)** | ✅ Yes (via Web3Auth) | ✅ Yes | Login with Web3Auth, sign with owner |
| **Device only (2FA enabled)** | ✅ Yes (via Web3Auth) | ❌ No (need passkey) | **Guardian Recovery** |
| **Web3Auth access** | ❌ No | ❌ No | **Guardian Recovery** |
| **Everything (no guardians)** | ❌ No | ❌ No | 💀 **Funds lost forever** |

**Important Notes:**
- **Address recalculation** requires Web3Auth access (to get owner address)
- **Fund access** when 2FA is enabled requires guardian recovery (cannot sign without passkey)
- **Guardian recovery** is the primary recovery mechanism for lost passkeys or Web3Auth access

**Alternative Considered:**
```javascript
// Store salt in localStorage
const salt = generateRandomSalt()
localStorage.setItem('ethaura_account_salt', salt)
```

**Why Rejected:**
- ❌ If user clears localStorage, they lose the salt
- ❌ Cannot recover address without salt
- ❌ More complex for most users who only need one account

**Future Enhancement:**
Could add multi-account support by:
1. Storing array of salts in localStorage
2. UI to switch between accounts
3. Account naming/labeling

---

## 3. Signature Validation Modes

### Decision: Two modes based on twoFactorEnabled flag

**Implementation:**
```solidity
// Mode 1: Owner-only (when qx=0 OR twoFactorEnabled=false)
if (qx == bytes32(0) || !twoFactorEnabled) {
    return _recoverSigner(userOpHash, sig) == owner() ? 0 : 1;
}

// Mode 2: Passkey with 2FA (when qx!=0 AND twoFactorEnabled=true)
// Verify both WebAuthn signature AND owner signature
```

**Rationale:**
- ✅ Clear separation of modes
- ✅ When 2FA disabled, only owner can sign (not passkey)
- ✅ When 2FA enabled, both signatures required
- ✅ Prevents social login compromise when 2FA enabled

**Alternative Considered:**
```solidity
// Three modes: owner-only, passkey-only, or both
if (qx == bytes32(0)) {
    // Owner-only
} else if (!twoFactorEnabled) {
    // Passkey-only (OR owner)
} else {
    // Both required
}
```

**Why Rejected:**
- ❌ "Passkey-only" mode is confusing
- ❌ When 2FA disabled, passkey shouldn't be used for signing
- ❌ Passkey is registered but not enforced until 2FA is enabled

---

## 4. WebAuthn Challenge Verification

### Decision: Verify challenge in clientDataJSON matches userOpHash

**Implementation:**
```solidity
function _verifyChallenge(bytes calldata clientDataJSON, uint256 challengeIndex, bytes32 expectedHash)
    internal pure returns (bool)
{
    // Verify: "challenge":"<base64url(expectedHash)>"
    bytes memory expectedChallenge = Base64Url.encode(expectedHash);
    bytes memory actualChallenge = clientDataJSON[challengeIndex + 13:challengeIndex + 56];
    return keccak256(actualChallenge) == keccak256(expectedChallenge);
}
```

**Rationale:**
- ✅ Prevents replay attacks
- ✅ Ensures passkey is authorizing the specific transaction
- ✅ Critical security requirement for WebAuthn

**Security Issue Prevented:**
Without challenge verification, an attacker could:
1. Create valid WebAuthn signature for any random challenge
2. Submit it with different userOpHash (different transaction)
3. Contract would accept it (signature is valid, but for wrong transaction)

---

## 5. Optional 2FA

### Decision: Make 2FA optional instead of mandatory

**Implementation:**
```solidity
function initialize(bytes32 _qx, bytes32 _qy, address _owner, bool _enable2FA) external {
    qx = _qx;
    qy = _qy;
    _transferOwnership(_owner);
    twoFactorEnabled = _enable2FA;
}
```

**Rationale:**
- ✅ Lower barrier to entry (users can start simple)
- ✅ Progressive security (add 2FA when ready)
- ✅ Flexibility for different use cases
- ✅ Better user experience

**Three Account Types:**
1. **Social Login Only** (qx=0, qy=0, 2FA=false)
   - Simple, owner-only
   - Cannot enable 2FA later (no passkey registered)

2. **With Passkey** (qx!=0, qy!=0, 2FA=false)
   - Passkey registered but not enforced
   - Can enable 2FA later
   - Currently uses owner signature only

3. **With 2FA** (qx!=0, qy!=0, 2FA=true)
   - Maximum security
   - Requires both owner AND passkey signatures

---

## 6. Guardian-Based Recovery

### Decision: Owner is automatically added as first guardian

**Implementation:**
```solidity
function initialize(bytes32 _qx, bytes32 _qy, address _owner, bool _enable2FA) external {
    // ... other initialization ...
    
    // Add owner as first guardian
    guardians.push(_owner);
    isGuardian[_owner] = true;
    guardianThreshold = 1;
}
```

**Rationale:**
- ✅ Owner can always initiate recovery (no timelock)
- ✅ Simplifies initial setup
- ✅ Owner can add more guardians later
- ✅ Threshold starts at 1 (owner can recover alone)

**Recovery Flow:**
1. Owner or guardians initiate recovery
2. Guardians approve (must reach threshold)
3. Wait 48-hour timelock
4. Execute recovery (change owner)

---

## 7. Timelock for Critical Operations

### Decision: 48-hour timelock for public key updates and recovery

**Implementation:**
```solidity
uint256 public constant TIMELOCK_DURATION = 48 hours;

function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) external onlyOwner {
    uint256 executeAfter = block.timestamp + TIMELOCK_DURATION;
    // ... store pending action ...
}
```

**Rationale:**
- ✅ Prevents immediate compromise if owner key is stolen
- ✅ Gives user time to react and cancel malicious updates
- ✅ Balance between security and usability

**Operations with Timelock:**
- Public key update (change passkey)
- Recovery (change owner)

**Operations without Timelock:**
- Enable/disable 2FA (immediate)
- Add/remove guardians (immediate)
- Normal transactions (immediate)

---

## 8. Base64Url Library

### Decision: Separate library for Base64Url encoding

**Implementation:**
```solidity
library Base64Url {
    function encode(bytes32 data) internal pure returns (bytes memory) {
        // URL-safe alphabet: A-Za-z0-9-_
        // No padding
    }
}
```

**Rationale:**
- ✅ Reusable across contracts
- ✅ Well-tested (dedicated test suite)
- ✅ Clean separation of concerns
- ✅ Easier to maintain

**Usage:**
```solidity
bytes memory challenge = Base64Url.encode(userOpHash);
```

---

## Summary

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Address = owner + salt** | Flexible security | One account per owner (salt=0) |
| **Salt = 0 (fixed)** | Simple, no storage needed | Cannot easily create multiple accounts |
| **Two signature modes** | Clear, secure | Passkey not used when 2FA disabled |
| **Challenge verification** | Prevents replay attacks | Slightly more complex signatures |
| **Optional 2FA** | Better UX, progressive security | Users might not enable it |
| **Owner as guardian** | Simplifies recovery | Owner has special privileges |
| **48-hour timelock** | Security vs usability balance | Delayed critical operations |
| **Base64Url library** | Reusable, testable | Additional contract |

All decisions prioritize **security**, **user experience**, and **flexibility** while keeping the implementation simple and maintainable.

