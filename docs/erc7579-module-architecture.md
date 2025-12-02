# ERC-7579 Module Architecture for P256Account

## Overview

This document describes the modular architecture for migrating P256Account to ERC-7579.

## Module Hierarchy

```
P256ModularAccount (Core Account)
├── Validators (Type 1)
│   ├── P256MFAValidatorModule - Owner (mandatory) + Passkey (when MFA enabled)
│   ├── SessionKeyValidatorModule - Session keys with time bounds, target restrictions, spending limits
│   └── PQMFAValidatorModule - Dilithium + MFA (future: post-quantum)
│
├── Executors (Type 2)
│   ├── SocialRecoveryModule - Guardian management + recovery with threshold + timelock
│   ├── HookManagerModule - Install/uninstall user hooks
│   └── LargeTransactionExecutorModule - Timelock for high-value txs (built-in, disabled by default)
│
├── Fallback (Type 3)
│   ├── ERC721ReceiverModule - Receive NFTs via safeTransferFrom
│   └── ERC1155ReceiverModule - Receive multi-tokens
│
└── Hooks (Type 4)
    └── MultiHook (wrapper for chaining hooks)
        ├── LargeTransactionGuardHook - Built-in (disabled by default, threshold = type(uint256).max)
        └── User-installed hooks (WhitelistHook, SpendingLimitHook, etc.)
```

**Key Design Decisions:**
- No separate ECDSAValidatorModule - recovery handled by SocialRecoveryModule (Executor)
- MultiHook allows users to install 3rd party hooks for custom execution checks
- HookManagerModule provides clean API for hook installation/removal
- Recovery timelock enforced inside SocialRecoveryModule (not via hook)
- LargeTransactionExecutorModule + LargeTransactionGuardHook installed at init (disabled by default)
- Set threshold to enable large tx protection (threshold = type(uint256).max means disabled)
- Post-quantum upgrade path: swap P256MFAValidatorModule → PQMFAValidatorModule (no account upgrade needed)

## Future Work: Post-Quantum Validator

### PQMFAValidatorModule (Planned)

**Purpose:** Post-quantum resistant MFA validation using Dilithium signatures

**Status:** Future implementation (when post-quantum standards mature)

**Design Notes:**
- Uses CRYSTALS-Dilithium (NIST FIPS 204) for signature verification
- Same MFA pattern: Owner (mandatory) + PQ signature (when MFA enabled)
- Drop-in replacement for P256MFAValidatorModule
- Migration: uninstall P256MFAValidatorModule, install PQMFAValidatorModule
- No account contract upgrade required (modular architecture benefit)

**Migration Path:**
```
Current: P256MFAValidatorModule (ECDSA + P256)
    ↓
Future:  PQMFAValidatorModule (ECDSA + Dilithium)
    ↓
Long-term: FullPQValidatorModule (Dilithium only, when ECDSA deprecated)
```

**Considerations:**
- Dilithium signature size: ~2.4KB (vs P256: 64 bytes)
- Gas costs will be higher for on-chain verification
- May require off-chain verification with on-chain proof
- EIP-7212 equivalent for Dilithium precompile would help

## Core Account: P256ModularAccount

### Responsibilities
- ERC-4337 validateUserOp delegation to validators
- ERC-7579 execute/executeFromExecutor
- Module installation/uninstallation
- ERC-1271 signature validation forwarding

### Key Interfaces
```solidity
interface IP256ModularAccount is IERC7579Account {
    // Account initialization
    function initialize(
        address defaultValidator,
        bytes calldata validatorData,
        address hook,
        bytes calldata hookData
    ) external;
    
    // Validator selection (encoded in userOp.nonce)
    function getActiveValidator() external view returns (address);
}
```

## Validator Modules

### 1. P256MFAValidatorModule (Type 1)

**Purpose:** Validate owner ECDSA signature with optional passkey as additional factor (MFA)

**Storage (per account):**
```solidity
struct PasskeyInfo {
    bytes32 qx;
    bytes32 qy;
    uint256 addedAt;
    bool active;
    bytes32 deviceId;
}

mapping(address account => mapping(bytes32 passkeyId => PasskeyInfo)) passkeys;
mapping(address account => bytes32[]) passkeyIds;
mapping(address account => address) owners;        // Owner (Web3Auth) - always required
mapping(address account => bool) mfaEnabled;       // MFA toggle
```

