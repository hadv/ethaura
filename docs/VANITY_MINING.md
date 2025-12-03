# Vanity Address Mining Guide

This guide explains how to deploy EthAura contracts to deterministic vanity addresses using CREATE2.

## Overview

Both `P256MFAValidatorModule` and `AuraAccountFactory` can be deployed to vanity addresses (e.g., `0x000000...`) using Solady's CREATE2 factory. This ensures the same contract addresses across all EVM networks.

**Solady CREATE2 Factory:** `0x0000000000FFe8B47B3e2130213B802212439497`

## Prerequisites

Install [create2crunch](https://github.com/0age/create2crunch) for GPU-accelerated vanity mining:

```bash
cargo install create2crunch
```

## Workflow

### Step 1: Get Validator Init Code Hash

```bash
forge script script/GetValidatorInitCodeHash.s.sol
```

Output:
```
=== P256MFAValidatorModule Init Code Hash ===
Init Code Hash: 0x1234...abcd
```

### Step 2: Mine Validator Vanity Salt

```bash
create2crunch \
  --factory 0x0000000000FFe8B47B3e2130213B802212439497 \
  --caller <YOUR_DEPLOYER_ADDRESS> \
  --init-code-hash <VALIDATOR_INIT_CODE_HASH> \
  --leading 6 \
  --output validator_salt.txt
```

> **Note:** For Solady's factory, the first 20 bytes of the salt must match your deployer address.

### Step 3: Compute Expected Validator Address

Use the mined salt to compute the expected validator address:

```bash
cast compute-address2 \
  --starts-with 000000 \
  --deployer 0x0000000000FFe8B47B3e2130213B802212439497 \
  --salt <MINED_SALT> \
  --init-code-hash <VALIDATOR_INIT_CODE_HASH>
```

Or calculate manually:
```
address = keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]
```

### Step 4: Get Factory Init Code Hash

Run with the expected validator address from Step 3:

```bash
forge script script/GetFactoryInitCodeHash.s.sol \
  --sig 'run(address)' <EXPECTED_VALIDATOR_ADDRESS>
```

Output:
```
=== AuraAccountFactory Init Code Hash ===
Validator Address: 0x000000...
Init Code Hash: 0x5678...efgh
```

### Step 5: Mine Factory Vanity Salt

```bash
create2crunch \
  --factory 0x0000000000FFe8B47B3e2130213B802212439497 \
  --caller <YOUR_DEPLOYER_ADDRESS> \
  --init-code-hash <FACTORY_INIT_CODE_HASH> \
  --leading 6 \
  --output factory_salt.txt
```

### Step 6: Update Deploy Script

Edit `script/Deploy.s.sol` with the mined salts:

```solidity
bytes32 constant VALIDATOR_SALT = 0x<YOUR_DEPLOYER_ADDRESS_20_BYTES><MINED_SUFFIX>;
bytes32 constant FACTORY_SALT = 0x<YOUR_DEPLOYER_ADDRESS_20_BYTES><MINED_SUFFIX>;
```

### Step 7: Deploy

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url <NETWORK_RPC> \
  --broadcast \
  --verify
```

## Important Notes

1. **Order matters:** Deploy validator first, then factory (factory depends on validator address)

2. **Deterministic addresses:** Same salts + same bytecode = same addresses on all EVM chains

3. **Salt format:** For Solady's CREATE2 factory, salt format is:
   ```
   [deployer address (20 bytes)][arbitrary suffix (12 bytes)]
   ```

4. **Mining time:** Finding 6 leading zero bytes typically takes minutes to hours depending on GPU

## Example

```bash
# Deployer: 0x18Ee4C040568238643C07e7aFd6c53efc196D26b

# After mining, you might get:
VALIDATOR_SALT = 0x18ee4c040568238643c07e7afd6c53efc196d26b0000000000000000deadbeef
FACTORY_SALT   = 0x18ee4c040568238643c07e7afd6c53efc196d26b00000000000000001234cafe

# Resulting in addresses like:
# P256MFAValidatorModule: 0x000000a1b2c3d4e5f6...
# AuraAccountFactory:     0x000000f6e5d4c3b2a1...
```

