# Security Model - EthAura P256Account

## 🔒 Overview

EthAura implements a **defense-in-depth security model** with multiple layers of protection to prevent unauthorized access and enable secure recovery from lost credentials.

## 🎯 Core Security Principles

### 1. **Passkey-First Security**
- **Primary authentication**: P-256 passkey signature (WebAuthn)
- **Hardware-backed**: Secure Enclave, TPM, or platform authenticator
- **Cannot be bypassed**: Owner address CANNOT execute transactions directly

### 2. **No Owner Bypass**
- ❌ Owner **CANNOT** call `execute()` or `executeBatch()` directly
- ❌ Owner **CANNOT** immediately change passkey
- ✅ Owner can only **propose** changes with timelock
- ✅ Passkey holder can **cancel** malicious proposals

### 3. **Timelock Protection**
- **Administrative actions** require 48-hour timelock
- **Recovery actions** require 24-hour timelock
- **User can cancel** any pending action with passkey signature

## 🛡️ Security Layers

### Layer 1: Passkey Authentication (Primary)

**All transactions require passkey signature:**
```solidity
function execute(address dest, uint256 value, bytes calldata func) external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    _call(dest, value, func);
}
```

**Protection:**
- ✅ Biometric authentication (Touch ID, Face ID, Windows Hello)
- ✅ Hardware-backed private key storage
- ✅ Phishing-resistant (WebAuthn challenge-response)
- ✅ Device-bound credentials

**Attack Scenarios:**
- ❌ Social account hacked → **Funds safe** (cannot execute transactions)
- ❌ Owner private key stolen → **Funds safe** (cannot bypass passkey)
- ✅ Passkey lost → **Recoverable** (via guardians or timelock)

### Layer 2: Optional Two-Factor Authentication

**Enable dual signatures for high-value transactions:**
```solidity
function enableTwoFactor() external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    twoFactorEnabled = true;
}
```

**When enabled:**
- Requires **both** passkey signature AND owner signature
- Signature format: `passkeySignature (64 bytes) + ownerSignature (65 bytes)`
- Provides additional security for sensitive operations

**Use cases:**
- Large transfers (> $10,000)
- Contract interactions
- Guardian management
- Recovery operations

### Layer 3: Timelock for Administrative Actions

**Owner can propose passkey updates, but must wait 48 hours:**

```solidity
// Step 1: Propose (owner can do this)
function proposePublicKeyUpdate(bytes32 _qx, bytes32 _qy) external onlyOwner {
    // Creates pending action with 48-hour timelock
}

// Step 2: Execute after timelock (anyone can do this)
function executePublicKeyUpdate(bytes32 _qx, bytes32 _qy, uint256 proposalTimestamp) external {
    // Executes after 48 hours
}

// Step 3: Cancel if malicious (passkey holder can do this)
function cancelPendingAction(bytes32 actionHash) external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    // Cancels the pending action
}
```

**Protection:**
- ✅ 48-hour window to detect and cancel malicious changes
- ✅ User receives notification and can cancel with passkey
- ✅ Prevents instant takeover if owner key is compromised

**Attack Scenario:**
1. Attacker compromises Web3Auth account
2. Attacker proposes new passkey
3. ⏰ **48-hour timelock starts**
4. User receives notification
5. User cancels with passkey signature
6. ✅ **Attack prevented**

### Layer 4: Guardian-Based Social Recovery

**Trusted contacts can help recover lost passkeys:**

#### Setup Guardians
```solidity
// Add guardians (via passkey signature)
function addGuardian(address guardian) external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    guardians[guardian] = true;
}

// Set threshold (e.g., 2 out of 3)
function setGuardianThreshold(uint256 threshold) external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    guardianThreshold = threshold;
}
```

#### Recovery Process
```solidity
// Step 1: Guardian initiates recovery
function initiateRecovery(bytes32 newQx, bytes32 newQy, address newOwner) external {
    if (!guardians[msg.sender]) revert NotGuardian();
    // Creates recovery request with 24-hour timelock
}

// Step 2: Other guardians approve
function approveRecovery(uint256 requestNonce) external {
    if (!guardians[msg.sender]) revert NotGuardian();
    // Increments approval count
}

// Step 3: Execute after threshold + timelock
function executeRecovery(uint256 requestNonce) external {
    // Requires: approvalCount >= threshold AND 24 hours passed
    // Updates passkey and owner
}

// Cancel if user still has access
function cancelRecovery(uint256 requestNonce) external {
    if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
    // Cancels recovery request
}
```

**Protection:**
- ✅ Decentralized recovery (no single point of failure)
- ✅ Multi-sig approval (prevents single guardian attack)
- ✅ 24-hour timelock (user can cancel if still has access)
- ✅ User can cancel malicious recovery with passkey

