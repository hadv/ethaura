/**
 * Unit tests for UniswapV3Service
 *
 * Comprehensive tests for the Uniswap V3 integration service
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ethers } from 'ethers'
import { UniswapV3Service, createUniswapV3Service } from './uniswapService.js'

describe('UniswapV3Service', () => {
  let provider
  let sepoliaService
  let mainnetService

  beforeEach(() => {
    // Create mock provider for Sepolia
    provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
    sepoliaService = createUniswapV3Service(provider, 11155111)

    // Create service for Mainnet
    const mainnetProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
    mainnetService = createUniswapV3Service(mainnetProvider, 1)
  })

  describe('Service Creation', () => {
    it('should create service instance for Sepolia', () => {
      expect(sepoliaService).toBeInstanceOf(UniswapV3Service)
      expect(sepoliaService.chainId).toBe(11155111)
      expect(sepoliaService.provider).toBe(provider)
    })

    it('should create service instance for Mainnet', () => {
      expect(mainnetService).toBeInstanceOf(UniswapV3Service)
      expect(mainnetService.chainId).toBe(1)
    })

    it('should throw error for unsupported network', () => {
      const invalidProvider = new ethers.JsonRpcProvider('https://rpc.example.com')

      expect(() => {
        new UniswapV3Service(invalidProvider, 999999)
      }).toThrow(/not supported/)
    })

    it('should throw error with chainId in message for unsupported network', () => {
      const invalidProvider = new ethers.JsonRpcProvider('https://rpc.example.com')

      expect(() => {
        new UniswapV3Service(invalidProvider, 999999)
      }).toThrow(/999999/)
    })
  })

  describe('getConfig()', () => {
    it('should return correct config for Sepolia', () => {
      const config = sepoliaService.getConfig()

      expect(config.swapRouter).toBe('0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E')
      expect(config.quoter).toBe('0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3')
      expect(config.weth).toBe('0xfff9976782d46cc05630d1f6ebab18b2324d6b14')
    })

    it('should return correct config for Mainnet', () => {
      const config = mainnetService.getConfig()

      expect(config.swapRouter).toBe('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
      expect(config.quoter).toBe('0x61fFE014bA17989E743c5F6cB21bF9697530B21e')
      expect(config.weth).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    })

    it('should return all required config fields', () => {
      const config = sepoliaService.getConfig()

      expect(config).toHaveProperty('swapRouter')
      expect(config).toHaveProperty('quoter')
      expect(config).toHaveProperty('weth')
    })

    it('should return valid Ethereum addresses', () => {
      const config = sepoliaService.getConfig()

      expect(ethers.isAddress(config.swapRouter)).toBe(true)
      expect(ethers.isAddress(config.quoter)).toBe(true)
      expect(ethers.isAddress(config.weth)).toBe(true)
    })
  })

  describe('calculateMinimumOutput()', () => {
    it('should calculate minimum output with default slippage (0.5%)', () => {
      const amountOut = ethers.parseUnits('100', 6) // 100 USDC
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut)

      // With 0.5% slippage: 100 * (10000 - 50) / 10000 = 99.5
      const expected = ethers.parseUnits('99.5', 6)

      expect(minOutput).toBe(expected)
    })

    it('should calculate minimum output with 1% slippage', () => {
      const amountOut = ethers.parseUnits('100', 6)
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 1.0)

      // With 1% slippage: 100 * (10000 - 100) / 10000 = 99
      const expected = ethers.parseUnits('99', 6)

      expect(minOutput).toBe(expected)
    })

    it('should calculate minimum output with 0.1% slippage', () => {
      const amountOut = 10000n
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 0.1)

      expect(minOutput).toBe(9990n)
    })

    it('should calculate minimum output with 2% slippage', () => {
      const amountOut = 10000n
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 2.0)

      expect(minOutput).toBe(9800n)
    })

    it('should calculate minimum output with 5% slippage', () => {
      const amountOut = 10000n
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 5.0)

      expect(minOutput).toBe(9500n)
    })

    it('should handle large amounts correctly', () => {
      const amountOut = ethers.parseEther('1000000') // 1M ETH
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 0.5)

      const expected = ethers.parseEther('995000') // 995K ETH

      expect(minOutput).toBe(expected)
    })

    it('should handle small amounts correctly', () => {
      const amountOut = 100n
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut, 0.5)

      // 100 * 9950 / 10000 = 99 (rounded down)
      expect(minOutput).toBe(99n)
    })

    it('should return BigInt type', () => {
      const amountOut = 10000n
      const minOutput = sepoliaService.calculateMinimumOutput(amountOut)

      expect(typeof minOutput).toBe('bigint')
    })
  })

  describe('buildSwapCalldata()', () => {
    const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
    const recipient = '0x1234567890123456789012345678901234567890'

    it('should build swap calldata correctly', () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      const calldata = sepoliaService.buildSwapCalldata(USDC, USDT, amountIn, amountOutMinimum, recipient)

      expect(typeof calldata).toBe('string')
      expect(calldata).toMatch(/^0x/)
      expect(calldata.length).toBeGreaterThan(66)
    })

    it('should build calldata with different fee tiers', () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)
      const fees = [500, 3000, 10000]

      fees.forEach(fee => {
        const calldata = sepoliaService.buildSwapCalldata(USDC, USDT, amountIn, amountOutMinimum, recipient, fee)
        expect(typeof calldata).toBe('string')
        expect(calldata).toMatch(/^0x/)
      })
    })

    it('should use default fee tier (3000) when not specified', () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      const calldataDefault = sepoliaService.buildSwapCalldata(USDC, USDT, amountIn, amountOutMinimum, recipient)
      const calldataExplicit = sepoliaService.buildSwapCalldata(USDC, USDT, amountIn, amountOutMinimum, recipient, 3000)

      expect(calldataDefault).toBe(calldataExplicit)
    })
  })

  describe('checkAllowance()', () => {
    it('should return 0n on error', async () => {
      const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      const ownerAddress = '0x1234567890123456789012345678901234567890'
      const spenderAddress = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E'

      // Mock provider to throw error
      const mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111n }),
      }
      const service = new UniswapV3Service(mockProvider, 11155111)

      const allowance = await service.checkAllowance(tokenAddress, ownerAddress, spenderAddress)

      expect(allowance).toBe(0n)
    })
  })

  describe('buildApproveAndSwap()', () => {
    const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
    const recipient = '0x1234567890123456789012345678901234567890'

    it('should build approve and swap batch correctly when allowance is insufficient', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return insufficient allowance
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(0n)

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      expect(Array.isArray(batch.targets)).toBe(true)
      expect(Array.isArray(batch.values)).toBe(true)
      expect(Array.isArray(batch.datas)).toBe(true)
    })

    it('should have 2 calls (approve + swap) when allowance is insufficient', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return insufficient allowance
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(0n)

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      expect(batch.targets.length).toBe(2)
      expect(batch.values.length).toBe(2)
      expect(batch.datas.length).toBe(2)
    })

    it('should have first call to token (approve) when allowance is insufficient', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return insufficient allowance
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(0n)

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      expect(batch.targets[0]).toBe(USDC)
      expect(batch.values[0]).toBe(0n)
      expect(typeof batch.datas[0]).toBe('string')
      expect(batch.datas[0]).toMatch(/^0x/)
    })

    it('should have second call to swap router when allowance is insufficient', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return insufficient allowance
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(0n)

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)
      const config = sepoliaService.getConfig()

      expect(batch.targets[1]).toBe(config.swapRouter)
      expect(batch.values[1]).toBe(0n)
      expect(typeof batch.datas[1]).toBe('string')
      expect(batch.datas[1]).toMatch(/^0x/)
    })

    it('should skip approval when allowance is sufficient', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return sufficient allowance
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(ethers.parseUnits('200', 6))

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      // Should only have 1 call (swap only, no approval)
      expect(batch.targets.length).toBe(1)
      expect(batch.values.length).toBe(1)
      expect(batch.datas.length).toBe(1)

      // Should call swap router directly
      const config = sepoliaService.getConfig()
      expect(batch.targets[0]).toBe(config.swapRouter)
      expect(batch.values[0]).toBe(0n)
    })

    it('should include approval when allowance is exactly equal to amountIn', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return exact amount
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(amountIn)

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      // Should only have 1 call (swap only) since allowance >= amountIn
      expect(batch.targets.length).toBe(1)
      expect(batch.values.length).toBe(1)
      expect(batch.datas.length).toBe(1)
    })

    it('should include approval when allowance is slightly less than amountIn', async () => {
      const amountIn = ethers.parseUnits('100', 6)
      const amountOutMinimum = ethers.parseUnits('99', 6)

      // Mock checkAllowance to return slightly less
      vi.spyOn(sepoliaService, 'checkAllowance').mockResolvedValue(ethers.parseUnits('99.999999', 6))

      const batch = await sepoliaService.buildApproveAndSwap(USDC, USDT, amountIn, amountOutMinimum, recipient)

      // Should have 2 calls (approve + swap)
      expect(batch.targets.length).toBe(2)
      expect(batch.values.length).toBe(2)
      expect(batch.datas.length).toBe(2)
    })
  })

  describe('calculatePriceImpact()', () => {
    it('should return placeholder value (0.0)', async () => {
      const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
      const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
      const amountIn = ethers.parseUnits('100', 6)
      const amountOut = ethers.parseUnits('99.5', 6)

      const priceImpact = await sepoliaService.calculatePriceImpact(USDC, USDT, amountIn, amountOut)

      expect(typeof priceImpact).toBe('number')
      expect(priceImpact).toBe(0.0)
    })
  })

  describe('Contract Instances', () => {
    it('should create contract instances', () => {
      expect(sepoliaService.swapRouter).toBeDefined()
      expect(sepoliaService.quoter).toBeDefined()
      expect(sepoliaService.weth).toBeDefined()
    })

    it('should have correct contract addresses', () => {
      const config = sepoliaService.getConfig()

      expect(sepoliaService.swapRouter.target).toBe(config.swapRouter)
      expect(sepoliaService.quoter.target).toBe(config.quoter)
      expect(sepoliaService.weth.target).toBe(config.weth)
    })
  })

  describe('BigInt Handling', () => {
    it('should handle large amounts correctly', () => {
      const largeAmount = ethers.parseEther('1000000') // 1M ETH
      const minOutput = sepoliaService.calculateMinimumOutput(largeAmount, 0.5)

      expect(typeof minOutput).toBe('bigint')
      expect(minOutput < largeAmount).toBe(true)
    })

    it('should handle small amounts correctly', () => {
      const smallAmount = 1000n
      const minOutput = sepoliaService.calculateMinimumOutput(smallAmount, 0.5)

      expect(typeof minOutput).toBe('bigint')
      expect(minOutput < smallAmount).toBe(true)
    })
  })
})


