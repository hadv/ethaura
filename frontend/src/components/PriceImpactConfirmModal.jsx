import { AlertTriangle, X } from 'lucide-react'
import { getPriceImpactSeverity } from './PriceImpactWarning'
import '../styles/PriceImpactConfirmModal.css'

function PriceImpactConfirmModal({ 
  priceImpact, 
  tokenIn, 
  tokenOut, 
  amountIn, 
  amountOut,
  onConfirm, 
  onCancel 
}) {
  const severity = getPriceImpactSeverity(priceImpact)
  const Icon = severity.icon

  return (
    <div className="price-impact-modal-backdrop" onClick={onCancel}>
      <div className="price-impact-modal" onClick={(e) => e.stopPropagation()}>
        <div className="price-impact-modal-header">
          <div className="price-impact-modal-title-row">
            <div 
              className="price-impact-modal-icon"
              style={{ backgroundColor: severity.bgColor, color: severity.color }}
            >
              <Icon size={24} />
            </div>
            <h3 className="price-impact-modal-title">High Price Impact Warning</h3>
          </div>
          <button className="price-impact-modal-close" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="price-impact-modal-content">
          <div 
            className="price-impact-modal-alert"
            style={{
              backgroundColor: severity.bgColor,
              borderColor: severity.borderColor,
              color: severity.color,
            }}
          >
            <AlertTriangle size={20} />
            <div>
              <div className="price-impact-modal-alert-title">
                Price Impact: {priceImpact.toFixed(2)}%
              </div>
              <div className="price-impact-modal-alert-message">
                {severity.message}
              </div>
            </div>
          </div>

          <div className="price-impact-modal-details">
            <h4>Swap Details</h4>
            <div className="price-impact-modal-detail-row">
              <span className="label">You're swapping:</span>
              <span className="value">{amountIn} {tokenIn}</span>
            </div>
            <div className="price-impact-modal-detail-row">
              <span className="label">You'll receive:</span>
              <span className="value">{amountOut} {tokenOut}</span>
            </div>
            <div className="price-impact-modal-detail-row">
              <span className="label">Price impact:</span>
              <span className="value" style={{ color: severity.color, fontWeight: 600 }}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="price-impact-modal-warning-text">
            <p>
              <strong>What does this mean?</strong>
            </p>
            <p>
              Your transaction will move the market price by {priceImpact.toFixed(2)}%. 
              This means you may receive significantly less than the current market rate.
            </p>
            <p>
              Consider splitting your trade into smaller amounts or waiting for better liquidity.
            </p>
          </div>
        </div>

        <div className="price-impact-modal-actions">
          <button className="price-impact-modal-btn cancel" onClick={onCancel}>
            Cancel Swap
          </button>
          <button 
            className="price-impact-modal-btn confirm"
            style={{ 
              backgroundColor: severity.color,
              borderColor: severity.color,
            }}
            onClick={onConfirm}
          >
            I Understand, Swap Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

export default PriceImpactConfirmModal

