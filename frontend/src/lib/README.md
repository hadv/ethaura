# P256Account SDK

Complete SDK for managing P256 smart contract wallets with ERC-4337 Account Abstraction.

## Features

- ✅ **Counterfactual Deployment** - Calculate account addresses before deployment
- ✅ **Passkey Integration** - Sign with WebAuthn/Passkeys (P-256)
- ✅ **Two-Factor Authentication** - Dual signatures (Passkey + Owner)
- ✅ **Bundler Support** - Submit UserOperations to bundlers
- ✅ **Gas Estimation** - Automatic gas price and limit estimation
- ✅ **Batch Transactions** - Execute multiple calls in one transaction

## Installation

```bash
npm install ethers
```

## Quick Start

### 1. Initialize SDK

```javascript
import { createSDK } from './lib/P256AccountSDK.js'
import { NETWORKS } from './lib/constants.js'

const sdk = createSDK({
  factoryAddress: '0xYourFactoryAddress',
  rpcUrl: NETWORKS.sepolia.rpcUrl,
  bundlerUrl: NETWORKS.sepolia.bundlerUrl,
  chainId: NETWORKS.sepolia.chainId,
})
```

### 2. Create Passkey

```javascript
const challenge = new Uint8Array(32)
crypto.getRandomValues(challenge)

const credential = await navigator.credentials.create({
  publicKey: {
    challenge,
    rp: { name: 'ΞTHΛURΛ', id: window.location.hostname },
    user: {
      id: new Uint8Array(16),
      name: 'user@ethaura.wallet',
      displayName: 'User',
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
    },
  },
})
```

### 3. Create Account (Counterfactual)

```javascript
import { parsePublicKey } from '../utils/webauthn.js'

const publicKey = parsePublicKey(credential.response.attestationObject)
const ownerAddress = '0xYourOwnerAddress' // From Web3Auth or wallet

const accountInfo = await sdk.createAccount(publicKey, ownerAddress)

console.log('Account address:', accountInfo.address)
console.log('Is deployed:', accountInfo.isDeployed)
console.log('InitCode:', accountInfo.initCode)
```

### 4. Fund the Account

```javascript
// Send ETH to the account address (even before deployment!)
console.log(`Send ETH to: ${accountInfo.address}`)
```

### 5. Send ETH (Deploys on First Use)

```javascript
import { signWithPasskey } from '../utils/webauthn.js'

const receipt = await sdk.sendEth({
  accountAddress: accountInfo.address,
  targetAddress: '0xRecipientAddress',
  amount: ethers.parseEther('0.01'),
  passkeyCredential: {
    credentialId: Array.from(new Uint8Array(credential.rawId)),
    publicKey,
  },
  signWithPasskey,
  ownerSignature: null, // Add for 2FA
  needsDeployment: !accountInfo.isDeployed,
  initCode: accountInfo.initCode,
})

console.log('Transaction hash:', receipt.transactionHash)
```

## API Reference

### P256AccountSDK

#### `createAccount(passkeyPublicKey, ownerAddress, salt?)`

Create a new P256Account (counterfactual).

**Parameters:**
- `passkeyPublicKey` - Public key from WebAuthn `{ x, y }`
- `ownerAddress` - Owner address for 2FA
- `salt` - Salt for CREATE2 (default: 0)

**Returns:** `Promise<AccountInfo>`

```javascript
{
  address: '0x...',
  qx: '0x...',
  qy: '0x...',
  owner: '0x...',
  salt: 0n,
  initCode: '0x...',
  isDeployed: false
}
```

#### `getAccountInfo(accountAddress)`

Get account information.

**Returns:** `Promise<AccountInfo>`

```javascript
{
  address: '0x...',
  deployed: true,
  twoFactorEnabled: true,
  deposit: 1000000000000000000n, // 1 ETH in wei
  nonce: 5n
}
```

#### `sendEth(params)`

Send ETH from P256Account.

**Parameters:**
```javascript
{
  accountAddress: '0x...',
  targetAddress: '0x...',
  amount: 1000000000000000000n, // wei
  passkeyCredential: { credentialId, publicKey },
  signWithPasskey: Function,
  ownerSignature: '0x...' | null, // For 2FA
  needsDeployment: false,
  initCode: '0x...'
}
```

**Returns:** `Promise<Receipt>`

#### `executeCall(params)`

Execute arbitrary contract call.

