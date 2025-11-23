# EthAura Deployments

This directory contains deployment records for EthAura's P256Account smart account infrastructure across different networks.

## Deployed Networks

### Testnets

#### Sepolia (Ethereum Testnet)
- **Chain ID**: 11155111
- **Status**: ✅ Deployed
- **Factory**: See deployment records
- **Explorer**: https://sepolia.etherscan.io

#### Base Sepolia (Base L2 Testnet)
- **Chain ID**: 84532
- **Status**: ✅ Deployed (Nov 22, 2025)
- **Factory**: `0xF913EF5101Dcb4fDB9A62666D18593aea5509262`
- **Implementation**: `0xA0ca2CDd6fe515f4C1B87f2aEe2EbD4F1e6EfB1E`
- **Explorer**: https://sepolia.basescan.org
- **Details**: See `base-sepolia.json`

### Mainnets

#### Base (Base L2 Mainnet)
- **Chain ID**: 8453
- **Status**: ⏳ Pending (after Base Sepolia testing)
- **Explorer**: https://basescan.org

## Deployment Files

Each deployment is recorded in a JSON file with the following information:

- Network details (chain ID, name, RPC URLs)
- Deployed contract addresses
- Deployment transaction hashes
- Gas costs and block numbers
- Explorer links
- Network features (RIP-7212, ERC-4337, etc.)

## Common Addresses

### EntryPoint v0.7 (Canonical)
- **Address**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- **Networks**: All supported networks (deterministic deployment)
- **Specification**: [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)

### Solady ERC1967Factory (Canonical)
- **Address**: `0x0000000000006396FF2a80c067f99B3d2Ab4Df24`
- **Networks**: All supported networks
- **Purpose**: Minimal proxy factory for gas-efficient account deployments

## Deployment Process

To deploy to a new network:

1. **Setup Environment**
   ```bash
   # Add network RPC to .env
   NETWORK_RPC_URL=https://...
   ```

2. **Deploy Factory**
   ```bash
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url <network> \
     --broadcast \
     --verify
   ```

3. **Record Deployment**
   - Create `<network>.json` in this directory
   - Update `README.md` with deployment details
   - Update frontend `NetworkContext.jsx`

4. **Verify Contracts**
   ```bash
   forge verify-contract \
     --chain-id <chain-id> \
     <factory-address> \
     src/P256AccountFactory.sol:P256AccountFactory
   ```

## Network Requirements

For a network to support EthAura:

- ✅ **ERC-4337 Support**: EntryPoint v0.7 deployed
- ✅ **Bundler Availability**: At least one bundler service
- ✅ **RIP-7212 (Recommended)**: P256 precompile for gas efficiency
- ✅ **Block Explorer**: For contract verification and transaction viewing

## Gas Costs

Approximate deployment costs:

| Network | Factory Deployment | Account Creation |
|---------|-------------------|------------------|
| Ethereum Mainnet | ~$50-100 | ~$10-20 |
| Base Mainnet | ~$0.10-0.20 | ~$0.01-0.02 |
| Base Sepolia | ~$0.09 | ~$0.01 |
| Sepolia | ~$0 (testnet) | ~$0 (testnet) |

## Documentation

- [Base Deployment Guide](../docs/BASE_DEPLOYMENT.md)
- [Base Deployment Summary](../docs/BASE_DEPLOYMENT_SUMMARY.md)
- [Architecture Documentation](../ARCHITECTURE.md)

## Support

For deployment issues or questions:
- Check the deployment guides in `docs/`
- Review the GitHub issues
- Consult the [ERC-4337 documentation](https://eips.ethereum.org/EIPS/eip-4337)

