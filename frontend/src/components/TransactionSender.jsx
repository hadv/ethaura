import { useState, useEffect, useCallback } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { signWithPasskey } from '../utils/webauthn'
import { formatSignatureForDisplay } from '../utils/signatureUtils'
import { useP256SDK } from '../hooks/useP256SDK'
import { ethers } from 'ethers'
import { buildSendEthUserOp, getUserOpHash, signUserOperation, signUserOperationOwnerOnly, packAccountGasLimits, packGasFees } from '../lib/userOperation'
import { getUserFriendlyMessage, getSuggestedAction, isRetryableError } from '../lib/errors'
import { formatPublicKeyForContract } from '../lib/accountManager'
import SignatureConfirmationDialog from './SignatureConfirmationDialog'
import '../styles/TransactionSender.css'

function TransactionSender({ accountAddress, credential, accountConfig }) {
  const { isConnected, signMessage, signRawHash, address: ownerAddress } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const sdk = useP256SDK()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetAddress, setTargetAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [passkeySignature, setPasskeySignature] = useState(null)
  const [ownerSignature, setOwnerSignature] = useState(null)
  const [combinedSignature, setCombinedSignature] = useState(null)
  const [accountInfo, setAccountInfo] = useState(null)
  const [balanceInfo, setBalanceInfo] = useState(null)
  const [depositLoading, setDepositLoading] = useState(false)

  // Signature confirmation dialog state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)
  const [pendingSignatureData, setPendingSignatureData] = useState(null)
  const [signatureResolver, setSignatureResolver] = useState(null)

  // Helper function to request signature with user confirmation
  const requestSignatureWithConfirmation = (signatureData) => {
    return new Promise((resolve, reject) => {
      setPendingSignatureData(signatureData)
      setShowSignatureDialog(true)
      setSignatureResolver({ resolve, reject })
    })
  }

  const handleSignatureConfirm = async () => {
    try {
      // Actually sign the hash
      const ownerSig = await signRawHash(pendingSignatureData.userOpHash)
      setShowSignatureDialog(false)
      setPendingSignatureData(null)
      if (signatureResolver) {
        signatureResolver.resolve(ownerSig)
        setSignatureResolver(null)
      }
    } catch (err) {
      setShowSignatureDialog(false)
      setPendingSignatureData(null)
      if (signatureResolver) {
        signatureResolver.reject(err)
        setSignatureResolver(null)
      }
    }
  }

  const handleSignatureCancel = () => {
    setShowSignatureDialog(false)
    setPendingSignatureData(null)
    if (signatureResolver) {
      signatureResolver.reject(new Error('User cancelled signature'))
      setSignatureResolver(null)
    }
  }

  // Load account info (derive from SDK using passkey + owner OR owner-only)
  useEffect(() => {
    const loadAccountInfo = async () => {
      if (accountAddress && sdk && ownerAddress) {
        // Immediately reset state when network changes
        setAccountInfo(null)

        try {
          // First, check if account is deployed
          const isDeployed = await sdk.accountManager.isDeployed(accountAddress)

          console.log('📋 Loading account info:', {
            accountAddress,
            isDeployed,
            hasAccountConfig: !!accountConfig,
            accountConfigHasPasskey: accountConfig?.hasPasskey,
            accountConfigTwoFactorEnabled: accountConfig?.twoFactorEnabled,
            hasCredential: !!credential,
          })

          if (isDeployed) {
            // For deployed accounts, fetch actual on-chain state
            // This is critical after recovery which may have changed the passkey to zero
            const info = await sdk.getAccountInfo(accountAddress)

            console.log('📋 Fetched deployed account info:', {
              address: info.address,
              deployed: info.deployed,
              twoFactorEnabled: info.twoFactorEnabled,
              hasPasskey: info.hasPasskey,
              qx: info.qx,
              qy: info.qy,
            })

            setAccountInfo({
              ...info,
              deployed: info.deployed,
              isDeployed: info.deployed,
            })
          } else {
            // For undeployed accounts, derive from credentials
            // Use the passkey that was used during account creation, not the current credential
            // This prevents issues when user adds passkey AFTER creating owner-only account
            let passkeyPublicKey = null
            if (accountConfig && accountConfig.hasPasskey && credential?.publicKey) {
              passkeyPublicKey = credential.publicKey
            }

            // Get the salt from account config (default to 0 for backwards compatibility)
            const salt = accountConfig?.salt !== undefined ? BigInt(accountConfig.salt) : 0n

            // Get the 2FA setting from account config
            const enable2FA = accountConfig?.twoFactorEnabled || false

            console.log('📋 Deriving undeployed account info:', {
              accountAddress,
              hasAccountConfig: !!accountConfig,
              accountConfigHasPasskey: accountConfig?.hasPasskey,
              accountConfigTwoFactorEnabled: accountConfig?.twoFactorEnabled,
              accountConfigSalt: accountConfig?.salt,
              hasCredential: !!credential,
              willUsePasskey: !!passkeyPublicKey,
              salt: salt.toString(),
              enable2FA,
            })

            const derived = await sdk.createAccount(passkeyPublicKey, ownerAddress, salt, enable2FA)
            if (derived.address.toLowerCase() !== accountAddress.toLowerCase()) {
              console.warn('Provided accountAddress differs from derived address from credentials/owner', {
                provided: accountAddress,
                derived: derived.address,
                salt: salt.toString(),
              })
            }
            // Normalize to shape expected by this component
            setAccountInfo({
              ...derived,
              deployed: derived.isDeployed,
              hasPasskey: !!passkeyPublicKey,
            })
          }

          // Don't load balance info here - it will be loaded when user sends transaction
          // This reduces unnecessary RPC calls
        } catch (err) {
          console.error('Error loading account info:', err)

          // Check if it's a factory not deployed error
          if (err.message && err.message.includes('Factory contract not deployed')) {
            setAccountInfo({
              address: accountAddress,
              deployed: false,
              isDeployed: false,
              twoFactorEnabled: false,
              hasPasskey: false,
              error: 'Factory not deployed on this network',
            })
          } else if (err.message && err.message.includes('Factory address not configured')) {
            setAccountInfo({
              address: accountAddress,
              deployed: false,
              isDeployed: false,
              twoFactorEnabled: false,
              hasPasskey: false,
              error: 'Network not supported',
            })
          }
        }
      }
    }
    loadAccountInfo()
  }, [accountAddress, sdk, credential, ownerAddress, accountConfig, networkInfo.chainId])

  // Load balance and deposit info
  const loadBalanceInfo = async (address) => {
    if (!sdk || !address) return

    try {
      const [accountBalance, entryPointDeposit] = await Promise.all([
        sdk.provider.getBalance(address),
        sdk.provider.getBalance(address).then(() => {
          // Get EntryPoint deposit
          const entryPointContract = new ethers.Contract(
            sdk.entryPointAddress,
            ['function balanceOf(address) view returns (uint256)'],
            sdk.provider
          )
          return entryPointContract.balanceOf(address)
        })
      ])

      setBalanceInfo({
        accountBalance: ethers.formatEther(accountBalance),
        entryPointDeposit: ethers.formatEther(entryPointDeposit),
        accountBalanceWei: accountBalance,
        entryPointDepositWei: entryPointDeposit,
      })
    } catch (err) {
      console.error('Error loading balance info:', err)
    }
  }

  // Deposit to EntryPoint from EOA
  const depositToEntryPoint = async () => {
    if (!sdk || !accountAddress || !isConnected) return

    setDepositLoading(true)
    setError('')
    setStatus('Depositing to EntryPoint...')

    try {
      // Get Web3Auth signer
      const web3authProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await web3authProvider.getSigner()

      const entryPointContract = new ethers.Contract(
        sdk.entryPointAddress,
        ['function depositTo(address) payable'],
        signer
      )

      const depositAmount = ethers.parseEther('0.02') // 0.02 ETH deposit
      const tx = await entryPointContract.depositTo(accountAddress, { value: depositAmount })

      setStatus('Waiting for deposit confirmation...')
      await tx.wait()

      setStatus('✅ Deposit successful!')

      // Reload balance info
      await loadBalanceInfo(accountAddress)

      setTimeout(() => setStatus(''), 3000)
    } catch (err) {
      console.error('Error depositing to EntryPoint:', err)
      setError(`Failed to deposit: ${err.message}`)
    } finally {
      setDepositLoading(false)
    }
  }

  const sendTransaction = async () => {
    if (!targetAddress || !amount) {
      setError('Please enter target address and amount')
      return
    }

    if (!isConnected) {
      setError('Please login with Web3Auth first')
      return
    }

    if (!accountInfo) {
      setError('Loading account info...')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Preparing transaction...')
    setTxHash('')
    setPasskeySignature(null)
    setOwnerSignature(null)
    setCombinedSignature(null)

    try {
      // CRITICAL: Read on-chain state DIRECTLY from contract before signing
      // This ensures we have the latest twoFactorEnabled and passkey settings
      console.log('🚀 STARTING TRANSACTION - Reading on-chain state directly...')
      setStatus('Reading on-chain account state...')

      // Check if account is deployed by reading code directly
      const accountCode = await sdk.provider.getCode(accountAddress)
      const isActuallyDeployed = accountCode !== '0x'

      console.log('📝 Deployment check:', {
        accountAddress,
        accountCode: accountCode.substring(0, 20) + '...',
        codeLength: accountCode.length,
        isActuallyDeployed,
      })

      let currentAccountInfo = accountInfo
      let onChainQx = '0x0000000000000000000000000000000000000000000000000000000000000000'
      let onChainQy = '0x0000000000000000000000000000000000000000000000000000000000000000'
      let onChainTwoFactorEnabled = false

      if (isActuallyDeployed) {
        console.log('🔄 Reading on-chain state DIRECTLY from contract...')

        // Read directly from contract - bypass all caching
        const accountContract = new ethers.Contract(
          accountAddress,
          [
            'function qx() view returns (bytes32)',
            'function qy() view returns (bytes32)',
            'function twoFactorEnabled() view returns (bool)',
          ],
          sdk.provider
        )

        const [qx, qy, twoFactorEnabled] = await Promise.all([
          accountContract.qx(),
          accountContract.qy(),
          accountContract.twoFactorEnabled(),
        ])

        onChainQx = qx
        onChainQy = qy
        onChainTwoFactorEnabled = twoFactorEnabled

        console.log('✅ On-chain state (direct from contract):', {
          accountAddress,
          qx: onChainQx,
          qy: onChainQy,
          twoFactorEnabled: onChainTwoFactorEnabled,
        })

        // Update currentAccountInfo with on-chain values
        currentAccountInfo = {
          ...accountInfo,
          qx: onChainQx,
          qy: onChainQy,
          twoFactorEnabled: onChainTwoFactorEnabled,
          hasPasskey: onChainQx !== '0x0000000000000000000000000000000000000000000000000000000000000000',
          isDeployed: true,
          deployed: true,
        }
      } else {
        console.log('⚠️ Account NOT deployed yet - using accountInfo from creation config')
        // For undeployed accounts, use the accountInfo from creation
        // This should have the passkey and 2FA settings from when the account was created
        onChainQx = accountInfo.qx || '0x0000000000000000000000000000000000000000000000000000000000000000'
        onChainQy = accountInfo.qy || '0x0000000000000000000000000000000000000000000000000000000000000000'
        onChainTwoFactorEnabled = accountInfo.twoFactorEnabled || false

        console.log('📋 Using accountInfo for undeployed account:', {
          qx: onChainQx,
          qy: onChainQy,
          twoFactorEnabled: onChainTwoFactorEnabled,
        })
      }

      // Determine if this is an owner-only account (no passkey OR passkey configured but 2FA disabled)
      // This MUST match the contract logic in P256Account.sol line 264:
      // if (_qx == bytes32(0) || !_twoFactorEnabled) { /* owner-only mode */ }
      const hasPasskey = onChainQx !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      const isOwnerOnly = !hasPasskey || !onChainTwoFactorEnabled

      // Log account and credential info for debugging
      console.log('🔍 SIGNATURE MODE DETERMINATION (FROM ON-CHAIN DATA):', {
        'onChainQx': onChainQx,
        'onChainQy': onChainQy,
        'onChainTwoFactorEnabled': onChainTwoFactorEnabled,
        'computed hasPasskey': hasPasskey,
        'computed isOwnerOnly': isOwnerOnly,
        'FINAL MODE': isOwnerOnly ? '👤 OWNER-ONLY (65 bytes)' : (onChainTwoFactorEnabled ? '🔐 PASSKEY + OWNER (WebAuthn + 65 bytes)' : '🔑 PASSKEY-ONLY (WebAuthn)'),
      })

      console.log('📋 Account Info (using on-chain data):', {
        address: accountAddress,
        isDeployed: isActuallyDeployed,
        twoFactorEnabled: onChainTwoFactorEnabled,
        hasPasskey: hasPasskey,
        isOwnerOnly,
        signatureMode: isOwnerOnly ? '👤 OWNER-ONLY (65 bytes)' : (onChainTwoFactorEnabled ? '🔐 PASSKEY + OWNER (WebAuthn + 65 bytes)' : '🔑 PASSKEY-ONLY (WebAuthn)'),
        qx: onChainQx,
        qy: onChainQy,
      })

      console.log('🔐 Credential Info:', {
        hasCredential: !!credential,
        credentialId: credential?.id,
      })

      if (!isOwnerOnly) {
        // Check if we have the passkey credential
        if (!credential) {
          setError(
            `❌ PASSKEY REQUIRED BUT NOT FOUND!\n\n` +
            `This account requires a passkey to sign transactions, but you don't have the passkey on this device/browser.\n\n` +
            `📱 Passkeys are device-specific and stored in your device's secure enclave (Touch ID/Face ID).\n\n` +
            `💡 Solutions:\n` +
            `1. Switch to the device/browser where you created this wallet's passkey\n` +
            `2. Go to Settings → Security → Initiate account recovery to set a new passkey\n` +
            `3. Go to Settings → Security → Disable 2FA (requires 48-hour timelock)\n\n` +
            `🔍 On-chain state:\n` +
            `  Account: ${accountAddress}\n` +
            `  Has passkey: Yes (qx: ${onChainQx.slice(0, 20)}...)\n` +
            `  2FA enabled: ${onChainTwoFactorEnabled}`
          )
          setLoading(false)
          return
        }

        console.log('🔐 Passkey Credential:', {
          id: credential?.id,
          publicKey: credential?.publicKey,
        })

        // Verify public key matches what's in the contract
        if (currentAccountInfo.isDeployed && credential?.publicKey) {
          try {
            const accountContract = new ethers.Contract(
              accountAddress,
              ['function qx() view returns (bytes32)', 'function qy() view returns (bytes32)'],
              sdk.provider
            )
            const [contractQx, contractQy] = await Promise.all([
              accountContract.qx(),
              accountContract.qy()
            ])

            const { qx: credentialQx, qy: credentialQy } = credential.publicKey

            console.log('🔍 Public Key Verification:', {
              contractQx,
              contractQy,
              credentialQx,
              credentialQy,
              qxMatch: contractQx.toLowerCase() === credentialQx.toLowerCase(),
              qyMatch: contractQy.toLowerCase() === credentialQy.toLowerCase(),
            })

            if (contractQx.toLowerCase() !== credentialQx.toLowerCase() ||
                contractQy.toLowerCase() !== credentialQy.toLowerCase()) {
              setError('⚠️ Public key mismatch! The passkey does not match the account.')
              setLoading(false)
              return
            }
          } catch (err) {
            console.warn('Could not verify public key:', err)
          }
        }
      } else {
        console.log('👤 Owner-only account (no passkey required)')
      }

      const amountWei = ethers.parseEther(amount)

      // Step 0.5: Get Pimlico gas prices
      setStatus('Fetching gas prices from Pimlico...')
      let gasPrices = null
      try {
        const pimlicoGasPrice = await sdk.bundler.getUserOperationGasPrice()
        if (pimlicoGasPrice && pimlicoGasPrice.fast) {
          gasPrices = {
            maxFeePerGas: BigInt(pimlicoGasPrice.fast.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(pimlicoGasPrice.fast.maxPriorityFeePerGas),
          }
          console.log('✅ Using Pimlico gas prices:', gasPrices)
        }
      } catch (e) {
        console.warn('Failed to get Pimlico gas prices, using provider gas prices', e)
      }

      // Step 1: Build UserOperation
      setStatus('Building UserOperation...')

      // Batch RPC calls to reduce rate limiting
      // Get balance and factory code in parallel (we already have accountCode from earlier)
      const [accountBalance, factoryCode] = await Promise.all([
        sdk.provider.getBalance(accountAddress),
        !isActuallyDeployed ? sdk.provider.getCode(sdk.accountManager.factoryAddress) : Promise.resolve('0x'),
      ])

      console.log('🏗️ Building UserOperation:', {
        accountAddress,
        isDeployed: isActuallyDeployed,
        needsDeployment: !isActuallyDeployed,
        initCodeLength: isActuallyDeployed ? 0 : currentAccountInfo.initCode.length,
        isOwnerOnly,
        credentialPublicKey: credential?.publicKey,
        accountInfoQx: currentAccountInfo.qx,
        accountInfoQy: currentAccountInfo.qy,
      })

      console.log('💰 Account balance:', ethers.formatEther(accountBalance), 'ETH')

      if (accountBalance === 0n) {
        throw new Error('Account has no ETH! Please fund the account first.')
      }

      // Check if factory is deployed (only if account not deployed yet)
      if (!isActuallyDeployed) {
        console.log('🏭 Factory deployed:', factoryCode !== '0x')
        console.log('🏭 Factory address:', sdk.accountManager.factoryAddress)

        if (factoryCode === '0x') {
          throw new Error(`Factory not deployed at ${sdk.accountManager.factoryAddress}! Please deploy the factory first.`)
        }
      }

      // Verify public key matches (only for passkey accounts)
      if (!isOwnerOnly && credential?.publicKey) {
        const { qx: credQx, qy: credQy } = formatPublicKeyForContract(credential.publicKey)
        const qxMatches = credQx === currentAccountInfo.qx
        const qyMatches = credQy === currentAccountInfo.qy

        console.log('🔍 Public key verification:', {
          credentialQx: credQx,
          credentialQy: credQy,
          accountQx: currentAccountInfo.qx,
          accountQy: currentAccountInfo.qy,
          qxMatches,
          qyMatches,
        })

        if (!qxMatches || !qyMatches) {
          throw new Error(
            `❌ PUBLIC KEY MISMATCH!\n\n` +
            `Your passkey's public key does NOT match the account's public key.\n\n` +
            `This means you're trying to sign with a DIFFERENT passkey than the one that created the account.\n\n` +
            `Solutions:\n` +
            `1. Delete the current passkey and create a NEW account with a new passkey\n` +
            `2. Or use the SAME passkey that created account ${accountAddress}\n\n` +
            `Credential Public Key:\n` +
            `  qx: ${credQx}\n` +
            `  qy: ${credQy}\n\n` +
            `Account Public Key (on-chain):\n` +
            `  qx: ${currentAccountInfo.qx}\n` +
            `  qy: ${currentAccountInfo.qy}`
          )
        }

        console.log('✅ Public key matches! Proceeding with signature...')
      }

      const userOp = await buildSendEthUserOp({
        accountAddress,
        targetAddress,
        amount: amountWei,
        provider: sdk.provider,
        needsDeployment: !isActuallyDeployed,
        initCode: isActuallyDeployed ? '0x' : currentAccountInfo.initCode,
      })

      console.log('📋 UserOp initCode details:', {
        isDeployed: isActuallyDeployed,
        initCodeLength: userOp.initCode.length,
        initCodePreview: userOp.initCode.slice(0, 66) + '...',
        factoryAddress: userOp.initCode.slice(0, 42),
        sender: userOp.sender,
      })

      // Apply Pimlico gas prices if available
      if (gasPrices) {
        const { maxFeePerGas, maxPriorityFeePerGas } = gasPrices
        userOp.gasFees = packGasFees(maxPriorityFeePerGas, maxFeePerGas)
        console.log('✅ Applied Pimlico gas prices to UserOp:', { maxFeePerGas, maxPriorityFeePerGas })
      }

      // Step 1.5: Ask bundler to estimate gas and apply it before hashing/signing
      setStatus('Estimating gas with bundler...')
      try {
        const est = await sdk.bundler.estimateUserOperationGas(userOp)
        const toBig = (v) => (typeof v === 'string' ? BigInt(v) : BigInt(v))
        const callGas = toBig(est.callGasLimit)
        let verifGas = toBig(est.verificationGasLimit)
        let preVerif = toBig(est.preVerificationGas)

        // Add 50% buffer to verification gas for P256 signature verification
        // The bundler's estimate is often too low for WebAuthn signatures
        const verifGasWithBuffer = (verifGas * 150n) / 100n

        // Add 10% buffer to preVerificationGas for signature overhead
        const preVerifWithBuffer = (preVerif * 110n) / 100n

        console.log('📊 Verification gas:', {
          estimated: verifGas.toString(),
          withBuffer: verifGasWithBuffer.toString(),
          bufferAdded: '50%'
        })

        console.log('📊 PreVerification gas:', {
          estimated: preVerif.toString(),
          withBuffer: preVerifWithBuffer.toString(),
          bufferAdded: '10%'
        })

        userOp.accountGasLimits = packAccountGasLimits(verifGasWithBuffer, callGas)
        userOp.preVerificationGas = '0x' + preVerifWithBuffer.toString(16)
        console.log('✅ Gas estimation successful:', { callGas, verifGas: verifGasWithBuffer, preVerif: preVerifWithBuffer })
      } catch (e) {
        console.warn('Gas estimation via bundler failed; proceeding with defaults', e)
      }

      // Step 2: Get userOpHash
      setStatus('Computing userOpHash...')
      const userOpHash = await getUserOpHash(userOp, sdk.provider, sdk.chainId)
      const userOpHashBytes = ethers.getBytes(userOpHash)

      console.log('🔐 UserOpHash:', {
        userOpHash,
        userOpHashLength: userOpHashBytes.length
      })

      // Step 3: Sign the UserOperation
      let signedUserOp

      if (isOwnerOnly) {
        // Owner-only account: Sign with owner signature only
        setStatus('🔐 Requesting signature from your social login account...')
        console.log('👤 Owner-only account: Signing with owner signature only')

        try {
          // Show confirmation dialog before signing
          const ownerSig = await requestSignatureWithConfirmation({
            userOpHash,
            targetAddress,
            amount: ethers.parseEther(amount),
            accountAddress,
            nonce: currentAccountInfo.nonce,
            isDeployment: !isActuallyDeployed,
            isTwoFactorAuth: false,
            signatureStep: 'only',
          })

          console.log('🔐 Owner signature received:', ownerSig)
          setOwnerSignature(ownerSig)

          // Sign with owner signature only
          signedUserOp = signUserOperationOwnerOnly(userOp, ownerSig)
          setCombinedSignature(signedUserOp.signature)
        } catch (err) {
          console.error('🔐 Error signing with Web3Auth:', err)
          throw err
        }
      } else {
        // Passkey account: Sign with passkey (and optionally owner for 2FA)
        setStatus('🔑 Signing with Passkey (Touch ID/Face ID)...')

        // Get credential ID (support both old and new format)
        const credentialId = credential.rawId || credential.credentialId
        const credentialIdBytes = credentialId instanceof ArrayBuffer
          ? new Uint8Array(credentialId)
          : new Uint8Array(credentialId)

        console.log('🔑 Using credential:', {
          credentialId: Array.from(credentialIdBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
          publicKey: credential.publicKey,
        })

        // Step 4: Check if 2FA is enabled - if so, get Web3Auth signature FIRST
        let ownerSig = null
        console.log('🔐 2FA Check:', {
          twoFactorEnabled: currentAccountInfo.twoFactorEnabled,
          currentAccountInfo: currentAccountInfo,
        })

        if (currentAccountInfo.twoFactorEnabled) {
          // 2FA ENABLED: Show Web3Auth confirmation dialog FIRST
          setStatus('🔐 Step 1/2: Requesting signature from your social login account...')
          console.log('🔐 2FA ENABLED: Requesting owner signature FIRST (Step 1/2)...')
          console.log('🔐 UserOpHash for signing:', userOpHash)
          console.log('🔐 UserOpHash bytes:', userOpHashBytes)
          try {
            // Show confirmation dialog before signing with Web3Auth
            ownerSig = await requestSignatureWithConfirmation({
              userOpHash,
              targetAddress,
              amount: ethers.parseEther(amount),
              accountAddress,
              nonce: currentAccountInfo.nonce,
              isDeployment: !isActuallyDeployed,
              isTwoFactorAuth: true,
              signatureStep: '1/2',
            })

            console.log('🔐 Owner signature received:', ownerSig)
            console.log('🔐 Owner signature length:', ownerSig.length)
            console.log('🔐 Owner signature (hex):', ownerSig)

            // Check signature format
            if (ownerSig.startsWith('0x')) {
              const sigLength = (ownerSig.length - 2) / 2
              console.log('🔐 Owner signature byte length:', sigLength)
              if (sigLength !== 65) {
                console.warn('⚠️ WARNING: Owner signature is', sigLength, 'bytes, expected 65 bytes!')
              }

              // Extract r, s, v
              const sigHex = ownerSig.slice(2)
              const r = sigHex.slice(0, 64)
              const s = sigHex.slice(64, 128)
              const v = sigHex.slice(128, 130)
              console.log('🔐 Signature components:', {
                r: '0x' + r,
                s: '0x' + s,
                v: parseInt(v, 16),
              })
            }

            setOwnerSignature(ownerSig)
          } catch (err) {
            console.error('🔐 Error signing with Web3Auth:', err)
            throw err
          }
        }

        // Step 5: Sign with Passkey (P-256)
        // If 2FA enabled: This is Step 2/2 (passkey as 2FA confirmation)
        // If 2FA disabled: This is the only signature needed
        const stepLabel = currentAccountInfo.twoFactorEnabled ? 'Step 2/2' : 'Only step'
        setStatus(`🔑 ${stepLabel}: Signing with your passkey (biometric)...`)
        console.log(`🔑 Signing with passkey (${stepLabel})...`)

        const passkeySignatureRaw = await signWithPasskey(credential, userOpHashBytes)

        // Step 6: Decode DER signature to r,s
        setStatus(`🔑 ${stepLabel}: Decoding P-256 signature...`)

        console.log('🔑 Raw DER signature:', {
          derSignatureHex: Array.from(passkeySignatureRaw.signature).map(b => b.toString(16).padStart(2, '0')).join(''),
          derSignatureLength: passkeySignatureRaw.signature.length,
        })

        console.log('🔑 ClientDataJSON from passkey:', {
          clientDataJSON: passkeySignatureRaw.clientDataJSON,
          clientDataJSONLength: passkeySignatureRaw.clientDataJSON.length,
          clientDataJSONHash: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passkeySignatureRaw.clientDataJSON)),
        })

        const { r, s } = sdk.derToRS(passkeySignatureRaw.signature)
        const passkeyR = '0x' + r
        const passkeyS = '0x' + s

        console.log('🔑 Passkey signature:', {
          r: passkeyR,
          s: passkeyS,
          rLength: r.length,
          sLength: s.length,
          authenticatorDataLength: passkeySignatureRaw.authenticatorData.length,
          clientDataJSONLength: passkeySignatureRaw.clientDataJSON.length,
          clientDataJSON: passkeySignatureRaw.clientDataJSON,
          authenticatorDataHex: Array.from(passkeySignatureRaw.authenticatorData).map(b => b.toString(16).padStart(2, '0')).join(''),
        })

        // Prepare passkey signature with WebAuthn data
        const passkeySignature = {
          r: passkeyR,
          s: passkeyS,
          authenticatorData: passkeySignatureRaw.authenticatorData,
          clientDataJSON: passkeySignatureRaw.clientDataJSON,
        }

        setPasskeySignature({ r: passkeyR, s: passkeyS })

        // Step 7: Combine signatures
        setStatus('Preparing final signature...')
        signedUserOp = signUserOperation(
          userOp,
          passkeySignature,
          ownerSig
        )
        setCombinedSignature(signedUserOp.signature)
      }

      // Step 8: Submit UserOperation to bundler
      setStatus('Submitting to bundler...')
      const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)

      setTxHash(receipt.transactionHash)
      setStatus(`✅ Transaction confirmed! ${isActuallyDeployed ? '' : 'Account deployed + '}Transaction executed`)

      // Clear cache and refresh account info
      sdk.accountManager.clearCache(accountAddress)
      const updatedInfo = await sdk.getAccountInfo(accountAddress)
      setAccountInfo({ ...updatedInfo, deployed: updatedInfo.deployed })

    } catch (err) {
      console.error('Error sending transaction:', err)

      // Get user-friendly error message
      const friendlyMessage = getUserFriendlyMessage(err)
      const suggestedAction = getSuggestedAction(err)
      const canRetry = isRetryableError(err)

      // Format error message with suggestion
      const errorMessage = canRetry
        ? `${friendlyMessage}\n\n💡 ${suggestedAction}\n\n🔄 This error is temporary - you can try again.`
        : `${friendlyMessage}\n\n💡 ${suggestedAction}`

      setError(errorMessage)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  // Load balance when component mounts or network changes
  useEffect(() => {
    if (accountAddress && sdk) {
      loadBalanceInfo(accountAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountAddress, sdk, networkInfo.chainId])

  // Calculate USD value
  const getUSDValue = () => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00'
    const ethPriceUSD = 2500 // Mock price
    return (parseFloat(amount) * ethPriceUSD).toFixed(2)
  }

  // Handle Max button
  const handleMaxAmount = () => {
    if (balanceInfo?.accountBalance) {
      // Leave some ETH for gas (0.001 ETH)
      const maxAmount = Math.max(0, parseFloat(balanceInfo.accountBalance) - 0.001)
      setAmount(maxAmount.toFixed(6))
    }
  }

  return (
    <div className="transaction-sender">
      {/* Amount Input Section */}
      <div className="amount-section">
        <div className="amount-input-wrapper">
          <input
            type="text"
            className="amount-input"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              // Only allow numbers and decimal point
              const value = e.target.value
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAmount(value)
              }
            }}
            disabled={loading || !isConnected}
          />
          <button
            className="max-button"
            onClick={handleMaxAmount}
            disabled={loading || !isConnected || !balanceInfo}
          >
            Max
          </button>
        </div>
        <div className="amount-usd">${getUSDValue()}</div>
      </div>

      {/* Token Selector */}
      <div className="token-selector">
        <div className="token-info">
          <div className="token-icon">
            <svg viewBox="0 0 784.37 1277.39" xmlns="http://www.w3.org/2000/svg">
              <g fill="#343434" fillRule="nonzero">
                <path d="m392.07 0-8.57 29.11v844.63l8.57 8.55 392.06-231.75z" fillOpacity=".6"/>
                <path d="m392.07 0-392.07 650.54 392.07 231.75v-435.68z"/>
                <path d="m392.07 956.52-4.83 5.89v300.87l4.83 14.1 392.3-552.49z" fillOpacity=".6"/>
                <path d="m392.07 1277.38v-320.86l-392.07-231.75z"/>
                <path d="m392.07 882.29 392.06-231.75-392.06-178.21z" fillOpacity=".2"/>
                <path d="m0 650.54 392.07 231.75v-409.96z" fillOpacity=".6"/>
              </g>
            </svg>
          </div>
          <div className="token-details">
            <div className="token-name">Ether</div>
            <div className="token-available">
              Available: {balanceInfo ? parseFloat(balanceInfo.accountBalance).toFixed(4) : '0.0000'} ETH
            </div>
          </div>
        </div>
        <div className="token-dropdown-icon">▼</div>
      </div>

      {/* To Address Section */}
      <div className="to-section">
        <label className="to-label">To</label>
        <input
          type="text"
          className="to-input"
          placeholder="Enter a public address"
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          disabled={loading || !isConnected}
        />
      </div>

      {/* Sign Button */}
      <button
        className="sign-button"
        onClick={sendTransaction}
        disabled={loading || !isConnected || !accountInfo || !targetAddress || !amount}
      >
        {loading ? (
          <span className="button-content">
            <span className="spinner-small"></span>
            {status || 'Processing...'}
          </span>
        ) : (
          'Sign'
        )}
      </button>

      {/* Status Messages */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {txHash && (
        <div className="success-message">
          <div className="success-title">✅ Transaction Successful!</div>
          <div className="tx-hash-label">Transaction Hash:</div>
          <div className="tx-hash">{txHash}</div>
          <a
            href={`${networkInfo.explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="view-explorer"
          >
            View on Explorer →
          </a>
        </div>
      )}

      {/* Account Info - Collapsible */}
      {accountInfo && !txHash && (
        <div className="account-info">
          {accountInfo.error ? (
            <div className="info-item">
              <span className="info-label">⚠️ Network Status:</span>
              <span className="info-value" style={{ color: '#ff6b6b' }}>
                {accountInfo.error}
              </span>
            </div>
          ) : (
            <>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {accountInfo.isDeployed ? '✅ Deployed' : '⏳ Will deploy on first transaction'}
                </span>
              </div>
              {accountInfo.twoFactorEnabled && (
                <div className="info-item">
                  <span className="info-label">Security:</span>
                  <span className="info-value">🔒 2FA Enabled</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Signature Confirmation Dialog */}
      <SignatureConfirmationDialog
        isOpen={showSignatureDialog}
        onConfirm={handleSignatureConfirm}
        onCancel={handleSignatureCancel}
        signatureData={pendingSignatureData}
      />
    </div>
  )
}

export default TransactionSender

