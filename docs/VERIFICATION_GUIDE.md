# Contract Verification Guide

This guide explains how to verify all EthAura contracts on Etherscan after deployment.

## Overview

With the ERC-1967 proxy pattern, you need to verify:
1. **P256AccountFactory** - The factory contract
2. **P256Account Implementation** - The shared implementation contract
3. **Proxy Accounts** (Optional) - Individual user accounts (auto-detected by Etherscan)

## Prerequisites

1. **Deployed contracts** on the target network
2. **Factory address** from deployment
3. **Etherscan API key** - Get from [etherscan.io/myapikey](https://etherscan.io/myapikey)
4. **Foundry** installed and configured

## Method 1: Automated Script (Recommended)

### Quick Start

```bash
# Set environment variables
export FACTORY_ADDRESS=0x...  # Your deployed factory address
export ETHERSCAN_API_KEY=your_api_key

# Run verification script
./scripts/verify-contracts.sh sepolia
```

### What It Does

The script automatically:
- ✅ Fetches implementation address from factory
- ✅ Verifies factory contract
- ✅ Verifies implementation contract
- ✅ Provides Etherscan links
- ✅ Handles rate limiting
- ✅ Shows verification status

### Supported Networks

- `sepolia` - Sepolia testnet
- `mainnet` - Ethereum mainnet

### Example Output

```
=== EthAura Contract Verification ===
Network: sepolia (Chain ID: 11155111)

Factory Address: 0x1234...
Implementation Address: 0x5678...

=== Verifying P256AccountFactory ===
✓ P256AccountFactory verified successfully!

=== Verifying P256Account Implementation ===
✓ P256Account Implementation verified successfully!

=== Verification Summary ===
✓ Factory verified
✓ Implementation verified

=== Etherscan Links ===
Factory: https://sepolia.etherscan.io/address/0x1234...#code
Implementation: https://sepolia.etherscan.io/address/0x5678...#code

All contracts verified successfully! ✓
```

## Method 2: Manual Verification

### Step 1: Get Implementation Address

```bash
export FACTORY_ADDRESS=0x...  # Your factory address

# Get implementation address
cast call $FACTORY_ADDRESS "IMPLEMENTATION()(address)" --rpc-url sepolia
```

### Step 2: Verify Factory

```bash
forge verify-contract \
  --chain-id 11155111 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version v0.8.23 \
  $FACTORY_ADDRESS \
  src/P256AccountFactory.sol:P256AccountFactory
```

### Step 3: Verify Implementation

```bash
forge verify-contract \
  --chain-id 11155111 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version v0.8.23 \
  $IMPLEMENTATION_ADDRESS \
  src/P256Account.sol:P256Account
```

## Method 3: Using Foundry Script

```bash
# Set factory address
export FACTORY_ADDRESS=0x...

# Run verification script (shows commands)
forge script script/Verify.s.sol --rpc-url sepolia
```

This will print all verification commands with correct parameters.

## Proxy Account Verification

### Automatic Detection (Recommended)

**Good news:** ERC-1967 proxies are automatically detected by Etherscan!

Once the implementation is verified:
1. Navigate to any proxy account address on Etherscan
2. Etherscan will automatically show:
   - ✅ "Read as Proxy" tab
   - ✅ "Write as Proxy" tab
   - ✅ Link to implementation contract
   - ✅ All implementation functions

**No manual verification needed!** 🎉

### Manual Proxy Verification (If Needed)

If Etherscan doesn't auto-detect the proxy:

```bash
forge verify-contract \
  --chain-id 11155111 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" $IMPLEMENTATION_ADDRESS 0x) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version v0.8.23 \
  $PROXY_ADDRESS \
  lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy
```

## Verification Checklist

After verification, check on Etherscan:

- [ ] Factory contract shows green checkmark ✓
- [ ] Implementation contract shows green checkmark ✓
- [ ] Factory "Read Contract" tab works
- [ ] Can call `IMPLEMENTATION()` to see implementation address
- [ ] Proxy accounts show "Read as Proxy" tab
- [ ] Proxy points to correct implementation address
- [ ] All contract functions are visible and documented

## Troubleshooting

### Verification Fails

**Problem:** `Error: Verification failed`

**Solutions:**
1. Check compiler version matches: `v0.8.23`
2. Check optimization settings: `200 runs`
3. Verify constructor args are correct
4. Check `ETHERSCAN_API_KEY` is set and valid
5. Wait a few minutes and try again (rate limiting)

### Wrong Constructor Args

**Problem:** `Error: Constructor arguments mismatch`

**Solution:**
```bash
# Verify constructor args encoding
cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

Should output the correct encoded args.

### Rate Limiting

**Problem:** `Error: Rate limit exceeded`

**Solution:**
- Wait 5-10 minutes between verification attempts
- Use `--watch` flag to automatically retry
- Upgrade Etherscan API key tier

### Compiler Version Mismatch

**Problem:** `Error: Compiler version mismatch`

**Solution:**
```bash
# Check foundry.toml
cat foundry.toml | grep solc

# Should show: solc = "0.8.23"
```

### Proxy Not Detected

**Problem:** Etherscan doesn't show "Read as Proxy" tab

**Solutions:**
1. Wait a few minutes (Etherscan needs time to detect)
2. Verify implementation contract first
3. Check proxy points to correct implementation:
   ```bash
   cast call $PROXY_ADDRESS "implementation()(address)" --rpc-url sepolia
   ```
4. Manually verify proxy (see above)

## Advanced: Verify with Standard JSON

For debugging, you can export the standard JSON input:

```bash
forge verify-contract \
  --show-standard-json-input \
  $FACTORY_ADDRESS \
  src/P256AccountFactory.sol:P256AccountFactory \
  > verification-input.json
```

Then verify on Etherscan UI:
1. Go to contract address
2. Click "Verify & Publish"
3. Select "Solidity (Standard JSON Input)"
4. Upload `verification-input.json`

## Network-Specific Settings

### Sepolia Testnet

```bash
CHAIN_ID=11155111
ENTRYPOINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032
EXPLORER=https://sepolia.etherscan.io
```

### Ethereum Mainnet

```bash
CHAIN_ID=1
ENTRYPOINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032
EXPLORER=https://etherscan.io
```

## Post-Verification

After successful verification:

1. **Test Read Functions**
   - Visit factory on Etherscan
   - Go to "Read Contract" tab
   - Call `IMPLEMENTATION()` to verify it returns correct address

2. **Test Proxy Functions**
   - Visit a proxy account on Etherscan
   - Go to "Read as Proxy" tab
   - Verify you can see all P256Account functions

3. **Update Documentation**
   - Add verified contract addresses to README
   - Update deployment documentation
   - Share Etherscan links with team

4. **Monitor**
   - Set up Etherscan alerts for contract events
   - Monitor for any unusual activity
   - Track gas usage

## Security Notes

- ✅ Verification makes contract source code public
- ✅ Users can audit the code on Etherscan
- ✅ Increases trust and transparency
- ✅ Required for most integrations
- ⚠️ Never share private keys in verification process
- ⚠️ Double-check addresses before verification

## Resources

- [Foundry Verification Docs](https://book.getfoundry.sh/reference/forge/forge-verify-contract)
- [Etherscan API Docs](https://docs.etherscan.io/api-endpoints/contracts)
- [ERC-1967 Standard](https://eips.ethereum.org/EIPS/eip-1967)
- [OpenZeppelin Proxy Docs](https://docs.openzeppelin.com/contracts/4.x/api/proxy)

## Quick Reference

```bash
# Automated verification (recommended)
export FACTORY_ADDRESS=0x...
export ETHERSCAN_API_KEY=your_key
./scripts/verify-contracts.sh sepolia

# Get implementation address
cast call $FACTORY_ADDRESS "IMPLEMENTATION()(address)" --rpc-url sepolia

# Check verification status
open https://sepolia.etherscan.io/address/$FACTORY_ADDRESS#code
```

---

**Need help?** Check the troubleshooting section or open an issue on GitHub.

