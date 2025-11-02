# ΞTHΛURΛ Production Setup Guide

## Overview

This guide explains the recommended setup for ΞTHΛURΛ in different environments:

- **Development (Sepolia)**: Use public beacon APIs
- **Production (Mainnet)**: Run your own consensus node on Linux

## Development Setup (Sepolia)

For development and testing, using public beacon APIs is sufficient and cost-effective.

### Quick Start

```bash
# 1. Install Helios
make helios-install
source ~/.bashrc
heliosup

# 2. Configure .env
echo "SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY" > .env

# 3. Start Helios (uses public beacon API)
make helios-sepolia

# 4. Test connection
make helios-test

# 5. Deploy contracts
make deploy-sepolia
```

### Configuration

The default `helios-config.toml` uses public beacon APIs for Sepolia:

```toml
[sepolia]
consensus_rpc = "https://ethereum-sepolia-beacon-api.publicnode.com"
execution_rpc = "${SEPOLIA_RPC_URL}"
```

**Cost**: $0 (uses free public APIs)

## Production Setup (Mainnet on Linux)

For production on mainnet, run your own consensus node for maximum security and reliability.

### Why Run Your Own Consensus Node?

| Aspect | Public Beacon API | Your Own Node |
|--------|-------------------|---------------|
| **Security** | Good | **Maximum** |
| **Trust** | Trust third party | **Trust yourself** |
| **Reliability** | Depends on others | **You control it** |
| **Privacy** | Moderate | **Excellent** |
| **Cost** | Free | $22-48/month |

### Automated Setup (Recommended)

```bash
# On your Linux production server
cd /path/to/ethaura
sudo make consensus-setup
```

This will:
1. Install Nimbus consensus node
2. Create system users (nimbus, helios)
3. Set up systemd services
4. Configure for mainnet
5. Set up monitoring

### Manual Setup

See detailed instructions in [docs/CONSENSUS_NODE_SETUP.md](docs/CONSENSUS_NODE_SETUP.md)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Production Server (Linux)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────────┐         │
│  │   ΞTHΛURΛ    │────────▶│     Helios       │         │
│  │     App      │         │  (Light Client)  │         │
│  └──────────────┘         └────────┬─────────┘         │
│                                    │                     │
│                           ┌────────┴────────┐           │
│                           │                 │           │
│                           ▼                 ▼           │
│                  ┌─────────────┐   ┌─────────────┐     │
│                  │   Nimbus    │   │  Alchemy    │     │
│                  │ Consensus   │   │ Execution   │     │
│                  │    Node     │   │     RPC     │     │
│                  │ (YOUR OWN)  │   │ (Verified)  │     │
│                  └─────────────┘   └─────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Configuration

Update `helios-config.toml` for production:

```toml
[mainnet]
# Use your local consensus node
consensus_rpc = "http://127.0.0.1:5052"

# Still use Alchemy for execution (Helios verifies it)
execution_rpc = "${MAINNET_RPC_URL}"

checkpoint = "0x..."
rpc_port = 8545
rpc_bind_ip = "127.0.0.1"
data_dir = "~/.helios/mainnet"
```

### Deployment Steps

1. **Provision Server**
   - Linux VPS (Ubuntu 22.04 recommended)
   - 8 GB RAM minimum
   - 200 GB SSD storage
   - 25+ Mbps network

2. **Run Setup Script**
   ```bash
   sudo make consensus-setup
   ```

3. **Start Nimbus and Wait for Sync**
   ```bash
   sudo systemctl start nimbus-mainnet
   sudo journalctl -u nimbus-mainnet -f
   ```
   
   Sync time: 4-8 hours

4. **Install Helios**
   ```bash
   sudo -u helios bash
   curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash
   source ~/.bashrc
   heliosup
   exit
   ```

5. **Start Helios**
   ```bash
   sudo systemctl start helios-mainnet
   ```

6. **Verify**
   ```bash
   /usr/local/bin/check-consensus-health.sh
   ```

### Monitoring

