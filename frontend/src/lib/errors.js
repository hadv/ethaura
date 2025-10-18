/**
 * Custom error classes for P256Account SDK
 */

/**
 * Base error class for SDK errors
 */
export class P256AccountError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'P256AccountError'
    this.code = code
    this.details = details
  }
}

/**
 * Bundler-related errors
 */
export class BundlerError extends P256AccountError {
  constructor(message, code, details = {}) {
    super(message, code, details)
    this.name = 'BundlerError'
  }
}

/**
 * Network/connection errors
 */
export class NetworkError extends P256AccountError {
  constructor(message, code, details = {}) {
    super(message, code, details)
    this.name = 'NetworkError'
  }
}

/**
 * UserOperation validation errors
 */
export class ValidationError extends P256AccountError {
  constructor(message, code, details = {}) {
    super(message, code, details)
    this.name = 'ValidationError'
  }
}

/**
 * Signature-related errors
 */
export class SignatureError extends P256AccountError {
  constructor(message, code, details = {}) {
    super(message, code, details)
    this.name = 'SignatureError'
  }
}

/**
 * Gas estimation errors
 */
export class GasEstimationError extends P256AccountError {
  constructor(message, code, details = {}) {
    super(message, code, details)
    this.name = 'GasEstimationError'
  }
}

/**
 * Error codes
 */
export const ErrorCodes = {
  // Network errors (1xxx)
  NETWORK_ERROR: 1000,
  NETWORK_TIMEOUT: 1001,
  NETWORK_UNAVAILABLE: 1002,
  RPC_ERROR: 1003,
  
  // Bundler errors (2xxx)
  BUNDLER_ERROR: 2000,
  BUNDLER_TIMEOUT: 2001,
  BUNDLER_REJECTED: 2002,
  BUNDLER_RATE_LIMITED: 2003,
  BUNDLER_UNAVAILABLE: 2004,
  BUNDLER_INVALID_RESPONSE: 2005,
  
  // Validation errors (3xxx)
  VALIDATION_ERROR: 3000,
  INVALID_USEROP: 3001,
  INVALID_SIGNATURE: 3002,
  INVALID_NONCE: 3003,
  INSUFFICIENT_FUNDS: 3004,
  INVALID_PAYMASTER: 3005,
  
  // Gas errors (4xxx)
  GAS_ESTIMATION_FAILED: 4000,
  GAS_TOO_LOW: 4001,
  GAS_TOO_HIGH: 4002,
  
  // Signature errors (5xxx)
  SIGNATURE_ERROR: 5000,
  PASSKEY_CANCELLED: 5001,
  PASSKEY_FAILED: 5002,
  OWNER_SIGNATURE_FAILED: 5003,
  
  // Account errors (6xxx)
  ACCOUNT_NOT_DEPLOYED: 6000,
  ACCOUNT_ALREADY_DEPLOYED: 6001,
  FACTORY_ERROR: 6002,
}

/**
 * Parse bundler error and return appropriate error object
 */
