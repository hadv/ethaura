# ERC-7579 Research & Analysis

## Overview

This document summarizes research on ERC-7579 (Minimal Modular Smart Accounts) for the P256Account migration.

## ERC-7579 Standard Summary

### Module Types
| Type ID | Name | Purpose |
|---------|------|---------|
| 1 | Validator | Validates transactions during ERC-4337 validation phase |
| 2 | Executor | Executes transactions on behalf of the account via callback |
| 3 | Fallback | Extends account functionality via fallback handler |
| 4 | Hook | Pre/post execution checks and custom logic |

### Core Interfaces

#### Account Interface (IERC7579Account)
- `execute(ModeCode mode, bytes calldata executionCalldata)` - Execute transactions
- `executeFromExecutor(ModeCode mode, bytes calldata executionCalldata)` - Execute from executor module
- `installModule(uint256 moduleTypeId, address module, bytes calldata initData)` - Install module
- `uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)` - Uninstall module
- `isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)` - Check if installed
- `supportsExecutionMode(ModeCode encodedMode)` - Check supported execution modes
- `supportsModule(uint256 moduleTypeId)` - Check supported module types
- `accountId()` - Return account implementation ID

#### Module Interface (IERC7579Module)
- `onInstall(bytes calldata data)` - Called during installation
- `onUninstall(bytes calldata data)` - Called during uninstallation
- `isModuleType(uint256 moduleTypeId)` - Check module type
- `isInitialized(address smartAccount)` - Check if initialized for account

#### Validator Interface (IERC7579Validator)
- `validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)` - Validate user operation
- `isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data)` - ERC-1271 validation

#### Hook Interface (IERC7579Hook)
- `preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)` - Pre-execution check
- `postCheck(bytes calldata hookData)` - Post-execution check

### Execution Modes
Encoded in bytes32:
- **CallType** (1 byte): 0x00=single, 0x01=batch, 0xfe=staticcall, 0xff=delegatecall
- **ExecType** (1 byte): 0x00=revert on failure, 0x01=try/catch
- **Unused** (4 bytes): Reserved for future use
- **ModeSelector** (4 bytes): Custom mode selector
- **ModePayload** (22 bytes): Additional data

## Reference Implementations Analysis

### 1. ZeroDev Kernel v3
**Architecture:**
- Modular validation system with `ValidationManager`
- Supports root validator + plugin validators
- Hook system integrated with validators/executors
- Uses nonce encoding for validator selection

**Key Patterns:**
- `ValidationId` for identifying validators (21 bytes)
- `ValidationConfig` stores nonce + hook per validator
- Selector-based access control for validators
- EIP-712 domain separation

**Storage:**
- Uses custom storage slots for validation data
- Hook stored per validator/executor

### 2. Biconomy Nexus v1.2
**Architecture:**
- UUPS upgradeable
- Sentinel list for validator management
- Default validator pattern
- Registry integration (ERC-7484)

**Key Patterns:**
- `ModuleManager` base contract for module handling
- `ExecutionHelper` for execution logic
- Emergency hook uninstall with 1-day timelock
- PREP mode for account initialization

**Storage:**
- Uses `AccountStorage` struct with namespaced storage
- Sentinel lists for validators/executors

### 3. Rhinestone ModuleKit
**Purpose:** Development kit for building ERC-7579 modules

**Base Contracts:**
- `ERC7579ValidatorBase` - Base for validators
- `ERC7579ExecutorBase` - Base for executors
- `ERC7579HookBase` - Base for hooks
- `ERC7579FallbackBase` - Base for fallback handlers

## P256Account Feature Mapping

| Current Feature | ERC-7579 Module Type | Notes |
|-----------------|---------------------|-------|
| Passkey validation (P256/WebAuthn) | Validator (1) | P256MFAValidatorModule |
| Owner validation (secp256k1) | Validator (1) | Part of MFA in P256MFAValidatorModule |
| Multi-factor authentication | Validator (1) | MFA handled in validator, not hook |
| Guardian management | Executor (2) | Guardian operations |
| Social recovery | Executor (2) + Hook (4) | Recovery with timelock |
| Passkey management | Executor (2) | Add/remove passkeys |
| EIP-1271 signatures | Validator (1) | Forward to validator |

## Key Design Decisions

### 1. Validator Selection
- Use nonce-based validator selection (like Kernel)
- Support multiple validators with different permissions

### 2. MFA Implementation
- Owner (Web3Auth) signature is always required (mandatory)
- Passkey signature is the additional factor when MFA is enabled
- Both validated in P256MFAValidatorModule during `validateUserOp`
- Hooks are for execution-time checks only (e.g., timelocks)

### 3. Storage Layout
- Use ERC-7201 namespaced storage
- Separate storage per module type
- Account-level storage for core state

### 4. Security Model
- Timelocks for sensitive operations (passkey updates, recovery)
- Guardian threshold for social recovery
- Emergency uninstall mechanism for hooks

## Next Steps
1. Design detailed module architecture
2. Define ERC-7201 storage layout
3. Document security model
4. Create interface specifications

