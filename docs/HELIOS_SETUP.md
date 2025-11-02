# Helios Light Client Setup for ΞTHΛURΛ

## Overview

Helios is a trustless, efficient Ethereum light client that converts an untrusted centralized RPC endpoint into a safe, unmanipulable local RPC. This guide explains how to integrate Helios with ΞTHΛURΛ for enhanced security and decentralization.

## Why Use Helios?

### Benefits

1. **Trustless Verification**: Helios cryptographically verifies all data from the RPC provider
2. **Security**: Protects against malicious or compromised RPC providers
3. **Privacy**: Reduces reliance on centralized infrastructure
4. **Fast Sync**: Syncs in seconds using light client protocol
5. **Lightweight**: Minimal storage and resource requirements
6. **Local RPC**: Provides a local JSON-RPC endpoint at `http://127.0.0.1:8545`

### How It Works

```
Untrusted RPC Provider → Helios Light Client → Verified Local RPC → Your DApp
     (Alchemy, Infura)      (Cryptographic        (127.0.0.1:8545)   (ΞTHΛURΛ)
                             Verification)
```

Helios uses Ethereum's consensus layer to verify execution layer data, ensuring that all responses from the RPC provider are cryptographically correct.

## Installation

### Option 1: Using heliosup (Recommended)

```bash
# Install heliosup (Helios installer)
curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash

# Reload your shell
source ~/.bashrc  # or source ~/.zshrc

# Install Helios
heliosup
```

### Option 2: Using Cargo

```bash
# Install from source
cargo install helios --locked
```

### Verify Installation

```bash
helios --version
# Should output: cli 0.5.1 (or later)
```

## Configuration

### 1. Configure Environment Variables

Edit your `.env` file:

```bash
# Your existing RPC provider (will be verified by Helios)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Optional: Mainnet RPC
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### 2. Configure Helios

The project includes a `helios-config.toml` file with pre-configured settings for:
- Sepolia Testnet (development)
- Ethereum Mainnet (production)
- Holesky Testnet (alternative)

You can customize this file or use command-line options.

### 3. Update Checkpoints

Checkpoints are the root of trust in Helios. They should be updated periodically (recommended: every 2 weeks).

#### Get Latest Checkpoint for Sepolia

1. Visit https://sepolia.beaconcha.in
2. Find the latest finalized epoch
3. Click on the first slot of that epoch
4. Copy the "Block Root" value
5. Update in `helios-config.toml` or use with `--checkpoint` flag

#### Get Latest Checkpoint for Mainnet

1. Visit https://beaconcha.in
2. Follow the same process as above

#### Using the Update Script

```bash
# Get instructions for updating checkpoint
./scripts/update-checkpoint.sh sepolia
```

## Usage

### Quick Start

Start Helios for Sepolia testnet:

```bash
# Make the script executable
chmod +x scripts/start-helios.sh

# Start Helios
./scripts/start-helios.sh sepolia
```

This will:
1. Check if Helios is installed
2. Load your RPC configuration from `.env`
3. Start a local RPC server at `http://127.0.0.1:8545`
4. Verify all data from your RPC provider

### Manual Start

You can also start Helios manually with custom options:

```bash
# Sepolia with auto-checkpoint fallback
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

### Using Helios with ΞTHΛURΛ

Once Helios is running, update your configuration to use the local RPC:

#### For Foundry (Smart Contracts)

Update `.env`:
```bash
SEPOLIA_RPC_URL=http://127.0.0.1:8545
```

Then deploy as usual:
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast
```

#### For Frontend

Update `frontend/.env`:
```bash
VITE_RPC_URL=http://127.0.0.1:8545
```

**Note**: The frontend will need to run on the same machine as Helios, or you'll need to configure Helios to accept remote connections:

```bash
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --rpc-bind-ip 0.0.0.0  # Allow remote access (use with caution)
```

## Advanced Configuration

### Custom RPC Port

```bash
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --rpc-port 8546  # Use port 8546 instead of 8545
```

### Data Directory

