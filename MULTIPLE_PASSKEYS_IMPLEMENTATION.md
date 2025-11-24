# Multiple Passkeys Implementation

## Overview

This implementation adds support for multiple passkeys per P256Account, allowing users to register passkeys on multiple devices (laptop, phone, tablet, hardware security keys) for enhanced security and device redundancy.

## Key Features

### 1. **Multiple Passkey Storage**
- Each account can have up to **10 active passkeys** (configurable via `MAX_PASSKEYS`)
- Passkeys are stored in a mapping with unique IDs: `passkeyId = keccak256(abi.encodePacked(qx, qy))`
- Each passkey includes metadata: coordinates (qx, qy), timestamp added, and active status

### 2. **Security Model**
- **OR Logic**: Any active passkey can authorize transactions
- **Passkey-only operations**: Adding/removing passkeys requires passkey signature (via EntryPoint)
- **24-hour timelock** for passkey removal to prevent malicious immediate removal
- **Cannot remove last passkey**: Prevents account lockout
- **Max limit enforcement**: Prevents excessive gas costs during signature verification

### 3. **Core Functions**

#### Adding Passkeys
```solidity
function addPasskey(bytes32 _qx, bytes32 _qy) external
```
- Only callable via EntryPoint (requires existing passkey signature)
- Validates coordinates are non-zero
- Enforces MAX_PASSKEYS limit
- Emits `PasskeyAdded` event

#### Removing Passkeys
```solidity
function proposePasskeyRemoval(bytes32 _qx, bytes32 _qy) external returns (bytes32)
function executePasskeyRemoval(bytes32 actionHash) external
function cancelPasskeyRemoval(bytes32 actionHash) external
```
- Proposal requires passkey signature (via EntryPoint)
- 24-hour timelock before execution
- Prevents removing the last active passkey
- User can cancel with passkey signature
- Marks passkey as inactive (preserves history)

### 4. **Signature Verification**

#### validateUserOp
- Checks WebAuthn signature against **ALL active passkeys** (OR logic)
- During counterfactual deployment: uses initial passkey from initCode
- After deployment: iterates through all active passkeys
- First valid signature passes verification

#### isValidSignature (EIP-1271)
- Checks P256 signature against **ALL active passkeys** (OR logic)
- Fallback to deprecated qx/qy for backward compatibility

### 5. **View Functions**
- `getPasskeyCount()`: Total number of passkeys
- `getActivePasskeyCount()`: Number of active passkeys
- `getPasskeyByIndex(uint256)`: Get passkey by array index
- `getPasskeyById(bytes32)`: Get passkey by ID
- `getAllPasskeys()`: Get all passkeys with metadata
- `getPendingPasskeyRemoval(bytes32)`: Get pending removal details

### 6. **Recovery Integration**
- Guardian recovery **deactivates ALL existing passkeys**
- Adds new recovery passkey as the only active passkey
- Prevents compromised passkeys from being used after recovery

## Security Considerations

### ✅ **Implemented Security Features**

1. **Timelock Protection**
   - 24-hour timelock for passkey removal
   - User can cancel malicious removal attempts with passkey signature

2. **Last Passkey Protection**
   - Cannot remove the last active passkey
   - Double-check during execution to prevent race conditions

3. **Access Control**
   - All passkey operations require EntryPoint authentication
   - Only passkey signatures can add/remove passkeys (owner cannot bypass)

4. **Gas Optimization**
   - MAX_PASSKEYS limit (10) prevents excessive iteration
   - Early exit in loops when signature is found
   - Inactive passkeys marked (not deleted) to preserve history

5. **Replay Protection**
   - Each removal action has unique hash based on timestamp
   - Action hash prevents replay attacks

6. **Backward Compatibility**
   - Deprecated qx/qy storage maintained
   - Existing accounts work without changes
   - isValidSignature has fallback to old storage

### 🔒 **Security Best Practices**

1. **Passkey ID Generation**: Uses `keccak256(qx, qy)` for deterministic, collision-resistant IDs
2. **Active Flag**: Allows deactivation without losing history
3. **Metadata Tracking**: Stores timestamp for audit trail
4. **Event Emission**: All operations emit events for transparency

## Gas Considerations

- **Adding passkey**: ~50k gas (storage write + array push)
- **Signature verification**: O(n) where n = number of active passkeys
  - Worst case: 10 passkeys × ~100k gas = ~1M gas
  - Average case: 2-3 passkeys × ~100k gas = ~200-300k gas
  - Early exit optimization reduces actual cost

## Testing Requirements

1. **Basic Operations**
   - Add passkey successfully
   - Remove passkey with timelock
   - Cancel passkey removal

2. **Security Tests**
   - Cannot remove last passkey
   - Cannot exceed MAX_PASSKEYS
   - Timelock enforcement
   - Only EntryPoint can call functions

3. **Signature Verification**
   - Any active passkey can sign
   - Inactive passkeys cannot sign
   - Multiple passkeys work correctly

4. **Recovery**
   - Recovery deactivates all passkeys
   - New passkey becomes only active one

## Migration Notes

Since we're in development mode, no migration is needed. Existing accounts will:
- Have their initial passkey added to the new storage during `initialize()`
- Maintain backward compatibility via deprecated qx/qy storage
- Work seamlessly with the new multi-passkey system

