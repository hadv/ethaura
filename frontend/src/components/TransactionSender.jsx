import { useState } from 'react'
import { signWithPasskey, derToRS } from '../utils/webauthn'

function TransactionSender({ accountAddress, credential }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [targetAddress, setTargetAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')

  const sendTransaction = async () => {
    if (!targetAddress || !amount) {
      setError('Please enter target address and amount')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Preparing transaction...')
    setTxHash('')

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

      // Step 3: Sign with passkey
      setStatus('Signing with passkey...')
      const signature = await signWithPasskey(credential, userOpHash)

      // Step 4: Decode DER signature to r,s
      setStatus('Decoding signature...')
      const { r, s } = derToRS(signature.signature)

      // Step 5: Create final signature (r || s)
      const finalSignature = '0x' + r + s

      // Step 6: Submit UserOperation
      setStatus('Submitting UserOperation...')
      
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
      setStatus('Transaction sent successfully!')

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
      <h2>3️⃣ Send Transaction</h2>
      <p className="text-sm mb-4">
        Send a transaction using your P256Account wallet. The transaction will be signed
        with your passkey and submitted as a UserOperation.
      </p>

      <div className="flex-col">
        <div>
          <label className="label">Target Address</label>
          <input
            type="text"
            className="input"
            placeholder="0x..."
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            disabled={loading}
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
            disabled={loading}
          />
        </div>

        <button 
          className="button" 
          onClick={sendTransaction}
          disabled={loading}
        >
          {loading ? 'Sending...' : '📤 Send Transaction'}
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