**Validation Modes:**
- `mfaEnabled = false`: Owner ECDSA signature only
- `mfaEnabled = true`: Owner ECDSA signature + Passkey signature (MFA)

**Interface:**
```solidity
interface IP256MFAValidatorModule is IValidator {
    // Passkey management (called by account)
    function addPasskey(bytes32 qx, bytes32 qy, bytes32 deviceId) external;
    function removePasskey(bytes32 passkeyId) external;

    // MFA management
    function enableMFA() external;
    function disableMFA() external;
    function isMFAEnabled(address account) external view returns (bool);

    // Owner management (called by SocialRecoveryModule during recovery)
    function setOwner(address newOwner) external;
    function getOwner(address account) external view returns (address);

    // View functions
    function getPasskeyCount(address account) external view returns (uint256);
    function getPasskey(address account, bytes32 passkeyId) external view returns (PasskeyInfo memory);
    function isPasskeyActive(address account, bytes32 passkeyId) external view returns (bool);
}
```

### 2. SessionKeyValidatorModule (Type 1)

**Purpose:** Validate session key signatures with granular permissions for gasless/automated transactions

**Storage (per account):**
```solidity
struct SessionKeyPermission {
    address sessionKey;        // EOA that can sign
    uint48 validAfter;         // Start timestamp
    uint48 validUntil;         // Expiry timestamp
    address[] allowedTargets;  // Contracts it can call (empty = any)
    bytes4[] allowedSelectors; // Functions it can call (empty = any)
    uint256 spendLimitPerTx;   // Max ETH per transaction (0 = unlimited)
    uint256 spendLimitTotal;   // Max ETH total (0 = unlimited)
}

struct SessionKeyData {
    bool active;
    uint48 validAfter;
    uint48 validUntil;
    uint256 spendLimitPerTx;
    uint256 spendLimitTotal;
    uint256 spentTotal;
}

mapping(address account => mapping(address sessionKey => SessionKeyData)) sessionKeys;
mapping(address account => address[]) sessionKeyList;
mapping(address account => mapping(address sessionKey => mapping(address target => bool))) allowedTargets;
mapping(address account => mapping(address sessionKey => mapping(bytes4 selector => bool))) allowedSelectors;
```

**Interface:**
```solidity
interface ISessionKeyValidatorModule is IValidator {
    // Session key management (called by account)
    function createSessionKey(SessionKeyPermission calldata permission) external;
    function revokeSessionKey(address sessionKey) external;

    // View functions
    function getSessionKey(address account, address sessionKey)
        external view returns (bool active, uint48 validAfter, uint48 validUntil,
            uint256 limitPerTx, uint256 limitTotal, uint256 spentTotal);
    function getSessionKeys(address account) external view returns (address[] memory);
    function getSessionKeyCount(address account) external view returns (uint256);
    function isSessionKeyValid(address account, address sessionKey) external view returns (bool);
    function isTargetAllowed(address account, address sessionKey, address target) external view returns (bool);
    function isSelectorAllowed(address account, address sessionKey, bytes4 selector) external view returns (bool);
}
```

**Use Cases:**
- **Gaming:** Allow game backend to submit moves without user signing each one
- **Trading bots:** Automated trading within spending limits
- **Subscriptions:** Recurring payments to specific addresses
- **Batch operations:** DeFi automation with selector restrictions

**Signature Format:**
```
┌────────────────────┬─────────────────────────┐
│ Session Key (20B)  │ ECDSA Signature (65B)   │
└────────────────────┴─────────────────────────┘
Total: 85 bytes
```

**Validation Flow:**
```
1. Extract sessionKey address from signature prefix
2. Verify session key is active and within time bounds
3. Verify ECDSA signature from session key
4. Check target and selector permissions
5. Check and update spending limits
6. Return validation success
```

## Executor Modules

### 3. SocialRecoveryModule (Type 2)

**Purpose:** Guardian management + social recovery with **threshold** and **timelock**

