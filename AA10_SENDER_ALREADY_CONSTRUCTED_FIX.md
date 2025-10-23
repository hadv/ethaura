# 🔧 Fixed: AA10 "sender already constructed" Error

## 🐛 The Problem

When sending a second transaction, the app was throwing:
```
UserOperation reverted with reason: AA10 sender already constructed
```

This error means the bundler rejected the UserOperation because it included `initCode` (deployment code) even though the account was already deployed.

---

## 🔍 Root Cause

The issue was a **state synchronization problem**:

1. **First Transaction**: Account is deployed via `initCode`
2. **After First TX**: `accountInfo.isDeployed` is still `false` (stale state)
3. **Second Transaction**: Code still includes `initCode` because `accountInfo.isDeployed` is `false`
4. **Bundler Rejects**: AA10 error - can't deploy an already-deployed account

---

## ✅ The Fix

Added **on-chain verification** before building the UserOperation:

```javascript
// Check if account code exists on-chain (most reliable source of truth)
const accountCode = await sdk.provider.getCode(accountAddress)
const isActuallyDeployed = accountCode !== '0x'

// If account is actually deployed but accountInfo says it's not, update it
if (isActuallyDeployed && !accountInfo.isDeployed) {
  console.log('🔄 Account is deployed on-chain but accountInfo says it\'s not. Updating...')
  const updatedInfo = await sdk.createAccount(credential.publicKey, ownerAddress, 0n)
  setAccountInfo({ ...updatedInfo, deployed: updatedInfo.isDeployed })
}

// Use the actual on-chain status, not the stale accountInfo
const userOp = await buildSendEthUserOp({
  accountAddress,
  targetAddress,
  amount: amountWei,
  provider: sdk.provider,
  needsDeployment: !isActuallyDeployed,  // ← Use actual status
  initCode: isActuallyDeployed ? '0x' : accountInfo.initCode,  // ← Use actual status
})
```

---

## 📝 Changes Made

**File:** `frontend/src/components/TransactionSender.jsx`

1. **Added on-chain code check** (line 216-218)
   - Calls `provider.getCode()` to check if account has bytecode
   - Most reliable source of truth

2. **Added state sync check** (line 227-232)
   - If account is deployed on-chain but `accountInfo` says it's not
   - Refresh `accountInfo` to sync state

3. **Use actual deployed status** (line 301-302)
   - Pass `isActuallyDeployed` to `buildSendEthUserOp()`
   - Don't include `initCode` if account is already deployed

4. **Updated logging** (line 236, 306)
   - Use `isActuallyDeployed` in logs for accuracy

---

## 🧪 Testing

### First Transaction (Deploys Account)
```
1. Send 0.001 ETH
2. Sign with passkey + Web3Auth
3. ✅ Account deployed
4. ✅ Transaction executed
```

### Second Transaction (Should NOT redeploy)
```
1. Send 0.001 ETH again
2. Sign with passkey + Web3Auth
3. ✅ NO AA10 error
4. ✅ Transaction executed
5. ✅ initCode NOT included
```

### Expected Console Output
```
📝 Account code check: {
  accountAddress: "0x5B390C8DD95781be9F8f8B9aBC469e90e6d7DFBE",
  codeLength: 2000,
  hasCode: true,
  isDeployedFlag: false
}

🔄 Account is deployed on-chain but accountInfo says it's not. Updating...

🏗️ Building UserOperation: {
  isDeployed: true,
  needsDeployment: false,
  initCodeLength: 0,
  ...
}

📋 UserOp initCode details: {
  isDeployed: true,
  initCodeLength: 0,
  ...
}
```

---

## 🎯 Summary

✅ **Problem**: AA10 error on second transaction  
✅ **Cause**: Stale `accountInfo.isDeployed` state  
✅ **Solution**: Check on-chain code before building UserOp  
✅ **Result**: Second and subsequent transactions work correctly  

**Status:** ✅ **FIXED!**