Helios caches checkpoints for faster startup:

```bash
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --data-dir ~/.helios/sepolia
```

### Strict Checkpoint Age

Enable strict checking (errors if checkpoint is > 2 weeks old):

```bash
helios ethereum \
    --network sepolia \
    --execution-rpc $SEPOLIA_RPC_URL \
    --strict-checkpoint-age
```

### Using Configuration File

Create or edit `~/.helios/helios.toml`:

```toml
[sepolia]
consensus_rpc = "https://ethereum-sepolia-beacon-api.publicnode.com"
execution_rpc = "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
checkpoint = "0x..."
rpc_port = 8545
rpc_bind_ip = "127.0.0.1"
```

Then start with just:
```bash
helios ethereum --network sepolia
```

## Troubleshooting

### Checkpoint Too Old

**Error**: "Checkpoint is too old"

**Solution**: Update your checkpoint using the latest finalized epoch from beaconcha.in

```bash
# Use automatic fallback
helios ethereum --network sepolia --execution-rpc $SEPOLIA_RPC_URL --load-external-fallback
```

### RPC Connection Failed

**Error**: "Failed to connect to execution RPC"

**Solution**: 
1. Verify your RPC URL is correct in `.env`
2. Check that your RPC provider supports `eth_getProof` endpoint
3. Ensure you have a valid API key

### Sync Issues

**Error**: "Failed to sync"

**Solution**:
1. Check your internet connection
2. Try a different consensus RPC endpoint
3. Verify the checkpoint is valid

### Port Already in Use

**Error**: "Address already in use"

**Solution**: Either stop the existing process on port 8545 or use a different port:

```bash
helios ethereum --network sepolia --execution-rpc $SEPOLIA_RPC_URL --rpc-port 8546
```

## Best Practices

1. **Update Checkpoints Regularly**: Update every 1-2 weeks for optimal security
2. **Use Reliable Consensus RPC**: Choose a stable consensus layer endpoint
3. **Monitor Helios Logs**: Watch for warnings or errors
4. **Backup Configuration**: Keep your `helios-config.toml` backed up
5. **Test Before Production**: Always test with Sepolia before using on mainnet

## Integration with ΞTHΛURΛ Workflow

### Development Workflow

```bash
# Terminal 1: Start Helios
./scripts/start-helios.sh sepolia

# Terminal 2: Deploy contracts
make deploy-sepolia

# Terminal 3: Run frontend
cd frontend && npm run dev
```

### Production Workflow

```bash
# Start Helios for mainnet
./scripts/start-helios.sh mainnet

# Deploy to mainnet (use with caution!)
make deploy-mainnet
```

## Supported Networks

| Network | Chain ID | Consensus RPC | Checkpoint Source |
|---------|----------|---------------|-------------------|
| Sepolia | 11155111 | https://ethereum-sepolia-beacon-api.publicnode.com | https://sepolia.beaconcha.in |
| Mainnet | 1 | https://www.lightclientdata.org | https://beaconcha.in |
| Holesky | 17000 | http://testing.holesky.beacon-api.nimbus.team | https://holesky.beaconcha.in |

## Resources

- [Helios GitHub](https://github.com/a16z/helios)
- [Helios Documentation](https://helios.a16zcrypto.com/)
- [Ethereum Light Client Spec](https://github.com/ethereum/consensus-specs/tree/dev/specs/altair/light-client)
- [Beacon Chain Explorer (Mainnet)](https://beaconcha.in)
- [Beacon Chain Explorer (Sepolia)](https://sepolia.beaconcha.in)

## Security Considerations

1. **Checkpoint Trust**: The initial checkpoint is the root of trust. Always verify it from multiple sources
2. **Consensus RPC**: While Helios verifies data, use reputable consensus RPC providers
3. **Network Security**: When exposing Helios RPC (`--rpc-bind-ip 0.0.0.0`), use proper firewall rules
4. **Regular Updates**: Keep Helios updated to the latest version

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
A: Minimal - Helios adds cryptographic verification but syncs in seconds.

