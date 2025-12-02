# ERC-7579 Security Model

## Overview

This document defines the security model for the P256ModularAccount ERC-7579 implementation.

## Core Security Principles

1. **Owner Always Required**: Owner (Web3Auth) signature is mandatory for all transactions
2. **MFA with Passkey**: When MFA enabled, passkey is required as additional factor
3. **Timelock Protection**: Sensitive operations have mandatory delays
4. **Module Isolation**: Modules cannot access each other's storage
5. **Guardian Recovery**: Multi-sig recovery with timelock

## Module Installation/Uninstallation Security

### Installation Requirements

| Module Type | Who Can Install | Requirements |
|-------------|-----------------|--------------|
| Validator | Account (via UserOp) | Valid signature from existing validator |
| Executor | Account (via UserOp) | Valid signature from existing validator |
| Hook | Account (via UserOp) | Valid signature + no active hook conflict |
| Fallback | Account (via UserOp) | Valid signature, selector not already registered |

### Uninstallation Requirements

| Module Type | Who Can Uninstall | Requirements |
|-------------|-------------------|--------------|
| Validator | Account (via UserOp) | Cannot remove last validator |
| Executor | Account (via UserOp) | Standard signature |
| Hook | Account (via UserOp) | **1-day timelock** for security hooks |
| Fallback | Account (via UserOp) | Standard signature |

### Hook Emergency Uninstall

```solidity
// Emergency hook uninstall with timelock (like Biconomy Nexus)
uint256 constant HOOK_UNINSTALL_DELAY = 1 days;

struct HookUninstallRequest {
    address hook;
    uint256 executeAfter;
    bool executed;
}

function requestHookUninstall(address hook) external;
function executeHookUninstall(address hook) external;
function cancelHookUninstall(address hook) external;
```

## Timelock Requirements

### Operation Timelocks

| Operation | Timelock | Rationale |
|-----------|----------|-----------|
| Social Recovery Execution | 24 hours | Allow user to detect and cancel malicious recovery |
| Hook Uninstallation | 24 hours | Prevent bypassing security hooks |
| Passkey Update (via recovery) | 24 hours | Part of recovery flow |
| Owner Update (via recovery) | 24 hours | Part of recovery flow |

### No Timelock Required

| Operation | Rationale |
|-----------|-----------|
| Add Passkey | User already authenticated |
| Remove Passkey (non-last) | User already authenticated |
| Add Guardian | User already authenticated |
| Remove Guardian | User already authenticated |
| Enable MFA | Increases security |
| Disable MFA | Requires current MFA signature |

## MFA Validation Security

### P256MFAValidatorModule Security

MFA validation happens during the ERC-4337 validation phase, not in hooks:

```solidity
function validateUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash
) external returns (uint256 validationData) {
    // 1. Always verify owner ECDSA signature (mandatory - Web3Auth)
    bool ownerValid = _verifyOwnerSignature(userOp, userOpHash);
    if (!ownerValid) return SIG_VALIDATION_FAILED;

    // 2. If MFA enabled, also verify passkey signature (additional factor)
    if (mfaEnabled[msg.sender]) {
        bool passkeyValid = _verifyPasskeySignature(userOp, userOpHash);
        if (!passkeyValid) return SIG_VALIDATION_FAILED;
    }

    return SIG_VALIDATION_SUCCESS;
}
```

**Security Model:**
- Owner (Web3Auth social login) is the primary authentication - always required
- Passkey is the additional factor when MFA is enabled
- This ensures users can't bypass Web3Auth even if they have a passkey

## Hook Execution Security

### Hook Bypass Prevention

1. **Global Hook**: Single hook slot prevents multiple hook conflicts
2. **Hook Chaining**: Use MultiHook wrapper for multiple hooks
3. **Mandatory Execution**: Hooks always execute for protected operations
4. **No Self-Call Bypass**: Hooks execute even for account self-calls

## Validator Security

### Validator Selection

```solidity
// Validator encoded in userOp.nonce (upper 192 bits)
// Lower 64 bits = sequential nonce
function _getValidator(PackedUserOperation calldata userOp) internal view returns (address) {
    uint256 nonce = userOp.nonce;
    address validator = address(uint160(nonce >> 64));
    
    // SECURITY: Verify validator is installed
    require(isModuleInstalled(MODULE_TYPE_VALIDATOR, validator, ""), "Validator not installed");
    
    return validator;
}
```

### Validator Isolation

- Each validator has separate storage namespace
- Validators cannot modify each other's state
- Account controls which validators are installed

## Executor Security

### Executor Authorization

```solidity
function executeFromExecutor(
    ModeCode mode,
    bytes calldata executionCalldata
) external payable returns (bytes[] memory) {
    // SECURITY: Only installed executors can call
    require(isModuleInstalled(MODULE_TYPE_EXECUTOR, msg.sender, ""), "Not an executor");
    
    // Execute with hook checks
    return _execute(mode, executionCalldata);
}
```

### Executor Permissions

| Executor | Allowed Operations |
|----------|-------------------|
| PasskeyManagerModule | Add/remove passkeys on P256ValidatorModule |
| GuardianManagerModule | Manage guardians (self-storage) |
| SocialRecoveryModule | Update passkeys and owner during recovery |

## Recovery Security

### Recovery Flow

```
1. Guardian initiates recovery
   └── Stores request with 24h timelock

2. Other guardians approve
   └── Increment approval count

3. After 24h + threshold met
   └── Anyone can execute

4. User can cancel anytime with passkey
   └── Requires valid passkey signature
```

### Recovery Protections

1. **Timelock**: 24-hour delay before execution
2. **Threshold**: Multiple guardian approvals required
3. **Cancellation**: User can cancel with passkey signature
4. **Full Reset**: Recovery replaces ALL passkeys (prevents compromised key reuse)

## Attack Vectors & Mitigations

### 1. Malicious Module Installation

**Attack**: Attacker tricks user into installing malicious module
**Mitigation**: 
- Module installation requires valid signature
- Consider module registry (ERC-7484) for attestation

### 2. Hook Bypass

**Attack**: Attacker uninstalls security hook to bypass 2FA
**Mitigation**: 24-hour timelock on hook uninstallation

### 3. Validator Takeover

**Attack**: Attacker installs malicious validator
**Mitigation**: 
- Validator installation requires existing validator signature
- Cannot remove last validator

### 4. Recovery Attack

**Attack**: Compromised guardians initiate malicious recovery
**Mitigation**:
- 24-hour timelock allows detection
- User can cancel with passkey
- Threshold requires multiple guardians

### 5. Storage Collision

**Attack**: Module overwrites another module's storage
**Mitigation**: ERC-7201 namespaced storage with unique slots

## Audit Checklist

- [ ] Module installation requires valid signature
- [ ] Cannot remove last validator
- [ ] Hook uninstall has timelock
- [ ] Recovery has 24h timelock
- [ ] User can cancel recovery with passkey
- [ ] Storage uses ERC-7201 namespaces
- [ ] Executors properly authorized
- [ ] Hooks cannot be bypassed
- [ ] Validators properly isolated