**Recommended Guardian Setup:**
- **3 guardians**: Family member, close friend, trusted colleague
- **Threshold: 2/3**: Requires 2 approvals to recover
- **Diversity**: Different geographic locations, different relationships

## 🚨 Attack Scenarios & Mitigations

### Scenario 1: Web3Auth Account Compromised

**Attack:** Hacker gains access to user's social login (Google, Facebook, etc.)

**What attacker CAN do:**
- Propose passkey update (48-hour timelock)
- View account information

**What attacker CANNOT do:**
- ❌ Execute transactions (requires passkey)
- ❌ Immediately change passkey (48-hour timelock)
- ❌ Steal funds (passkey required)

**Mitigation:**
1. User receives notification of proposed change
2. User cancels with passkey signature
3. User changes Web3Auth password
4. ✅ Funds remain safe

### Scenario 2: Passkey Device Lost/Stolen

**Attack:** User loses phone with passkey

**Recovery Options:**

**Option A: Owner-initiated recovery (48 hours)**
1. Login to Web3Auth from new device
2. Propose new passkey update
3. Wait 48 hours
4. Execute update
5. ✅ Access restored

**Option B: Guardian recovery (24 hours + threshold)**
1. Contact guardians
2. Guardian initiates recovery with new passkey
3. Other guardians approve
4. Wait 24 hours
5. Execute recovery
6. ✅ Access restored

### Scenario 3: Both Passkey AND Web3Auth Lost

**Attack:** User loses phone AND forgets Web3Auth password

**Recovery:**
1. Contact guardians
2. Guardians initiate recovery
3. 2/3 guardians approve
4. Wait 24 hours
5. Execute recovery
6. ✅ Access restored

**This is why guardians are critical!**

### Scenario 4: Malicious Guardian

**Attack:** One guardian tries to steal account

**Protection:**
- ❌ Single guardian cannot recover (requires threshold)
- ✅ User can cancel with passkey signature
- ✅ 24-hour timelock provides detection window

### Scenario 5: Coordinated Guardian Attack

**Attack:** Multiple guardians collude to steal account

**Protection:**
- ✅ 24-hour timelock (user can cancel)
- ✅ User receives notification
- ✅ User can remove malicious guardians

**Mitigation:**
- Choose trustworthy guardians
- Use diverse guardian set
- Monitor recovery requests

## 📊 Security Comparison

| Scenario | Traditional Wallet | EthAura (No Guardians) | EthAura (With Guardians) |
|----------|-------------------|------------------------|--------------------------|
| Seed phrase lost | ❌ Funds lost | ❌ Funds lost | ✅ Recoverable |
| Private key stolen | ❌ Funds stolen | ✅ Funds safe (passkey required) | ✅ Funds safe |
| Social account hacked | N/A | ✅ Funds safe (48h timelock) | ✅ Funds safe |
| Passkey device lost | N/A | ⚠️ Recoverable (48h) | ✅ Recoverable (24h) |
| Both credentials lost | ❌ Funds lost | ❌ Funds lost | ✅ Recoverable |

## 🎯 Best Practices

### For Users

1. **Setup Guardians Immediately**
   - Add 3+ trusted guardians
   - Set threshold to 2/3 or 3/5
   - Choose diverse guardians

2. **Enable 2FA for High-Value Transactions**
   - Transfers > $10,000
   - Smart contract interactions
   - Guardian management

3. **Monitor Notifications**
   - Check for proposed changes
   - Cancel malicious proposals immediately
   - Review recovery requests

4. **Backup Information**
   - Save account address
   - Document guardian contacts
   - Keep Web3Auth recovery info

### For Developers

1. **Test Recovery Flows**
   - Test guardian recovery
   - Test timelock cancellation
   - Test edge cases

2. **Monitor Events**
   - `RecoveryInitiated`
   - `ActionProposed`
   - `GuardianAdded/Removed`

3. **Implement Notifications**
   - Email/SMS for proposed changes
   - Push notifications for recovery
   - Dashboard for pending actions

## 🔐 Security Audit Checklist

- [x] Passkey signature required for all transactions
- [x] Owner cannot bypass passkey authentication
- [x] Timelock for administrative actions (48 hours)
- [x] Guardian-based social recovery
- [x] Recovery timelock (24 hours)
- [x] User can cancel malicious actions
- [x] Multi-sig guardian approval
- [x] Comprehensive test coverage (35 tests)
- [ ] External security audit (recommended before mainnet)
- [ ] Bug bounty program (recommended)

## 📚 Additional Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [P-256 Curve](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf)
- [Account Abstraction Security](https://ethereum.org/en/roadmap/account-abstraction/)

