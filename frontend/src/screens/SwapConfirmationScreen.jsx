import { useState } from 'react'
import { ArrowDownUp, AlertCircle, Loader, ChevronLeft } from 'lucide-react'
import { ethers } from 'ethers'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import PriceImpactWarning from '../components/PriceImpactWarning'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import ethIcon from '../assets/tokens/eth.svg'
import '../styles/SwapConfirmationScreen.css'
import '../styles/SendTransactionScreen.css'

function SwapConfirmationScreen({
  wallet,
  swapDetails,
  onBack,
  onConfirm,
  onHome,
  onSettings,
  onLogout,
}) {
  const { userInfo } = useWeb3Auth()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  if (!swapDetails) {
    return (
      <div className="swap-confirmation-screen">
        <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />
        <div className="error-state">
          <p>No swap details available</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    )
  }

  const {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    quote,
    slippage,
    gasEstimate,
    minimumReceived,
  } = swapDetails

  const tokenInSymbol = tokenIn === 'ETH' ? 'ETH' : tokenIn.symbol
  const tokenOutSymbol = tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol
  const tokenOutDecimals = tokenOut === 'ETH' ? 18 : tokenOut.decimals
  const tokenInIcon = tokenIn === 'ETH' ? ethIcon : tokenIn.icon
  const tokenOutIcon = tokenOut === 'ETH' ? ethIcon : tokenOut.icon

  const handleConfirm = async () => {
    setConfirming(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      console.error('Swap confirmation error:', err)
      setError(err.message || 'Failed to execute swap')
      setConfirming(false)
    }
  }

  return (
    <div className="swap-confirmation-screen">
      {/* Header */}
      <Header userInfo={userInfo} onLogout={onLogout} onHome={onHome} />

      {/* SubHeader */}
      <SubHeader
        wallet={wallet}
        onBack={onBack}
        showBackButton={true}
        onSettings={onSettings}
        title="Confirm Swap"
        subtitle="Review your swap details"
      />

      {/* Main Content */}
      <div className="send-content-wrapper">
        <div className="send-main">
          {/* Swap Confirmation Card */}
          <div className="send-form-card">
            {/* Title */}
            <h2 className="confirm-title">Review Your Swap</h2>

            {/* Token Swap Visual */}
            <div className="confirm-swap-visual">
              <div className="confirm-token-box">
                <div className="confirm-token-icon">
                  <img src={tokenInIcon} alt={tokenInSymbol} />
                </div>
                <span className="confirm-token-label">You Pay</span>
                <span className="confirm-token-amount">{parseFloat(amountIn).toFixed(6)}</span>
                <span className="confirm-token-symbol">{tokenInSymbol}</span>
              </div>

              <div className="confirm-arrow">
                <ArrowDownUp size={20} />
              </div>

              <div className="confirm-token-box">
                <div className="confirm-token-icon">
                  <img src={tokenOutIcon} alt={tokenOutSymbol} />
                </div>
                <span className="confirm-token-label">You Receive (estimated)</span>
                <span className="confirm-token-amount">~{parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)).toFixed(6)}</span>
                <span className="confirm-token-symbol">{tokenOutSymbol}</span>
              </div>
            </div>

            {/* Exchange Rate Info */}
            <div className="confirm-rate-info">
              <div className="confirm-rate-label">Exchange Rate</div>
              <div className="confirm-rate-value">
                1 {tokenInSymbol} = {(parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)) / parseFloat(amountIn)).toFixed(6)} {tokenOutSymbol}
              </div>
            </div>

            {/* Key Details */}
            <div className="confirm-key-details">
              <div className="confirm-detail-item">
                <span className="confirm-detail-label">Minimum Received</span>
                <span className="confirm-detail-value">
                  {parseFloat(ethers.formatUnits(minimumReceived, tokenOutDecimals)).toFixed(6)} {tokenOutSymbol}
                </span>
              </div>

              {quote && quote.priceImpact !== undefined && (
                <div className="confirm-detail-item">
                  <span className="confirm-detail-label">Price Impact</span>
                  <span className={`confirm-detail-value ${
                    quote.priceImpact < 2 ? 'impact-low' :
                    quote.priceImpact < 5 ? 'impact-medium' : 'impact-high'
                  }`}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}

              {gasEstimate && (
                <div className="confirm-detail-item">
                  <span className="confirm-detail-label">Network Fee</span>
                  <span className="confirm-detail-value">
                    {gasEstimate.gasCostEth < 0.0001
                      ? gasEstimate.gasCostEth.toFixed(8)
                      : gasEstimate.gasCostEth.toFixed(6)} ETH
                    {gasEstimate.gasCostUsd && (
                      <span className="confirm-detail-usd"> (${gasEstimate.gasCostUsd.toFixed(2)})</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Price Impact Warning */}
            {quote && quote.priceImpact > 2 && (
              <PriceImpactWarning priceImpact={quote.priceImpact} />
            )}

            {/* Error Message */}
            {error && (
              <div className="confirm-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="confirm-actions">
              <button
                className="confirm-btn-primary"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming && <Loader className="button-loader" size={20} />}
                {confirming ? 'Confirming...' : 'Confirm Swap'}
              </button>

              <button className="confirm-btn-secondary" onClick={onBack} disabled={confirming}>
                <ChevronLeft size={16} />
                Back to Swap
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Transaction Details */}
        <div className="send-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Transaction Details</h3>
            <div className="sidebar-content">
              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Exchange Rate</span>
                <span className="sidebar-info-value">
                  1 {tokenInSymbol} = {(parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)) / parseFloat(amountIn)).toFixed(6)} {tokenOutSymbol}
                </span>
              </div>

              {quote && quote.priceImpact !== undefined && (
                <div className="sidebar-info-item">
                  <span className="sidebar-info-label">Price Impact</span>
                  <span className={`sidebar-info-value ${
                    quote.priceImpact < 2 ? 'impact-low' :
                    quote.priceImpact < 5 ? 'impact-medium' : 'impact-high'
                  }`}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}

              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Slippage Tolerance</span>
                <span className="sidebar-info-value">{slippage}%</span>
              </div>

              <div className="sidebar-info-item">
                <span className="sidebar-info-label">Minimum Received</span>
                <span className="sidebar-info-value">
                  {parseFloat(ethers.formatUnits(minimumReceived, tokenOutDecimals)).toFixed(6)} {tokenOutSymbol}
                </span>
              </div>

              {gasEstimate && (
                <div className="sidebar-info-item">
                  <span className="sidebar-info-label">Network Fee</span>
                  <span className="sidebar-info-value">
                    {gasEstimate.gasCostEth < 0.0001
                      ? gasEstimate.gasCostEth.toFixed(8)
                      : gasEstimate.gasCostEth.toFixed(6)} ETH
                    {gasEstimate.gasCostUsd && (
                      <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '2px' }}>
                        ${gasEstimate.gasCostUsd.toFixed(2)}
                      </div>
                    )}
                  </span>
                </div>
              )}

              {gasEstimate && gasEstimate.gasPriceDisplay && (
                <div className="sidebar-info-item">
                  <span className="sidebar-info-label">Gas Price</span>
                  <span className="sidebar-info-value">
                    {gasEstimate.gasPriceDisplay.value.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: gasEstimate.gasPriceDisplay.unit === 'Gwei' ? 2 : 0
                    })} {gasEstimate.gasPriceDisplay.unit}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SwapConfirmationScreen
