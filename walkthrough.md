# Social Recovery UI Integration Walkthrough

This document details the changes made to integrate the Social Recovery Module into the frontend UI.

## 1. New Hooks

### `useSocialRecovery.js`
- **Purpose**: Encapsulates all interactions with the `SocialRecoveryModule` contract.
- **Features**:
    - Fetches guardian list, threshold, and timelock.
    - Monitors pending recovery requests.
    - Provides functions to add/remove guardians, change config, and manage recovery flows.
    - Handles data refetching and loading states.

### `useUserOperation.js`
- **Purpose**: Generic hook for executing ERC-4337 UserOperations.
- **Features**:
    - Abstraction over building, signing, and sending UserOps.
    - Supports both **Owner-Only** and **Passkey/2FA** signing flows.
    - Handles gas estimation and bundler submission.
    - Returns transaction status and hash.

## 2. Component Updates

### `GuardianManager.jsx`
- **Changes**:
    - Replaced stubbed logic with `useSocialRecovery` hook.
    - Replaced generic transaction sender with `useUserOperation` hook.
    - Added UI for adding/removing guardians and setting threshold.
    - Displays real-time guardian status from the blockchain.

### `RecoveryManager.jsx`
- **Changes**:
    - Replaced stubbed logic with `useSocialRecovery` hook.
    - Implemented full recovery flow: **Initiate -> Approve -> Execute**.
    - Added "Cancel Recovery" for the account owner.
    - Displays pending recovery requests with countdowns.

## 3. Integration with Account Manager

### `modularAccountManager.js`
- Added `SocialRecoveryManager` class to handle contract encoding/decoding.
- Integrated `SOCIAL_RECOVERY_ABI`.

## 4. Verification Steps

To verify the integration manually:
1.  **Deploy Account**: Ensure you have a deployed modular account with `SocialRecoveryModule` installed.
2.  **Add Guardian**:
    - Go to **Security Settings** -> **Guardians**.
    - Enter an address and click **Add**.
    - Confirm transaction (Check if Passkey/Owner signature is requested correctly).
3.  **Initiate Recovery** (Simulate):
    - Connect as a different address (Guardian).
    - Go to **Recovery** page.
    - Propose a new owner or passkey.
4.  **Approve Recovery**:
    - As another Guardian (if threshold > 1), approve the request.
5.  **Execute Recovery**:
    - Once threshold is met and timelock passes, execute the recovery.

## 5. Next Steps
- Deploy `SocialRecoveryModule` to testnet.
- Perform end-to-end integration testing with a real Bundler and Validator.
