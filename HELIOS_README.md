# 🌐 Helios Light Client Integration for ΞTHΛURΛ

## Quick Links

- 🚀 **[Quick Start Guide](HELIOS_QUICKSTART.md)** - Get started in 5 minutes
- 📚 **[Full Setup Guide](docs/HELIOS_SETUP.md)** - Comprehensive documentation
- 🏗️ **[Architecture](docs/HELIOS_ARCHITECTURE.md)** - Deep dive into how it works
- 📋 **[Integration Summary](HELIOS_INTEGRATION_SUMMARY.md)** - What was added

## What is Helios?

Helios is a **trustless Ethereum light client** that converts your untrusted RPC provider (like Alchemy or Infura) into a cryptographically verified, trustless local RPC endpoint.

### The Problem

When you use a centralized RPC provider:
- ⚠️ You must **trust** the provider
- ⚠️ Data can be **manipulated**
- ⚠️ **Privacy** concerns
- ⚠️ **Single point of failure**

### The Solution

Helios verifies all data cryptographically:
- ✅ **Trustless** - No need to trust the RPC provider
- ✅ **Secure** - Cryptographic proof of correctness
- ✅ **Fast** - Syncs in seconds
- ✅ **Lightweight** - Minimal storage required

## How It Works

```
┌─────────────┐
│ Your App    │
│  (ΞTHΛURΛ)  │
└──────┬──────┘
       │ RPC Call
       ▼
┌─────────────┐
│   Helios    │ ← Verifies all data cryptographically
│ (127.0.0.1) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Alchemy/    │ ← Untrusted provider
│ Infura      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Ethereum   │
└─────────────┘
```

## Quick Start

### 1. Install Helios (1 minute)

```bash
make helios-install
source ~/.bashrc  # or source ~/.zshrc
heliosup
```

### 2. Start Helios (30 seconds)

```bash
make helios-sepolia
```

### 3. Test Connection (30 seconds)

```bash
make helios-test
```

### 4. Use with ΞTHΛURΛ

Update your `.env`:
```bash
SEPOLIA_RPC_URL=http://127.0.0.1:8545
```

Deploy contracts:
```bash
make deploy-sepolia
```

## Available Commands

```bash
# Installation
make helios-install      # Install Helios

# Start Helios for different networks
make helios-sepolia      # Sepolia testnet
make helios-mainnet      # Ethereum mainnet
make helios-holesky      # Holesky testnet

# Testing
make helios-test         # Test RPC connection

# Maintenance
make helios-checkpoint   # Update checkpoint
```

## Manual Usage

### Start Helios Manually

```bash
# Sepolia with automatic checkpoint fallback
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --load-external-fallback

# Mainnet with specific checkpoint
helios ethereum \
    --network mainnet \
    --execution-rpc $MAINNET_RPC_URL \
    --checkpoint 0x85e6151a246e8fdba36db27a0c7678a575346272fe978c9281e13a8b26cdfa68
```

### Test RPC Connection

```bash
# Using curl
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545

# Using the test script
./scripts/test-helios.sh
```

## Configuration Files

### `helios-config.toml`
Pre-configured settings for all supported networks:
- Sepolia (development)
- Mainnet (production)
- Holesky (alternative testnet)

### `.env`
Environment variables for RPC URLs:
```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

## Helper Scripts

### `scripts/start-helios.sh`
Convenient startup script with automatic configuration:
```bash
./scripts/start-helios.sh sepolia
./scripts/start-helios.sh mainnet
```

### `scripts/test-helios.sh`
Comprehensive RPC testing:
```bash
./scripts/test-helios.sh
```

### `scripts/update-checkpoint.sh`
Checkpoint update helper:
```bash
./scripts/update-checkpoint.sh sepolia
```

## Complete Workflow

### Development Workflow

```bash
# Terminal 1: Start Helios
make helios-sepolia

# Terminal 2: Test connection
make helios-test

# Terminal 3: Deploy contracts
make deploy-sepolia

