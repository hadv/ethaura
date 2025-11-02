# ΞTHΛURΛ Frontend Integration Guide

Complete guide for integrating P256Account with your frontend application.

## Table of Contents

1. [Setup](#setup)
2. [Architecture](#architecture)
3. [Step-by-Step Integration](#step-by-step-integration)
4. [Bundler Setup](#bundler-setup)
5. [Production Checklist](#production-checklist)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

Required dependencies:
- `ethers` - Ethereum library
- `@web3auth/modal` - Social login
- `react` - UI framework

### 2. Environment Variables

Create `.env` file:

```env
# Web3Auth (for social login)
VITE_WEB3AUTH_CLIENT_ID=your_client_id

# Network Configuration
VITE_NETWORK=sepolia
VITE_RPC_URL=https://rpc.sepolia.org
VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY

# Contract Addresses (deploy these first!)
VITE_FACTORY_ADDRESS=0xYourFactoryAddress
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### 3. Deploy Contracts

Before using the frontend, deploy your contracts:

```bash
# From project root
cd ..

# Deploy factory
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify

# Note the factory address from deployment
```

## Architecture

```
User Flow:
1. User creates passkey (WebAuthn) → Public key (qx, qy)
2. User logs in with Web3Auth → Owner address
3. Calculate account address (counterfactual)
4. User funds account with ETH
5. User creates UserOperation
6. Sign with passkey + owner (2FA)
7. Submit to bundler
8. Account deployed + transaction executed
```

## Step-by-Step Integration

### Step 1: Initialize SDK

```javascript
// src/hooks/useP256SDK.js
import { useMemo } from 'react'
import { createSDK } from '../lib/P256AccountSDK.js'
import { NETWORKS } from '../lib/constants.js'

export function useP256SDK() {
  const sdk = useMemo(() => {
    return createSDK({
      factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
      rpcUrl: import.meta.env.VITE_RPC_URL,
      bundlerUrl: import.meta.env.VITE_BUNDLER_URL,
      chainId: NETWORKS.sepolia.chainId,
    })
  }, [])

  return sdk
}
```

### Step 2: Create Passkey

```javascript
// src/components/PasskeyManager.jsx (already exists)
import { parsePublicKey } from '../utils/webauthn.js'

const createPasskey = async () => {
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
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
      },
    },
  })

  const publicKey = parsePublicKey(credential.response.attestationObject)
  
  return {
    credentialId: Array.from(new Uint8Array(credential.rawId)),
    publicKey,
  }
}
```

### Step 3: Create Account (Counterfactual)

```javascript
// src/components/AccountManager.jsx
import { useP256SDK } from '../hooks/useP256SDK.js'
import { useWeb3Auth } from '../contexts/Web3AuthContext.jsx'

function AccountManager({ credential, onAccountCreated }) {
  const sdk = useP256SDK()
  const { address: ownerAddress } = useWeb3Auth()

  const createAccount = async () => {
    // Create account (counterfactual - no deployment yet!)
    const accountInfo = await sdk.createAccount(
      credential.publicKey,
      ownerAddress,
      0n // salt
    )

    console.log('Account address:', accountInfo.address)
    console.log('Deployed:', accountInfo.isDeployed)
    
    // Save account info
    onAccountCreated(accountInfo)
    
    return accountInfo
  }

  return (
    <div>
      <button onClick={createAccount}>Create Account</button>
    </div>
  )
}
```

### Step 4: Send Transaction

```javascript
// src/components/TransactionSender.jsx
import { useP256SDK } from '../hooks/useP256SDK.js'
import { signWithPasskey } from '../utils/webauthn.js'
import { useWeb3Auth } from '../contexts/Web3AuthContext.jsx'
import { ethers } from 'ethers'

function TransactionSender({ accountInfo, credential }) {
  const sdk = useP256SDK()
  const { signMessage } = useWeb3Auth()

  const sendTransaction = async (targetAddress, amount) => {
    try {
      // Check if 2FA is enabled
      const accountData = await sdk.getAccountInfo(accountInfo.address)
      const needs2FA = accountData.twoFactorEnabled

      // Prepare owner signature if 2FA enabled
      let ownerSignature = null
      if (needs2FA) {
        // We'll get this after signing with passkey
        // (need userOpHash first)
      }

      // Send ETH
      const receipt = await sdk.sendEth({
        accountAddress: accountInfo.address,
        targetAddress,
        amount: ethers.parseEther(amount),
        passkeyCredential: credential,
        signWithPasskey,
        ownerSignature, // null for now, will be added in SDK
        needsDeployment: !accountInfo.isDeployed,
        initCode: accountInfo.initCode,
      })

      console.log('Success!', receipt)
      return receipt
    } catch (error) {
      console.error('Transaction failed:', error)
      throw error
    }
  }

  return (
    <div>
      <button onClick={() => sendTransaction('0x...', '0.01')}>
        Send 0.01 ETH
      </button>
    </div>
  )
}
```

### Step 5: Handle 2FA Signatures

For 2FA, you need to modify the SDK call to include owner signature:

```javascript
// Enhanced sendTransaction with 2FA
const sendTransactionWith2FA = async (targetAddress, amount) => {
  const { ethers } = await import('ethers')
  
  // Build UserOperation
  const userOp = await buildSendEthUserOp({
    accountAddress: accountInfo.address,
    targetAddress,
    amount: ethers.parseEther(amount),
    provider: sdk.provider,
    needsDeployment: !accountInfo.isDeployed,
    initCode: accountInfo.initCode,
  })

  // Get UserOperation hash
  const userOpHash = await getUserOpHash(userOp, sdk.provider, sdk.chainId)

  // 1. Sign with passkey
  const userOpHashBytes = ethers.getBytes(userOpHash)
  const passkeySignatureRaw = await signWithPasskey(credential, userOpHashBytes)
  const { r, s } = sdk.derToRS(passkeySignatureRaw.signature)
  const passkeySignature = { r: '0x' + r, s: '0x' + s }

  // 2. Sign with Web3Auth (owner)
  const ownerSignature = await signMessage(ethers.getBytes(userOpHash))

  // 3. Combine and submit
  const signedUserOp = signUserOperation(userOp, passkeySignature, ownerSignature)
  const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)

  return receipt
}
```

## Bundler Setup

### Option 1: Pimlico (Recommended)

1. Sign up at https://pimlico.io
2. Get API key
3. Update `.env`:

```env
VITE_BUNDLER_URL=https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_KEY
```

### Option 2: Alchemy

1. Sign up at https://alchemy.com
2. Create app
3. Update `.env`:

```env
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_BUNDLER_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Option 3: Stackup