```bash
# Check Nimbus status
sudo systemctl status nimbus-mainnet

# Check Helios status
sudo systemctl status helios-mainnet

# View logs
sudo journalctl -u nimbus-mainnet -f
sudo journalctl -u helios-mainnet -f

# Run health check
/usr/local/bin/check-consensus-health.sh
```

### Maintenance

- **Update checkpoints**: Every 1-2 weeks
- **Update Nimbus**: When new versions released
- **Update Helios**: When new versions released
- **Monitor disk space**: Ensure adequate free space
- **Review logs**: Check for errors weekly

## Cost Comparison

### Development (Sepolia)

| Component | Cost |
|-----------|------|
| Helios | $0 |
| Public Beacon API | $0 |
| Alchemy Sepolia RPC | $0 (free tier) |
| **Total** | **$0/month** |

### Production (Mainnet)

#### Option 1: Public Beacon API (Not Recommended)

| Component | Cost |
|-----------|------|
| Helios | $0 |
| Public Beacon API | $0 |
| Alchemy Mainnet RPC | $0-50/month |
| **Total** | **$0-50/month** |
| **Security** | ⚠️ Moderate |

#### Option 2: Your Own Consensus Node (Recommended)

| Component | Cost |
|-----------|------|
| VPS (Hetzner) | $22/month |
| Helios | $0 |
| Alchemy Mainnet RPC | $0-50/month |
| **Total** | **$22-72/month** |
| **Security** | ✅ Maximum |

#### Option 3: Full Node (Overkill)

| Component | Cost |
|-----------|------|
| VPS (2 TB storage) | $200+/month |
| **Total** | **$200+/month** |
| **Security** | ✅ Maximum |

**Recommendation**: Option 2 (Own consensus node) provides maximum security at a fraction of the cost of a full node.

## Security Comparison

### Development (Sepolia)

```
App → Helios → Public Beacon API (trusted)
              → Alchemy (verified)
```

**Trust Level**: Medium (trust public beacon API)  
**Acceptable for**: Development, testing, staging

### Production Option 1 (Public Beacon API)

```
App → Helios → Public Beacon API (trusted)
              → Alchemy (verified)
```

**Trust Level**: Medium (trust public beacon API)  
**Acceptable for**: Low-value applications

### Production Option 2 (Own Consensus Node) ✅ Recommended

```
App → Helios → YOUR Consensus Node (100% trusted)
              → Alchemy (verified)
```

**Trust Level**: Maximum (trust only yourself)  
**Acceptable for**: Production, high-value applications

## Quick Reference

### Development Commands

```bash
# Start Helios for development
make helios-sepolia

# Test connection
make helios-test

# Deploy to Sepolia
make deploy-sepolia
```

### Production Commands

```bash
# Set up production consensus node (one-time)
sudo make consensus-setup

# Check status
sudo systemctl status nimbus-mainnet
sudo systemctl status helios-mainnet

# View logs
sudo journalctl -u nimbus-mainnet -f

# Health check
/usr/local/bin/check-consensus-health.sh
```

## Documentation

- **[HELIOS_QUICKSTART.md](HELIOS_QUICKSTART.md)** - 5-minute Helios setup
- **[docs/HELIOS_SETUP.md](docs/HELIOS_SETUP.md)** - Comprehensive Helios guide
- **[docs/CONSENSUS_NODE_SETUP.md](docs/CONSENSUS_NODE_SETUP.md)** - Production consensus node setup
- **[docs/HELIOS_ARCHITECTURE.md](docs/HELIOS_ARCHITECTURE.md)** - Architecture deep dive

## Support

For issues or questions:
1. Check documentation above
2. Review logs: `sudo journalctl -u nimbus-mainnet -f`
3. Run health check: `/usr/local/bin/check-consensus-health.sh`
4. Open an issue on GitHub

---

**Summary:**
- 🧪 **Development**: Use public beacon APIs (free, easy)
- 🚀 **Production**: Run your own consensus node (secure, reliable)
- 💰 **Cost**: $0 for dev, $22-72/month for production
- 🔒 **Security**: Maximum with your own consensus node

