# Error Handling Guide

## Overview

The P256Account SDK includes comprehensive error handling to provide clear, actionable feedback to users when things go wrong.

## Error Types

### 1. Network Errors (`NetworkError`)

**When they occur:**
- Internet connection issues
- RPC endpoint unavailable
- Request timeouts

**Examples:**
```javascript
NetworkError: Failed to connect to bundler. Please check your internet connection.
NetworkError: Request timed out. Please check your connection and try again.
```

**User Action:**
- Check internet connection
- Wait and retry
- Check if RPC/bundler URL is correct

---

### 2. Bundler Errors (`BundlerError`)

**When they occur:**
- Bundler service issues
- Rate limiting
- Invalid UserOperation
- Transaction reverted

**Examples:**
```javascript
BundlerError: Rate limit exceeded. Please wait a moment and try again.
BundlerError: Bundler service is temporarily unavailable. Please try again.
BundlerError: UserOperation failed on-chain. The transaction was reverted.
```

**User Action:**
- Wait and retry (for rate limits)
- Check UserOperation validity
- Check account balance

---

### 3. Validation Errors (`ValidationError`)

**When they occur:**
- Invalid UserOperation parameters
- Insufficient funds
- Invalid nonce
- Account already deployed

**Examples:**
```javascript
ValidationError: Insufficient funds in account to pay for gas. Please fund your account.
ValidationError: Invalid nonce. Your account state may have changed.
ValidationError: Account is already deployed.
```

**User Action:**
- Fund account with ETH
- Refresh page to get latest nonce
- Check transaction parameters

---

### 4. Signature Errors (`SignatureError`)

**When they occur:**
- Invalid passkey signature
- Invalid owner signature
- User cancelled biometric prompt

**Examples:**
```javascript
SignatureError: Invalid signature. Please try signing again.
SignatureError: Passkey authentication cancelled.
```

**User Action:**
- Try signing again
- Complete biometric authentication
- Check if correct passkey is being used

---

### 5. Gas Estimation Errors (`GasEstimationError`)

**When they occur:**
- Transaction would fail
- Gas estimation failed
- Gas limits too low/high

**Examples:**
```javascript
GasEstimationError: Failed to estimate gas. The transaction may fail.
```

**User Action:**
- Check if transaction is valid
- Increase gas limits manually
- Check account balance

---

## ERC-4337 Error Codes

The SDK automatically parses ERC-4337 error codes and provides user-friendly messages:

| Code | Meaning | User-Friendly Message |
|------|---------|----------------------|
| AA10 | Sender already constructed | Account is already deployed. |
| AA21 | Didn't pay prefund | Insufficient funds in account to pay for gas. Please fund your account. |
| AA22 | Expired or not due | Transaction expired or not yet valid. |
| AA23 | Reverted (or OOG) | Transaction validation failed. The operation may be invalid or out of gas. |
| AA24 | Signature error | Invalid signature. Please try signing again. |
| AA25 | Invalid account nonce | Invalid nonce. Your account state may have changed. |
| AA30 | Paymaster not deployed | Paymaster not found or not deployed. |
| AA31 | Paymaster deposit too low | Paymaster has insufficient funds. |
| AA32 | Paymaster expired | Paymaster signature expired. |
| AA33 | Paymaster reverted | Paymaster rejected the transaction. |
| AA34 | Paymaster signature error | Invalid paymaster signature. |

---

## Retry Logic

### Automatic Retries

The SDK automatically retries certain operations with exponential backoff:

**Retryable Errors:**
- Network timeouts
- Network unavailable
- Bundler timeouts
- Rate limiting
- RPC errors

**Retry Strategy:**
- Max retries: 3
- Base delay: 1000ms
- Exponential backoff: delay × 2^attempt
- Example: 1s → 2s → 4s

**Non-Retryable Errors:**
- Validation errors (invalid UserOperation)
- Signature errors
- Insufficient funds
- Invalid nonce

### Manual Retries

Users can manually retry failed operations. The UI shows a "🔄 This error is temporary - you can try again" message for retryable errors.

---

## Usage in Components

### TransactionSender Component

```javascript
import { getUserFriendlyMessage, getSuggestedAction, isRetryableError } from '../lib/errors'

try {
  const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)
  // Success!
} catch (err) {
  // Get user-friendly error message
  const friendlyMessage = getUserFriendlyMessage(err)
  const suggestedAction = getSuggestedAction(err)
  const canRetry = isRetryableError(err)
  
  // Display to user
  const errorMessage = canRetry
    ? `${friendlyMessage}\n\n💡 ${suggestedAction}\n\n🔄 This error is temporary - you can try again.`
    : `${friendlyMessage}\n\n💡 ${suggestedAction}`
  
  setError(errorMessage)
}
```

