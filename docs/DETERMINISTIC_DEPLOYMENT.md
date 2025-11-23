# Deterministic Deployment Guide

## Goal
Deploy **P256AccountFactory** to the **same address** on all networks (Ethereum, Base, Optimism, Polygon, Arbitrum, etc.)

## Why This Matters
- Users get the **same account address** across all networks
- Easier UX - one address to remember
- Consistent branding and trust

## How CREATE2 Works

CREATE2 address = `keccak256(0xff ++ deployer ++ salt ++ initCodeHash)`

Where:
- `deployer` = address deploying the contract
- `salt` = a bytes32 value you choose
- `initCodeHash` = keccak256 of the contract creation bytecode

## Method 1: Use Same Deployer EOA (Simplest)

If you deploy from the **same EOA** at the **same nonce** on all networks, you'll get the **same address**.

### Steps:

1. **Create a dedicated deployer EOA**
   ```bash
   # Generate a new wallet
   cast wallet new
   ```

2. **Fund it on all networks**
   - Send enough ETH to cover deployment gas on each network
   - Ethereum, Base, Optimism, Polygon, Arbitrum, etc.

3. **Check the nonce is 0 on all networks**
   ```bash
   cast nonce <DEPLOYER_ADDRESS> --rpc-url <NETWORK_RPC>
   ```

4. **Deploy on each network in sequence**
   ```bash
   # Deploy on Sepolia first (testnet)
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url sepolia \
     --private-key <DEPLOYER_PRIVATE_KEY> \
     --broadcast

   # Deploy on Base Sepolia
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url base-sepolia \
     --private-key <DEPLOYER_PRIVATE_KEY> \
     --broadcast

   # Deploy on Ethereum mainnet
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url mainnet \
     --private-key <DEPLOYER_PRIVATE_KEY> \
     --broadcast

   # Deploy on Base mainnet
   forge script script/Deploy.s.sol:DeployScript \
     --rpc-url base \
     --private-key <DEPLOYER_PRIVATE_KEY> \
     --broadcast
   ```

5. **Verify the addresses match**
   ```bash
   # Check factory address on each network
   cast call <FACTORY_ADDRESS> "IMPLEMENTATION()(address)" --rpc-url sepolia
   cast call <FACTORY_ADDRESS> "IMPLEMENTATION()(address)" --rpc-url base-sepolia
   ```

### Important Notes:
- ⚠️ **Do NOT use this EOA for anything else** - any transaction will increment the nonce
- ⚠️ **Deploy in the same order** on all networks
- ⚠️ **Verify nonce is the same** before each deployment

## Method 2: Use CREATE2 Deployer (More Robust)

Use a universal CREATE2 deployer like:
- **0age's ImmutableCreate2Factory**: `0x0000000000FFe8B47B3e2130213B802212439497`
- **CREATE3**: Deterministic deployment regardless of constructor args

### Using ImmutableCreate2Factory:

```solidity
// Deploy via CREATE2
bytes memory creationCode = abi.encodePacked(
    type(P256AccountFactory).creationCode,
    abi.encode(ENTRYPOINT_V07)
);

bytes32 salt = bytes32(0); // Choose your salt

address factory = ImmutableCreate2Factory(0x0000000000FFe8B47B3e2130213B802212439497)
    .safeCreate2(salt, creationCode);
```

## Method 3: Use Foundry's CREATE2 (Recommended)

Foundry has built-in CREATE2 support:

```bash
# Deploy with CREATE2
forge create src/P256AccountFactory.sol:P256AccountFactory \
  --constructor-args <ENTRYPOINT_ADDRESS> \
  --rpc-url <NETWORK_RPC> \
  --private-key <PRIVATE_KEY> \
  --create2 \
  --salt <YOUR_SALT>
```

## Verification

After deployment, verify the factory address is the same:

```bash
# Get factory address on each network
SEPOLIA_FACTORY=$(cast call <ADDRESS> "IMPLEMENTATION()(address)" --rpc-url sepolia)
BASE_FACTORY=$(cast call <ADDRESS> "IMPLEMENTATION()(address)" --rpc-url base)

# Compare
if [ "$SEPOLIA_FACTORY" == "$BASE_FACTORY" ]; then
  echo "✅ Factory addresses match!"
else
  echo "❌ Factory addresses don't match"
fi
```

## Current Status

- ✅ **Sepolia**: Factory deployed at `<address from .env>`
- ✅ **Base Sepolia**: Factory deployed at `0xF913EF5101Dcb4fDB9A62666D18593aea5509262`
- ❌ **Ethereum**: Not deployed yet
- ❌ **Base**: Not deployed yet
- ❌ **Optimism**: Not deployed yet
- ❌ **Polygon**: Not deployed yet
- ❌ **Arbitrum**: Not deployed yet

## Next Steps

1. Choose deployment method (Method 1 is simplest)
2. Create dedicated deployer EOA
3. Fund it on all networks
4. Deploy sequentially
5. Verify addresses match
6. Update frontend `.env` files

