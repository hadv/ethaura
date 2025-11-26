import { useState } from 'react'
import { ArrowDownUp, AlertCircle, Loader, ChevronLeft } from 'lucide-react'
import { ethers } from 'ethers'
import Header from '../components/Header'
import SubHeader from '../components/SubHeader'
import PriceImpactWarning from '../components/PriceImpactWarning'
import { useWeb3Auth } from '../contexts/Web3AuthContext'
import '../styles/SwapConfirmationScreen.css'

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
      <div className="swap-confirmation-content">
        <div className="swap-confirmation-main">
          {/* Swap Details Card */}
          <div className="swap-details-card">
            <h3 className="section-title">Swap Details</h3>

            {/* Token Swap Visual */}
            <div className="token-swap-visual">
              <div className="token-amount-display">
                <div className="token-label">You Pay</div>
                <div className="token-amount">
                  {parseFloat(amountIn).toFixed(6)} {tokenInSymbol}
                </div>
              </div>

              <div className="swap-arrow">
                <ArrowDownUp size={24} />
              </div>

              <div className="token-amount-display">
                <div className="token-label">You Receive (estimated)</div>
                <div className="token-amount">
                  ~{parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)).toFixed(6)} {tokenOutSymbol}
                </div>
              </div>
            </div>

            {/* Exchange Rate */}
            <div className="info-row">
              <span className="info-label">Exchange Rate:</span>
              <span className="info-value">
                1 {tokenInSymbol} ≈ {(parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)) / parseFloat(amountIn)).toFixed(6)} {tokenOutSymbol}
              </span>
            </div>
          </div>

          {/* Transaction Settings Card */}
          <div className="transaction-settings-card">
            <h3 className="section-title">Transaction Settings</h3>

            <div className="info-row">
              <span className="info-label">Slippage Tolerance:</span>
              <span className="info-value">{slippage}%</span>
            </div>

            <div className="info-row">
              <span className="info-label">Minimum Received:</span>
              <span className="info-value">
                {parseFloat(ethers.formatUnits(minimumReceived, tokenOutDecimals)).toFixed(6)} {tokenOutSymbol}
              </span>
            </div>

            {quote && quote.priceImpact !== undefined && (
              <div className="info-row">
                <span className="info-label">Price Impact:</span>
                <span className={`info-value price-impact-${quote.priceImpact > 5 ? 'high' : quote.priceImpact > 2 ? 'medium' : 'low'}`}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Network Fee Card */}
          {gasEstimate && (
            <div className="network-fee-card">
              <h3 className="section-title">Network Fee</h3>

              <div className="info-row">
                <span className="info-label">Estimated Gas:</span>
                <span className="info-value">
                  ~{gasEstimate.gasCostEth.toFixed(6)} ETH
                  {gasEstimate.gasCostUsd && ` ($${gasEstimate.gasCostUsd.toFixed(2)})`}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">Gas Price:</span>
                <span className="info-value">
                  {gasEstimate.gasPriceDisplay.value.toLocaleString()} {gasEstimate.gasPriceDisplay.unit}
                </span>
              </div>
            </div>
          )}

          {/* Price Impact Warning */}
          {quote && quote.priceImpact > 2 && (
            <PriceImpactWarning priceImpact={quote.priceImpact} />
          )}

          {/* Error Message */}
          {error && (
            <div className="swap-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Confirm Button */}
          <button
            className="confirm-swap-button"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming && <Loader className="button-loader" size={20} />}
            {confirming ? 'Confirming...' : 'Confirm Swap'}
          </button>

          {/* Back Link */}
          <button className="back-link" onClick={onBack} disabled={confirming}>
            <ChevronLeft size={16} />
            Back to Swap
          </button>
        </div>
      </div>
    </div>
  )
}

export default SwapConfirmationScreen
