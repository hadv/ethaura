# Base L2 Deployment Guide

This guide walks through deploying EthAura's P256Account smart account infrastructure on Base L2 network.

## Prerequisites

### 1. Get Base Sepolia Testnet ETH

Visit the [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) to get testnet ETH.

### 2. Get API Keys

- **Pimlico API Key**: Sign up at [Pimlico Dashboard](https://dashboard.pimlico.io/)
- **Etherscan API Key**: Get from [Etherscan](https://etherscan.io/apis) or [BaseScan](https://basescan.org/apis)
  - Note: BaseScan uses the same API key as Etherscan

### 3. Update Environment Variables

Update your `.env` file with Base configuration:

```bash
# Base L2 Networks
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Block Explorers (BaseScan uses the same API key as Etherscan)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Private key for deployment
PRIVATE_KEY=0x...
```

Update `frontend/.env` with Base configuration:

```bash
# Base Sepolia Testnet
VITE_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VITE_BASE_SEPOLIA_BUNDLER_URL=https://api.pimlico.io/v2/base-sepolia/rpc?apikey=YOUR_PIMLICO_API_KEY
VITE_BASE_SEPOLIA_FACTORY_ADDRESS=  # Will be filled after deployment

# Base Mainnet (for production)
VITE_BASE_RPC_URL=https://mainnet.base.org
VITE_BASE_BUNDLER_URL=https://api.pimlico.io/v2/base/rpc?apikey=YOUR_PIMLICO_API_KEY
VITE_BASE_FACTORY_ADDRESS=  # Will be filled after mainnet deployment
```

## Phase 1: Deploy to Base Sepolia Testnet

### Step 1: Deploy Factory Contract

```bash
# Deploy to Base Sepolia
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base-sepolia \
  --broadcast \
  --verify \
  -vvvv
```

The script will deploy:
- P256AccountFactory
- P256Account implementation contract

### Step 2: Verify Deployment

After deployment, you should see output like:

```
=== Deployment Complete ===
EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
P256AccountFactory: 0x...
P256Account Implementation: 0x...
Solady ERC1967Factory: 0x...
```

### Step 3: Verify Contracts on BaseScan

Contracts should be automatically verified. If not, verify manually:

```bash
forge verify-contract \
  --chain-id 84532 \
  --watch \
  <FACTORY_ADDRESS> \
  src/P256AccountFactory.sol:P256AccountFactory \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032)
```

### Step 4: Test P256 Precompile

Create a simple test script to verify RIP-7212 precompile is available:

```bash
cast call 0x0100 "0x" --rpc-url base-sepolia
```

If the precompile exists, it should return data (not revert).

### Step 5: Update Frontend Configuration

Update `frontend/.env`:

```bash
VITE_BASE_SEPOLIA_FACTORY_ADDRESS=0x...  # Your deployed factory address
```

Enable Base Sepolia in `frontend/src/contexts/NetworkContext.jsx`:

```javascript
{
  chainId: 84532,
  name: 'Base Sepolia',
  // ...
  supported: true,  // Change from false to true
}
```

## Phase 2: Test on Base Sepolia

### Test Checklist

- [ ] Create a new account with passkey
- [ ] Verify counterfactual address generation
- [ ] Deploy account (first transaction)
- [ ] Send a transaction with 2FA
- [ ] Test guardian recovery flow
- [ ] Verify gas costs
- [ ] Check transactions on BaseScan

### Testing Commands

```bash
# Create test account
forge script script/CreateAccount.s.sol:CreateAccountScript \
  --rpc-url base-sepolia \
  --broadcast

# Test 2FA transaction
forge script script/Demo2FA.s.sol:Demo2FAScript \
  --rpc-url base-sepolia \
  --broadcast
```

## Phase 3: Deploy to Base Mainnet

⚠️ **Only proceed after thorough testing on Base Sepolia**

### Step 1: Prepare Mainnet Deployment

- [ ] Complete all Base Sepolia tests
- [ ] Review gas costs
- [ ] Prepare deployment funds (ETH on Base mainnet)
- [ ] Backup private keys securely

### Step 2: Deploy to Base Mainnet

```bash
# Deploy to Base mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base \
  --broadcast \
  --verify \
  -vvvv
```

### Step 3: Update Production Configuration

Update `frontend/.env`:

```bash
VITE_BASE_FACTORY_ADDRESS=0x...  # Your mainnet factory address
```

Enable Base mainnet in `frontend/src/contexts/NetworkContext.jsx`:

```javascript
{
  chainId: 8453,
  name: 'Base',
  // ...
  supported: true,  // Change from false to true
}
```

## Network Information

### Base Mainnet
- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Explorer**: https://basescan.org
- **EntryPoint v0.7**: 0x0000000071727De22E5E9d8BAf0edAc6f37da032

### Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **EntryPoint v0.7**: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

## Troubleshooting

### Issue: "Insufficient funds for gas"
**Solution**: Get more Base Sepolia ETH from the faucet

### Issue: "Contract verification failed"
**Solution**: Ensure BASESCAN_API_KEY is set correctly in `.env`

### Issue: "Bundler not responding"
**Solution**: Check Pimlico API key and bundler URL

### Issue: "P256 signature verification failed"
**Solution**: Verify RIP-7212 precompile is available on Base (it should be after Fjord upgrade)

## Resources

- [Base Documentation](https://docs.base.org)
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- [BaseScan](https://basescan.org)
- [Pimlico Bundler Docs](https://docs.pimlico.io)
- [RIP-7212 Specification](https://github.com/ethereum/RIPs/blob/master/RIPS/rip-7212.md)

## Next Steps

After successful deployment:

1. Update user documentation
2. Announce Base support
3. Monitor gas costs and optimize if needed
4. Consider Coinbase Paymaster integration for gasless transactions

