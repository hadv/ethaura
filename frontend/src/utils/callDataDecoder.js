import { ethers } from 'ethers'

/**
 * Decode callData to show human-readable operation details
 * 
 * @param {string} callData - The hex-encoded callData from a UserOperation
 * @returns {Object|null} Decoded operation details or null if unable to decode
 * 
 * @example
 * const decoded = decodeCallData('0xb61d27f6...')
 * // Returns:
 * // {
 * //   function: 'execute',
 * //   dest: '0x...',
 * //   value: '0',
 * //   innerCall: {
 * //     type: 'ERC20 Transfer',
 * //     to: '0x...',
 * //     amount: '1000000'
 * //   },
 * //   rawFunc: '0x...'
 * // }
 */
export function decodeCallData(callData) {
  if (!callData || callData === '0x') return null

  try {
    // Check if it's an execute() call (0xb61d27f6)
    const executeSelector = '0xb61d27f6'
    if (callData.startsWith(executeSelector)) {
      // Decode execute(address dest, uint256 value, bytes calldata func)
      const abiCoder = ethers.AbiCoder.defaultAbiCoder()
      const params = abiCoder.decode(
        ['address', 'uint256', 'bytes'],
        '0x' + callData.slice(10) // Remove function selector
      )

      const [dest, value, func] = params

      // Try to decode the inner function call
      let innerCall = null
      if (func && func !== '0x' && func.length >= 10) {
        const funcSelector = func.slice(0, 10)

        // ERC-20 transfer (0xa9059cbb)
        if (funcSelector === '0xa9059cbb') {
          try {
            const transferParams = abiCoder.decode(
              ['address', 'uint256'],
              '0x' + func.slice(10)
            )
            innerCall = {
              type: 'ERC20 Transfer',
              to: transferParams[0],
              amount: transferParams[1].toString(),
            }
          } catch (e) {
            console.error('Failed to decode transfer:', e)
          }
        }
        // ERC-20 approve (0x095ea7b3)
        else if (funcSelector === '0x095ea7b3') {
          try {
            const approveParams = abiCoder.decode(
              ['address', 'uint256'],
              '0x' + func.slice(10)
            )
            innerCall = {
              type: 'ERC20 Approve',
              spender: approveParams[0],
              amount: approveParams[1].toString(),
            }
          } catch (e) {
            console.error('Failed to decode approve:', e)
          }
        }
      }

      return {
        function: 'execute',
        dest,
        value: value.toString(),
        innerCall,
        rawFunc: func,
      }
    }

    return null
  } catch (e) {
    console.error('Failed to decode callData:', e)
    return null
  }
}

