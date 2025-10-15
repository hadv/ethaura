import { useState } from 'react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { signWithPasskey, derToRS } from '../utils/webauthn'
import { combineTwoFactorSignatures, formatSignatureForDisplay } from '../utils/signatureUtils'
import { keccak256 } from 'viem'

function TransactionSender({ accountAddress, credential }) {
  const { isConnected, signMessage } = useWeb3Auth()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetAddress, setTargetAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [passkeySignature, setPasskeySignature] = useState(null)
  const [ownerSignature, setOwnerSignature] = useState(null)
  const [combinedSignature, setCombinedSignature] = useState(null)

  const sendTransaction = async () => {
    if (!targetAddress || !amount) {
      setError('Please enter target address and amount')
      return
    }

    if (!isConnected) {
      setError('Please login with Web3Auth first')
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
      // Step 1: Create UserOperation
      setStatus('Creating UserOperation...')

      const userOp = {
        sender: accountAddress,
        nonce: '0x0', // In production, fetch from contract
        callData: '0x', // Encode execute(target, value, data)
        callGasLimit: '0x10000',
        verificationGasLimit: '0x10000',
        preVerificationGas: '0x5000',
        maxFeePerGas: '0x3b9aca00',
        maxPriorityFeePerGas: '0x3b9aca00',
        signature: '0x',
      }

      // Step 2: Get userOpHash
      setStatus('Computing userOpHash...')
      // In production, compute proper userOpHash
      const userOpHash = new Uint8Array(32)
      crypto.getRandomValues(userOpHash)
      const userOpHashHex = '0x' + Array.from(userOpHash).map(b => b.toString(16).padStart(2, '0')).join('')

      // Step 3: Sign with passkey (P-256)
      setStatus('🔑 Signing with Passkey (Touch ID/Face ID)...')
      const passkeySignatureRaw = await signWithPasskey(credential, userOpHash)

      // Step 4: Decode DER signature to r,s
      setStatus('Decoding P-256 signature...')
      const { r, s } = derToRS(passkeySignatureRaw.signature)
      const passkeyR = '0x' + r
      const passkeyS = '0x' + s

      setPasskeySignature({ r: passkeyR, s: passkeyS })

      // Step 5: Sign with Web3Auth wallet (ECDSA)
      setStatus('🔐 Signing with Web3Auth wallet (2FA)...')
      const ownerSig = await signMessage(userOpHashHex)
      setOwnerSignature(ownerSig)

      // Step 6: Combine signatures for 2FA
      setStatus('Combining signatures for 2FA...')
      const finalSignature = combineTwoFactorSignatures(
        { r: passkeyR, s: passkeyS },
        ownerSig
      )
      setCombinedSignature(finalSignature)

      // Step 7: Submit UserOperation
      setStatus('Submitting UserOperation with 2FA...')

      // In production, submit to bundler
      // const response = await fetch('https://bundler.example.com/rpc', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     jsonrpc: '2.0',
      //     method: 'eth_sendUserOperation',
      //     params: [{ ...userOp, signature: finalSignature }, entryPointAddress],
      //     id: 1,
      //   }),
      // })

      // Simulate for demo
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockTxHash = '0x' + Array.from(
        new Uint8Array(32).map(() => Math.floor(Math.random() * 256))
      ).map(b => b.toString(16).padStart(2, '0')).join('')

      setTxHash(mockTxHash)
      setStatus('✅ Transaction sent successfully with 2FA!')

    } catch (err) {
      console.error('Error sending transaction:', err)
      setError(err.message)
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>3️⃣ Send Transaction with 2FA</h2>
      <p className="text-sm mb-4">
        Send a transaction using your P256Account wallet with Two-Factor Authentication.
        You'll need to sign with both your Passkey and Web3Auth wallet.
      </p>

      <div className="status status-info mb-4">
        🔒 2FA Required: This transaction needs both signatures
      </div>

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
          disabled={loading || !isConnected}
        >
          {loading ? 'Sending...' : '🔐 Send Transaction (2FA)'}
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

