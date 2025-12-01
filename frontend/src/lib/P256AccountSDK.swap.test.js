/**
 * Unit tests for P256AccountSDK.executeSwap()
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { P256AccountSDK } from './P256AccountSDK.js'
import { UniswapV3Service } from './uniswapService.js'

// Mock dependencies
vi.mock('./uniswapService.js')
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn(() => ({
      getNetwork: vi.fn(() => Promise.resolve({ chainId: 11155111n })),
    })),
    Contract: vi.fn(),
    getBytes: vi.fn((hash) => new Uint8Array(32)),
  },
}))

describe('P256AccountSDK > executeSwap()', () => {
  let sdk
  let mockBuildApproveAndSwap
  let mockExecuteBatch

  beforeEach(() => {
    // Create SDK instance
    sdk = new P256AccountSDK({
      factoryAddress: '0x1234567890123456789012345678901234567890',
      rpcUrl: 'http://localhost:8545',
      bundlerUrl: 'http://localhost:4337',
      chainId: 11155111,
    })

    // Mock UniswapV3Service.buildApproveAndSwap
    mockBuildApproveAndSwap = vi.fn(() => ({
      targets: [
        '0xTokenAddress', // approve
        '0xSwapRouterAddress', // swap
      ],
      values: [0n, 0n],
      datas: ['0xapproveCalldata', '0xswapCalldata'],
    }))

    UniswapV3Service.mockImplementation(() => ({
      buildApproveAndSwap: mockBuildApproveAndSwap,
    }))

    // Mock executeBatch
    mockExecuteBatch = vi.fn(() =>
      Promise.resolve({
        success: true,
        userOpHash: '0xUserOpHash',
        receipt: { transactionHash: '0xTxHash' },
      })
    )
    sdk.executeBatch = mockExecuteBatch
  })

  test('should build and execute swap transaction', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    const result = await sdk.executeSwap(params)

    // Verify UniswapV3Service was instantiated
    expect(UniswapV3Service).toHaveBeenCalledWith(sdk.provider, sdk.chainId)

    // Verify buildApproveAndSwap was called with correct params
    expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.amountOutMinimum,
      params.accountAddress,
      params.fee,
      null, // deadline (null by default)
      { isNativeEthIn: false, isNativeEthOut: false } // ETH swap options
    )

    // Verify executeBatch was called with batch transaction
    expect(mockExecuteBatch).toHaveBeenCalledWith({
      accountAddress: params.accountAddress,
      targets: ['0xTokenAddress', '0xSwapRouterAddress'],
      values: [0n, 0n],
      datas: ['0xapproveCalldata', '0xswapCalldata'],
      passkeyCredential: params.passkeyCredential,
      signWithPasskey: params.signWithPasskey,
      ownerSignature: null,
      needsDeployment: false,
      initCode: '0x',
    })

    // Verify result
    expect(result.success).toBe(true)
  })

  test('should use default fee tier (3000) when not specified', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      // fee not specified
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await sdk.executeSwap(params)

    // Verify default fee tier (3000) was used
    expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.amountOutMinimum,
      params.accountAddress,
      3000, // default fee
      null, // deadline (null by default)
      { isNativeEthIn: false, isNativeEthOut: false } // ETH swap options
    )
  })

  test('should work with owner signature (primary auth)', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
      ownerSignature: '0xOwnerSignature', // Web3Auth signature
    }

    await sdk.executeSwap(params)

    // Verify executeBatch was called with owner signature
    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerSignature: '0xOwnerSignature',
      })
    )
  })

  test('should work with counterfactual account (initCode)', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
      needsDeployment: true,
      initCode: '0xInitCode',
    }

    await sdk.executeSwap(params)

    // Verify executeBatch was called with initCode
    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        needsDeployment: true,
        initCode: '0xInitCode',
      })
    )
  })

  test('should throw user-friendly error for insufficient balance', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Transfer amount exceeds balance'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Insufficient token balance for swap')
  })

  test('should throw user-friendly error for slippage exceeded', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Too little received'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Price moved too much. Try increasing slippage tolerance.')
  })

  test('should throw user-friendly error for insufficient liquidity', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Insufficient liquidity'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Not enough liquidity for this swap')
  })

  test('should throw user-friendly error for deadline exceeded', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Transaction deadline expired'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Transaction took too long. Please try again.')
  })

  test('should throw user-friendly error for gas estimation failure', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Cannot estimate gas'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Unable to estimate gas. Check token balances and allowances.')
  })

  test('should re-throw unknown errors', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Unknown error'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Unknown error')
  })

  test('should handle different fee tiers', async () => {
    const feeTiers = [500, 3000, 10000]

    for (const fee of feeTiers) {
      const params = {
        accountAddress: '0xAccountAddress',
        tokenIn: '0xTokenIn',
        tokenOut: '0xTokenOut',
        amountIn: 1000000n,
        amountOutMinimum: 950000n,
        fee,
        passkeyCredential: { id: 'credential-id' },
        signWithPasskey: vi.fn(),
      }

      await sdk.executeSwap(params)

      expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
        params.tokenIn,
        params.tokenOut,
        params.amountIn,
        params.amountOutMinimum,
        params.accountAddress,
        fee,
        null, // deadline (null by default)
        { isNativeEthIn: false, isNativeEthOut: false } // ETH swap options
      )
    }
  })

  test('should pass deadline parameter to buildApproveAndSwap', async () => {
    const deadline = Math.floor(Date.now() / 1000) + 600 // 10 minutes from now
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      deadline,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await sdk.executeSwap(params)

    expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.amountOutMinimum,
      params.accountAddress,
      params.fee,
      deadline,
      { isNativeEthIn: false, isNativeEthOut: false } // ETH swap options
    )
  })

  test('should handle zero amountIn gracefully', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 0n,
      amountOutMinimum: 0n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    const result = await sdk.executeSwap(params)

    expect(result.success).toBe(true)
    expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
      params.tokenIn,
      params.tokenOut,
      0n,
      0n,
      params.accountAddress,
      3000,
      null,
      { isNativeEthIn: false, isNativeEthOut: false }
    )
  })

  test('should handle large amountIn (max uint256)', async () => {
    const maxUint256 = 2n ** 256n - 1n
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: maxUint256,
      amountOutMinimum: 0n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    const result = await sdk.executeSwap(params)

    expect(result.success).toBe(true)
    expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
      params.tokenIn,
      params.tokenOut,
      maxUint256,
      0n,
      params.accountAddress,
      3000,
      null,
      { isNativeEthIn: false, isNativeEthOut: false }
    )
  })

  test('should work with all supported fee tiers', async () => {
    const feeTiers = [100, 500, 3000, 10000] // 0.01%, 0.05%, 0.3%, 1%

    for (const fee of feeTiers) {
      const params = {
        accountAddress: '0xAccountAddress',
        tokenIn: '0xTokenIn',
        tokenOut: '0xTokenOut',
        amountIn: 1000000n,
        amountOutMinimum: 950000n,
        fee,
        passkeyCredential: { id: 'credential-id' },
        signWithPasskey: vi.fn(),
      }

      await sdk.executeSwap(params)

      expect(mockBuildApproveAndSwap).toHaveBeenLastCalledWith(
        params.tokenIn,
        params.tokenOut,
        params.amountIn,
        params.amountOutMinimum,
        params.accountAddress,
        fee,
        null,
        { isNativeEthIn: false, isNativeEthOut: false }
      )
    }
  })

  test('should throw error when buildApproveAndSwap fails', async () => {
    mockBuildApproveAndSwap.mockRejectedValue(new Error('Failed to build swap'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Failed to build swap')
  })

  test('should work without passkey credential for owner-only auth', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: null,
      signWithPasskey: null,
      ownerSignature: '0xOwnerSignature',
    }

    const result = await sdk.executeSwap(params)

    expect(result.success).toBe(true)
    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        passkeyCredential: null,
        signWithPasskey: null,
        ownerSignature: '0xOwnerSignature',
      })
    )
  })

  test('should handle network error gracefully', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('Network error: connection refused'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('Network error')
  })

  test('should throw user-friendly error for user rejection', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('User rejected the request'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('User rejected')
  })

  test('should work with both passkey and owner signature (2FA mode)', async () => {
    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
      ownerSignature: '0xOwnerSignature',
      needsDeployment: false,
      initCode: '0x',
    }

    const result = await sdk.executeSwap(params)

    expect(result.success).toBe(true)
    expect(mockExecuteBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        passkeyCredential: params.passkeyCredential,
        signWithPasskey: params.signWithPasskey,
        ownerSignature: '0xOwnerSignature',
      })
    )
  })

  test('should throw user-friendly error for invalid token address', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('invalid address'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: 'invalid',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('invalid address')
  })

  test('should handle execution reverted error', async () => {
    mockExecuteBatch.mockRejectedValue(new Error('execution reverted'))

    const params = {
      accountAddress: '0xAccountAddress',
      tokenIn: '0xTokenIn',
      tokenOut: '0xTokenOut',
      amountIn: 1000000n,
      amountOutMinimum: 950000n,
      fee: 3000,
      passkeyCredential: { id: 'credential-id' },
      signWithPasskey: vi.fn(),
    }

    await expect(sdk.executeSwap(params)).rejects.toThrow('execution reverted')
  })
})

