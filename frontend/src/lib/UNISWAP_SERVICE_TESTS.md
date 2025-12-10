# UniswapV3Service Test Documentation

## Overview

Comprehensive test suite for the UniswapV3Service using Vitest. All 28 tests are passing successfully.

## Test Framework

- **Framework**: Vitest (optimized for Vite projects)
- **Environment**: jsdom
- **Test File**: `frontend/src/lib/uniswapService.test.js`
- **Configuration**: `frontend/vitest.config.js`

## Running Tests

```bash
# Run all tests
cd frontend && npm test

# Run tests in watch mode
cd frontend && npm test

# Run tests once
cd frontend && npm run test:run

# Run tests with UI
cd frontend && npm run test:ui

# Run tests with coverage
cd frontend && npm run test:coverage

# Run only UniswapV3Service tests
cd frontend && npm test uniswapService.test.js
```

## Test Coverage

### 1. Service Creation (4 tests)

✅ **should create service instance for Sepolia**
- Verifies service is created with correct chainId and provider
- Checks instance type

✅ **should create service instance for Mainnet**
- Verifies service works for Ethereum mainnet
- Checks chainId is set correctly

✅ **should throw error for unsupported network**
- Tests error handling for invalid chainId
- Ensures proper error message

✅ **should throw error with chainId in message for unsupported network**
- Verifies error message includes the invalid chainId
- Helps with debugging

### 2. getConfig() (4 tests)

✅ **should return correct config for Sepolia**
- Validates SwapRouter address: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- Validates Quoter address: `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`
- Validates WETH address: `0xfff9976782d46cc05630d1f6ebab18b2324d6b14`

✅ **should return correct config for Mainnet**
- Validates SwapRouter address: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- Validates Quoter address: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Validates WETH address: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`

✅ **should return all required config fields**
- Checks presence of swapRouter, quoter, and weth fields

✅ **should return valid Ethereum addresses**
- Validates all addresses using ethers.isAddress()

### 3. calculateMinimumOutput() (8 tests)

✅ **should calculate minimum output with default slippage (0.5%)**
- Input: 100 USDC → Output: 99.5 USDC minimum
- Tests default slippage protection

✅ **should calculate minimum output with 1% slippage**
- Input: 100 USDC → Output: 99 USDC minimum
- Tests custom slippage parameter

✅ **should calculate minimum output with 0.1% slippage**
- Input: 10000 → Output: 9990
- Tests low slippage tolerance

✅ **should calculate minimum output with 2% slippage**
- Input: 10000 → Output: 9800
- Tests medium slippage tolerance

✅ **should calculate minimum output with 5% slippage**
- Input: 10000 → Output: 9500
- Tests high slippage tolerance

✅ **should handle large amounts correctly**
- Input: 1,000,000 ETH → Output: 995,000 ETH minimum
- Tests BigInt handling for large values

✅ **should handle small amounts correctly**
- Input: 100 → Output: 99
- Tests rounding behavior for small values

✅ **should return BigInt type**
- Verifies return type is bigint

### 4. buildSwapCalldata() (3 tests)

✅ **should build swap calldata correctly**
- Validates calldata is a hex string starting with 0x
- Checks calldata has substantial length
- Tests basic swap encoding

✅ **should build calldata with different fee tiers**
- Tests fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)
- Ensures all fee tiers produce valid calldata

✅ **should use default fee tier (3000) when not specified**
- Verifies default fee tier matches explicit 3000
- Tests parameter defaults

### 5. buildApproveAndSwap() (4 tests)

✅ **should build approve and swap batch correctly**
- Validates batch structure (targets, values, datas arrays)
- Tests batch transaction building

✅ **should have 2 calls (approve + swap)**
- Verifies batch has exactly 2 transactions
- Checks array lengths

✅ **should have first call to token (approve)**
- Validates first target is token address
- Checks approve calldata format
- Verifies value is 0

✅ **should have second call to swap router**
- Validates second target is SwapRouter address
- Checks swap calldata format
- Verifies value is 0

### 6. calculatePriceImpact() (1 test)

✅ **should return placeholder value (0.0)**
- Tests placeholder implementation
- Returns 0.0 until Phase 4 implementation

### 7. Contract Instances (2 tests)

✅ **should create contract instances**
- Verifies swapRouter, quoter, and weth contracts are created
- Checks all instances are defined

✅ **should have correct contract addresses**
- Validates contract addresses match configuration
- Tests contract.target property

### 8. BigInt Handling (2 tests)

✅ **should handle large amounts correctly**
- Tests with 1,000,000 ETH
- Verifies BigInt arithmetic
- Checks minimum < input

✅ **should handle small amounts correctly**
- Tests with 1000 wei
- Verifies BigInt handling for small values
- Checks minimum < input

## Test Results

```
✓ src/lib/uniswapService.test.js (28 tests) 105ms
  ✓ UniswapV3Service (28)
    ✓ Service Creation (4)
    ✓ getConfig() (4)
    ✓ calculateMinimumOutput() (8)
    ✓ buildSwapCalldata() (3)
    ✓ buildApproveAndSwap() (4)
    ✓ calculatePriceImpact() (1)
    ✓ Contract Instances (2)
    ✓ BigInt Handling (2)

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  1.40s
```

## Coverage Areas

### ✅ Fully Tested
- Service instantiation
- Network configuration
- Slippage calculations
- Calldata encoding
- Batch transaction building
- Contract instance creation
- BigInt arithmetic
- Error handling

### 🔄 To Be Enhanced (Phase 4)
- Real price impact calculation (currently placeholder)
- Integration tests with live Sepolia testnet
- Gas estimation accuracy
- Multi-hop swap paths
- Edge cases for extreme slippage values

## Next Steps

1. **Integration Testing** (Phase 2)
   - Test with ModularAccountSDK
   - Test passkey signing flow
   - Test actual swap execution on Sepolia

2. **E2E Testing** (Phase 5)
   - Full swap flow from UI to blockchain
   - Real token swaps on testnet
   - Error recovery scenarios

3. **Performance Testing** (Phase 5)
   - Quote fetching speed
   - Calldata encoding performance
   - Memory usage with large batches

## Notes

- All tests use mock providers (no real RPC calls)
- Tests are deterministic and fast (~105ms total)
- No external dependencies required for testing
- Tests follow Vitest best practices
- Console methods are mocked to reduce noise