**Storage (per account):**
```solidity
// Guardian management
mapping(address account => mapping(address guardian => bool)) guardians;
mapping(address account => address[]) guardianList;

// Recovery configuration
struct RecoveryConfig {
    uint256 threshold;          // e.g., 2 for "2 of 3 guardians"
    uint256 timelockPeriod;     // e.g., 24 hours (86400 seconds)
}

struct RecoveryRequest {
    bytes32 newPasskeyQx;
    bytes32 newPasskeyQy;
    address newOwner;
    uint256 approvalCount;
    mapping(address guardian => bool) hasApproved;
    uint256 initiatedAt;        // When first guardian approved
    uint256 executeAfter;       // initiatedAt + timelockPeriod (set when threshold met)
    bool thresholdMet;          // True when approvalCount >= threshold
    bool executed;
    bool cancelled;
}

mapping(address account => RecoveryConfig) recoveryConfig;
mapping(address account => uint256) recoveryNonce;
mapping(address account => mapping(uint256 => RecoveryRequest)) recoveryRequests;
```

**Interface:**
```solidity
interface ISocialRecoveryModule is IExecutor {
    // Guardian management (called by account owner)
    function addGuardian(address guardian) external;
    function removeGuardian(address guardian) external;
    function getGuardians(address account) external view returns (address[] memory);
    function isGuardian(address account, address guardian) external view returns (bool);
    function getGuardianCount(address account) external view returns (uint256);

    // Recovery configuration (called by account owner)
    function setRecoveryConfig(uint256 threshold, uint256 timelockPeriod) external;
    function getRecoveryConfig(address account) external view returns (uint256 threshold, uint256 timelockPeriod);

    // Recovery flow (called by guardians)
    function initiateRecovery(bytes32 newQx, bytes32 newQy, address newOwner) external;
    function approveRecovery(uint256 nonce) external;

    // Execution (called by anyone after threshold + timelock)
    function executeRecovery(uint256 nonce) external;

    // Cancellation (called by account owner with valid signature)
    function cancelRecovery(uint256 nonce) external;

    // View functions
    function getRecoveryRequest(address account, uint256 nonce) external view returns (RecoveryRequest memory);
    function isRecoveryReady(address account, uint256 nonce) external view returns (bool);
}
```

**Recovery Flow:**
```
Guardian 1 calls initiateRecovery(newPasskeyPubKey)
    → approvalCount = 1, initiatedAt = now
        ↓
Guardian 2 calls approveRecovery()
    → approvalCount = 2, threshold met (2/3)!
    → executeAfter = now + 24h (timelock starts)
        ↓
    24h timelock period
    (Owner can cancelRecovery() during this time)
        ↓
Anyone calls executeRecovery()
    → Checks: thresholdMet && block.timestamp >= executeAfter
    → Calls P256MFAValidatorModule.updatePasskey(newQx, newQy)
        ↓
User can now use new passkey ✅
```

**Security Features:**
- **Threshold**: Multiple guardians must approve (e.g., 2 of 3)
- **Timelock**: Mandatory delay after threshold is met (e.g., 24h)
- **Cancellation**: Owner can cancel anytime before execution
- **No bypass**: Recovery updates passkey, doesn't bypass MFA

## Fallback Modules

Fallback modules handle function calls the account doesn't recognize (unknown selectors).

### 5. ERC721ReceiverModule (Type 3 - Fallback)

**Purpose:** Allow account to receive NFTs via `safeTransferFrom`

```solidity
contract ERC721ReceiverModule is IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        // Can add custom logic here (e.g., auto-list on marketplace)
        return IERC721Receiver.onERC721Received.selector;
    }
}
```

**Installation:**
```solidity
account.installModule(
    MODULE_TYPE_FALLBACK,  // type = 3
    erc721ReceiverModule,
    abi.encode(IERC721Receiver.onERC721Received.selector)
);
```

### 6. ERC1155ReceiverModule (Type 3 - Fallback)

**Purpose:** Allow account to receive multi-tokens (ERC1155)

```solidity
contract ERC1155ReceiverModule is IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
```

### 7. HookManagerModule (Type 2 - Executor)

**Purpose:** Provides clean API for users to install/uninstall hooks

```solidity
interface IHookManagerModule {
    // Hook installation
    function installHook(address hook, bytes calldata initData) external;
    function uninstallHook(address hook) external;

    // Emergency uninstall (if hook blocks all txs)
    function proposeEmergencyUninstall(address hook) external;
    function executeEmergencyUninstall(address hook) external;

    // View functions
    function getInstalledHooks(address account) external view returns (address[] memory);
    function isHookInstalled(address account, address hook) external view returns (bool);
    function getEmergencyUninstallTime(address account, address hook) external view returns (uint256);
}
```

