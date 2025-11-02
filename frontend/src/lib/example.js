/**
 * Example usage of P256AccountSDK
 */

import { createSDK } from './P256AccountSDK.js'
import { signWithPasskey } from '../utils/webauthn.js'
import { NETWORKS } from './constants.js'

/**
 * Example: Complete flow from passkey creation to sending ETH
 */
export async function exampleCompleteFlow() {
  // 1. Create passkey (WebAuthn)
  console.log('Step 1: Creating passkey...')
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'ΞTHΛURΛ P256 Wallet',
        id: window.location.hostname,
      },
      user: {
        id: new Uint8Array(16),
        name: 'user@ethaura.wallet',
        displayName: 'ΞTHΛURΛ User',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256 (P-256)
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })

  // Parse public key from credential
  const publicKey = parsePublicKey(credential.response.attestationObject)
  console.log('Passkey created:', publicKey)

  // 2. Initialize SDK
  console.log('Step 2: Initializing SDK...')
  const sdk = createSDK({
    factoryAddress: '0xYourFactoryAddress', // Replace with your deployed factory
    rpcUrl: NETWORKS.sepolia.rpcUrl,
    bundlerUrl: NETWORKS.sepolia.bundlerUrl,
    chainId: NETWORKS.sepolia.chainId,
  })

  // 3. Create account (counterfactual)
  console.log('Step 3: Creating account (counterfactual)...')
  const ownerAddress = '0xYourOwnerAddress' // From Web3Auth or other wallet
  const accountInfo = await sdk.createAccount(publicKey, ownerAddress)
  console.log('Account created:', accountInfo)
  console.log('Account address:', accountInfo.address)
  console.log('Is deployed:', accountInfo.isDeployed)

  // 4. Fund the account
  console.log('Step 4: Fund the account with ETH')
  console.log(`Send ETH to: ${accountInfo.address}`)
  console.log('Waiting for funding...')
  // In real app, wait for user to fund the account

  // 5. Send ETH (this will deploy the account on first use)
  console.log('Step 5: Sending ETH...')
  const receipt = await sdk.sendEth({
    accountAddress: accountInfo.address,
    targetAddress: '0xRecipientAddress',
    amount: ethers.parseEther('0.01'), // 0.01 ETH
    passkeyCredential: {
      credentialId: Array.from(new Uint8Array(credential.rawId)),
      publicKey,
    },
    signWithPasskey,
    ownerSignature: null, // Add if 2FA is enabled
    needsDeployment: !accountInfo.isDeployed,
    initCode: accountInfo.initCode,
  })

  console.log('Transaction successful!', receipt)
  return receipt
}

/**
 * Example: Send ETH with 2FA
 */
export async function exampleSendWithTwoFactor(sdk, accountAddress, passkeyCredential, web3AuthSigner) {
  // Build the UserOperation
  const targetAddress = '0xRecipientAddress'
  const amount = ethers.parseEther('0.01')

  // Get account info
  const accountInfo = await sdk.getAccountInfo(accountAddress)
  console.log('2FA enabled:', accountInfo.twoFactorEnabled)

  // Create UserOperation
  const userOp = await buildSendEthUserOp({
    accountAddress,
    targetAddress,
    amount,
    provider: sdk.provider,
    needsDeployment: false,
    initCode: '0x',
  })

  // Get UserOperation hash
  const userOpHash = await getUserOpHash(userOp, sdk.provider, sdk.chainId)

  // Sign with passkey
  const userOpHashBytes = ethers.getBytes(userOpHash)
  const passkeySignatureRaw = await signWithPasskey(passkeyCredential, userOpHashBytes)
  const { r, s } = sdk.derToRS(passkeySignatureRaw.signature)
  const passkeySignature = { r: '0x' + r, s: '0x' + s }

  // Sign with Web3Auth (owner signature for 2FA)
  const ownerSignature = await web3AuthSigner.signMessage(ethers.getBytes(userOpHash))

  // Combine signatures and submit
  const signedUserOp = signUserOperation(userOp, passkeySignature, ownerSignature)
  const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)

  console.log('Transaction with 2FA successful!', receipt)
  return receipt
}

/**
 * Example: Execute custom contract call
 */
export async function exampleExecuteCall(sdk, accountAddress, passkeyCredential) {
  // Example: Call a contract function
  const targetContract = '0xContractAddress'
  const iface = new ethers.Interface([
    'function transfer(address to, uint256 amount)',
  ])
  const callData = iface.encodeFunctionData('transfer', [
    '0xRecipientAddress',
    ethers.parseUnits('100', 18), // 100 tokens
  ])

  const receipt = await sdk.executeCall({
    accountAddress,
    targetAddress: targetContract,
    value: 0n,
    data: callData,
    passkeyCredential,
    signWithPasskey,
    ownerSignature: null,
    needsDeployment: false,
    initCode: '0x',
  })

  console.log('Contract call successful!', receipt)
  return receipt
}

/**
 * Example: Execute batch calls
 */
export async function exampleExecuteBatch(sdk, accountAddress, passkeyCredential) {
  // Example: Send ETH to multiple addresses in one transaction
  const targets = [
    '0xRecipient1',
    '0xRecipient2',
    '0xRecipient3',
  ]
  const values = [
    ethers.parseEther('0.01'),
    ethers.parseEther('0.02'),
    ethers.parseEther('0.03'),
  ]
  const datas = ['0x', '0x', '0x'] // No call data, just ETH transfers

  const receipt = await sdk.executeBatch({
    accountAddress,
    targets,
    values,
    datas,
    passkeyCredential,
    signWithPasskey,
    ownerSignature: null,
    needsDeployment: false,
    initCode: '0x',
  })

  console.log('Batch transaction successful!', receipt)
  return receipt
}

/**
 * Example: Check account status
 */
export async function exampleCheckAccount(sdk, accountAddress) {
  const info = await sdk.getAccountInfo(accountAddress)
  
  console.log('Account Info:')
  console.log('  Address:', info.address)
  console.log('  Deployed:', info.deployed)
  console.log('  2FA Enabled:', info.twoFactorEnabled)
  console.log('  Deposit:', ethers.formatEther(info.deposit), 'ETH')
  console.log('  Nonce:', info.nonce.toString())

  return info
}

/**
 * Helper: Parse public key from attestation object
 */
function parsePublicKey(attestationObject) {
  // Decode CBOR attestation object
  const attestationBuffer = new Uint8Array(attestationObject)
  
  // This is a simplified parser - in production use a proper CBOR library
  // For now, extract the public key coordinates from the credential
  
  // The public key is in COSE format
  // For P-256, it's: { 1: 2, 3: -7, -1: 1, -2: x, -3: y }
  
  // This is a placeholder - you should use the parsePublicKey from webauthn.js
  return {
    x: new Uint8Array(32), // Replace with actual x coordinate
    y: new Uint8Array(32), // Replace with actual y coordinate
  }
}

