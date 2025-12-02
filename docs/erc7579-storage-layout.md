# ERC-7579 Storage Layout Specification

## Overview

This document defines the ERC-7201 namespaced storage layout for the P256ModularAccount and its modules.

## ERC-7201 Namespaced Storage

ERC-7201 provides collision-resistant storage for upgradeable contracts and modules.

### Namespace Formula
```
keccak256(abi.encode(uint256(keccak256("namespace.identifier")) - 1)) & ~bytes32(uint256(0xff))
```

## Core Account Storage

### P256ModularAccount Storage

**Namespace:** `ethaura.storage.P256ModularAccount`

```solidity
/// @custom:storage-location erc7201:ethaura.storage.P256ModularAccount
struct AccountStorage {
    // Module management
    mapping(uint256 moduleType => mapping(address module => bool)) installedModules;
    
    // Validator management (sentinel list pattern)
    address validatorLinkedList;  // Head of linked list
    uint256 validatorCount;
    
    // Executor management (sentinel list pattern)
    address executorLinkedList;
    uint256 executorCount;
    
    // Hook management
    address globalHook;           // Single global hook (can be multi-hook wrapper)
    
    // Fallback management
    mapping(bytes4 selector => address) fallbackHandlers;
    
    // Account state
    bool initialized;
    uint256 nonce;
}

bytes32 constant ACCOUNT_STORAGE_LOCATION = 
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.P256ModularAccount")) - 1)) & ~bytes32(uint256(0xff));

function _getAccountStorage() internal pure returns (AccountStorage storage $) {
    bytes32 location = ACCOUNT_STORAGE_LOCATION;
    assembly {
        $.slot := location
    }
}
```

## Module Storage

### P256MFAValidatorModule Storage

**Namespace:** `ethaura.storage.P256MFAValidatorModule`

```solidity
/// @custom:storage-location erc7201:ethaura.storage.P256MFAValidatorModule
struct P256MFAValidatorStorage {
    // Per-account passkey storage
    mapping(address account => mapping(bytes32 passkeyId => PasskeyInfo)) passkeys;
    mapping(address account => bytes32[]) passkeyIds;
    mapping(address account => uint256) passkeyCount;

    // MFA settings
    mapping(address account => address) owners;      // Owner for MFA signature
    mapping(address account => bool) mfaEnabled;     // MFA toggle
}

struct PasskeyInfo {
    bytes32 qx;
    bytes32 qy;
    uint256 addedAt;
    bool active;
    bytes32 deviceId;
}

bytes32 constant P256_MFA_VALIDATOR_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.P256MFAValidatorModule")) - 1)) & ~bytes32(uint256(0xff));
```

### GuardianManagerModule Storage

**Namespace:** `ethaura.storage.GuardianManagerModule`

```solidity
/// @custom:storage-location erc7201:ethaura.storage.GuardianManagerModule
struct GuardianStorage {
    mapping(address account => mapping(address guardian => bool)) isGuardian;
    mapping(address account => address[]) guardianList;
    mapping(address account => uint256) threshold;
}

bytes32 constant GUARDIAN_STORAGE_LOCATION = 
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.GuardianManagerModule")) - 1)) & ~bytes32(uint256(0xff));
```

### SocialRecoveryModule Storage

**Namespace:** `ethaura.storage.SocialRecoveryModule`

```solidity
/// @custom:storage-location erc7201:ethaura.storage.SocialRecoveryModule
struct RecoveryStorage {
    // Per-account configuration
    mapping(address account => RecoveryConfig) config;

    // Recovery requests
    mapping(address account => uint256) recoveryNonce;
    mapping(address account => mapping(uint256 nonce => RecoveryRequest)) requests;

    // Separate storage for approvals (nested mappings not allowed in structs)
    mapping(address account => mapping(uint256 nonce => mapping(address guardian => bool))) approvals;
}

struct RecoveryConfig {
    uint256 threshold;          // e.g., 2 for "2 of 3 guardians"
    uint256 timelockPeriod;     // e.g., 24 hours (86400 seconds)
}

struct RecoveryRequest {
    bytes32 newPasskeyQx;
    bytes32 newPasskeyQy;
    address newOwner;
    uint256 approvalCount;
    uint256 initiatedAt;        // When first guardian approved
    uint256 executeAfter;       // Set when threshold met: initiatedAt + timelockPeriod
    bool thresholdMet;          // True when approvalCount >= threshold
    bool executed;
    bool cancelled;
}

bytes32 constant RECOVERY_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.SocialRecoveryModule")) - 1)) & ~bytes32(uint256(0xff));
```

