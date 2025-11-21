# UniswapV3Service Documentation

## Overview

The `UniswapV3Service` provides a simple interface for interacting with Uniswap V3 protocol for token swaps. It handles quote fetching, swap calldata building, and integrates seamlessly with P256Account's `execute()` and `executeBatch()` functions.

## Features

- ✅ Get swap quotes from Uniswap V3 QuoterV2
- ✅ Build swap calldata for single swaps
- ✅ Build approve + swap batch transactions
- ✅ Calculate slippage protection
- ✅ Support for Sepolia testnet and Ethereum mainnet
- ✅ Price impact calculation (placeholder for Phase 4)

## Installation

The service is already included in the EthAura frontend. Import it from:

```javascript
import { createUniswapV3Service, UniswapV3Service } from './lib/uniswapService'
```

## Quick Start

### 1. Create Service Instance

```javascript
import { ethers } from 'ethers'
import { createUniswapV3Service } from './lib/uniswapService'

const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo')
const chainId = 11155111 // Sepolia

const uniswapService = createUniswapV3Service(provider, chainId)
```

### 2. Get Swap Quote

```javascript
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
const USDT = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
const amountIn = ethers.parseUnits('100', 6) // 100 USDC

const quote = await uniswapService.getQuote(USDC, USDT, amountIn)

console.log('Amount Out:', ethers.formatUnits(quote.amountOut, 6), 'USDT')
console.log('Gas Estimate:', quote.gasEstimate.toString())
console.log('Price Impact:', quote.priceImpact, '%')
```

### 3. Build Swap Transaction

```javascript
// Calculate minimum output with slippage protection
const amountOutMinimum = uniswapService.calculateMinimumOutput(quote.amountOut, 0.5) // 0.5% slippage

// Build approve + swap batch
const batch = uniswapService.buildApproveAndSwap(
  USDC,
  USDT,
  amountIn,
  amountOutMinimum,
  accountAddress // P256Account address
)

// Execute via P256Account
await sdk.executeBatch(batch.targets, batch.values, batch.datas)
```

## API Reference

### `createUniswapV3Service(provider, chainId)`

Factory function to create a new UniswapV3Service instance.

**Parameters:**
- `provider` (Object): ethers.js provider
- `chainId` (number): Network chain ID (11155111 for Sepolia, 1 for Mainnet)

**Returns:** `UniswapV3Service` instance

---

### `getConfig()`

Get Uniswap V3 configuration for the current network.

**Returns:** Object with `swapRouter`, `quoter`, and `weth` addresses

---

### `getQuote(tokenIn, tokenOut, amountIn, fee = 3000)`

Get a quote for a token swap.

**Parameters:**
- `tokenIn` (string): Input token address
- `tokenOut` (string): Output token address
- `amountIn` (bigint): Input amount in wei
- `fee` (number): Pool fee tier (default: 3000 = 0.3%)

**Returns:** Promise<Object>
```javascript
{
  amountOut: bigint,           // Expected output amount
  sqrtPriceX96After: bigint,   // Price after swap
  initializedTicksCrossed: number, // Ticks crossed
  gasEstimate: bigint,         // Estimated gas
  priceImpact: number          // Price impact percentage
}
```

---

### `buildSwapCalldata(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee = 3000)`

Build calldata for a swap transaction.

**Parameters:**
- `tokenIn` (string): Input token address
- `tokenOut` (string): Output token address
- `amountIn` (bigint): Input amount in wei
- `amountOutMinimum` (bigint): Minimum output amount (with slippage)
- `recipient` (string): Recipient address (P256Account)
- `fee` (number): Pool fee tier (default: 3000 = 0.3%)

**Returns:** string (encoded calldata)

---

### `buildApproveAndSwap(tokenIn, tokenOut, amountIn, amountOutMinimum, recipient, fee = 3000)`

Build a batch transaction with approve + swap.

**Parameters:** Same as `buildSwapCalldata()`

**Returns:** Object
```javascript
{
  targets: [tokenAddress, swapRouterAddress],
  values: [0n, 0n],
  datas: [approveCalldata, swapCalldata]
}
```

---

### `calculateMinimumOutput(amountOut, slippagePercent = 0.5)`

Calculate minimum output amount with slippage tolerance.

**Parameters:**
- `amountOut` (bigint): Expected output amount
- `slippagePercent` (number): Slippage tolerance percentage (e.g., 0.5 for 0.5%)

**Returns:** bigint (minimum output amount)

---

### `calculatePriceImpact(tokenIn, tokenOut, amountIn, amountOut)`

Calculate price impact of a swap (placeholder for Phase 4).

**Returns:** Promise<number> (price impact percentage)

## Supported Networks

### Sepolia Testnet (chainId: 11155111)
- SwapRouter02: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- QuoterV2: `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`
- WETH: `0xfff9976782d46cc05630d1f6ebab18b2324d6b14`

### Ethereum Mainnet (chainId: 1)
- SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

## Pool Fee Tiers

Uniswap V3 supports multiple fee tiers:
- `500` = 0.05% (for stablecoin pairs)
- `3000` = 0.3% (default, most common)
- `10000` = 1% (for exotic pairs)

## Error Handling

The service throws errors with descriptive messages:

```javascript
try {
  const quote = await uniswapService.getQuote(tokenIn, tokenOut, amountIn)
} catch (error) {
  console.error('Failed to get quote:', error.message)
  // Handle error appropriately
}
```

## Examples

See `uniswapService.example.js` for complete working examples.

## Next Steps (Future Phases)

- **Phase 2**: Integrate with P256AccountSDK
- **Phase 3**: Build swap UI components
- **Phase 4**: Implement real price impact calculation
- **Phase 5**: Add comprehensive tests

## Resources

- [Uniswap V3 Documentation](https://docs.uniswap.org/contracts/v3/overview)
- [Uniswap V3 Swap Guide](https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps)
- [QuoterV2 Reference](https://docs.uniswap.org/contracts/v3/reference/periphery/lens/Quoter)