**Hook Installation Flow:**
```
User wants to install WhitelistHook
        ↓
1. Create UserOperation:
   - target: HookManagerModule
   - data: installHook(whitelistHookAddress, initData)
        ↓
2. Sign with Owner + Passkey (if MFA enabled)
        ↓
3. Submit to EntryPoint
        ↓
4. HookManagerModule.installHook() called
   - Validates hook implements IHook
   - Calls MultiHook.addHook(whitelistHookAddress)
   - Initializes hook with initData
        ↓
5. WhitelistHook now runs on every transaction ✅
```

**Emergency Uninstall Flow:**
```
Malicious hook blocks all transactions
        ↓
1. User calls proposeEmergencyUninstall(hookAddress)
   (via guardian or social recovery mechanism)
        ↓
2. 24h timelock starts
        ↓
3. After timelock, call executeEmergencyUninstall()
        ↓
4. Hook removed, user can transact again ✅
```

### 8. LargeTransactionExecutorModule (Type 2 - Executor)

**Purpose:** Enforce timelock for high-value transactions

- Installed at account initialization (paired with LargeTransactionGuardHook)
- Disabled by default (threshold = type(uint256).max)
- User enables by setting a threshold (e.g., 10 ETH) and timelock period (e.g., 24h)

```solidity
interface ILargeTransactionExecutorModule {
    // Execute (propose on first call, execute after timelock)
    function execute(address target, uint256 value, bytes calldata data) external;

    // Cancel pending transaction
    function cancel(bytes32 txHash) external;

    // View pending transactions
    function getPendingTransaction(address account, bytes32 txHash)
        external view returns (uint256 proposedAt, address target, uint256 value, bytes memory data);

    function getPendingTransactions(address account)
        external view returns (bytes32[] memory txHashes);

    // Configuration (threshold = type(uint256).max means disabled)
    function setThreshold(uint256 threshold) external;
    function setTimelockPeriod(uint256 period) external;
    function getConfig(address account) external view returns (uint256 threshold, uint256 timelockPeriod);
    function disable() external;  // Sets threshold to type(uint256).max
}
```

**Large Transaction Flow:**
```
User wants to send 50 ETH (above threshold)
        ↓
1. User creates UserOperation:
   callData: account.execute(
       LargeTransactionExecutorModule,
       0,  // value = 0, just calling executor
       abi.encodeCall(execute, (recipient, 50 ETH, ""))
   )
        ↓
2. LargeTransactionExecutorModule.execute() called
   - First call: stores proposal, reverts "wait 24h"
        ↓
3. Wait 24 hours
        ↓
4. User submits same UserOperation again
        ↓
5. LargeTransactionExecutorModule.execute() called
   - Timelock passed: calls account.executeFromExecutor(recipient, 50 ETH)
        ↓
6. LargeTransactionGuardHook.preCheck()
   - value = 50 ETH, caller = LargeTransactionExecutorModule → ALLOW ✅
        ↓
50 ETH sent ✅
```

**Cancel Flow:**
```
Attacker proposes unauthorized 50 ETH transfer
        ↓
Owner notices pending tx (via UI/monitoring)
        ↓
Owner creates UserOperation:
   callData: account.execute(
       LargeTransactionExecutorModule,
       0,
       abi.encodeCall(cancel, (txHash))
   )
        ↓
LargeTransactionExecutorModule.cancel(txHash)
        ↓
Proposal deleted ✅
        ↓
Attacker tries to execute after 24h → fails (no proposal)
```

**Implementation:**
```solidity
contract LargeTransactionExecutorModule is IExecutorModule {
    struct PendingTx {
        address target;
        uint256 value;
        bytes data;
        uint256 proposedAt;
    }

    mapping(address account => uint256) public threshold;
    mapping(address account => uint256) public timelockPeriod;
    mapping(address account => mapping(bytes32 => PendingTx)) public pendingTxs;

    function execute(address target, uint256 value, bytes calldata data) external {
        address account = msg.sender;
        bytes32 txHash = keccak256(abi.encode(account, target, value, data));

        PendingTx storage pending = pendingTxs[account][txHash];

        if (pending.proposedAt == 0) {
            // First call - propose
            pending.target = target;
            pending.value = value;
            pending.data = data;
            pending.proposedAt = block.timestamp;
            revert("Large tx proposed, execute after timelock");
        }

        // Second call - execute if timelock passed
        require(
            block.timestamp >= pending.proposedAt + timelockPeriod[account],
            "Timelock not passed"
        );

        // Clear pending tx
        delete pendingTxs[account][txHash];

        // Execute via account
        IModularAccount(account).executeFromExecutor(target, value, data);
    }

    function cancel(bytes32 txHash) external {
        delete pendingTxs[msg.sender][txHash];
        emit TransactionCancelled(msg.sender, txHash);
    }
}
```