### HookManagerModule Storage

**Namespace:** `ethaura.storage.HookManagerModule`

```solidity
/// @custom:storage-location erc7201:ethaura.storage.HookManagerModule
struct HookManagerStorage {
    // Installed hooks per account
    mapping(address account => address[]) installedHooks;
    mapping(address account => mapping(address hook => bool)) isInstalled;

    // Emergency uninstall proposals
    mapping(address account => mapping(address hook => uint256)) emergencyUninstallTime;
}

bytes32 constant HOOK_MANAGER_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.HookManagerModule")) - 1)) & ~bytes32(uint256(0xff));
```

**Note:** MFA state (enabled/disabled) is stored in P256MFAValidatorModule, not in a hook.
Recovery timelock is enforced inside SocialRecoveryModule (not via hook).

### LargeTransactionExecutorModule Storage

**Namespace:** `ethaura.storage.LargeTransactionExecutorModule`

- Built-in module, installed at account initialization
- Disabled by default (threshold = type(uint256).max)

```solidity
/// @custom:storage-location erc7201:ethaura.storage.LargeTransactionExecutorModule
struct LargeTransactionExecutorStorage {
    // Per-account configuration
    // threshold = type(uint256).max means disabled
    mapping(address account => uint256) threshold;        // e.g., 10 ETH
    mapping(address account => uint256) timelockPeriod;   // e.g., 24 hours

    // Pending large transactions
    mapping(address account => mapping(bytes32 txHash => PendingTx)) pendingTxs;
    mapping(address account => bytes32[]) pendingTxHashes;  // For enumeration
}

struct PendingTx {
    address target;
    uint256 value;
    bytes data;
    uint256 proposedAt;
}

bytes32 constant LARGE_TX_EXECUTOR_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.LargeTransactionExecutorModule")) - 1)) & ~bytes32(uint256(0xff));
```

### LargeTransactionGuardHook Storage

**Namespace:** `ethaura.storage.LargeTransactionGuardHook`

- Built-in hook, installed at account initialization
- Reads threshold from LargeTransactionExecutorModule (single source of truth)
- No threshold storage - only stores executor address

```solidity
/// @custom:storage-location erc7201:ethaura.storage.LargeTransactionGuardHook
struct LargeTransactionGuardHookStorage {
    // LargeTransactionExecutorModule address (set at initialization)
    // Hook reads threshold from this executor
    address executor;
}

bytes32 constant LARGE_TX_GUARD_STORAGE_LOCATION =
    keccak256(abi.encode(uint256(keccak256("ethaura.storage.LargeTransactionGuardHook")) - 1)) & ~bytes32(uint256(0xff));
```

## Storage Slot Calculations

| Component | Namespace | Slot (first 8 bytes) |
|-----------|-----------|---------------------|
| P256ModularAccount | ethaura.storage.P256ModularAccount | 0x... (calculated at compile) |
| P256MFAValidatorModule | ethaura.storage.P256MFAValidatorModule | 0x... |
| GuardianManagerModule | ethaura.storage.GuardianManagerModule | 0x... |
| SocialRecoveryModule | ethaura.storage.SocialRecoveryModule | 0x... |
| HookManagerModule | ethaura.storage.HookManagerModule | 0x... |
| LargeTransactionExecutorModule | ethaura.storage.LargeTransactionExecutorModule | 0x... |
| LargeTransactionGuardHook | ethaura.storage.LargeTransactionGuardHook | 0x... |

## Storage Access Patterns

### Module Storage Access
```solidity
library P256ValidatorLib {
    function _getStorage() internal pure returns (P256ValidatorStorage storage $) {
        bytes32 location = P256_VALIDATOR_STORAGE_LOCATION;
        assembly {
            $.slot := location
        }
    }
    
    function getPasskey(address account, bytes32 passkeyId) internal view returns (PasskeyInfo storage) {
        return _getStorage().passkeys[account][passkeyId];
    }
}
```

## Security Considerations

1. **Namespace Isolation**: Each module has unique namespace preventing collisions
2. **Account Isolation**: All module storage is keyed by account address
3. **Upgrade Safety**: ERC-7201 ensures storage compatibility across upgrades
4. **No Slot Overlap**: Calculated slots are guaranteed unique by keccak256

