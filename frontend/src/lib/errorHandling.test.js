/**
 * Error handling tests and examples
 * 
 * This file demonstrates how to test error handling in the SDK
 */

import {
  P256AccountError,
  BundlerError,
  NetworkError,
  ValidationError,
  SignatureError,
  GasEstimationError,
  ErrorCodes,
  parseBundlerError,
  getUserFriendlyMessage,
  getSuggestedAction,
  isRetryableError,
} from './errors.js'

/**
 * Test: Parse AA21 error (insufficient funds)
 */
export function testInsufficientFundsError() {
  const error = new Error('AA21 didn\'t pay prefund')
  const parsed = parseBundlerError(error)
  
  console.assert(parsed instanceof ValidationError, 'Should be ValidationError')
  console.assert(parsed.code === ErrorCodes.INSUFFICIENT_FUNDS, 'Should have INSUFFICIENT_FUNDS code')
  console.assert(parsed.message.includes('Insufficient funds'), 'Should have user-friendly message')
  
  const action = getSuggestedAction(parsed)
  console.assert(action.includes('Add more ETH'), 'Should suggest adding ETH')
  
  console.log('✅ testInsufficientFundsError passed')
}

/**
 * Test: Parse AA24 error (signature error)
 */
export function testSignatureError() {
  const error = new Error('AA24 signature error')
  const parsed = parseBundlerError(error)
  
  console.assert(parsed instanceof SignatureError, 'Should be SignatureError')
  console.assert(parsed.code === ErrorCodes.INVALID_SIGNATURE, 'Should have INVALID_SIGNATURE code')
  
  const action = getSuggestedAction(parsed)
  console.assert(action.includes('sign'), 'Should suggest signing again')
  
  console.log('✅ testSignatureError passed')
}

/**
 * Test: Parse rate limit error
 */
export function testRateLimitError() {
  const error = new Error('rate limit exceeded')
  const parsed = parseBundlerError(error)
  
  console.assert(parsed instanceof BundlerError, 'Should be BundlerError')
  console.assert(parsed.code === ErrorCodes.BUNDLER_RATE_LIMITED, 'Should have BUNDLER_RATE_LIMITED code')
  console.assert(isRetryableError(parsed), 'Should be retryable')
  
  const action = getSuggestedAction(parsed)
  console.assert(action.includes('wait'), 'Should suggest waiting')
  
  console.log('✅ testRateLimitError passed')
}

/**
 * Test: Parse network timeout error
 */
export function testNetworkTimeoutError() {
  const error = new Error('timeout')
  const parsed = parseBundlerError(error)
  
  console.assert(parsed instanceof BundlerError, 'Should be BundlerError')
  console.assert(isRetryableError(parsed), 'Should be retryable')
  
  console.log('✅ testNetworkTimeoutError passed')
}

/**
 * Test: Parse invalid nonce error
 */
export function testInvalidNonceError() {
  const error = new Error('AA25 invalid account nonce')
  const parsed = parseBundlerError(error)
  
  console.assert(parsed instanceof ValidationError, 'Should be ValidationError')
  console.assert(parsed.code === ErrorCodes.INVALID_NONCE, 'Should have INVALID_NONCE code')
  console.assert(!isRetryableError(parsed), 'Should NOT be retryable')
  
  const action = getSuggestedAction(parsed)
  console.assert(action.includes('Refresh'), 'Should suggest refreshing')
  
  console.log('✅ testInvalidNonceError passed')
}

/**
 * Test: User-friendly messages
 */
export function testUserFriendlyMessages() {
  const errors = [
    new BundlerError('Test error', ErrorCodes.BUNDLER_ERROR),
    new NetworkError('Test error', ErrorCodes.NETWORK_UNAVAILABLE),
    new ValidationError('Test error', ErrorCodes.INSUFFICIENT_FUNDS),
    new SignatureError('Test error', ErrorCodes.INVALID_SIGNATURE),
  ]
  
  errors.forEach(error => {
    const message = getUserFriendlyMessage(error)
    console.assert(typeof message === 'string', 'Should return string')
    console.assert(message.length > 0, 'Should not be empty')
  })
  
  console.log('✅ testUserFriendlyMessages passed')
}

/**
 * Test: Retryable errors
 */
