import { useState, useEffect } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { signWithPasskey } from '../utils/webauthn'
import { formatSignatureForDisplay } from '../utils/signatureUtils'
import { useP256SDK } from '../hooks/useP256SDK'
import { ethers } from 'ethers'
import { buildSendEthUserOp, getUserOpHash, signUserOperation } from '../lib/userOperation'
import { getUserFriendlyMessage, getSuggestedAction, isRetryableError } from '../lib/errors'

function TransactionSender({ accountAddress, credential }) {
  const { isConnected, signMessage } = useWeb3Auth()
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

  // Load account info
  useEffect(() => {
    const loadAccountInfo = async () => {
      if (accountAddress && sdk) {
        try {
          const info = await sdk.getAccountInfo(accountAddress)
          setAccountInfo(info)
        } catch (err) {
          console.error('Error loading account info:', err)
        }
      }
    }
    loadAccountInfo()
  }, [accountAddress, sdk])

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
      const amountWei = ethers.parseEther(amount)

      // Step 1: Build UserOperation
      setStatus('Building UserOperation...')
      const userOp = await buildSendEthUserOp({
        accountAddress,
        targetAddress,
        amount: amountWei,
        provider: sdk.provider,
        needsDeployment: !accountInfo.deployed,
        initCode: accountInfo.deployed ? '0x' : await sdk.accountManager.getInitCode(
          accountInfo.qx || credential.publicKey.x,
          accountInfo.qy || credential.publicKey.y,
          accountInfo.owner,
          0n
        ),
      })

      // Step 2: Get userOpHash
      setStatus('Computing userOpHash...')
      const userOpHash = await getUserOpHash(userOp, sdk.provider, sdk.chainId)
      const userOpHashBytes = ethers.getBytes(userOpHash)

      // Step 3: Sign with passkey (P-256)
      setStatus('🔑 Signing with Passkey (Touch ID/Face ID)...')
      const passkeySignatureRaw = await signWithPasskey(credential, userOpHashBytes)

      // Step 4: Decode DER signature to r,s
      setStatus('Decoding P-256 signature...')
      const { r, s } = sdk.derToRS(passkeySignatureRaw.signature)
      const passkeyR = '0x' + r
      const passkeyS = '0x' + s

      setPasskeySignature({ r: passkeyR, s: passkeyS })

      // Step 5: Check if 2FA is enabled
      let ownerSig = null
      if (accountInfo.twoFactorEnabled) {
        setStatus('🔐 Signing with Web3Auth wallet (2FA)...')
        ownerSig = await signMessage(ethers.getBytes(userOpHash))
        setOwnerSignature(ownerSig)
      }

      // Step 6: Combine signatures
      setStatus('Preparing final signature...')
      const signedUserOp = signUserOperation(
        userOp,
        { r: passkeyR, s: passkeyS },
        ownerSig
      )
      setCombinedSignature(signedUserOp.signature)

      // Step 7: Submit UserOperation to bundler
      setStatus('Submitting to bundler...')
      const receipt = await sdk.bundler.sendUserOperationAndWait(signedUserOp)

      setTxHash(receipt.transactionHash)
      setStatus(`✅ Transaction confirmed! ${accountInfo.deployed ? '' : 'Account deployed + '}Transaction executed`)

      // Refresh account info
      const updatedInfo = await sdk.getAccountInfo(accountAddress)
      setAccountInfo(updatedInfo)

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
          {accountInfo.deployed
            ? `✅ Account deployed | Nonce: ${accountInfo.nonce?.toString() || '0'}`
            : '⏳ Account will deploy on first transaction'
          }
          {accountInfo.twoFactorEnabled && ' | 🔒 2FA Enabled'}
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

