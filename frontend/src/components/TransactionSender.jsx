import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { signWithPasskey } from '../utils/webauthn'
import { formatSignatureForDisplay } from '../utils/signatureUtils'
import { useP256SDK } from '../hooks/useP256SDK'
import { ethers } from 'ethers'
import { buildSendEthUserOp, getUserOpHash, signUserOperation, packAccountGasLimits, packGasFees } from '../lib/userOperation'
import { getUserFriendlyMessage, getSuggestedAction, isRetryableError } from '../lib/errors'
import { formatPublicKeyForContract } from '../lib/accountManager'

function TransactionSender({ accountAddress, credential }) {
  const { isConnected, signMessage, signRawHash, address: ownerAddress } = useWeb3Auth()
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

  // Load account info (derive from SDK using passkey + owner to ensure correct initCode)
  useEffect(() => {
    const loadAccountInfo = async () => {
      if (accountAddress && sdk && credential?.publicKey && ownerAddress) {
        try {
          const derived = await sdk.createAccount(credential.publicKey, ownerAddress, 0n)
          if (derived.address.toLowerCase() !== accountAddress.toLowerCase()) {
            console.warn('Provided accountAddress differs from derived address from credentials/owner', {
              provided: accountAddress,
              derived: derived.address,
            })
          }
          // Normalize to shape expected by this component
          setAccountInfo({
            ...derived,
            deployed: derived.isDeployed,
          })

          // Don't load balance info here - it will be loaded when user sends transaction
          // This reduces unnecessary RPC calls
        } catch (err) {
          console.error('Error loading account info:', err)
        }
      }
    }
    loadAccountInfo()
  }, [accountAddress, sdk, credential, ownerAddress])

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
      // Log account and credential info for debugging
      console.log('📋 Account Info:', {
        address: accountAddress,
        isDeployed: accountInfo.isDeployed,
        twoFactorEnabled: accountInfo.twoFactorEnabled,
      })

      console.log('🔐 Passkey Credential:', {
        id: credential.id,
        publicKey: credential.publicKey,
      })

      // Verify public key matches what's in the contract
      if (accountInfo.isDeployed) {
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
      // Get account code, balance, and factory code in parallel
      const [accountCode, accountBalance, factoryCode] = await Promise.all([
        sdk.provider.getCode(accountAddress),
        sdk.provider.getBalance(accountAddress),
        !accountInfo.isDeployed ? sdk.provider.getCode(sdk.accountManager.factoryAddress) : Promise.resolve('0x'),
      ])

      const isActuallyDeployed = accountCode !== '0x'

      console.log('📝 Account code check:', {
        accountAddress,
        codeLength: accountCode.length,
        hasCode: isActuallyDeployed,
        isDeployedFlag: accountInfo.isDeployed,
      })

      // If account is actually deployed but accountInfo says it's not, update it
      if (isActuallyDeployed && !accountInfo.isDeployed) {
        console.log('🔄 Account is deployed on-chain but accountInfo says it\'s not. Updating...')
        const updatedInfo = await sdk.createAccount(credential.publicKey, ownerAddress, 0n)
        setAccountInfo({ ...updatedInfo, deployed: updatedInfo.isDeployed })
      }

      console.log('🏗️ Building UserOperation:', {
        accountAddress,
        isDeployed: isActuallyDeployed,
        needsDeployment: !isActuallyDeployed,
        initCodeLength: isActuallyDeployed ? 0 : accountInfo.initCode.length,
        credentialPublicKey: credential.publicKey,
        accountInfoQx: accountInfo.qx,
        accountInfoQy: accountInfo.qy,
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

      // Verify public key matches
      const { qx: credQx, qy: credQy } = formatPublicKeyForContract(credential.publicKey)
      const qxMatches = credQx === accountInfo.qx
      const qyMatches = credQy === accountInfo.qy

      console.log('🔍 Public key verification:', {
        credentialQx: credQx,
        credentialQy: credQy,
        accountQx: accountInfo.qx,
        accountQy: accountInfo.qy,
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
          `  qx: ${accountInfo.qx}\n` +
          `  qy: ${accountInfo.qy}`
        )
      }

      console.log('✅ Public key matches! Proceeding with signature...')

      const userOp = await buildSendEthUserOp({
        accountAddress,
        targetAddress,
        amount: amountWei,
        provider: sdk.provider,
        needsDeployment: !isActuallyDeployed,
        initCode: isActuallyDeployed ? '0x' : accountInfo.initCode,
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

      // Step 3: Sign with passkey (P-256)
      // Note: WebAuthn will wrap this challenge in clientDataJSON and sign sha256(authenticatorData || sha256(clientDataJSON))
      // But we're using a simplified approach where we just extract the raw signature
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

      const passkeySignatureRaw = await signWithPasskey(credential, userOpHashBytes)

      // Step 4: Decode DER signature to r,s
      setStatus('Decoding P-256 signature...')

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

      // Step 5: Check if 2FA is enabled
      let ownerSig = null
      console.log('🔐 2FA Check:', {
        twoFactorEnabled: accountInfo.twoFactorEnabled,
        accountInfo: accountInfo,
      })
      if (accountInfo.twoFactorEnabled) {
        setStatus('🔐 Signing with Web3Auth wallet (2FA)...')
        console.log('🔐 Requesting owner signature for 2FA...')
        console.log('🔐 UserOpHash for signing:', userOpHash)
        console.log('🔐 UserOpHash bytes:', userOpHashBytes)
        try {
          // Use signRawHash to sign without Ethereum message prefix
          ownerSig = await signRawHash(userOpHash)
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
      } else {
        console.warn('⚠️ 2FA is disabled! Owner signature will NOT be included.')
      }

      // Step 6: Combine signatures
      setStatus('Preparing final signature...')
      const signedUserOp = signUserOperation(
        userOp,
        passkeySignature,
        ownerSig
      )
      setCombinedSignature(signedUserOp.signature)

      // Step 7: Submit UserOperation to bundler
      setStatus('Submitting to bundler...')
      const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)

      setTxHash(receipt.transactionHash)
      setStatus(`✅ Transaction confirmed! ${isActuallyDeployed ? '' : 'Account deployed + '}Transaction executed`)

      // Clear cache and refresh account info
      sdk.accountManager.clearCache(accountAddress)
      const updatedInfo = await sdk.createAccount(credential.publicKey, ownerAddress, 0n)
      setAccountInfo({ ...updatedInfo, deployed: updatedInfo.isDeployed })

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

  return (
    <div className="card">
      <h2>3️⃣ Send Transaction</h2>
      <p className="text-sm mb-4">
        Send ETH using your P256Account wallet.
        {accountInfo?.twoFactorEnabled && " You'll need to sign with both your Passkey and Web3Auth wallet (2FA)."}
      </p>

      {accountInfo && (
        <div className="status status-info mb-4">
          {accountInfo.isDeployed
            ? `✅ Account deployed | Nonce: ${accountInfo.nonce?.toString() || '0'}`
            : '⏳ Account will deploy on first transaction'
          }
          {accountInfo.twoFactorEnabled && ' | 🔒 2FA Enabled'}
        </div>
      )}

      {/* Balance and Deposit Info */}
      {balanceInfo && (
        <div className="card mb-4" style={{ background: '#f8f9fa', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>💰 Balance & Deposit</h3>
          <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
            <div>
              <strong>Account Balance:</strong> {balanceInfo.accountBalance} ETH
              {parseFloat(balanceInfo.accountBalance) < 0.001 && (
                <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>⚠️ Low balance</span>
              )}
            </div>
            <div>
              <strong>EntryPoint Deposit:</strong> {balanceInfo.entryPointDeposit} ETH
              {parseFloat(balanceInfo.entryPointDeposit) < 0.001 && (
                <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>⚠️ Low deposit</span>
              )}
            </div>
          </div>

          {parseFloat(balanceInfo.entryPointDeposit) < 0.01 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                💡 Low EntryPoint deposit may cause transaction failures. Deposit from your Web3Auth wallet:
              </p>
              <button
                className="button"
                onClick={depositToEntryPoint}
                disabled={depositLoading || !isConnected}
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {depositLoading ? 'Depositing...' : '💳 Deposit 0.02 ETH to EntryPoint'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-col">
        <div>
          <label className="label">Target Address</label>
          <input
            type="text"
            className="input"
            placeholder="0x..."
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            disabled={loading || !isConnected}
          />
        </div>

        <div>
          <label className="label">Amount (ETH)</label>
          <input
            type="text"
            className="input"
            placeholder="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading || !isConnected}
          />
        </div>

        <button
          className="button"
          onClick={sendTransaction}
          disabled={loading || !isConnected || !accountInfo}
        >
          {loading ? 'Sending...' : accountInfo?.twoFactorEnabled ? '🔐 Send Transaction (2FA)' : '📤 Send Transaction'}
        </button>
      </div>

      {status && !error && (
        <div className="status status-info mt-4">
          {status}
        </div>
      )}

      {error && (
        <div className="status status-error mt-4">
          ❌ {error}
        </div>
      )}

      {/* Show signature details */}
      {(passkeySignature || ownerSignature || combinedSignature) && (
        <div className="mt-4">
          <h3>Signature Details (2FA)</h3>

          {passkeySignature && (
            <div className="mt-2">
              <strong>1️⃣ Passkey Signature (P-256):</strong>
              <div className="code-block" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                <div>r: {passkeySignature.r}</div>
                <div>s: {passkeySignature.s}</div>
              </div>
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                ✅ Signed with biometric authentication
              </p>
            </div>
          )}

          {ownerSignature && (
            <div className="mt-3">
              <strong>2️⃣ Owner Signature (ECDSA):</strong>
              <div className="code-block" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {ownerSignature}
              </div>
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                ✅ Signed with Web3Auth wallet
              </p>
            </div>
          )}

          {combinedSignature && (
            <div className="mt-3">
              <strong>🔐 Combined Signature (129 bytes):</strong>
              <div className="code-block" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {formatSignatureForDisplay(combinedSignature)}
              </div>
              <p className="text-xs mt-1" style={{ color: '#666' }}>
                ✅ Ready for 2FA validation
              </p>
            </div>
          )}
        </div>
      )}

      {txHash && (
        <div className="mt-4">
          <h3>Transaction Hash</h3>
          <div className="code-block">
            {txHash}
          </div>
          <p className="text-xs mt-4">
            Your transaction has been submitted to the network!
          </p>
        </div>
      )}

      <div className="mt-4">
        <h3>How it works:</h3>
        <ol className="text-sm" style={{ marginLeft: '20px', marginTop: '8px' }}>
          <li>Create a UserOperation with your transaction details</li>
          <li>Compute the userOpHash</li>
          <li>Sign the hash with your passkey (P-256 ECDSA)</li>
          <li>Decode DER signature to raw r,s components</li>
          <li>Submit UserOperation to bundler</li>
          <li>Bundler submits to EntryPoint, which verifies using P256VERIFY precompile</li>
        </ol>
      </div>
    </div>
  )
}

export default TransactionSender

