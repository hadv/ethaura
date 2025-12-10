/**
 * Unit tests for ModularAccountSDK.executeSwap()
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ModularAccountSDK } from './modularAccountSDK.js'
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
        Interface: vi.fn(() => ({
            encodeFunctionData: vi.fn(),
        })),
        keccak256: vi.fn(() => '0xmockkeccak'),
    },
}))
vi.mock('./bundlerClient.js', () => ({
    BundlerClient: vi.fn()
}))
vi.mock('./modularAccountManager.js', () => ({
    ModularAccountManager: vi.fn(),
    encodeModularBatchExecute: vi.fn(() => '0xencodedBatch'),
    encodeModularExecute: vi.fn(() => '0xencodedExecute'),
    // Add other necessary exports if needed by the test execution flow
    AURA_ACCOUNT_ABI: [],
    P256_MFA_VALIDATOR_ABI: [],
}))

describe('ModularAccountSDK > executeSwap()', () => {
    let sdk
    let mockBuildApproveAndSwap
    let mockExecuteBatch

    beforeEach(() => {
        // Create SDK instance
        sdk = new ModularAccountSDK({
            factoryAddress: '0xFactoryAddress',
            validatorAddress: '0xValidatorAddress',
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
        // We are mocking the method on the instance to test executeSwap's usage of it
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
            undefined, // deadline (undefined by default)
            { isNativeEthIn: undefined, isNativeEthOut: undefined } // ETH swap options
        )

        // Verify executeBatch was called with batch transaction
        expect(mockExecuteBatch).toHaveBeenCalledWith({
            accountAddress: params.accountAddress,
            targets: ['0xTokenAddress', '0xSwapRouterAddress'],
            values: [0n, 0n],
            datas: ['0xapproveCalldata', '0xswapCalldata'],
            passkeyCredential: params.passkeyCredential,
            signWithPasskey: params.signWithPasskey,
            ownerSignature: undefined,
            initCode: undefined,
            getSigner: undefined
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
            undefined, // deadline (undefined by default)
            { isNativeEthIn: undefined, isNativeEthOut: undefined } // ETH swap options
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
            initCode: '0xInitCode',
        }

        await sdk.executeSwap(params)

        // Verify executeBatch was called with initCode
        expect(mockExecuteBatch).toHaveBeenCalledWith(
            expect.objectContaining({
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

        await expect(sdk.executeSwap(params)).rejects.toThrow('Transfer amount exceeds balance')
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

            expect(mockBuildApproveAndSwap).toHaveBeenCalledWith(
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                params.amountOutMinimum,
                params.accountAddress,
                fee,
                undefined,
                { isNativeEthIn: undefined, isNativeEthOut: undefined }
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
            { isNativeEthIn: undefined, isNativeEthOut: undefined } // ETH swap options
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
            undefined,
            { isNativeEthIn: undefined, isNativeEthOut: undefined }
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
            undefined,
            { isNativeEthIn: undefined, isNativeEthOut: undefined }
        )
    })
})
