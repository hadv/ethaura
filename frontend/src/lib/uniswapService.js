/**
 * Uniswap V3 Service for token swaps
 * Handles quote fetching, swap calldata building, and price impact calculation
 */

import { ethers } from 'ethers'
import {
  UNISWAP_V3_SWAP_ROUTER_ABI,
  UNISWAP_V3_QUOTER_V2_ABI,
  WETH_ABI,
  ERC20_ABI,
} from './constants'

/**
 * Uniswap V3 network configurations
 */
const UNISWAP_V3_CONFIG = {
  // Sepolia Testnet (chainId: 11155111)
  11155111: {
    swapRouter: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
    quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
    weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  },
  // Ethereum Mainnet (chainId: 1)
  1: {
    swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
}

/**
 * UniswapV3Service class for managing Uniswap V3 swaps
 */
export class UniswapV3Service {
  constructor(provider, chainId) {
    this.provider = provider
    this.chainId = chainId
    
    // Get network configuration
    const config = this.getConfig()
    
    // Initialize contract instances
    this.swapRouter = new ethers.Contract(
      config.swapRouter,
      UNISWAP_V3_SWAP_ROUTER_ABI,
      provider
    )
    
    this.quoter = new ethers.Contract(
      config.quoter,
      UNISWAP_V3_QUOTER_V2_ABI,
      provider
    )
    
    this.weth = new ethers.Contract(
      config.weth,
      WETH_ABI,
      provider
    )
  }

  /**
   * Get Uniswap V3 configuration for the current network
   * @returns {Object} Network configuration
   */
  getConfig() {
    const config = UNISWAP_V3_CONFIG[this.chainId]
    
    if (!config) {
      throw new Error(
        `Uniswap V3 not supported on chainId ${this.chainId}. ` +
        `Supported networks: ${Object.keys(UNISWAP_V3_CONFIG).join(', ')}`
      )
    }
    
    return config
  }

  /**
   * Get quote for a token swap
   * @param {string} tokenIn - Input token address
   * @param {string} tokenOut - Output token address
   * @param {bigint} amountIn - Input amount in wei
   * @param {number} fee - Pool fee tier (default: 3000 = 0.3%)
   * @returns {Promise<Object>} Quote object with amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate, priceImpact
   */
  async getQuote(tokenIn, tokenOut, amountIn, fee = 3000) {
    try {
      console.log('🔍 Fetching Uniswap V3 quote:', {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        fee,
      })

      // Call QuoterV2.quoteExactInputSingle
      const quoteParams = {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n, // No price limit
      }

      const result = await this.quoter.quoteExactInputSingle.staticCall(quoteParams)
      
      // QuoterV2 returns: (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result

      console.log('✅ Quote received:', {
        amountOut: amountOut.toString(),
        sqrtPriceX96After: sqrtPriceX96After.toString(),
        initializedTicksCrossed,
        gasEstimate: gasEstimate.toString(),
      })

      // Calculate price impact
      const priceImpact = await this.calculatePriceImpact(
        tokenIn,
        tokenOut,
        amountIn,
        amountOut
      )

      return {
        amountOut,
        sqrtPriceX96After,
        initializedTicksCrossed,
        gasEstimate,
        priceImpact,
      }
    } catch (error) {
      console.error('❌ Failed to fetch quote:', error)
      throw new Error(`Failed to get swap quote: ${error.message}`)
    }
  }

  /**
   * Calculate price impact of a swap
   * @param {string} tokenIn - Input token address
   * @param {string} tokenOut - Output token address
   * @param {bigint} amountIn - Input amount
   * @param {bigint} amountOut - Output amount from quote
   * @returns {Promise<number>} Price impact as percentage (e.g., 0.5 for 0.5%)
   */
  async calculatePriceImpact(tokenIn, tokenOut, amountIn, amountOut) {
    try {
      // Get pool contract to fetch reserves
      const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, 3000)
      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
          'function liquidity() external view returns (uint128)',
        ],
        this.provider
      )

      // Get current pool state
      const [slot0, liquidity] = await Promise.all([
        poolContract.slot0(),
        poolContract.liquidity()
      ])

      const sqrtPriceX96 = slot0[0]

      // Calculate current price from sqrtPriceX96
      // price = (sqrtPriceX96 / 2^96)^2
      const Q96 = 2n ** 96n
      const currentPrice = (sqrtPriceX96 * sqrtPriceX96 * (10n ** 18n)) / (Q96 * Q96)

      // Calculate execution price from the quote
      // executionPrice = amountOut / amountIn
      const executionPrice = (amountOut * (10n ** 18n)) / amountIn

      // Price impact = |1 - (executionPrice / currentPrice)| * 100
      let priceImpact = 0
      if (currentPrice > 0n) {
        const ratio = (executionPrice * 10000n) / currentPrice
        const diff = ratio > 10000n ? ratio - 10000n : 10000n - ratio
        priceImpact = Number(diff) / 100
      }

      console.log('📊 Price impact calculation:', {
        currentPrice: currentPrice.toString(),
        executionPrice: executionPrice.toString(),
        priceImpact: priceImpact.toFixed(2) + '%'
      })

      return priceImpact
    } catch (error) {
      console.warn('⚠️ Failed to calculate price impact, using fallback:', error.message)
      // Fallback: estimate based on amount size
      // For small amounts, assume low impact
      const amountInEth = Number(amountIn) / 1e18
      if (amountInEth < 0.1) return 0.1
      if (amountInEth < 1) return 0.5
      if (amountInEth < 10) return 2.0
      return 5.0
    }
  }

  /**
   * Build swap calldata for exactInputSingle
   * @param {string} tokenIn - Input token address
   * @param {string} tokenOut - Output token address
   * @param {bigint} amountIn - Input amount in wei
   * @param {bigint} amountOutMinimum - Minimum output amount (with slippage)
   * @param {string} recipient - Recipient address (usually the P256Account)
   * @param {number} fee - Pool fee tier (default: 3000 = 0.3%)
   * @returns {string} Encoded calldata for swap
   */
  buildSwapCalldata(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee = 3000) {
    try {
      console.log('🔨 Building swap calldata:', {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        recipient,
        fee,
      })

      // Build exactInputSingle params
      const params = {
        tokenIn,
        tokenOut,
        fee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n, // No price limit
      }

      // Encode the function call
      const calldata = this.swapRouter.interface.encodeFunctionData(
        'exactInputSingle',
        [params]
      )

      console.log('✅ Swap calldata built:', calldata.slice(0, 66) + '...')
      return calldata
    } catch (error) {
      console.error('❌ Failed to build swap calldata:', error)
      throw new Error(`Failed to build swap calldata: ${error.message}`)
    }
  }

  /**
   * Build approve and swap batch transaction
   * @param {string} tokenIn - Input token address
   * @param {string} tokenOut - Output token address
   * @param {bigint} amountIn - Input amount in wei
   * @param {bigint} amountOutMinimum - Minimum output amount (with slippage)
   * @param {string} recipient - Recipient address (P256Account)
   * @param {number} fee - Pool fee tier (default: 3000 = 0.3%)
   * @returns {Object} Batch transaction object with targets, values, and datas arrays
   */
  buildApproveAndSwap(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee = 3000) {
    try {
      console.log('🔨 Building approve and swap batch:', {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        recipient,
        fee,
      })

      const config = this.getConfig()

      // Build approve calldata for tokenIn
      const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.provider)
      const approveCalldata = tokenContract.interface.encodeFunctionData('approve', [
        config.swapRouter,
        amountIn,
      ])

      // Build swap calldata
      const swapCalldata = this.buildSwapCalldata(
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMinimum,
        recipient,
        fee
      )

      // Return batch transaction
      const batch = {
        targets: [tokenIn, config.swapRouter],
        values: [0n, 0n],
        datas: [approveCalldata, swapCalldata],
      }

      console.log('✅ Approve and swap batch built:', {
        targets: batch.targets,
        values: batch.values.map(v => v.toString()),
      })

      return batch
    } catch (error) {
      console.error('❌ Failed to build approve and swap batch:', error)
      throw new Error(`Failed to build approve and swap batch: ${error.message}`)
    }
  }

  /**
   * Calculate minimum output amount with slippage tolerance
   * @param {bigint} amountOut - Expected output amount
   * @param {number} slippagePercent - Slippage tolerance percentage (e.g., 0.5 for 0.5%)
   * @returns {bigint} Minimum output amount
   */
  calculateMinimumOutput(amountOut, slippagePercent = 0.5) {
    // Convert slippage to basis points (0.5% = 50 basis points)
    const slippageBps = BigInt(Math.floor(slippagePercent * 100))
    const bps = 10000n

    // amountOutMinimum = amountOut * (10000 - slippageBps) / 10000
    const amountOutMinimum = (amountOut * (bps - slippageBps)) / bps

    console.log('📊 Slippage calculation:', {
      amountOut: amountOut.toString(),
      slippagePercent,
      amountOutMinimum: amountOutMinimum.toString(),
    })

    return amountOutMinimum
  }
}

/**
 * Create Uniswap V3 service instance
 * @param {Object} provider - ethers provider
 * @param {number} chainId - Network chain ID
 * @returns {UniswapV3Service} Uniswap V3 service instance
 */
export function createUniswapV3Service(provider, chainId) {
  return new UniswapV3Service(provider, chainId)
}

