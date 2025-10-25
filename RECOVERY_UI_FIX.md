# 🔧 Recovery UI - Bug Fixes

## Bug #1: Web3Auth Signer Issue

### Error
```
TypeError: Cannot read properties of undefined (reading 'getSigner')
```

### Root Cause
The RecoveryManager was trying to call `web3AuthProvider.getSigner()`, but:
1. The Web3Auth context provides `provider` (not `web3AuthProvider`)
2. The Web3Auth provider doesn't have a `getSigner()` method
3. We needed to create an ethers Signer from the Web3Auth provider

### Solution
1. **Fixed context hook** (line 9):
   ```javascript
   const { isConnected, address: ownerAddress, provider: web3AuthProvider } = useWeb3Auth()
   ```

2. **Created getSigner helper** (lines 93-111):
   ```javascript
   const getSigner = async () => {
     if (!web3AuthProvider) {
       throw new Error('Web3Auth provider not available')
     }

     const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo'
     const provider = new ethers.JsonRpcProvider(rpcUrl)

     const privateKey = await web3AuthProvider.request({
       method: 'eth_private_key',
     })

     const signer = new ethers.Wallet(privateKey, provider)
     return signer
   }
   ```

3. **Updated all recovery functions** to use `getSigner()`

---

## Bug #2: Invalid Bytes32 Value

### Error
```
TypeError: invalid BytesLike value (argument="value", value="0x0", code=INVALID_ARGUMENT, version=6.15.0)
```

### Root Cause
When updating owner (not passkey), we were passing `'0x0'` as the bytes32 value, but ethers requires a full 64-character hex string (32 bytes).

### Solution
Created `normalizeBytes32()` helper function (lines 113-129):

```javascript
const normalizeBytes32 = (value) => {
  if (!value) return '0x' + '0'.repeat(64)

  // Remove 0x prefix if present
  let hex = value.startsWith('0x') ? value.slice(2) : value

  // Pad to 64 characters (32 bytes)
  hex = hex.padStart(64, '0')

  // Ensure it's exactly 64 characters
  if (hex.length > 64) {
    hex = hex.slice(-64)
  }

  return '0x' + hex
}
```

Updated recovery initiation to use it:
```javascript
const qx = recoveryType === 'passkey' ? normalizeBytes32(newQx) : normalizeBytes32('')
const qy = recoveryType === 'passkey' ? normalizeBytes32(newQy) : normalizeBytes32('')
```

---

## How It Works

### For Passkey Recovery
1. User enters new Qx and Qy coordinates
2. `normalizeBytes32()` pads them to 64 hex characters
3. Passes to `initiateRecovery()` with new owner address

### For Owner Recovery
1. User enters new owner address
2. Qx and Qy are set to zero (all zeros bytes32)
3. `normalizeBytes32('')` returns `0x` + 64 zeros
4. Passes to `initiateRecovery()` with new owner address

---

## Files Modified

- `frontend/src/components/RecoveryManager.jsx`
  - Fixed Web3Auth context hook usage
  - Added `getSigner()` helper function
  - Added `normalizeBytes32()` helper function
  - Updated all recovery handler functions

## Status

✅ Bug #1 fixed
✅ Bug #2 fixed
✅ No diagnostics errors
✅ Ready to test

