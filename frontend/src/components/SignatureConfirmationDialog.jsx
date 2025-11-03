import { useState } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { decodeCallData } from '../utils/callDataDecoder'

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
  const { networkInfo } = useNetwork()

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
    }
  }

  const getExplorerUrl = (address) => {
    const baseUrl = networkInfo.blockExplorer || 'https://sepolia.etherscan.io'
    return `${baseUrl}/address/${address}`
  }

  const openExplorer = (address) => {
    window.open(getExplorerUrl(address), '_blank', 'noopener,noreferrer')
  }

  const {
    userOpHash,
    targetAddress,
    amount,
    accountAddress,
    nonce,
    isDeployment,
    isTwoFactorAuth,
    signatureStep,
    operationType,
    operationDetails,
    token, // Token info for ERC-20 transfers
    userOp,
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
          🔐 Signature Required {isTwoFactorAuth && `(Step ${signatureStep})`}
        </h2>

        <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          {isTwoFactorAuth
            ? '🔑 Step 1/2: Your social login account needs to sign this transaction. After this, you\'ll be prompted to confirm with your passkey (biometric).'
            : 'Your social login account needs to sign this transaction. Please review the details below:'}
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

          {operationType && (
            <div className="detail-row" style={{ marginBottom: '1rem' }}>
              <div style={{
                backgroundColor: '#3a1a1a',
                border: '1px solid #5a2a2a',
                borderRadius: '6px',
                padding: '0.75rem',
                color: '#f87171',
                fontSize: '0.9rem',
                fontWeight: 'bold',
              }}>
                🔒 {operationType}
              </div>
            </div>
          )}

          {operationDetails && (
            <div className="detail-row" style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                Operation:
              </strong>
              <div style={{
                fontSize: '0.9rem',
                color: '#fff',
                padding: '0.5rem',
                backgroundColor: '#000',
                borderRadius: '4px',
              }}>
                {operationDetails}
              </div>
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              {token ? 'Recipient Address:' : 'To Address:'}
            </strong>
            <div style={{ position: 'relative' }}>
              <div className="code-block" style={{
                fontSize: '0.8rem',
                padding: '0.5rem',
                paddingRight: '2.5rem',
                backgroundColor: '#000',
                borderRadius: '4px',
                wordBreak: 'break-all',
              }}>
                {targetAddress}
              </div>
              <button
                onClick={() => openExplorer(targetAddress)}
                title="View on Explorer"
                type="button"
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '0.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2a2a2a'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a'
                  e.currentTarget.style.color = '#888'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333M10 2H14M14 2V6M14 2L6.66667 9.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          {amount !== undefined && (
            <div className="detail-row" style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                Amount:
              </strong>
              <div style={{
                fontSize: '1.2rem',
                color: '#4ade80',
                fontWeight: 'bold',
              }}>
                {token
                  ? amount ? ethers.formatUnits(amount, token.decimalsFromChain || token.decimals) : '0'
                  : `${amount ? ethers.formatEther(amount) : '0'} ETH`
                }
              </div>
              {token && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#aaa' }}>
                    {token.icon && (
                      <img
                        src={token.icon}
                        alt={token.symbol}
                        style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                      />
                    )}
                    <span>{token.name} ({token.symbol})</span>
                  </div>

                  {/* Token Contract Address - Creative Badge Style */}
                  <div
                    onClick={() => openExplorer(token.address)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.3rem 0.5rem',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      color: '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2a2a2a'
                      e.currentTarget.style.borderColor = '#444'
                      e.currentTarget.style.color = '#aaa'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#1a1a1a'
                      e.currentTarget.style.borderColor = '#333'
                      e.currentTarget.style.color = '#888'
                    }}
                    title="Click to view on block explorer"
                  >
                    <span>{token.address}</span>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333M10 2H14M14 2V6M14 2L6.66667 9.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: '1rem' }}>
            <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
              Nonce:
            </strong>
            <div style={{ color: '#fff', fontSize: '0.9rem' }}>
              {nonce?.toString() || '0'}
            </div>
          </div>

          {/* Operation Type - Decoded from CallData */}
          {userOp && (() => {
            const decoded = decodeCallData(userOp.callData)
            if (decoded && decoded.innerCall) {
              return (
                <div className="detail-row" style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                    Operation Type:
                  </strong>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#10b981',
                    background: '#064e3b',
                    border: '1px solid #065f46',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'inline-block'
                  }}>
                    {decoded.innerCall.type}
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Raw CallData */}
          {userOp && (
            <div className="detail-row" style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                Raw CallData:
              </strong>
              <div className="code-block" style={{
                fontSize: '0.75rem',
                padding: '0.5rem',
                backgroundColor: '#000',
                borderRadius: '4px',
                wordBreak: 'break-all',
              }}>
                {userOp.callData}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
                The encoded function call data for this operation
              </p>
            </div>
          )}

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