## Hook Modules

Hooks provide execution-time checks. Users can install 3rd party hooks to add custom logic.

### Hook Architecture

```
P256ModularAccount
└── globalHook (MultiHook wrapper)
    ├── LargeTransactionGuardHook - Built-in (disabled by default)
    └── User-installed hooks:
        ├── WhitelistHook - Contract whitelist
        ├── SpendingLimitHook - Daily/weekly limits
        └── ... (any 3rd party hook)
```

### 9. MultiHook (Type 4)

**Purpose:** Wrapper that chains multiple hooks together

```solidity
interface IMultiHook is IHook {
    function addHook(address hook) external;
    function removeHook(address hook) external;
    function getHooks() external view returns (address[] memory);
}

contract MultiHook is IHook {
    mapping(address account => address[]) internal hooks;

    function preCheck(
        address msgSender,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory) {
        address[] memory accountHooks = hooks[msg.sender];
        for (uint i = 0; i < accountHooks.length; i++) {
            IHook(accountHooks[i]).preCheck(msgSender, value, data);
        }
        return "";
    }

    function postCheck(bytes calldata hookData) external {
        // Call postCheck on all hooks
    }
}
```

### Built-in Hook: LargeTransactionGuardHook

**LargeTransactionGuardHook** - Enforce large transactions go through LargeTransactionExecutorModule:

- Installed at account initialization (paired with LargeTransactionExecutorModule)
- Reads threshold from LargeTransactionExecutorModule (single source of truth)
- No separate configuration needed - user only configures the executor

```solidity
contract LargeTransactionGuardHook is IHook {
    ILargeTransactionExecutorModule public executor;  // Set at initialization

    function preCheck(
        address msgSender,
        uint256 value,
        bytes calldata
    ) external returns (bytes memory) {
        // Read threshold from executor (single source of truth)
        uint256 accountThreshold = executor.threshold(msg.sender);

        // If disabled (max value) or small tx, allow
        if (accountThreshold == type(uint256).max || value <= accountThreshold) {
            return "";
        }

        // Large tx must come from LargeTransactionExecutorModule
        require(
            msgSender == address(executor),
            "Large tx must use LargeTransactionExecutorModule"
        );
        return "";
    }

    // No setThreshold() - reads from executor
}
```

**Configuration (executor only):**
```solidity
// Enable large tx protection
LargeTransactionExecutorModule.setThreshold(10 ether);
LargeTransactionExecutorModule.setTimelockPeriod(24 hours);
// Hook automatically uses same threshold ✅

// Disable
LargeTransactionExecutorModule.disable();
// Hook automatically disabled ✅
```

### Example: User-Installed Hooks

**WhitelistHook** - Only allow calls to whitelisted contracts:
```solidity
contract WhitelistHook is IHook {
    mapping(address account => mapping(address target => bool)) public whitelist;

    function preCheck(address, uint256, bytes calldata data) external returns (bytes memory) {
        address target = _extractTarget(data);
        require(whitelist[msg.sender][target], "Target not whitelisted");
        return "";
    }
}
```

**SpendingLimitHook** - Daily spending limits:
```solidity
contract SpendingLimitHook is IHook {
    mapping(address account => uint256) public dailyLimit;
    mapping(address account => uint256) public spentToday;

    function preCheck(address, uint256 value, bytes calldata) external returns (bytes memory) {
        require(spentToday[msg.sender] + value <= dailyLimit[msg.sender], "Limit exceeded");
        spentToday[msg.sender] += value;
        return "";
    }
}
```

### Hook Security

| Risk | Mitigation |
|------|------------|
| Malicious hook blocks txs | Emergency hook uninstall with timelock |
| Hook sees sensitive data | Use trusted/audited hooks only |
| Hook front-runs txs | Use on-chain hooks, avoid off-chain operators |

