/**
 * Example usage of UniswapV3Service
 * This file demonstrates how to use the Uniswap V3 service for token swaps
 */

import { ethers } from 'ethers'
import { createUniswapV3Service } from './uniswapService'

/**
 * Example 1: Get a quote for swapping USDC to USDT on Sepolia
 */
export async function exampleGetQuote() {
  console.log('📝 Example 1: Get swap quote\n')

  // Setup provider (Sepolia testnet)
  const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
  const chainId = 11155111 // Sepolia

  // Create service
  const uniswapService = createUniswapV3Service(provider, chainId)

  // Token addresses on Sepolia
  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'

  // Amount to swap: 100 USDC (6 decimals)
  const amountIn = ethers.parseUnits('100', 6)

  try {
    // Get quote
    const quote = await uniswapService.getQuote(USDC, USDT, amountIn)

    console.log('Quote received:')
    console.log('  Amount In:  100 USDC')
    console.log('  Amount Out:', ethers.formatUnits(quote.amountOut, 6), 'USDT')
    console.log('  Gas Estimate:', quote.gasEstimate.toString())
    console.log('  Price Impact:', quote.priceImpact, '%')
    console.log('  Ticks Crossed:', quote.initializedTicksCrossed)

    return quote
  } catch (error) {
    console.error('❌ Failed to get quote:', error.message)
    throw error
  }
}

/**
 * Example 2: Build swap calldata
 */
export async function exampleBuildSwapCalldata() {
  console.log('\n📝 Example 2: Build swap calldata\n')

  const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
  const chainId = 11155111

  const uniswapService = createUniswapV3Service(provider, chainId)

  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
  const amountIn = ethers.parseUnits('100', 6)

  try {
    // First get quote
    const quote = await uniswapService.getQuote(USDC, USDT, amountIn)

    // Calculate minimum output with 0.5% slippage
    const amountOutMinimum = uniswapService.calculateMinimumOutput(quote.amountOut, 0.5)

    // Build swap calldata
    const recipient = '0x1234567890123456789012345678901234567890' // P256Account address
    const calldata = uniswapService.buildSwapCalldata(
      USDC,
      USDT,
      amountIn,
      amountOutMinimum,
      recipient
    )

    console.log('Swap calldata built:')
    console.log('  Calldata:', calldata.slice(0, 66) + '...')
    console.log('  Length:', calldata.length, 'characters')

    return calldata
  } catch (error) {
    console.error('❌ Failed to build calldata:', error.message)
    throw error
  }
}

/**
 * Example 3: Build approve and swap batch transaction
 */
export async function exampleBuildApproveAndSwap() {
  console.log('\n📝 Example 3: Build approve and swap batch\n')

  const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
  const chainId = 11155111

  const uniswapService = createUniswapV3Service(provider, chainId)

  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
  const amountIn = ethers.parseUnits('100', 6)
  const recipient = '0x1234567890123456789012345678901234567890'

  try {
    // Get quote
    const quote = await uniswapService.getQuote(USDC, USDT, amountIn)

    // Calculate minimum output with 0.5% slippage
    const amountOutMinimum = uniswapService.calculateMinimumOutput(quote.amountOut, 0.5)

    // Build batch transaction
    const batch = uniswapService.buildApproveAndSwap(
      USDC,
      USDT,
      amountIn,
      amountOutMinimum,
      recipient
    )

    console.log('Batch transaction built:')
    console.log('  Targets:', batch.targets)
    console.log('  Values:', batch.values.map(v => v.toString()))
    console.log('  Number of calls:', batch.targets.length)
    console.log('\nThis batch can be executed via P256Account.executeBatch()')

    return batch
  } catch (error) {
    console.error('❌ Failed to build batch:', error.message)
    throw error
  }
}

/**
 * Example 4: Calculate slippage
 */
export function exampleCalculateSlippage() {
  console.log('\n📝 Example 4: Calculate slippage\n')

  const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
  const chainId = 11155111

  const uniswapService = createUniswapV3Service(provider, chainId)

  const expectedOutput = ethers.parseUnits('99.5', 6) // 99.5 USDT

  // Test different slippage tolerances
  const slippages = [0.1, 0.5, 1.0, 2.0]

  console.log('Expected output: 99.5 USDT\n')
  slippages.forEach(slippage => {
    const minOutput = uniswapService.calculateMinimumOutput(expectedOutput, slippage)
    console.log(`  ${slippage}% slippage: ${ethers.formatUnits(minOutput, 6)} USDT minimum`)
  })
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🧪 Running UniswapV3Service examples...\n')
  console.log('=' .repeat(60))

  try {
    await exampleGetQuote()
    await exampleBuildSwapCalldata()
    await exampleBuildApproveAndSwap()
    exampleCalculateSlippage()

    console.log('\n' + '='.repeat(60))
    console.log('✅ All examples completed successfully!')
    return true
  } catch (error) {
    console.error('\n❌ Example failed:', error)
    return false
  }
}