1. Sign up at https://stackup.sh
2. Get API key
3. Update `.env`:

```env
VITE_BUNDLER_URL=https://api.stackup.sh/v1/node/YOUR_KEY
```

### Option 4: Local Testing (No Bundler)

For testing without a bundler:

```javascript
import { createLocalBundlerClient } from '../lib/bundlerClient.js'

// Use local bundler (requires EOA with ETH)
const localBundler = createLocalBundlerClient(provider, signer)
const receipt = await localBundler.sendUserOperation(userOp)
```

## Production Checklist

### Before Launch

- [ ] Deploy contracts to mainnet
- [ ] Set up production bundler (Pimlico/Alchemy)
- [ ] Configure Web3Auth production client ID
- [ ] Test on testnet thoroughly
- [ ] Audit smart contracts
- [ ] Set up monitoring/alerts
- [ ] Create backup/recovery flow
- [ ] Document user flows
- [ ] Test on multiple devices (iOS, Android, Desktop)
- [ ] Test different browsers (Chrome, Safari, Firefox)

### Security

- [ ] Never expose private keys in frontend
- [ ] Validate all user inputs
- [ ] Use HTTPS only
- [ ] Implement rate limiting
- [ ] Add transaction confirmation UI
- [ ] Show gas estimates before signing
- [ ] Implement spending limits
- [ ] Add session management
- [ ] Log security events

### UX

- [ ] Show clear loading states
- [ ] Display transaction status
- [ ] Handle errors gracefully
- [ ] Add transaction history
- [ ] Show account balance
- [ ] Explain 2FA clearly
- [ ] Add help/support
- [ ] Mobile-responsive design

### Performance

- [ ] Cache account info
- [ ] Optimize gas estimates
- [ ] Lazy load components
- [ ] Minimize bundle size
- [ ] Use service workers for offline support

## Common Issues

### "Passkey not supported"
- Check browser compatibility (Chrome 67+, Safari 13+, Firefox 60+)
- Ensure HTTPS (required for WebAuthn)
- Check device has biometric authentication

### "Transaction failed"
- Verify account has sufficient ETH
- Check gas prices
- Verify bundler is working
- Check network connectivity

### "2FA signature invalid"
- Ensure both signatures are provided
- Verify signature format (129 bytes total)
- Check owner address matches

## Next Steps

1. Run the development server: `npm run dev`
2. Create a passkey
3. Login with Web3Auth
4. Create account (note the address)
5. Fund account with testnet ETH
6. Send a transaction!

## Support

- Documentation: `/docs`
- Examples: `/frontend/src/lib/example.js`
- Issues: GitHub Issues