export function parseBundlerError(error, context = {}) {
  const errorMessage = error?.message || String(error)
  const errorData = error?.data || error?.error || {}
  
  // Network/connection errors
  if (error instanceof TypeError && errorMessage.includes('fetch')) {
    return new NetworkError(
      'Failed to connect to bundler. Please check your internet connection.',
      ErrorCodes.NETWORK_UNAVAILABLE,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return new BundlerError(
      'Bundler request timed out. Please try again.',
      ErrorCodes.BUNDLER_TIMEOUT,
      { originalError: error, ...context }
    )
  }
  
  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return new BundlerError(
      'Rate limit exceeded. Please wait a moment and try again.',
      ErrorCodes.BUNDLER_RATE_LIMITED,
      { originalError: error, ...context }
    )
  }
  
  // Validation errors
  if (errorMessage.includes('AA10')) {
    // AA10 = sender already constructed
    return new ValidationError(
      'Account is already deployed.',
      ErrorCodes.ACCOUNT_ALREADY_DEPLOYED,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA21')) {
    // AA21 = didn't pay prefund
    return new ValidationError(
      'Insufficient funds in account to pay for gas. Please fund your account.',
      ErrorCodes.INSUFFICIENT_FUNDS,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA22')) {
    // AA22 = expired or not due
    return new ValidationError(
      'Transaction expired or not yet valid.',
      ErrorCodes.INVALID_USEROP,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA23')) {
    // AA23 = reverted (or OOG)
    return new ValidationError(
      'Transaction validation failed. The operation may be invalid or out of gas.',
      ErrorCodes.VALIDATION_ERROR,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA24')) {
    // AA24 = signature error
    return new SignatureError(
      'Invalid signature. Please try signing again.',
      ErrorCodes.INVALID_SIGNATURE,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA25')) {
    // AA25 = invalid account nonce
    return new ValidationError(
      'Invalid nonce. Your account state may have changed.',
      ErrorCodes.INVALID_NONCE,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA30')) {
    // AA30 = paymaster not deployed
    return new ValidationError(
      'Paymaster not found or not deployed.',
      ErrorCodes.INVALID_PAYMASTER,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA31')) {
    // AA31 = paymaster deposit too low
    return new ValidationError(
      'Paymaster has insufficient funds.',
      ErrorCodes.INVALID_PAYMASTER,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA32')) {
    // AA32 = paymaster expired or not due
    return new ValidationError(
      'Paymaster signature expired.',
      ErrorCodes.INVALID_PAYMASTER,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA33')) {
    // AA33 = paymaster reverted
    return new ValidationError(
      'Paymaster rejected the transaction.',
      ErrorCodes.INVALID_PAYMASTER,
      { originalError: error, ...context }
    )
  }
  
  if (errorMessage.includes('AA34')) {
    // AA34 = signature error
    return new SignatureError(
      'Invalid paymaster signature.',
      ErrorCodes.INVALID_SIGNATURE,
      { originalError: error, ...context }
    )
  }
  
  // Gas estimation errors
  if (errorMessage.includes('gas') && errorMessage.includes('estimate')) {
    return new GasEstimationError(
      'Failed to estimate gas. The transaction may fail.',
      ErrorCodes.GAS_ESTIMATION_FAILED,
      { originalError: error, ...context }
    )
  }
  
  // Generic bundler error
  return new BundlerError(
    `Bundler error: ${errorMessage}`,
    ErrorCodes.BUNDLER_ERROR,
    { originalError: error, ...context }
  )
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error) {
  if (error instanceof P256AccountError) {
    return error.message
  }
  
  // Fallback for unknown errors
  return 'An unexpected error occurred. Please try again.'
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  if (!(error instanceof P256AccountError)) {
    return false
  }
  
  const retryableCodes = [
    ErrorCodes.NETWORK_TIMEOUT,
    ErrorCodes.NETWORK_UNAVAILABLE,
    ErrorCodes.BUNDLER_TIMEOUT,
    ErrorCodes.BUNDLER_RATE_LIMITED,
    ErrorCodes.BUNDLER_UNAVAILABLE,
    ErrorCodes.RPC_ERROR,
  ]
  
  return retryableCodes.includes(error.code)
}

/**
 * Get suggested action for error
 */
export function getSuggestedAction(error) {
  if (!(error instanceof P256AccountError)) {
    return 'Please try again or contact support.'
  }
  
  const actions = {
    [ErrorCodes.NETWORK_UNAVAILABLE]: 'Check your internet connection and try again.',
    [ErrorCodes.NETWORK_TIMEOUT]: 'The network is slow. Please wait and try again.',
    [ErrorCodes.BUNDLER_TIMEOUT]: 'The bundler is busy. Please wait a moment and try again.',
    [ErrorCodes.BUNDLER_RATE_LIMITED]: 'Too many requests. Please wait 1 minute and try again.',
    [ErrorCodes.INSUFFICIENT_FUNDS]: 'Add more ETH to your account and try again.',
    [ErrorCodes.INVALID_SIGNATURE]: 'Please sign the transaction again.',
    [ErrorCodes.INVALID_NONCE]: 'Refresh the page and try again.',
    [ErrorCodes.PASSKEY_CANCELLED]: 'Please complete the biometric authentication.',
    [ErrorCodes.GAS_ESTIMATION_FAILED]: 'Try increasing the gas limit or check if the transaction is valid.',
  }
  
  return actions[error.code] || 'Please try again or contact support.'
}

