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
    factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
    weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  },
  // Ethereum Mainnet (chainId: 1)
  1: {
    swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
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

    this.factory = new ethers.Contract(
      config.factory,
      ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
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
   * Get pool address for a token pair
   * @param {string} tokenA - First token address
   * @param {string} tokenB - Second token address
   * @param {number} fee - Pool fee tier (default: 3000 = 0.3%)
   * @returns {Promise<string>} Pool address
   */
  async getPoolAddress(tokenA, tokenB, fee = 3000) {
    const poolAddress = await this.factory.getPool(tokenA, tokenB, fee)

    if (poolAddress === ethers.ZeroAddress) {
      throw new Error(`No pool found for ${tokenA}/${tokenB} with fee ${fee}`)
    }

    return poolAddress
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
      // Get token decimals
      const getDecimals = async (tokenAddress) => {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function decimals() view returns (uint8)'],
          this.provider
        )
        return await tokenContract.decimals()
      }

      const [decimalsIn, decimalsOut] = await Promise.all([
        getDecimals(tokenIn),
        getDecimals(tokenOut)
      ])

      // Get pool contract to fetch current price
      const poolAddress = await this.getPoolAddress(tokenIn, tokenOut, 3000)
      const poolContract = new ethers.Contract(
        poolAddress,
        [
          'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
          'function token0() external view returns (address)',
          'function token1() external view returns (address)',
        ],
        this.provider
      )

      // Get current pool state and token order
      const [slot0, token0Address] = await Promise.all([
        poolContract.slot0(),
        poolContract.token0()
      ])

      const sqrtPriceX96 = slot0[0]

      // Determine if tokenIn is token0 or token1
      const isToken0 = tokenIn.toLowerCase() === token0Address.toLowerCase()

      // Calculate pool price: token1/token0
      // sqrtPriceX96 = sqrt(price) * 2^96
      // price = (sqrtPriceX96 / 2^96)^2
      const Q96 = 2n ** 96n

      // Get decimals for token0 and token1 (not tokenIn/tokenOut)
      const decimals0 = isToken0 ? decimalsIn : decimalsOut
      const decimals1 = isToken0 ? decimalsOut : decimalsIn

      // Calculate price with proper decimal adjustment
      // price = (sqrtPriceX96^2 * 10^decimals0) / (2^192 * 10^decimals1)
      // This gives us the price in human-readable terms: token1/token0
      const numerator = sqrtPriceX96 * sqrtPriceX96 * (10n ** decimals0)
      const denominator = Q96 * Q96 * (10n ** decimals1)
      const poolPriceToken1PerToken0 = numerator / denominator

      // Now we need tokenOut/tokenIn
      let poolPrice
      if (isToken0) {
        // tokenIn = token0, tokenOut = token1
        // We want token1/token0, which is what we have
        poolPrice = poolPriceToken1PerToken0
      } else {
        // tokenIn = token1, tokenOut = token0
        // We want token0/token1, need to invert
        // Use high precision for inversion to avoid zero
        if (poolPriceToken1PerToken0 === 0n) {
          throw new Error('Pool price is zero, cannot calculate price impact')
        }
        const scale = 10n ** 18n
        poolPrice = (scale * scale) / poolPriceToken1PerToken0
      }

      // Calculate execution price from the quote: amountOut / amountIn
      // amountOut is in raw units (e.g., 54631345 for PYUSD with 6 decimals)
      // amountIn is in raw units (e.g., 20000000000000000000 for LINK with 18 decimals)
      // We need to adjust for decimals to get human-readable price
      // executionPrice = (amountOut / 10^decimalsOut) / (amountIn / 10^decimalsIn)
      //                = (amountOut * 10^decimalsIn) / (amountIn * 10^decimalsOut)
      const executionPriceNumerator = amountOut * (10n ** decimalsIn)
      const executionPriceDenominator = amountIn * (10n ** decimalsOut)
      const executionPrice = executionPriceNumerator / executionPriceDenominator

      // Price impact = |1 - (executionPrice / poolPrice)| * 100
      let priceImpact = 0
      if (poolPrice > 0n && executionPrice > 0n) {
        const ratio = (executionPrice * 10000n) / poolPrice
        const diff = ratio > 10000n ? ratio - 10000n : 10000n - ratio
        priceImpact = Number(diff) / 100
      }

      console.log('📊 Price impact calculation:', {
        tokenIn,
        tokenOut,
        token0: token0Address,
        decimalsIn,
        decimalsOut,
        isToken0,
        sqrtPriceX96: sqrtPriceX96.toString(),
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        poolPrice: poolPrice.toString(),
        executionPrice: executionPrice.toString(),
        ratio: poolPrice > 0n ? ((executionPrice * 10000n) / poolPrice).toString() : '0',
        priceImpact: priceImpact.toFixed(2) + '%'
      })

      return priceImpact
    } catch (error) {
      console.warn('⚠️ Failed to calculate price impact, using fallback:', error.message)
      // Fallback: estimate based on amount size relative to typical liquidity
      // This is a rough estimate - actual impact depends on pool liquidity
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
   * Check token allowance for swap router
   * @param {string} tokenAddress - Token contract address
   * @param {string} ownerAddress - Owner address (P256Account)
   * @param {string} spenderAddress - Spender address (SwapRouter)
   * @returns {Promise<bigint>} Current allowance amount
   */
  async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress)

      console.log('🔍 Checked allowance:', {
        token: tokenAddress,
        owner: ownerAddress,
        spender: spenderAddress,
        allowance: allowance.toString(),
      })

      return allowance
    } catch (error) {
      console.error('❌ Failed to check allowance:', error)
      // Return 0 on error to be safe (will trigger approval)
      return 0n
    }
  }

  /**
   * Build multicall calldata with deadline
   * Wraps the swap call in a multicall to enforce transaction deadline
   * @param {number} deadline - Unix timestamp deadline
   * @param {string} swapCalldata - The swap function calldata
   * @returns {string} Encoded multicall calldata
   */
  buildMulticallWithDeadline(deadline, swapCalldata) {
    try {
      console.log('🔨 Building multicall with deadline:', {
        deadline,
        deadlineDate: new Date(deadline * 1000).toISOString(),
      })

      // Encode multicall with deadline
      const multicallData = this.swapRouter.interface.encodeFunctionData(
        'multicall',
        [BigInt(deadline), [swapCalldata]]
      )

      console.log('✅ Multicall with deadline built')
      return multicallData
    } catch (error) {
      console.error('❌ Failed to build multicall with deadline:', error)
      throw new Error(`Failed to build multicall with deadline: ${error.message}`)
    }
  }

  /**
   * Check if an address is the WETH contract for this network
   * @param {string} address - Address to check
   * @returns {boolean} True if address is WETH
   */
  isWeth(address) {
    const config = this.getConfig()
    return address.toLowerCase() === config.weth.toLowerCase()
  }

  /**
   * Build WETH deposit calldata (wrap ETH → WETH)
   * @returns {string} Encoded deposit() calldata
   */
  buildWrapCalldata() {
    return this.weth.interface.encodeFunctionData('deposit', [])
  }

  /**
   * Build WETH withdraw calldata (unwrap WETH → ETH)
   * @param {bigint} amount - Amount of WETH to unwrap
   * @returns {string} Encoded withdraw(amount) calldata
   */
  buildUnwrapCalldata(amount) {
    return this.weth.interface.encodeFunctionData('withdraw', [amount])
  }

  /**
   * Build approve and swap batch transaction with allowance optimization and deadline
   * Handles native ETH swaps automatically via WETH wrapping/unwrapping
   * @param {string} tokenIn - Input token address (use 'ETH' or WETH address for native ETH)
   * @param {string} tokenOut - Output token address (use 'ETH' or WETH address for native ETH)
   * @param {bigint} amountIn - Input amount in wei
   * @param {bigint} amountOutMinimum - Minimum output amount (with slippage)
   * @param {string} recipient - Recipient address (P256Account)
   * @param {number} fee - Pool fee tier (default: 3000 = 0.3%)
   * @param {number} deadline - Unix timestamp deadline (optional, defaults to 10 minutes from now)
   * @param {Object} options - Additional options
   * @param {boolean} options.isNativeEthIn - True if swapping native ETH (will wrap to WETH first)
   * @param {boolean} options.isNativeEthOut - True if receiving native ETH (will unwrap WETH after)
   * @returns {Promise<Object>} Batch transaction object with targets, values, and datas arrays
   */
  async buildApproveAndSwap(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee = 3000, deadline = null, options = {}) {
    try {
      const { isNativeEthIn = false, isNativeEthOut = false } = options

      // Default deadline: 10 minutes from now
      const txDeadline = deadline || Math.floor(Date.now() / 1000) + (10 * 60)
      const config = this.getConfig()

      // For native ETH swaps, use WETH address in the actual swap
      const actualTokenIn = isNativeEthIn ? config.weth : tokenIn
      const actualTokenOut = isNativeEthOut ? config.weth : tokenOut

      console.log('🔨 Building approve and swap batch:', {
        tokenIn: actualTokenIn,
        tokenOut: actualTokenOut,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        recipient,
        fee,
        deadline: txDeadline,
        deadlineDate: new Date(txDeadline * 1000).toISOString(),
        isNativeEthIn,
        isNativeEthOut,
      })

      // Handle ETH → ERC20 swap (wrap ETH first)
      if (isNativeEthIn) {
        return this._buildEthToTokenSwap(actualTokenIn, actualTokenOut, amountIn, amountOutMinimum, recipient, fee, txDeadline, config)
      }

      // Handle ERC20 → ETH swap (unwrap WETH after)
      if (isNativeEthOut) {
        return this._buildTokenToEthSwap(actualTokenIn, actualTokenOut, amountIn, amountOutMinimum, recipient, fee, txDeadline, config)
      }

      // Standard ERC20 → ERC20 swap
      return this._buildTokenToTokenSwap(actualTokenIn, actualTokenOut, amountIn, amountOutMinimum, recipient, fee, txDeadline, config)
    } catch (error) {
      console.error('❌ Failed to build approve and swap batch:', error)
      throw new Error(`Failed to build approve and swap batch: ${error.message}`)
    }
  }

  /**
   * Build ETH → ERC20 swap batch (wrap + approve + swap)
   * @private
   */
  async _buildEthToTokenSwap(wethAddress, tokenOut, amountIn, amountOutMinimum, recipient, fee, deadline, config) {
    console.log('🔄 Building ETH → Token swap (with WETH wrapping)')

    // Build wrap calldata (WETH.deposit())
    const wrapCalldata = this.buildWrapCalldata()

    // Build approve calldata (approve WETH to SwapRouter)
    const approveCalldata = this.weth.interface.encodeFunctionData('approve', [
      config.swapRouter,
      amountIn,
    ])

    // Build swap calldata
    const swapCalldata = this.buildSwapCalldata(
      wethAddress,
      tokenOut,
      amountIn,
      amountOutMinimum,
      recipient,
      fee
    )

    // Wrap swap in multicall with deadline
    const multicallData = this.buildMulticallWithDeadline(deadline, swapCalldata)

    // Batch: wrap ETH → approve WETH → swap WETH for token
    const batch = {
      targets: [config.weth, config.weth, config.swapRouter],
      values: [amountIn, 0n, 0n], // Send ETH value for deposit
      datas: [wrapCalldata, approveCalldata, multicallData],
    }

    console.log('✅ ETH → Token swap batch built:', {
      steps: ['wrap ETH', 'approve WETH', 'swap WETH→Token'],
      targets: batch.targets,
      values: batch.values.map(v => v.toString()),
    })

    return batch
  }

  /**
   * Build ERC20 → ETH swap batch (approve + swap + unwrap)
   * @private
   */
  async _buildTokenToEthSwap(tokenIn, wethAddress, amountIn, amountOutMinimum, recipient, fee, deadline, config) {
    console.log('🔄 Building Token → ETH swap (with WETH unwrapping)')

    // Check existing allowance for tokenIn
    const allowance = await this.checkAllowance(tokenIn, recipient, config.swapRouter)

    // Build swap calldata - recipient is the account itself to receive WETH first
    const swapCalldata = this.buildSwapCalldata(
      tokenIn,
      wethAddress,
      amountIn,
      amountOutMinimum,
      recipient, // Swap to self, then unwrap
      fee
    )

    // Wrap swap in multicall with deadline
    const multicallData = this.buildMulticallWithDeadline(deadline, swapCalldata)

    // Build unwrap calldata (WETH.withdraw())
    // Use amountOutMinimum as the amount to unwrap (conservative estimate)
    const unwrapCalldata = this.buildUnwrapCalldata(amountOutMinimum)

    // Build batch based on allowance
    if (allowance >= amountIn) {
      console.log('✅ Sufficient allowance, skipping approval')

      // Batch: swap token → WETH, then unwrap WETH → ETH
      const batch = {
        targets: [config.swapRouter, config.weth],
        values: [0n, 0n],
        datas: [multicallData, unwrapCalldata],
      }

      console.log('✅ Token → ETH swap batch built (no approval):', {
        steps: ['swap Token→WETH', 'unwrap WETH'],
        targets: batch.targets,
        values: batch.values.map(v => v.toString()),
      })

      return batch
    }

    // Build approve calldata
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.provider)
    const approveCalldata = tokenContract.interface.encodeFunctionData('approve', [
      config.swapRouter,
      amountIn,
    ])

    // Batch: approve token → swap token → WETH → unwrap WETH → ETH
    const batch = {
      targets: [tokenIn, config.swapRouter, config.weth],
      values: [0n, 0n, 0n],
      datas: [approveCalldata, multicallData, unwrapCalldata],
    }

    console.log('✅ Token → ETH swap batch built (with approval):', {
      steps: ['approve Token', 'swap Token→WETH', 'unwrap WETH'],
      targets: batch.targets,
      values: batch.values.map(v => v.toString()),
    })

    return batch
  }

  /**
   * Build standard ERC20 → ERC20 swap batch (approve + swap)
   * @private
   */
  async _buildTokenToTokenSwap(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee, deadline, config) {
    console.log('🔄 Building Token → Token swap')

    // Check existing allowance
    const allowance = await this.checkAllowance(tokenIn, recipient, config.swapRouter)

    // Build swap calldata (inner call for multicall)
    const swapCalldata = this.buildSwapCalldata(
      tokenIn,
      tokenOut,
      amountIn,
      amountOutMinimum,
      recipient,
      fee
    )

    // Wrap swap in multicall with deadline
    const multicallData = this.buildMulticallWithDeadline(deadline, swapCalldata)

    // If allowance is sufficient, skip approval
    if (allowance >= amountIn) {
      console.log('✅ Sufficient allowance, skipping approval:', {
        allowance: allowance.toString(),
        required: amountIn.toString(),
      })

      const batch = {
        targets: [config.swapRouter],
        values: [0n],
        datas: [multicallData],
      }

      console.log('✅ Swap-only batch built (no approval needed):', {
        targets: batch.targets,
        values: batch.values.map(v => v.toString()),
      })

      return batch
    }

    // Allowance insufficient, include approval
    console.log('⚠️ Insufficient allowance, including approval:', {
      allowance: allowance.toString(),
      required: amountIn.toString(),
    })

    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.provider)
    const approveCalldata = tokenContract.interface.encodeFunctionData('approve', [
      config.swapRouter,
      amountIn,
    ])

    // Return batch transaction with approval
    const batch = {
      targets: [tokenIn, config.swapRouter],
      values: [0n, 0n],
      datas: [approveCalldata, multicallData],
    }

    console.log('✅ Approve and swap batch built:', {
      targets: batch.targets,
      values: batch.values.map(v => v.toString()),
    })

    return batch
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

