# 2FA Flow Reordering - Implementation Summary

## Overview

Updated the transaction signing flow for 2FA-enabled accounts to show the Web3Auth social account popup **first**, followed by passkey confirmation as the **second factor**.

## Previous Flow (2FA Enabled)

1. ❌ Sign with Passkey (P-256) first
2. ❌ Then show Web3Auth confirmation dialog
3. ❌ Then sign with Web3Auth wallet

**Problem:** Passkey was the primary interaction, Web3Auth was secondary.

## New Flow (2FA Enabled)

1. ✅ **Step 1/2:** Show Web3Auth confirmation dialog FIRST
   - User reviews transaction details
   - User confirms with social login account
   - Web3Auth signature obtained

2. ✅ **Step 2/2:** Show passkey confirmation (biometric) SECOND
   - User prompted for Touch ID/Face ID/Windows Hello
   - Passkey signature obtained
   - Signatures combined and submitted

**Benefit:** Web3Auth (social login) is the primary authentication, passkey is the 2FA confirmation.

## Files Modified

### 1. `frontend/src/components/TransactionSender.jsx`

**Changes:**
- Reordered signing steps when 2FA is enabled
- Web3Auth signature is now requested BEFORE passkey signature
- Updated status messages to show step numbers (Step 1/2, Step 2/2)
- Added `isTwoFactorAuth` and `signatureStep` parameters to signature confirmation dialog

**Key Code Sections:**
```javascript
// Step 4: Check if 2FA is enabled - if so, get Web3Auth signature FIRST
if (accountInfo.twoFactorEnabled) {
  setStatus('🔐 Step 1/2: Requesting signature from your social login account...')
  ownerSig = await requestSignatureWithConfirmation({
    // ... signature data
    isTwoFactorAuth: true,
    signatureStep: '1/2',
  })
}

// Step 5: Sign with Passkey (P-256)
// If 2FA enabled: This is Step 2/2 (passkey as 2FA confirmation)
const stepLabel = accountInfo.twoFactorEnabled ? 'Step 2/2' : 'Only step'
setStatus(`🔑 ${stepLabel}: Signing with your passkey (biometric)...`)
```

### 2. `frontend/src/components/SignatureConfirmationDialog.jsx`

**Changes:**
- Added support for `isTwoFactorAuth` and `signatureStep` props
- Updated dialog title to show step number when 2FA is enabled
- Updated description text to explain the 2FA flow
- Clear messaging that passkey confirmation will follow

**Key Code Sections:**
```javascript
<h2>🔐 Signature Required {isTwoFactorAuth && `(Step ${signatureStep})`}</h2>

<p>
  {isTwoFactorAuth 
    ? '🔑 Step 1/2: Your social login account needs to sign this transaction. After this, you\'ll be prompted to confirm with your passkey (biometric).'
    : 'Your social login account needs to sign this transaction. Please review the details below:'}
</p>
```

## User Experience

### For 2FA-Enabled Accounts

**Before:**
1. Biometric prompt (passkey)
2. Web3Auth confirmation dialog
3. Web3Auth signature

**After:**
1. Web3Auth confirmation dialog (Step 1/2)
   - Clear indication this is the first step
   - User reviews transaction details
   - User confirms with social login
2. Biometric prompt (Step 2/2)
   - Clear indication this is the second factor
   - User confirms with passkey

### For Non-2FA Accounts

**No change** - Still shows Web3Auth confirmation dialog with "Only step" label.

## Status Messages

### 2FA Enabled
- `🔐 Step 1/2: Requesting signature from your social login account...`
- `🔑 Step 2/2: Signing with your passkey (biometric)...`
- `🔑 Step 2/2: Decoding P-256 signature...`

### 2FA Disabled
- `🔐 Requesting signature from your social login account...` (owner-only)
- `🔑 Only step: Signing with your passkey (biometric)...`

## Backward Compatibility

✅ **Fully backward compatible**
- Owner-only accounts: No changes
- 2FA-disabled accounts: No changes
- Only affects 2FA-enabled accounts with passkey

## Testing Checklist

- [ ] Test 2FA-enabled account: Web3Auth dialog appears first
- [ ] Test 2FA-enabled account: Passkey prompt appears after Web3Auth
- [ ] Test 2FA-enabled account: Step numbers display correctly
- [ ] Test 2FA-disabled account: Passkey prompt appears first
- [ ] Test owner-only account: Web3Auth dialog appears with "Only step" label
- [ ] Test transaction submission: Signatures combined correctly
- [ ] Test transaction submission: UserOperation submitted successfully

