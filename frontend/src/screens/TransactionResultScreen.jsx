import { useState, useEffect, useMemo } from 'react'
import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import { useNetwork } from '../contexts/NetworkContext'
import { walletDataCache } from '../lib/walletDataCache'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import { ethers } from 'ethers'
import '../styles/TransactionResultScreen.css'

function TransactionResultScreen({
  wallet,
  transactionData,
  onBack,
  onHome,
  onSettings,
  onLogout,
  onWalletChange,
  wallets = []
}) {
  const { userInfo } = useWeb3Auth()
  const { networkInfo } = useNetwork()
  const provider = useMemo(() => new ethers.JsonRpcProvider(networkInfo.rpcUrl), [networkInfo.rpcUrl])
  const [status, setStatus] = useState('pending') // 'pending', 'confirmed', 'failed'
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [confirmations, setConfirmations] = useState(0)
  const [cacheUpdated, setCacheUpdated] = useState(false)

  // Poll for transaction confirmation
  useEffect(() => {
    if (!transactionData?.hash || !provider) return

    let isCancelled = false
    let pollInterval = null

    const checkTransactionStatus = async () => {
      try {
        console.log('🔍 Checking transaction status:', transactionData.hash)

        // Get transaction receipt
        const txReceipt = await provider.getTransactionReceipt(transactionData.hash)

        if (isCancelled) return

        if (txReceipt) {
          console.log('✅ Transaction confirmed:', txReceipt)

          // Check if transaction was successful
          if (txReceipt.status === 1) {
            setStatus('confirmed')
            setReceipt(txReceipt)

            // Get current block to calculate confirmations
            const currentBlock = await provider.getBlockNumber()
            const confs = currentBlock - txReceipt.blockNumber + 1
            setConfirmations(confs)

            // Add confirmed transaction to cache
            if (!cacheUpdated && wallet?.address) {
              const confirmedTransaction = {
                ...transactionData,
                status: 'confirmed',
                blockNumber: txReceipt.blockNumber,
                gasUsed: txReceipt.gasUsed?.toString(),
                gasPrice: txReceipt.gasPrice?.toString(),
              }
              await walletDataCache.addTransactionToCache(wallet.address, networkInfo.name, confirmedTransaction)
              setCacheUpdated(true)
              console.log('✅ Transaction added to cache')
            }

            // Stop polling
            if (pollInterval) {
              clearInterval(pollInterval)
            }
          } else {
            setStatus('failed')
            setError('Transaction failed on-chain')
            if (pollInterval) {
              clearInterval(pollInterval)
            }
          }
        } else {
          console.log('⏳ Transaction still pending...')
        }
      } catch (err) {
        console.error('Error checking transaction status:', err)
        if (!isCancelled) {
          setError('Failed to check transaction status')
        }
      }
    }

    // Initial check
    checkTransactionStatus()

    // Poll every 2 seconds
    pollInterval = setInterval(checkTransactionStatus, 2000)

    // Cleanup
    return () => {
      isCancelled = true
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [transactionData?.hash, provider, wallet?.address, networkInfo.name, cacheUpdated, transactionData])

  // Update confirmations count periodically
  useEffect(() => {
    if (status !== 'confirmed' || !receipt || !provider) return

    let isCancelled = false
    const interval = setInterval(async () => {
      try {
        const currentBlock = await provider.getBlockNumber()
        const confs = currentBlock - receipt.blockNumber + 1
        if (!isCancelled) {
          setConfirmations(confs)
        }
      } catch (err) {
        console.error('Error updating confirmations:', err)
      }
    }, 5000) // Update every 5 seconds

    return () => {
      isCancelled = true
      clearInterval(interval)
    }
  }, [status, receipt, provider])

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock size={48} style={{ color: '#f59e0b' }} />
      case 'confirmed':
        return <CheckCircle size={48} style={{ color: '#10b981' }} />
      case 'failed':
        return <XCircle size={48} style={{ color: '#ef4444' }} />
      default:
        return <Clock size={48} style={{ color: '#f59e0b' }} />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Transaction Pending'
      case 'confirmed':
        return 'Transaction Confirmed'
      case 'failed':
        return 'Transaction Failed'
      default:
        return 'Processing...'
    }
  }

  const getStatusDescription = () => {
    switch (status) {
      case 'pending':
        return 'Your transaction has been broadcast to the network and is waiting to be confirmed...'
      case 'confirmed':
        return `Your transaction has been confirmed with ${confirmations} confirmation${confirmations !== 1 ? 's' : ''}.`
      case 'failed':
        return 'Your transaction was included in a block but failed during execution.'
      default:
        return ''
    }
  }

  const explorerUrl = `${networkInfo.explorerUrl}/tx/${transactionData?.hash}`

  return (
    <div className="transaction-result-screen">
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />
      
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        showWalletDropdown={true}
        wallets={wallets}
        onWalletChange={onWalletChange}
      />

      {/* Main Content - Two Column Layout */}
      <div className="result-content-wrapper">
        {/* Left Panel - Main Content */}
        <div className="result-main">
          <div className="result-container">
          {/* Status Icon */}
          <div className={`status-icon ${status}`}>
            {status === 'pending' && <div className="spinner-large"></div>}
            {status !== 'pending' && <span className="status-emoji">{getStatusIcon()}</span>}
          </div>

          {/* Status Text */}
          <h1 className="status-title">{getStatusText()}</h1>
          <p className="status-description">{getStatusDescription()}</p>

          {/* Error Message */}
          {error && (
            <div className="error-box">
              <p>{error}</p>
            </div>
          )}

          {/* Transaction Details */}
          <div className="transaction-details">
            <h3 className="details-title">Transaction Details</h3>

              <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className={`detail-value status-badge ${status}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {status === 'pending' && (
                  <>
                    <Clock size={16} style={{ color: '#f59e0b' }} />
                    Pending
                  </>
                )}
                {status === 'confirmed' && (
                  <>
                    <CheckCircle size={16} style={{ color: '#10b981' }} />
                    Confirmed
                  </>
                )}
                {status === 'failed' && (
                  <>
                    <XCircle size={16} style={{ color: '#ef4444' }} />
                    Failed
                  </>
                )}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Amount</span>
              <span className="detail-value">
                {transactionData?.amount} {transactionData?.tokenSymbol || 'ETH'}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">From</span>
              <span className="detail-value address">{transactionData?.from}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">To</span>
              <span className="detail-value address">{transactionData?.to}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Transaction Hash</span>
              <div className="hash-with-link">
                <span className="detail-value hash">{transactionData?.hash}</span>
                <button
                  className="explorer-link-btn"
                  onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}
                  title="View on Explorer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              {status === 'confirmed' && (
                <button className="done-button" onClick={onHome}>
                  Done
                </button>
              )}

              {status === 'failed' && (
                <button className="retry-button" onClick={onBack}>
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Extra Information */}
        <div className="result-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">Network</h3>
            <div className="sidebar-content">
              <div className="info-row">
                <span className="info-label">Network</span>
                <span className="info-value">{networkInfo.name}</span>
              </div>
              {receipt && (
                <>
                  <div className="info-row">
                    <span className="info-label">Block Number</span>
                    <span className="info-value">{receipt.blockNumber}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Gas Used</span>
                    <span className="info-value">
                      {receipt.gasUsed ? receipt.gasUsed.toString() : 'N/A'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Confirmations</span>
                    <span className="info-value">{confirmations}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TransactionResultScreen

