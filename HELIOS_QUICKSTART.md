# Helios Quick Start Guide for ΞTHΛURΛ

Get started with Helios light client in 5 minutes!

## What is Helios?

Helios is a trustless Ethereum light client that verifies all RPC data cryptographically. It converts your untrusted RPC provider (like Alchemy or Infura) into a verified, trustless local RPC endpoint.

**Benefits:**
- 🔒 **Trustless**: Cryptographically verifies all data
- ⚡ **Fast**: Syncs in seconds
- 💾 **Lightweight**: Minimal storage required
- 🔐 **Secure**: Protects against malicious RPC providers
- 🌐 **Local**: Runs on `http://127.0.0.1:8545`

## Quick Start

### Step 1: Install Helios (1 minute)

```bash
# Install Helios
make helios-install

# Reload your shell
source ~/.bashrc  # or source ~/.zshrc

# Install Helios binary
heliosup

# Verify installation
helios --version
```

### Step 2: Configure Your RPC (30 seconds)

Make sure your `.env` file has your RPC URL:

```bash
# .env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

### Step 3: Start Helios (30 seconds)

```bash
# Start Helios for Sepolia testnet
make helios-sepolia
```

You should see:
```
Starting Helios Light Client for sepolia...
Helios will provide a trustless, verified local RPC endpoint
Network: sepolia
Consensus RPC: https://ethereum-sepolia-beacon-api.publicnode.com
Execution RPC: https://eth-sepolia.g.alchemy.com/v2/...

[INFO] Helios started successfully
[INFO] RPC server listening on http://127.0.0.1:8545
```

### Step 4: Test the Connection (30 seconds)

Open a new terminal and run:

```bash
# Test Helios RPC
make helios-test
```

Or manually:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
```

### Step 5: Use with ΞTHΛURΛ (1 minute)

#### Option A: Update .env to use Helios

```bash
# .env
SEPOLIA_RPC_URL=http://127.0.0.1:8545
```

#### Option B: Keep both (recommended for development)

```bash
# .env
# Centralized RPC (for when Helios is not running)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Helios local RPC (use when Helios is running)
# SEPOLIA_RPC_URL=http://127.0.0.1:8545
```

Now deploy contracts:

```bash
# Make sure Helios is running in another terminal
make deploy-sepolia
```

## Complete Workflow

### Terminal 1: Start Helios
```bash
make helios-sepolia
```

### Terminal 2: Deploy Contracts
```bash
make deploy-sepolia
```

### Terminal 3: Run Frontend
```bash
make frontend
```

## Common Commands

```bash
# Install Helios
make helios-install

# Start Helios for different networks
make helios-sepolia   # Sepolia testnet
make helios-mainnet   # Ethereum mainnet
make helios-holesky   # Holesky testnet

# Test Helios connection
make helios-test

# Update checkpoint (do this every 2 weeks)
make helios-checkpoint NETWORK=sepolia

# Stop Helios
# Press Ctrl+C in the terminal running Helios
```

## Manual Start (Advanced)

If you prefer manual control:

```bash
# Sepolia with automatic checkpoint fallback
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --consensus-rpc https://ethereum-sepolia-beacon-api.publicnode.com \
    --load-external-fallback

# Mainnet with specific checkpoint
helios ethereum \
    --network mainnet \
    --execution-rpc $MAINNET_RPC_URL \
    --consensus-rpc https://www.lightclientdata.org \
    --checkpoint 0x85e6151a246e8fdba36db27a0c7678a575346272fe978c9281e13a8b26cdfa68
```

## Troubleshooting

### "Checkpoint too old" error

**Solution**: Use automatic fallback:
```bash
./scripts/start-helios.sh sepolia
# This includes --load-external-fallback flag
```

Or get a fresh checkpoint:
1. Visit https://sepolia.beaconcha.in
2. Find the latest finalized epoch
3. Copy the block root of the first slot
4. Update in `helios-config.toml`

### "Port already in use" error

**Solution**: Stop the existing process or use a different port:
```bash
helios ethereum --network sepolia --execution-rpc $SEPOLIA_RPC_URL --rpc-port 8546
```

### "Failed to connect to execution RPC"

**Solution**: 
1. Check your RPC URL in `.env`
2. Verify your API key is valid
3. Ensure the RPC provider supports `eth_getProof`

### Helios not syncing

**Solution**:
1. Check internet connection
2. Try a different consensus RPC
3. Restart Helios with `--load-external-fallback`

## Configuration Files

### helios-config.toml
Pre-configured settings for all networks. Located in project root.

### ~/.helios/helios.toml
User-level configuration (created automatically).

### scripts/start-helios.sh
Convenient startup script with automatic configuration.

## Next Steps

1. **Read the full documentation**: See `docs/HELIOS_SETUP.md`
2. **Update checkpoints regularly**: Every 1-2 weeks for best security
3. **Monitor Helios logs**: Watch for any warnings or errors
4. **Test thoroughly**: Always test on Sepolia before mainnet

## Why Use Helios?

### Without Helios
```
Your App → Centralized RPC (Alchemy/Infura) → Ethereum
            ⚠️ Trust required
            ⚠️ Can be manipulated
            ⚠️ Single point of failure
```

### With Helios
```
Your App → Helios (Local) → Centralized RPC → Ethereum
            ✓ Cryptographically verified
            ✓ Trustless
            ✓ Secure
```

## Resources

- 📚 [Full Helios Setup Guide](docs/HELIOS_SETUP.md)
- 🔗 [Helios GitHub](https://github.com/a16z/helios)
- 🌐 [Helios Website](https://helios.a16zcrypto.com/)
- 📊 [Sepolia Beacon Chain](https://sepolia.beaconcha.in)
- 📊 [Mainnet Beacon Chain](https://beaconcha.in)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in the Helios terminal
3. Consult `docs/HELIOS_SETUP.md`
4. Open an issue on GitHub

---

**Happy building with trustless RPC! 🚀**

