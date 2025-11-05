import React, { useState, useEffect } from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import { useP256SDK } from '../hooks/useP256SDK'
import { getSdkError } from '@walletconnect/utils'
import { ethers } from 'ethers'
import '../styles/WalletConnectModal.css'

export const SessionRequestModal = ({ 
  request, 
  accountAddress, 
  passkeyCredential,
  ownerSigner,
  twoFactorEnabled,
  onComplete 
}) => {
  const { respondSessionRequest } = useWalletConnect()
  const sdk = useP256SDK()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [decodedData, setDecodedData] = useState(null)

  useEffect(() => {
    if (request) {
      decodeRequestData()
    }
  }, [request])

  if (!request) return null

  const { topic, params, id } = request
  const { request: requestParams, chainId } = params
  const { method, params: methodParams } = requestParams

  const decodeRequestData = () => {
    try {
      switch (method) {
        case 'eth_sendTransaction':
        case 'eth_signTransaction':
          const tx = methodParams[0]
          setDecodedData({
            type: 'transaction',
            to: tx.to,
            value: tx.value ? ethers.formatEther(tx.value) : '0',
            data: tx.data || '0x',
            from: tx.from,
            gas: tx.gas,
            gasPrice: tx.gasPrice,
          })
          break

        case 'personal_sign':
          const message = methodParams[0]
          setDecodedData({
            type: 'message',
            message: ethers.toUtf8String(message),
            rawMessage: message,
          })
          break

        case 'eth_sign':
          setDecodedData({
            type: 'message',
            message: methodParams[1],
            rawMessage: methodParams[1],
          })
          break

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4':
          const typedData = typeof methodParams[1] === 'string' 
            ? JSON.parse(methodParams[1]) 
            : methodParams[1]
          setDecodedData({
            type: 'typedData',
            typedData,
          })
          break

        default:
          setDecodedData({
            type: 'unknown',
            method,
            params: methodParams,
          })
      }
    } catch (err) {
      console.error('Failed to decode request data:', err)
      setDecodedData({
        type: 'error',
        error: err.message,
      })
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    setError('')

    try {
      let result

      switch (method) {
        case 'eth_sendTransaction':
          result = await handleSendTransaction(methodParams[0])
          break

        case 'eth_signTransaction':
          result = await handleSignTransaction(methodParams[0])
          break

        case 'personal_sign':
          result = await handlePersonalSign(methodParams[0], methodParams[1])
          break

        case 'eth_sign':
          result = await handleEthSign(methodParams[0], methodParams[1])
          break

        case 'eth_signTypedData':
        case 'eth_signTypedData_v4':
          result = await handleSignTypedData(methodParams[0], methodParams[1])
          break

        default:
          throw new Error(`Unsupported method: ${method}`)
      }

      // Send success response
      await respondSessionRequest(topic, {
        id,
        jsonrpc: '2.0',
        result,
      })

      if (onComplete) onComplete()
    } catch (err) {
      console.error('Failed to process request:', err)
      setError(err.message || 'Failed to process request')
      
      // Send error response
      try {
        await respondSessionRequest(topic, {
          id,
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: err.message || 'Request failed',
          },
        })
      } catch (respondErr) {
        console.error('Failed to send error response:', respondErr)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    setError('')

    try {
      await respondSessionRequest(topic, {
        id,
        jsonrpc: '2.0',
        error: getSdkError('USER_REJECTED'),
      })

      if (onComplete) onComplete()
    } catch (err) {
      console.error('Failed to reject request:', err)
      setError(err.message || 'Failed to reject request')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTransaction = async (tx) => {
    console.log('📤 Sending transaction:', tx)

    // Build UserOperation
    const userOp = await sdk.buildUserOperation(
      accountAddress,
      tx.to,
      tx.value || '0',
      tx.data || '0x'
    )

    // Sign with passkey and owner (if 2FA enabled)
    const signedUserOp = await sdk.signUserOperation(
      userOp,
      passkeyCredential,
      twoFactorEnabled ? ownerSigner : null
    )

    // Send to bundler
    const userOpHash = await sdk.sendUserOperation(signedUserOp)
    console.log('✅ UserOperation sent:', userOpHash)

    // Wait for receipt
    const receipt = await sdk.waitForUserOperationReceipt(userOpHash)
    console.log('✅ Transaction confirmed:', receipt.transactionHash)

    return receipt.transactionHash
  }

  const handleSignTransaction = async (tx) => {
    console.log('✍️ Signing transaction:', tx)
    
    // For sign transaction, we just return the signature without sending
    // This is not commonly used with AA wallets
    throw new Error('eth_signTransaction is not supported for smart contract wallets')
  }

  const handlePersonalSign = async (message, address) => {
    console.log('✍️ Signing message:', message)
    
    // For now, we'll use the owner signer to sign messages
    // In a production implementation, you might want to use EIP-1271
    if (!ownerSigner) {
      throw new Error('Owner signer not available')
    }

    const signature = await ownerSigner.signMessage(ethers.getBytes(message))
    return signature
  }

  const handleEthSign = async (address, message) => {
    console.log('✍️ Signing message (eth_sign):', message)
    
    if (!ownerSigner) {
      throw new Error('Owner signer not available')
    }

    const signature = await ownerSigner.signMessage(ethers.getBytes(message))
    return signature
  }

  const handleSignTypedData = async (address, typedData) => {
    console.log('✍️ Signing typed data:', typedData)
    
    if (!ownerSigner) {
      throw new Error('Owner signer not available')
    }

    const data = typeof typedData === 'string' ? JSON.parse(typedData) : typedData
    const { domain, types, message: typedMessage } = data
    
    // Remove EIP712Domain from types if present
    const filteredTypes = { ...types }
    delete filteredTypes.EIP712Domain

    const signature = await ownerSigner.signTypedData(domain, filteredTypes, typedMessage)
    return signature
  }

  const getMethodName = () => {
    switch (method) {
      case 'eth_sendTransaction':
        return 'Send Transaction'
      case 'eth_signTransaction':
        return 'Sign Transaction'
      case 'personal_sign':
        return 'Sign Message'
      case 'eth_sign':
        return 'Sign Message'
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return 'Sign Typed Data'
      default:
        return method
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content session-request-modal">
        <div className="modal-header">
          <h2>📝 {getMethodName()}</h2>
        </div>

        <div className="modal-body">
          <div className="request-details">
            <div className="detail-section">
              <h4>Account</h4>
              <p className="account-address">{accountAddress}</p>
            </div>

            {decodedData?.type === 'transaction' && (
              <>
                <div className="detail-section">
                  <h4>To</h4>
                  <p className="address">{decodedData.to}</p>
                </div>

                <div className="detail-section">
                  <h4>Value</h4>
                  <p className="value">{decodedData.value} ETH</p>
                </div>

                {decodedData.data !== '0x' && (
                  <div className="detail-section">
                    <h4>Data</h4>
                    <pre className="data-preview">{decodedData.data}</pre>
                  </div>
                )}
              </>
            )}

            {decodedData?.type === 'message' && (
              <div className="detail-section">
                <h4>Message</h4>
                <pre className="message-preview">{decodedData.message}</pre>
              </div>
            )}

            {decodedData?.type === 'typedData' && (
              <div className="detail-section">
                <h4>Typed Data</h4>
                <pre className="data-preview">
                  {JSON.stringify(decodedData.typedData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="button-group">
            <button
              onClick={handleReject}
              disabled={loading}
              className="secondary-button"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="primary-button"
            >
              {loading ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

