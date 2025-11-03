import { useState } from 'react'
import { ethers } from 'ethers'
import Header from '../components/Header'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import NetworkSelector from '../components/NetworkSelector'
import { Identicon } from '../utils/identicon.jsx'
import { decodeCallData } from '../utils/callDataDecoder'
import '../styles/SignatureConfirmationScreen.css'

function SignatureConfirmationScreen({
  signatureData,
  wallet,
  onConfirm,
  onCancel,
  onLogout,
  onHome
}) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error('Signature confirmation error:', error)
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
    isTwoFactorAuth,
    signatureStep,
    operationType,
    operationDetails,
    token,
    userOp,
  } = signatureData || {}

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getExplorerUrl = (address) => {
    const baseUrl = networkInfo.blockExplorer || 'https://sepolia.etherscan.io'
    return `${baseUrl}/address/${address}`
  }

  const openExplorer = (address) => {
    window.open(getExplorerUrl(address), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="signature-confirmation-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader */}
      <div className="signature-sub-header">
        <div className="signature-sub-header-left">
          <button className="back-btn" onClick={onCancel} disabled={isLoading}>
            <span>←</span>
          </button>

          {/* Account Display */}
          {wallet && (
            <div className="wallet-selector">
              <Identicon address={wallet.address} size={32} className="wallet-icon-small" />
              <div className="wallet-info-compact">
                <div className="wallet-name-header">{wallet.name}</div>
                <div className="wallet-address-header">{formatAddress(wallet.address)}</div>
              </div>
            </div>
          )}

          <NetworkSelector />
        </div>
      </div>

      {/* Main Content */}
      <div className="signature-content-wrapper">
        <div className="signature-main">
          <div className="signature-container">
            {/* Transaction Details Card */}
            <div className="signature-details-card">
              <h3 className="signature-card-title">Transaction Details</h3>

              {/* Deployment Badge */}
              {isDeployment && (
                <div className="signature-deployment-badge">
                  <span className="badge-icon">✨</span>
                  <div className="badge-content">
                    <p className="badge-title">Account Deployment</p>
                    <p className="badge-description">This transaction will deploy your smart account</p>
                  </div>
                </div>
              )}

              {/* Operation Type Badge */}
              {operationType && (
                <div className="signature-operation-badge">
                  <span className="badge-icon">🔒</span>
                  <div className="badge-content">
                    <p className="badge-title">{operationType}</p>
                  </div>
                </div>
              )}

              {/* Operation Details */}
              {operationDetails && (
                <div className="signature-detail-item">
                  <label className="detail-label">Operation</label>
                  <div className="detail-value-box">
                    {operationDetails}
                  </div>
                </div>
              )}

              {/* To Address */}
              <div className="signature-detail-item">
                <label className="detail-label">
                  {token ? 'Recipient Address' : 'To Address'}
                </label>
                <div className="detail-address-with-icon">
                  <div className="detail-address">
                    {targetAddress}
                  </div>
                  <button
                    className="explorer-icon-btn"
                    onClick={() => openExplorer(targetAddress)}
                    title="View on Explorer"
                    type="button"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10 2H14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6.66667 9.33333L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Amount - Highlighted */}
              {amount !== undefined && (
                <div className="signature-amount-section">
                  <label className="detail-label">Amount</label>
                  <div className="amount-display">
                    {token
                      ? amount ? ethers.formatUnits(amount, token.decimalsFromChain || token.decimals) : '0'
                      : `${amount ? ethers.formatEther(amount) : '0'} ETH`
                    }
                  </div>
                  {token && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#6b7280' }}>
                        {token.icon && (
                          <img
                            src={token.icon}
                            alt={token.symbol}
                            style={{ width: '18px', height: '18px', borderRadius: '50%' }}
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
                          gap: '6px',
                          padding: '4px 8px',
                          background: '#f3f4f6',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          color: '#6b7280',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e5e7eb'
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                        }}
                        title="Click to view on block explorer"
                      >
                        <span>{token.address}</span>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333M10 2H14M14 2V6M14 2L6.66667 9.33333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nonce */}
              <div className="signature-detail-item">
                <label className="detail-label">Nonce</label>
                <div className="detail-value">
                  {nonce?.toString() || '0'}
                </div>
              </div>

              {/* Operation Type - Decoded from CallData */}
              {userOp && (() => {
                const decoded = decodeCallData(userOp.callData)
                if (decoded && decoded.innerCall) {
                  return (
                    <div className="signature-detail-item">
                      <label className="detail-label">Operation Type</label>
                      <div className="operation-type-value">
                        {decoded.innerCall.type}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Raw CallData */}
              {userOp && (
                <div className="signature-detail-item">
                  <label className="detail-label">Raw CallData</label>
                  <div className="detail-hash">
                    {userOp.callData}
                  </div>
                  <p className="detail-hint">
                    The encoded function call data for this operation
                  </p>
                </div>
              )}

              {/* UserOperation Hash */}
              <div className="signature-detail-item">
                <label className="detail-label">UserOperation Hash</label>
                <div className="detail-hash">
                  {userOpHash}
                </div>
                <p className="detail-hint">
                  This is the hash of the transaction data that will be signed
                </p>
              </div>
            </div>

            {/* Warning Box */}
            <div className="signature-warning-card">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <p className="warning-title">Important</p>
                <p className="warning-text">
                  By signing this transaction, you authorize the transfer of funds from your account. 
                  Make sure you trust the recipient address and the amount is correct.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="signature-actions">
              <button
                className="signature-btn signature-btn-cancel"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="signature-btn signature-btn-confirm"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Signing...</span>
                  </>
                ) : (
                  <span>Confirm & Sign</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="signature-sidebar">
          {/* Signature Info Card */}
          <div className="signature-info-card">
            <div className="signature-icon-large">🔐</div>
            <h3 className="signature-info-title">Signature Required</h3>
            {isTwoFactorAuth && (
              <span className="signature-step-badge-large">
                Step {signatureStep}
              </span>
            )}
            <p className="signature-info-description">
              {isTwoFactorAuth
                ? 'Step 1/2: Your social login account needs to sign this transaction. After this, you\'ll be prompted to confirm with your passkey (biometric).'
                : 'Your social login account needs to sign this transaction. Please review the details on the left.'}
            </p>
          </div>

          {/* Security Tips Card */}
          <div className="signature-tips-card">
            <h4 className="tips-title">Security Tips</h4>
            <ul className="tips-list">
              <li>Always verify the recipient address</li>
              {token && <li>Verify the token contract address on block explorer</li>}
              <li>Double-check the amount before signing</li>
              <li>Never sign transactions you don't understand</li>
              <li>Keep your passkey secure</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignatureConfirmationScreen

