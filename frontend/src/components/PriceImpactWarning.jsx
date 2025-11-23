import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import '../styles/PriceImpactWarning.css'

/**
 * Get price impact severity level and styling
 * @param {number} priceImpact - Price impact percentage
 * @returns {Object} Severity info with level, color, icon, and message
 */
export const getPriceImpactSeverity = (priceImpact) => {
  if (priceImpact < 1) {
    return {
      level: 'low',
      color: '#10b981', // green
      bgColor: '#d1fae5',
      borderColor: '#6ee7b7',
      icon: Info,
      label: 'Low Impact',
      message: null,
    }
  } else if (priceImpact < 5) {
    return {
      level: 'medium',
      color: '#f59e0b', // yellow/amber
      bgColor: '#fef3c7',
      borderColor: '#fde68a',
      icon: AlertCircle,
      label: 'Moderate Impact',
      message: 'This swap may move the market price slightly.',
    }
  } else if (priceImpact < 15) {
    return {
      level: 'high',
      color: '#f97316', // orange
      bgColor: '#ffedd5',
      borderColor: '#fed7aa',
      icon: AlertTriangle,
      label: 'High Impact',
      message: 'This swap will significantly move the market price. You may receive much less than expected.',
    }
  } else {
    return {
      level: 'extreme',
      color: '#dc2626', // red
      bgColor: '#fee2e2',
      borderColor: '#fecaca',
      icon: AlertTriangle,
      label: 'Extreme Impact',
      message: 'This swap will drastically move the market price. Transaction blocked for your protection.',
    }
  }
}

function PriceImpactWarning({ priceImpact, className = '', compact = false }) {
  if (priceImpact === undefined || priceImpact === null) {
    return null
  }

  const severity = getPriceImpactSeverity(priceImpact)
  const Icon = severity.icon

  if (compact) {
    // Compact mode: just show colored percentage
    return (
      <span
        className={`price-impact-compact ${className}`}
        style={{ color: severity.color }}
        title={severity.message || severity.label}
      >
        {priceImpact.toFixed(2)}%
      </span>
    )
  }

  // Full warning mode: show banner with icon and message
  if (severity.level === 'low') {
    // Don't show warning for low impact
    return null
  }

  return (
    <div
      className={`price-impact-warning ${severity.level} ${className}`}
      style={{
        backgroundColor: severity.bgColor,
        borderColor: severity.borderColor,
        color: severity.color,
      }}
    >
      <div className="price-impact-header">
        <Icon size={18} className="price-impact-icon" />
        <span className="price-impact-label">
          {severity.label} ({priceImpact.toFixed(2)}%)
        </span>
      </div>
      {severity.message && (
        <p className="price-impact-message">{severity.message}</p>
      )}
    </div>
  )
}

export default PriceImpactWarning