**Parameters:**
```javascript
{
  accountAddress: '0x...',
  targetAddress: '0x...', // Contract address
  value: 0n,
  data: '0x...', // Encoded function call
  passkeyCredential: { credentialId, publicKey },
  signWithPasskey: Function,
  ownerSignature: '0x...' | null,
  needsDeployment: false,
  initCode: '0x...'
}
```

#### `executeBatch(params)`

Execute multiple calls in one transaction.

**Parameters:**
```javascript
{
  accountAddress: '0x...',
  targets: ['0x...', '0x...'],
  values: [0n, 0n],
  datas: ['0x...', '0x...'],
  passkeyCredential: { credentialId, publicKey },
  signWithPasskey: Function,
  ownerSignature: '0x...' | null,
  needsDeployment: false,
  initCode: '0x...'
}
```

## Two-Factor Authentication (2FA)

When 2FA is enabled, you need both passkey and owner signatures:

```javascript
import { ethers } from 'ethers'

// 1. Sign with passkey (as usual)
const passkeySignatureRaw = await signWithPasskey(passkeyCredential, userOpHashBytes)
const { r, s } = sdk.derToRS(passkeySignatureRaw.signature)
const passkeySignature = { r: '0x' + r, s: '0x' + s }

// 2. Sign with owner wallet (Web3Auth, MetaMask, etc.)
const ownerSignature = await ownerSigner.signMessage(ethers.getBytes(userOpHash))

// 3. Send with both signatures
const receipt = await sdk.sendEth({
  // ... other params
  ownerSignature, // ← Add this for 2FA
})
```

## Bundler Configuration

### Using Pimlico

```javascript
const sdk = createSDK({
  factoryAddress: '0xYourFactory',
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY',
  chainId: 11155111,
})
```

### Using Alchemy

```javascript
const sdk = createSDK({
  factoryAddress: '0xYourFactory',
  rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
  bundlerUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
  chainId: 11155111,
})
```

### Using Stackup

```javascript
const sdk = createSDK({
  factoryAddress: '0xYourFactory',
  rpcUrl: 'https://rpc.sepolia.org',
  bundlerUrl: 'https://api.stackup.sh/v1/node/YOUR_KEY',
  chainId: 11155111,
})
```

## Examples

See `example.js` for complete examples:

- ✅ Complete flow from passkey to transaction
- ✅ Sending ETH with 2FA
- ✅ Executing contract calls
- ✅ Batch transactions
- ✅ Checking account status

## Architecture

```
P256AccountSDK
├── accountManager.js       - Account creation & management
├── userOperation.js        - UserOperation building & signing
├── bundlerClient.js        - Bundler communication
├── constants.js            - Network configs & ABIs
├── P256AccountSDK.js       - Main SDK wrapper
├── tokenService.js         - Token balance management
├── transactionService.js   - Transaction history
├── priceOracle.js          - Token price fetching
└── uniswapService.js       - Uniswap V3 swap integration (NEW)
```

## Token Swap Integration

The SDK now includes Uniswap V3 integration for token swaps. See [UNISWAP_SERVICE.md](./UNISWAP_SERVICE.md) for detailed documentation.

### Quick Example

```javascript
import { createUniswapV3Service } from './lib/uniswapService'

// Create service
const uniswapService = createUniswapV3Service(provider, chainId)

// Get quote
const quote = await uniswapService.getQuote(tokenIn, tokenOut, amountIn)

// Build swap batch
const batch = uniswapService.buildApproveAndSwap(
  tokenIn,
  tokenOut,
  amountIn,
  amountOutMinimum,
  accountAddress
)

// Execute via P256Account
await sdk.executeBatch({
  accountAddress,
  targets: batch.targets,
  values: batch.values,
  datas: batch.datas,
  passkeyCredential,
  signWithPasskey,
})
```

## Gas Costs

| Operation | Gas Cost (approx) |
|-----------|------------------|
| Account deployment | ~300,000 |
| Simple ETH transfer | ~100,000 |
| Contract call | ~150,000+ |
| Batch (3 calls) | ~200,000+ |

**Note:** First transaction includes deployment cost if using counterfactual deployment.

## Troubleshooting

### "Account not deployed"
- Fund the account with ETH first
- Set `needsDeployment: true` and provide `initCode`

### "Insufficient deposit"
- Account needs ETH balance to pay for gas
- Send ETH to the account address

### "Invalid signature"
- Check if 2FA is enabled - you need both signatures
- Verify passkey signature format (r, s must be 32 bytes each)

### "Bundler error"
- Check bundler URL and API key
- Verify network/chainId matches
- Check gas prices are reasonable

## License

MIT

