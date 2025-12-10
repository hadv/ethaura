# ModularAccountSDK

Complete SDK for managing ERC-7579 modular smart accounts (AuraAccount) with ERC-4337 Account Abstraction.

## Features

- ✅ **Modular Architecture** - ERC-7579 compliant
- ✅ **Passkey Integration** - Sign with WebAuthn/Passkeys (P-256) via P256MFAValidator
- ✅ **Two-Factor Authentication** - Dual signatures (Passkey + Owner)
- ✅ **Bundler Support** - Submit UserOperations to bundlers
- ✅ **Token Swaps** - Integrated Uniswap V3 swapping
- ✅ **Batch Transactions** - Execute multiple calls in one transaction

## Installation

```bash
npm install ethers
```

## Quick Start

### 1. Initialize SDK

```javascript
import { createModularAccountSDK } from './lib/modularAccountSDK.js'
import { NETWORKS } from './lib/constants.js'

const sdk = createModularAccountSDK({
  factoryAddress: '0xFactoryAddress',
  validatorAddress: '0xValidatorAddress',
  rpcUrl: NETWORKS.sepolia.rpcUrl,
  bundlerUrl: NETWORKS.sepolia.bundlerUrl,
  chainId: NETWORKS.sepolia.chainId,
})
```

### 2. Get Account Address (Counterfactual)

```javascript
const ownerAddress = '0xYourOwnerAddress' // From Web3Auth or wallet
const accountAddress = await sdk.accountManager.getAccountAddress(ownerAddress)

console.log('Account address:', accountAddress)
```

### 3. Get Account Info

```javascript
const accountInfo = await sdk.getAccountInfo(accountAddress)
console.log('Is deployed:', accountInfo.deployed)
console.log('MFA Enabled:', accountInfo.mfaEnabled)
```

### 4. Send ETH (Deploys on First Use)

```javascript
import { signWithPasskey } from '../utils/webauthn.js'

const receipt = await sdk.sendETH({
  accountAddress,
  to: '0xRecipientAddress',
  amount: ethers.parseEther('0.01'),
  passkeyCredential: {
    id: 'credential-id-base64',
    publicKey: { x: '...', y: '...' },
  },
  signWithPasskey,
  ownerSignature: null, // Add for 2FA
  // initCode will be automatically handled if account is not deployed
})

console.log('Transaction hash:', receipt.transactionHash)
```

## API Reference

### ModularAccountSDK

#### `getAccountInfo(accountAddress)`
Get account information including deployment status and MFA state.
**Returns:** `Promise<AccountInfo>`

#### `sendETH(params)`
Send ETH from the account.
**Parameters:**
- `accountAddress`: Smart account address
- `to`: Recipient address
- `amount`: Amount in wei
- `passkeyCredential`: Optional passkey credential for MFA
- `signWithPasskey`: Callback to sign with passkey
- `ownerSignature`: Optional owner signature (if already signed)

#### `executeCall(params)`
Execute arbitrary contract call.
**Parameters:**
- `target`: Contract address
- `value`: ETH value
- `data`: Calldata

#### `executeBatch(params)`
Execute multiple calls in one transaction.
**Parameters:**
- `targets`: Array of target addresses
- `values`: Array of ETH values
- `datas`: Array of calldatas
- (plus standard signing params)

#### `executeSwap(params)`
Execute a token swap via Uniswap V3.
**Parameters:**
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `amountIn`: Amount to swap
- `amountOutMinimum`: Minimum output amount
- `fee`: Pool fee (default 3000)
- `deadline`: Optional deadline
- (plus standard signing params)

#### `enableMFA(params)`
Enable 2FA (Passkey + Owner).

#### `disableMFA(params)`
Disable 2FA.

#### `addPasskey(params)`
Add a new passkey to the account.

#### `removePasskey(params)`
Remove a passkey.

## Two-Factor Authentication (2FA)

When 2FA is enabled, you need both passkey and owner signatures. The SDK handles this in `_signAndSubmitUserOp`. You provide `passkeyCredential` and `signWithPasskey` callback, and optionally `ownerSignature` if you've pre-signed. If `ownerSignature` is missing, the SDK will try to use the signer provided via `getSigner`.

## License

MIT
