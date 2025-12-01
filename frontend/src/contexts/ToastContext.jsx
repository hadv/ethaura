import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      ...toast,
      // Default durations: 5s for success, 10s for error
      duration: toast.duration || (toast.type === 'error' ? 10000 : 5000),
    }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message, options = {}) => {
    return addToast({
      type: 'success',
      message,
      ...options,
    })
  }, [addToast])

  const showError = useCallback((message, options = {}) => {
    return addToast({
      type: 'error',
      message,
      ...options,
    })
  }, [addToast])

  const showSwapSuccess = useCallback((swapDetails, txHash, explorerUrl) => {
    const { tokenIn, tokenOut, amountIn, amountOutFormatted } = swapDetails
    const tokenInSymbol = tokenIn === 'ETH' ? 'ETH' : tokenIn.symbol
    const tokenOutSymbol = tokenOut === 'ETH' ? 'ETH' : tokenOut.symbol

    return addToast({
      type: 'success',
      title: 'Swap Successful!',
      message: `Swapped ${parseFloat(amountIn).toLocaleString()} ${tokenInSymbol} for ${parseFloat(amountOutFormatted).toLocaleString()} ${tokenOutSymbol}`,
      txHash,
      explorerUrl,
      duration: 5000,
    })
  }, [addToast])

  const showSwapError = useCallback((error) => {
    // Parse common swap errors for user-friendly messages
    let message = error?.message || 'Swap failed. Please try again.'

    if (message.includes('slippage') || message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
      message = 'Price moved too much. Try increasing slippage.'
    } else if (message.includes('insufficient funds') || message.includes('INSUFFICIENT_BALANCE')) {
      message = 'Insufficient balance for this swap.'
    } else if (message.includes('user rejected') || message.includes('User denied')) {
      message = 'Transaction was cancelled.'
    } else if (message.includes('gas')) {
      message = 'Insufficient ETH for gas fees.'
    }

    return addToast({
      type: 'error',
      title: 'Swap Failed',
      message,
      duration: 10000,
    })
  }, [addToast])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showSwapSuccess,
        showSwapError,
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

