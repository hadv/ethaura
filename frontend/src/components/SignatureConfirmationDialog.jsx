import { useState } from 'react'
import { ethers } from 'ethers'

/**
 * SignatureConfirmationDialog - Shows users what they're signing before requesting signature
 * This replaces silent signing with transparent user consent
 */
function SignatureConfirmationDialog({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  signatureData 
}) {
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
    }
  }

  const {
    userOpHash,
    targetAddress,
    amount,
    accountAddress,
    nonce,
    isDeployment,
  } = signatureData || {}

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      }}>
        <h2 style={{ marginTop: 0, color: '#fff', fontSize: '1.5rem' }}>
          🔐 Signature Required
        </h2>
        
        <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Your social login account needs to sign this transaction. Please review the details below:
        </p>

        <div className="signature-details" style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.1rem', marginBottom: '1rem' }}>
            Transaction Details
          </h3>

          {isDeployment && (
            <div className="detail-row" style={{ marginBottom: '1rem' }}>
              <div style={{ 
                backgroundColor: '#1a3a1a', 
                border: '1px solid #2a5a2a',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#4ade80',
                fontSize: '0.9rem',
                fontWeight: 'bold',
              }}>
                ✨ This transaction will deploy your account
              </div>
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              From Account:
            </strong>
            <div className="code-block" style={{ 
              fontSize: '0.8rem', 
              padding: '0.5rem',
              backgroundColor: '#000',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {accountAddress}
            </div>
          </div>

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              To Address:
            </strong>
            <div className="code-block" style={{ 
              fontSize: '0.8rem', 
              padding: '0.5rem',
              backgroundColor: '#000',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {targetAddress}
            </div>
          </div>

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              Amount:
            </strong>
            <div style={{ 
              fontSize: '1.2rem', 
              color: '#4ade80',
              fontWeight: 'bold',
            }}>
              {amount ? ethers.formatEther(amount) : '0'} ETH
            </div>
          </div>

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              Nonce:
            </strong>
            <div style={{ color: '#fff', fontSize: '0.9rem' }}>
              {nonce?.toString() || '0'}
            </div>
          </div>

          <div className="detail-row">
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              UserOperation Hash:
            </strong>
            <div className="code-block" style={{ 
              fontSize: '0.75rem', 
              padding: '0.5rem',
              backgroundColor: '#000',
              borderRadius: '4px',
              wordBreak: 'break-all',
            }}>
              {userOpHash}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
              This is the hash of the transaction data that will be signed
            </p>
          </div>
        </div>

        <div className="warning-box" style={{
          backgroundColor: '#3a2a1a',
          border: '1px solid #5a4a2a',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#fbbf24' }}>
            ⚠️ <strong>Important:</strong> By signing this transaction, you authorize the transfer of funds from your account. 
            Make sure you trust the recipient address and the amount is correct.
          </p>
        </div>

        <div className="button-group" style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
        }}>
          <button
            className="button button-secondary"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#333',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            ❌ Cancel
          </button>
          <button
            className="button button-primary"
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#4ade80',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? '⏳ Signing...' : '✅ Confirm & Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignatureConfirmationDialog

