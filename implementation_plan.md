# Social Recovery UI Integration Plan

The goal is to connect the existing (but stubbed) Social Recovery UI components to the deployed `SocialRecoveryModule` contract.

## User Review Required

> [!IMPORTANT]
> Ensure the `SOCIAL_RECOVERY_MODULE_ADDRESS` is correctly set in the frontend configuration (environment variables or constants file) after deployment.

## Proposed Changes

### Frontend Logic

#### [MODIFY] [modularAccountManager.js](file:///Users/hadv/ethaura/frontend/src/lib/modularAccountManager.js)
- Add `SOCIAL_RECOVERY_ABI` for the module.
- Create `SocialRecoveryManager` class to handle module interactions:
    - `getGuardians(account)`
    - `getRecoveryConfig(account)`
    - `isGuardian(account, address)`
    - `getRecoveryRequest(account, nonce)`
    - `encodeAddGuardian(guardian)`
    - `encodeRemoveGuardian(guardian)`
    - `encodeSetRecoveryConfig(threshold, timelock)`
    - `encodeInitiateRecovery(...)`
    - `encodeApproveRecovery(...)`
    - `encodeExecuteRecovery(...)`
    - `encodeCancelRecovery(...)`
- Export `createSocialRecoveryManager`.

#### [NEW] [useSocialRecovery.js](file:///Users/hadv/ethaura/frontend/src/hooks/useSocialRecovery.js)
- Create a React hook `useSocialRecovery(accountAddress)` that provides:
    - State: `guardians`, `threshold`, `timelock`, `pendingRecoveries`, `isGuardian`
    - Actions: `addGuardian`, `removeGuardian`, `setThreshold`, `initiateRecovery`, `approveRecovery`, `executeRecovery`, `cancelRecovery` (all wrapping account execution).

### Frontend Components

#### [MODIFY] [GuardianManager.jsx](file:///Users/hadv/ethaura/frontend/src/components/GuardianManager.jsx)
- Replace stubbed functions with `useSocialRecovery` hook calls.
- Implement real data loading for guardian list and status.

#### [MODIFY] [RecoveryManager.jsx](file:///Users/hadv/ethaura/frontend/src/components/RecoveryManager.jsx)
- Replace stubbed functions with `useSocialRecovery` hook calls.
- Implement real data loading for recovery requests.

## Verification Plan

### Manual Verification
1.  **Environment Setup**: Ensure frontend is connected to the network where modules are deployed (e.g. Sepolia or local Anvil).
2.  **Add Guardian**:
    -   Open "Guardian Management".
    -   Enter a valid address (e.g. a second wallet).
    -   Click "Add Guardian".
    -   Confirm transaction in wallet.
    -   Verify the address appears in "Current Guardians" list.
3.  **Initiate Recovery**:
    -   Switch to the Guardian wallet (if testing with 2 wallets) or use the Owner wallet (since owner is also a guardian usually).
    -   Go to "Recovery".
    -   Propose a recovery (e.g. change owner to a 3rd wallet).
    -   Verify a "Pending Recovery" card appears.
4.  **Approve/Execute**:
    -   If threshold > 1, switch to another guardian and approve.
    -   If threshold met + timelock passed, click "Execute".
    -   Verify the account owner changes on-chain (using `cast` or UI).