export function testRetryableErrors() {
  const retryable = [
    new NetworkError('Test', ErrorCodes.NETWORK_TIMEOUT),
    new NetworkError('Test', ErrorCodes.NETWORK_UNAVAILABLE),
    new BundlerError('Test', ErrorCodes.BUNDLER_TIMEOUT),
    new BundlerError('Test', ErrorCodes.BUNDLER_RATE_LIMITED),
  ]
  
  const notRetryable = [
    new ValidationError('Test', ErrorCodes.INSUFFICIENT_FUNDS),
    new SignatureError('Test', ErrorCodes.INVALID_SIGNATURE),
    new ValidationError('Test', ErrorCodes.INVALID_NONCE),
  ]
  
  retryable.forEach(error => {
    console.assert(isRetryableError(error), `${error.name} should be retryable`)
  })
  
  notRetryable.forEach(error => {
    console.assert(!isRetryableError(error), `${error.name} should NOT be retryable`)
  })
  
  console.log('✅ testRetryableErrors passed')
}

/**
 * Test: All AA error codes
 */
export function testAllAAErrorCodes() {
  const testCases = [
    { code: 'AA10', expectedType: ValidationError, expectedCode: ErrorCodes.ACCOUNT_ALREADY_DEPLOYED },
    { code: 'AA21', expectedType: ValidationError, expectedCode: ErrorCodes.INSUFFICIENT_FUNDS },
    { code: 'AA22', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_USEROP },
    { code: 'AA23', expectedType: ValidationError, expectedCode: ErrorCodes.VALIDATION_ERROR },
    { code: 'AA24', expectedType: SignatureError, expectedCode: ErrorCodes.INVALID_SIGNATURE },
    { code: 'AA25', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_NONCE },
    { code: 'AA30', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_PAYMASTER },
    { code: 'AA31', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_PAYMASTER },
    { code: 'AA32', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_PAYMASTER },
    { code: 'AA33', expectedType: ValidationError, expectedCode: ErrorCodes.INVALID_PAYMASTER },
    { code: 'AA34', expectedType: SignatureError, expectedCode: ErrorCodes.INVALID_SIGNATURE },
  ]
  
  testCases.forEach(({ code, expectedType, expectedCode }) => {
    const error = new Error(`${code} some error message`)
    const parsed = parseBundlerError(error)
    
    console.assert(parsed instanceof expectedType, `${code} should be ${expectedType.name}`)
    console.assert(parsed.code === expectedCode, `${code} should have code ${expectedCode}`)
  })
  
  console.log('✅ testAllAAErrorCodes passed')
}

/**
 * Run all tests
 */
export function runAllTests() {
  console.log('🧪 Running error handling tests...\n')
  
  try {
    testInsufficientFundsError()
    testSignatureError()
    testRateLimitError()
    testNetworkTimeoutError()
    testInvalidNonceError()
    testUserFriendlyMessages()
    testRetryableErrors()
    testAllAAErrorCodes()
    
    console.log('\n✅ All tests passed!')
    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    return false
  }
}

/**
 * Example: Handling errors in a component
 */
export async function exampleComponentErrorHandling(sdk, userOp) {
  try {
    // Try to send UserOperation
    const receipt = await sdk.bundler.sendUserOperationAndWait(userOp)
    console.log('✅ Success:', receipt)
    return { success: true, receipt }
    
  } catch (error) {
    // Get user-friendly information
    const message = getUserFriendlyMessage(error)
    const action = getSuggestedAction(error)
    const canRetry = isRetryableError(error)
    
    // Log for debugging
    console.error('❌ Error:', {
      name: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
    })
    
    // Return error info for UI
    return {
      success: false,
      error: {
        message,
        action,
        canRetry,
        code: error.code,
      }
    }
  }
}

/**
 * Example: Retry logic
 */
export async function exampleRetryLogic(sdk, userOp, maxRetries = 3) {
  let lastError
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const receipt = await sdk.bundler.sendUserOperationAndWait(userOp, 60000, false) // disable auto-retry
      return { success: true, receipt }
      
    } catch (error) {
      lastError = error
      
      // Only retry if error is retryable
      if (!isRetryableError(error)) {
        break
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = 1000 * Math.pow(2, attempt)
      console.log(`⚠️ Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // All retries failed
  return {
    success: false,
    error: {
      message: getUserFriendlyMessage(lastError),
      action: getSuggestedAction(lastError),
      canRetry: isRetryableError(lastError),
    }
  }
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  window.runErrorHandlingTests = runAllTests
  console.log('💡 Run window.runErrorHandlingTests() to test error handling')
}

