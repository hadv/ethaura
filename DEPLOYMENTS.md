# Deployment History

This file tracks all production and testnet deployments of the EthAura contracts.

## Sepolia Testnet

### Latest Deployment (2025-10-20)

**P256AccountFactory**
- Address: `0x705a2d8560b9d4B6c1f3ac742D2875E239fcEEd9`
- Transaction: `0x346b70ba18ed659fecba962144a324e52aa150f32a0482d6e6091dd67f8d0241`
- Block: 9449645
- Deployer: `0x18ee4c040568238643c07e7afd6c53efc196d26b`
- Gas Used: 1,887,613
- Verified: ✅ [View on Etherscan](https://sepolia.etherscan.io/address/0x705a2d8560b9d4b6c1f3ac742d2875e239fceed9)
- EntryPoint: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (v0.7)

### Previous Deployments

**P256AccountFactory (Old - Deprecated)**
- Address: `0x8d8cCBb7E5Bf6De92862cBC89490b11B79c2Ba1E`
- Status: Deprecated - Use latest deployment above
- Verified: ✅ [View on Etherscan](https://sepolia.etherscan.io/address/0x8d8ccbb7e5bf6de92862cbc89490b11b79c2ba1e)

---

## Mainnet

*No mainnet deployments yet*

---

## Notes

- All deployments use EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- Compiler: Solc 0.8.23
- Optimizer: Enabled (1,000,000 runs)
- EVM Version: Cancun

## Deployment Commands

### Deploy to Sepolia
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

### Verify Existing Contract
```bash
forge verify-contract \
  --chain sepolia \
  --watch \
  <CONTRACT_ADDRESS> \
  src/P256AccountFactory.sol:P256AccountFactory \
  --constructor-args <CONSTRUCTOR_ARGS>
```