# Terminal 4: Run frontend
make frontend
```

## Supported Networks

| Network | Chain ID | Status | Checkpoint Source |
|---------|----------|--------|-------------------|
| Sepolia | 11155111 | ✅ Ready | [sepolia.beaconcha.in](https://sepolia.beaconcha.in) |
| Mainnet | 1 | ✅ Ready | [beaconcha.in](https://beaconcha.in) |
| Holesky | 17000 | ✅ Ready | [holesky.beaconcha.in](https://holesky.beaconcha.in) |

## Troubleshooting

### "Checkpoint too old" error

**Solution**: Use automatic fallback
```bash
./scripts/start-helios.sh sepolia
```

Or get a fresh checkpoint from [sepolia.beaconcha.in](https://sepolia.beaconcha.in)

### "Port already in use" error

**Solution**: Use a different port
```bash
helios ethereum --network sepolia --execution-rpc $SEPOLIA_RPC_URL --rpc-port 8546
```

### "Failed to connect to execution RPC"

**Solution**: 
1. Check your RPC URL in `.env`
2. Verify your API key is valid
3. Ensure the provider supports `eth_getProof`

## Benefits

### Security
- 🔒 Trustless verification of all RPC data
- 🛡️ Protection against malicious providers
- ✅ Cryptographic proof of correctness

### Performance
- ⚡ Fast sync (seconds, not hours)
- 💾 Minimal storage (< 1 MB)
- 🚀 Low resource usage

### Privacy
- 🔐 Reduced reliance on centralized providers
- 🌐 Local verification
- 🔒 No data leakage

### Developer Experience
- 🔄 Drop-in replacement for existing RPC
- 🎯 Same JSON-RPC interface
- 📚 Comprehensive documentation

## Maintenance

### Regular Tasks

1. **Update Checkpoints** (every 1-2 weeks)
   ```bash
   make helios-checkpoint NETWORK=sepolia
   ```

2. **Update Helios** (when new versions released)
   ```bash
   heliosup
   ```

3. **Monitor Logs**
   - Watch for warnings or errors
   - Check sync status
   - Verify block numbers

## Documentation

### Quick Start
- **[HELIOS_QUICKSTART.md](HELIOS_QUICKSTART.md)** - 5-minute setup guide

### Comprehensive Guides
- **[docs/HELIOS_SETUP.md](docs/HELIOS_SETUP.md)** - Full setup and configuration
- **[docs/HELIOS_ARCHITECTURE.md](docs/HELIOS_ARCHITECTURE.md)** - Architecture deep dive
- **[docs/CONSENSUS_NODE_SETUP.md](docs/CONSENSUS_NODE_SETUP.md)** - Run your own consensus node

### Reference
- **[HELIOS_INTEGRATION_SUMMARY.md](HELIOS_INTEGRATION_SUMMARY.md)** - What was added
- **[helios-config.toml](helios-config.toml)** - Configuration file

## External Resources

- 🔗 [Helios GitHub](https://github.com/a16z/helios)
- 🌐 [Helios Website](https://helios.a16zcrypto.com/)
- 📊 [Sepolia Beacon Chain](https://sepolia.beaconcha.in)
- 📊 [Mainnet Beacon Chain](https://beaconcha.in)
- 📚 [Light Client Spec](https://github.com/ethereum/consensus-specs/tree/dev/specs/altair/light-client)

## FAQ

**Q: Do I need to run a full node?**
A: No! Helios is a light client that requires minimal resources.

**Q: How much storage does Helios need?**
A: Very little - just 32 bytes per network for checkpoint caching.

**Q: Can I use Helios in production?**
A: Yes, but ensure you keep checkpoints updated and monitor the service.

**Q: Does Helios work with all RPC providers?**
A: It works with any provider that supports `eth_getProof` (Alchemy, Infura, etc.)

**Q: What's the performance impact?**
A: Minimal - Helios adds 10-50ms latency for cryptographic verification.

**Q: Is Helios secure?**
A: Yes, it provides cryptographic verification of all data. The checkpoint is the root of trust.

## Support

For issues or questions:
1. Check **[docs/HELIOS_SETUP.md](docs/HELIOS_SETUP.md)** for troubleshooting
2. Review **[HELIOS_QUICKSTART.md](HELIOS_QUICKSTART.md)** for quick fixes
3. Check [Helios GitHub Issues](https://github.com/a16z/helios/issues)
4. Open an issue in this repository

## Next Steps

1. ✅ **Install Helios**: `make helios-install`
2. ✅ **Start Helios**: `make helios-sepolia`
3. ✅ **Test Connection**: `make helios-test`
4. ✅ **Update .env**: Point to `http://127.0.0.1:8545`
5. ✅ **Deploy**: `make deploy-sepolia`

---

**Enjoy trustless RPC access with Helios! 🚀**

For detailed documentation, see:
- [Quick Start Guide](HELIOS_QUICKSTART.md)
- [Full Setup Guide](docs/HELIOS_SETUP.md)
- [Architecture Guide](docs/HELIOS_ARCHITECTURE.md)