**Emergency Hook Uninstall:**
```solidity
// If a hook blocks all transactions, user can force-uninstall
function proposeHookUninstall(address hook) external;  // Start 24h timer
function executeHookUninstall(address hook) external;  // After timelock
```

**Note:** MFA validation is handled entirely in the P256MFAValidatorModule during the ERC-4337 validation phase, not in hooks. Hooks are for execution-time checks only.

## Module Interactions

```
User Transaction Flow:
1. UserOp submitted to EntryPoint
2. P256ModularAccount.validateUserOp called
3. Validator selected based on nonce encoding
4. P256MFAValidatorModule.validateUserOp verifies:
   - Owner ECDSA signature (always required)
   - Passkey signature (if MFA enabled - additional factor)
5. Transaction executed
6. Hooks postCheck called (if any)

Recovery Flow (threshold + timelock):
1. Guardian 1 calls SocialRecoveryModule.initiateRecovery(newPasskey)
2. Guardian 2 calls approveRecovery() → threshold met (e.g., 2/3)
3. 24h timelock starts (owner can cancel during this period)
4. After timelock, anyone calls executeRecovery()
5. SocialRecoveryModule updates passkey in P256MFAValidatorModule
```

## Security Considerations

1. **Module Authorization**: Only installed executors can call executeFromExecutor
2. **Validator Isolation**: Each validator has isolated storage per account
3. **Hook Enforcement**: Hooks cannot be bypassed for protected operations
4. **Timelock Protection**: Recovery has mandatory 24h delay
5. **Emergency Uninstall**: 1-day timelock for hook removal (like Nexus)

## Future: Post-Quantum Security Upgrade

ERC-7579's modular design enables seamless upgrade to post-quantum cryptography via validator swap.

### Current vs Future Validators

```
Current (Classical)                    Future (Post-Quantum)
═══════════════════════════════════    ═══════════════════════════════════

P256MFAValidatorModule            →    PQMFAValidatorModule
├── Owner: secp256k1 ECDSA             ├── Owner: Dilithium signature
└── Passkey: P256 (when MFA)           └── Passkey: Dilithium (when MFA)
```

### Validator Swap Process

```solidity
// Step 1: Install new PQ validator
account.installModule(MODULE_TYPE_VALIDATOR, pqMFAValidatorModule, pqInitData);

// Step 2: Uninstall old classical validator
account.uninstallModule(MODULE_TYPE_VALIDATOR, p256MFAValidatorModule, "");

// Result: Account now uses post-quantum cryptography
// No account contract upgrade needed!
```

### Migration Phases

**Phase 1: Preparation (Now)**
- Design modular validators with swap in mind
- Keep validator logic isolated from account logic

**Phase 2: Hybrid Mode (Transition)**
```
├── Validators (Type 1)
│   ├── P256MFAValidatorModule - Classical (existing)
│   └── HybridPQMFAValidatorModule - Classical + PQ (new)
```
- Users can choose hybrid (both signatures required) for maximum security
- Protects against "harvest now, decrypt later" attacks

**Phase 3: Full PQ (Future)**
```
├── Validators (Type 1)
│   └── PQMFAValidatorModule - Dilithium + MFA
```
- Uninstall classical validators
- Fully post-quantum secure

### Dependencies for Full PQ Migration

| Component | Current | Future Requirement |
|-----------|---------|-------------------|
| Owner (Web3Auth) | secp256k1 ECDSA | Web3Auth PQ support needed |
| Passkey | P256 ECDSA | WebAuthn PQ support needed |
| On-chain verification | Native EVM | EVM precompiles for PQ |

### NIST Post-Quantum Standards
| Algorithm | Type | Use Case |
|-----------|------|----------|
| ML-DSA (Dilithium) | Lattice-based | General signatures |
| FN-DSA (Falcon) | Lattice-based | Smaller signatures |
| SLH-DSA (SPHINCS+) | Hash-based | Conservative choice |

### Implementation Considerations
- **Gas costs**: PQ signatures are larger (~2-3KB), verification is expensive
- **Precompiles**: Future EVM precompiles may reduce PQ verification costs
- **Storage**: PQ public keys are larger (1-2KB vs 64 bytes for P256)
- **Timeline**: Install PQ module when NIST standards are finalized and EVM support improves