---

## Error Handling Best Practices

### 1. Always Catch Errors

```javascript
try {
  await sdk.bundler.sendUserOperation(userOp)
} catch (error) {
  // Handle error
  console.error('Failed to send UserOperation:', error)
  // Show user-friendly message
  alert(getUserFriendlyMessage(error))
}
```

### 2. Provide Context

```javascript
try {
  await sdk.bundler.sendUserOperation(userOp)
} catch (error) {
  throw parseBundlerError(error, {
    operation: 'sendUserOperation',
    userOp,
    accountAddress,
  })
}
```

### 3. Show Suggested Actions

```javascript
const suggestedAction = getSuggestedAction(error)
// "Add more ETH to your account and try again."
```

### 4. Enable Retries for Temporary Errors

```javascript
if (isRetryableError(error)) {
  // Show retry button
  setShowRetryButton(true)
}
```

### 5. Log Errors for Debugging

```javascript
catch (error) {
  console.error('Error details:', {
    message: error.message,
    code: error.code,
    details: error.details,
  })
}
```

---

## Common Error Scenarios

### Scenario 1: Insufficient Funds

**Error:**
```
ValidationError: Insufficient funds in account to pay for gas. Please fund your account.
```

**Solution:**
1. Check account balance
2. Send ETH to account address
3. Wait for confirmation
4. Retry transaction

---

### Scenario 2: Rate Limited

**Error:**
```
BundlerError: Rate limit exceeded. Please wait a moment and try again.
```

**Solution:**
1. Wait 60 seconds
2. Retry automatically (SDK handles this)
3. Or upgrade bundler plan

---

### Scenario 3: Invalid Signature

**Error:**
```
SignatureError: Invalid signature. Please try signing again.
```

**Solution:**
1. Retry signing with passkey
2. Ensure correct passkey is used
3. Check if 2FA is enabled and sign with both

---

### Scenario 4: Network Timeout

**Error:**
```
NetworkError: Request timed out. Please check your connection and try again.
```

**Solution:**
1. Check internet connection
2. SDK automatically retries 3 times
3. If still fails, try again later

---

### Scenario 5: Account Already Deployed

**Error:**
```
ValidationError: Account is already deployed.
```

**Solution:**
1. Remove `initCode` from UserOperation
2. Set `initCode = "0x"`
3. Retry transaction

---

## Testing Error Handling

### Test Network Errors

```javascript
// Simulate network error
const badBundlerUrl = 'https://invalid-url.example.com'
const bundler = new BundlerClient(badBundlerUrl)

try {
  await bundler.sendUserOperation(userOp)
} catch (error) {
  console.log(error.name) // NetworkError
  console.log(error.code) // 1002
}
```

### Test Rate Limiting

```javascript
// Send many requests quickly
for (let i = 0; i < 100; i++) {
  try {
    await bundler.sendUserOperation(userOp)
  } catch (error) {
    if (error.code === ErrorCodes.BUNDLER_RATE_LIMITED) {
      console.log('Rate limited!')
      break
    }
  }
}
```

### Test Validation Errors

```javascript
// Create invalid UserOperation (no funds)
const userOp = {
  sender: accountWithNoFunds,
  // ... other fields
}

try {
  await bundler.sendUserOperation(userOp)
} catch (error) {
  console.log(error.code) // 3004 (INSUFFICIENT_FUNDS)
}
```

---

## Error Monitoring

### Log Errors to Console

All errors are automatically logged with emoji indicators:
- ✅ Success
- ⚠️ Warning (retrying)
- ❌ Error

### Track Error Rates

```javascript
let errorCount = 0
let successCount = 0

try {
  await sdk.bundler.sendUserOperation(userOp)
  successCount++
} catch (error) {
  errorCount++
  console.log(`Error rate: ${errorCount / (errorCount + successCount) * 100}%`)
}
```

---

## Summary

The SDK provides:
- ✅ **Comprehensive error types** for different failure scenarios
- ✅ **User-friendly messages** instead of technical jargon
- ✅ **Suggested actions** to help users resolve issues
- ✅ **Automatic retries** for temporary errors
- ✅ **ERC-4337 error parsing** for validation failures
- ✅ **Detailed logging** for debugging

**Result:** Users get clear, actionable feedback when things go wrong, improving the overall UX! 🎉

