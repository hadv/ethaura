import { CheckCircle, XCircle, X, ExternalLink } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import '../styles/Toast.css'

function Toast({ toast }) {
  const { removeToast } = useToast()
  const { id, type, title, message, txHash, explorerUrl } = toast

  const Icon = type === 'success' ? CheckCircle : XCircle

  const handleExplorerClick = () => {
    if (explorerUrl && txHash) {
      window.open(`${explorerUrl}/tx/${txHash}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">
        <Icon size={24} />
      </div>
      <div className="toast-content">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{message}</div>
        {txHash && explorerUrl && (
          <button className="toast-explorer-link" onClick={handleExplorerClick} title="View on Explorer">
            <ExternalLink size={16} />
          </button>
        )}
      </div>
      <button className="toast-close" onClick={() => removeToast(id)}>
        <X size={18} />
      </button>
    </div>
  )
}

function ToastContainer() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export default ToastContainer

