# Running Your Own Consensus Node for Helios (Mainnet Production)

> **Note**: This guide is for **mainnet production environments on Linux**. For development on Sepolia, using public beacon APIs is sufficient.

## Why Run Your Own Consensus Node for Production?

When you run your own consensus (beacon chain) node in production, you:
- ✅ **Eliminate trust** in third-party beacon APIs
- ✅ **Improve reliability** - no dependency on external services
- ✅ **Enhance privacy** - no data leakage to third parties
- ✅ **Support the network** - contribute to Ethereum decentralization
- ✅ **Get maximum security** with Helios for production workloads

## Can You Run Consensus Without Execution?

**Yes!** A consensus node does NOT require an execution node. This is a common misconception.

**For Production**: Run your own consensus node + use Alchemy/Infura for execution (Helios verifies it)
**For Development**: Use public beacon APIs (like `https://www.lightclientdata.org`)

### What You Need

- **Consensus Node**: Beacon chain client (Lighthouse, Nimbus, Prysm, Teku, Lodestar)
- **Execution RPC**: Can use Alchemy/Infura (Helios will verify it)
- **Storage**: ~100-200 GB (vs ~1 TB for full execution node)
- **Sync Time**: Hours (vs days for execution node)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Setup                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────────┐             │
│  │   ΞTHΛURΛ    │────────▶│     Helios       │             │
│  │     App      │         │  (Light Client)  │             │
│  └──────────────┘         └────────┬─────────┘             │
│                                    │                         │
│                           ┌────────┴────────┐               │
│                           │                 │               │
│                           ▼                 ▼               │
│                  ┌─────────────┐   ┌─────────────┐         │
│                  │  YOUR OWN   │   │  Alchemy/   │         │
│                  │  Consensus  │   │  Infura     │         │
│                  │    Node     │   │ (Execution) │         │
│                  │ (Nimbus/    │   └─────────────┘         │
│                  │ Lighthouse) │                            │
│                  └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Ethereum     │
                  │     Network     │
                  └─────────────────┘
```

## Recommended: Nimbus for Production

Nimbus is the best choice for production alongside Helios because:
- 🪶 **Lightweight** - Low resource usage (~4 GB RAM)
- ⚡ **Fast** - Quick sync times (4-8 hours for mainnet)
- 🔌 **Light Client API** - Built-in support
- 🐳 **Production-ready** - Stable and well-tested
- 🔒 **Secure** - Written in Nim with memory safety

## Production Installation Guide (Linux)

### Install Nimbus on Linux

```bash
# Download latest Nimbus release
cd /opt
sudo wget https://github.com/status-im/nimbus-eth2/releases/download/v24.2.2/nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6.tar.gz

# Extract
sudo tar -xzf nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6.tar.gz
sudo mv nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6 nimbus

# Create symlink
sudo ln -s /opt/nimbus/build/nimbus_beacon_node /usr/local/bin/nimbus_beacon_node

# Verify installation
nimbus_beacon_node --version
```

### Create Nimbus User (Security Best Practice)

```bash
# Create dedicated user for Nimbus
sudo useradd -m -s /bin/bash nimbus

# Create data directory
sudo mkdir -p /var/lib/nimbus/mainnet
sudo chown -R nimbus:nimbus /var/lib/nimbus

# Create log directory
sudo mkdir -p /var/log/nimbus
sudo chown -R nimbus:nimbus /var/log/nimbus
```

### Run Nimbus for Mainnet (Production)

```bash
# Test run (as nimbus user)
sudo -u nimbus nimbus_beacon_node \
    --network=mainnet \
    --data-dir=/var/lib/nimbus/mainnet \
    --web3-url=none \
    --rest \
    --rest-port=5052 \
    --rest-address=127.0.0.1 \
    --log-level=INFO \
    --log-file=/var/log/nimbus/mainnet.log
```

**Key flags for production:**
- `--network=mainnet` - Ethereum mainnet
- `--data-dir=/var/lib/nimbus/mainnet` - Data directory
- `--web3-url=none` - **No execution node needed!**
- `--rest` - Enable REST API (for Helios)
- `--rest-port=5052` - API port
- `--rest-address=127.0.0.1` - Bind to localhost only
- `--log-level=INFO` - Production logging
- `--log-file=/var/log/nimbus/mainnet.log` - Log to file

### Alternative: Lighthouse (More Resource Intensive)

If you prefer Lighthouse:

```bash
# Install Lighthouse on Linux
cd /opt
sudo wget https://github.com/sigp/lighthouse/releases/download/v5.1.3/lighthouse-v5.1.3-x86_64-unknown-linux-gnu.tar.gz
sudo tar -xzf lighthouse-v5.1.3-x86_64-unknown-linux-gnu.tar.gz
sudo mv lighthouse /usr/local/bin/

# Run for mainnet
lighthouse beacon_node \
    --network mainnet \
    --datadir /var/lib/lighthouse/mainnet \
    --http \
    --http-port 5052 \
    --http-address 127.0.0.1 \
    --disable-deposit-contract-sync
```

**Note**: Lighthouse requires more resources (~8 GB RAM vs ~4 GB for Nimbus)

## Using Your Consensus Node with Helios (Production)

Once your consensus node is synced, configure Helios to use it:

### Update .env for Production

```bash
# .env (production)
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Your local consensus node
CONSENSUS_RPC_URL=http://127.0.0.1:5052
```

### Start Helios for Production

```bash
helios ethereum \
    --network mainnet \
    --consensus-rpc http://127.0.0.1:5052 \
    --execution-rpc $MAINNET_RPC_URL
```

### Update helios-config.toml for Production

```toml
[mainnet]
# Your local consensus node (maximum security)
consensus_rpc = "http://127.0.0.1:5052"

# Still use Alchemy for execution (Helios will verify it)
execution_rpc = "${MAINNET_RPC_URL}"

# Get latest checkpoint from https://beaconcha.in
checkpoint = "0x85e6151a246e8fdba36db27a0c7678a575346272fe978c9281e13a8b26cdfa68"

rpc_port = 8545
rpc_bind_ip = "127.0.0.1"
data_dir = "~/.helios/mainnet"
```

### For Development (Sepolia)

For development, you can use public beacon APIs:

```toml
[sepolia]
# Public beacon API (sufficient for development)
consensus_rpc = "https://ethereum-sepolia-beacon-api.publicnode.com"

execution_rpc = "${SEPOLIA_RPC_URL}"
checkpoint = "0x..."
rpc_port = 8545
rpc_bind_ip = "127.0.0.1"
data_dir = "~/.helios/sepolia"
```

## Verification

### Check Consensus Node Status

```bash
# Nimbus
curl http://127.0.0.1:5052/eth/v1/node/health

# Check sync status
curl http://127.0.0.1:5052/eth/v1/node/syncing
```

### Test with Helios

```bash
# Start Helios with your local consensus node
helios ethereum \
    --network sepolia \
    --consensus-rpc http://127.0.0.1:5052 \
    --execution-rpc $SEPOLIA_RPC_URL

# In another terminal, test
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
```

## Resource Requirements (Production - Mainnet)

### Nimbus (Recommended for Production)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Storage** | 100 GB SSD | 200 GB NVMe SSD |
| **RAM** | 4 GB | 8 GB |
| **CPU** | 2 cores | 4 cores |
| **Network** | 10 Mbps | 25+ Mbps |
| **Sync Time** | 6-8 hours | 4-6 hours |

### Lighthouse (Alternative)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Storage** | 150 GB SSD | 250 GB NVMe SSD |
| **RAM** | 8 GB | 16 GB |
| **CPU** | 4 cores | 8 cores |
| **Network** | 10 Mbps | 25+ Mbps |
| **Sync Time** | 8-12 hours | 6-8 hours |

## Running as a Production Service (systemd)

### Create systemd Service for Nimbus Mainnet

Create `/etc/systemd/system/nimbus-mainnet.service`:

```ini
[Unit]
Description=Nimbus Beacon Node (Mainnet Production)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=nimbus
Group=nimbus

# Production settings
ExecStart=/usr/local/bin/nimbus_beacon_node \
    --network=mainnet \
    --data-dir=/var/lib/nimbus/mainnet \
    --web3-url=none \
    --rest \
    --rest-port=5052 \
    --rest-address=127.0.0.1 \
    --log-level=INFO \
    --log-file=/var/log/nimbus/mainnet.log \
    --max-peers=100 \
    --nat=extip:YOUR_SERVER_IP

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

# Restart policy
Restart=always
RestartSec=10
TimeoutStopSec=300

# Resource limits
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

**Important**: Replace `YOUR_SERVER_IP` with your server's public IP address.

### Enable and Start the Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable nimbus-mainnet

# Start service
sudo systemctl start nimbus-mainnet

# Check status
sudo systemctl status nimbus-mainnet

# View logs
sudo journalctl -u nimbus-mainnet -f
```

### Create Helios Service

Create `/etc/systemd/system/helios-mainnet.service`:

```ini
[Unit]
Description=Helios Light Client (Mainnet Production)
After=network.target nimbus-mainnet.service
Requires=nimbus-mainnet.service

[Service]
Type=simple
User=helios
Group=helios

# Wait for Nimbus to be ready
ExecStartPre=/bin/sleep 30

# Start Helios
ExecStart=/home/helios/.helios/bin/helios ethereum \
    --network mainnet \
    --consensus-rpc http://127.0.0.1:5052 \
    --execution-rpc ${MAINNET_RPC_URL} \
    --rpc-port 8545 \
    --rpc-bind-ip 127.0.0.1

# Environment file
EnvironmentFile=/etc/helios/mainnet.env

# Security
NoNewPrivileges=true
PrivateTmp=true

# Restart policy
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Create Helios User and Environment

```bash
# Create helios user
sudo useradd -m -s /bin/bash helios

# Create environment file
sudo mkdir -p /etc/helios
sudo bash -c 'cat > /etc/helios/mainnet.env << EOF
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
EOF'

sudo chown helios:helios /etc/helios/mainnet.env
sudo chmod 600 /etc/helios/mainnet.env

# Enable and start Helios
sudo systemctl daemon-reload
sudo systemctl enable helios-mainnet
sudo systemctl start helios-mainnet
sudo systemctl status helios-mainnet
```

## Benefits of This Production Setup

### Maximum Security for Production
```
Production App → Helios → Your Consensus Node (100% trusted)
                        → Alchemy (cryptographically verified)
```

- ✅ **Zero trust in third parties** for consensus data
- ✅ **Alchemy cannot manipulate data** - verified by your node
- ✅ **Full decentralization** - you control the verification
- ✅ **Production-grade reliability** - no dependency on external beacon APIs

### Cost Effective
- 💰 **No execution node needed** - saves ~1 TB storage + bandwidth
- 💰 **Still use Alchemy/Infura** - their free/paid tiers work
- 💰 **Modest VPS requirements** - $20-40/month for mainnet
- 💰 **Much cheaper than full node** - ~$200+/month for full node

### Privacy & Compliance
- 🔒 **No consensus data leakage** - your own node
- 🔒 **Execution queries verified** - can't be manipulated
- 🔒 **Better compliance** - reduced third-party dependencies
- 🔒 **Audit trail** - full control over verification logs

## Production Monitoring

### Health Check Script

Create `/usr/local/bin/check-consensus-health.sh`:

```bash
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Nimbus Consensus Node Health Check ==="
echo ""

# Check if service is running
if systemctl is-active --quiet nimbus-mainnet; then
    echo -e "${GREEN}✓ Service Status: Running${NC}"
else
    echo -e "${RED}✗ Service Status: Not Running${NC}"
    exit 1
fi

# Check API health
if curl -s http://127.0.0.1:5052/eth/v1/node/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Health: OK${NC}"
else
    echo -e "${RED}✗ API Health: Failed${NC}"
    exit 1
fi

# Check sync status
SYNC_STATUS=$(curl -s http://127.0.0.1:5052/eth/v1/node/syncing | jq -r '.data.is_syncing')
if [ "$SYNC_STATUS" = "false" ]; then
    echo -e "${GREEN}✓ Sync Status: Synced${NC}"
else
    echo -e "${YELLOW}⚠ Sync Status: Syncing...${NC}"
fi

# Check peer count
PEER_COUNT=$(curl -s http://127.0.0.1:5052/eth/v1/node/peer_count | jq -r '.data.connected')
echo -e "Peers: ${PEER_COUNT}"

if [ "$PEER_COUNT" -gt 50 ]; then
    echo -e "${GREEN}✓ Peer Count: Good${NC}"
elif [ "$PEER_COUNT" -gt 10 ]; then
    echo -e "${YELLOW}⚠ Peer Count: Low${NC}"
else
    echo -e "${RED}✗ Peer Count: Critical${NC}"
fi

# Check latest slot
LATEST_SLOT=$(curl -s http://127.0.0.1:5052/eth/v1/beacon/headers/head | jq -r '.data.header.message.slot')
echo -e "Latest Slot: ${LATEST_SLOT}"

echo ""
echo "=== Helios Light Client Health Check ==="
echo ""

# Check Helios service
if systemctl is-active --quiet helios-mainnet; then
    echo -e "${GREEN}✓ Helios Service: Running${NC}"
else
    echo -e "${RED}✗ Helios Service: Not Running${NC}"
    exit 1
fi

# Check Helios RPC
BLOCK_NUMBER=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://127.0.0.1:8545 | jq -r '.result')

if [ -n "$BLOCK_NUMBER" ] && [ "$BLOCK_NUMBER" != "null" ]; then
    BLOCK_DEC=$((16#${BLOCK_NUMBER#0x}))
    echo -e "${GREEN}✓ Helios RPC: OK (Block: ${BLOCK_DEC})${NC}"
else
    echo -e "${RED}✗ Helios RPC: Failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All checks passed!${NC}"
```

Make it executable:

```bash
sudo chmod +x /usr/local/bin/check-consensus-health.sh
```

Run health check:

```bash
sudo /usr/local/bin/check-consensus-health.sh
```

### Monitor Logs

```bash
# Nimbus logs
sudo journalctl -u nimbus-mainnet -f

# Helios logs
sudo journalctl -u helios-mainnet -f

# Both together
sudo journalctl -u nimbus-mainnet -u helios-mainnet -f

# Last 100 lines
sudo journalctl -u nimbus-mainnet -n 100

# Errors only
sudo journalctl -u nimbus-mainnet -p err
```

### Set Up Monitoring Cron Job

Add to crontab:

```bash
# Edit crontab
sudo crontab -e

# Add health check every 5 minutes
*/5 * * * * /usr/local/bin/check-consensus-health.sh >> /var/log/consensus-health.log 2>&1
```

## Production Troubleshooting

### Consensus Node Not Syncing

**Symptoms:**
- Sync status shows `is_syncing: true` for extended period
- Low or no peer connections
- Slot number not increasing

**Diagnosis:**
```bash
# Check sync status
curl http://127.0.0.1:5052/eth/v1/node/syncing | jq

# Check peers
curl http://127.0.0.1:5052/eth/v1/node/peer_count | jq

# Check logs
sudo journalctl -u nimbus-mainnet -n 100
```

**Solutions:**

1. **Firewall Configuration**
```bash
# Allow Nimbus P2P port (9000)
sudo ufw allow 9000/tcp
sudo ufw allow 9000/udp

# Verify
sudo ufw status
```

2. **Check Disk Space**
```bash
df -h /var/lib/nimbus
```

3. **Restart Service**
```bash
sudo systemctl restart nimbus-mainnet
sudo journalctl -u nimbus-mainnet -f
```

### Helios Can't Connect to Consensus Node

**Symptoms:**
- Helios fails to start
- Error: "Failed to connect to consensus RPC"

**Diagnosis:**
```bash
# Check if Nimbus is running
sudo systemctl status nimbus-mainnet

# Test API directly
curl http://127.0.0.1:5052/eth/v1/node/health

# Check if synced
curl http://127.0.0.1:5052/eth/v1/node/syncing | jq '.data.is_syncing'
```

**Solutions:**

1. **Wait for Sync**
```bash
# Nimbus must be fully synced before Helios can use it
# Check sync status
curl http://127.0.0.1:5052/eth/v1/node/syncing | jq
```

2. **Verify Port**
```bash
# Check if port 5052 is listening
sudo netstat -tlnp | grep 5052
```

3. **Check Helios Configuration**
```bash
# Verify consensus RPC URL
cat /etc/helios/mainnet.env
```

### High Memory Usage

**Symptoms:**
- Nimbus using more RAM than expected
- System becoming slow

**Solutions:**

1. **Check Current Usage**
```bash
# Memory usage
ps aux | grep nimbus_beacon_node

# System memory
free -h
```

2. **Adjust Max Peers** (reduces memory)
```bash
# Edit service file
sudo systemctl edit nimbus-mainnet

# Add:
[Service]
ExecStart=
ExecStart=/usr/local/bin/nimbus_beacon_node \
    --network=mainnet \
    --data-dir=/var/lib/nimbus/mainnet \
    --web3-url=none \
    --rest \
    --rest-port=5052 \
    --rest-address=127.0.0.1 \
    --max-peers=50

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart nimbus-mainnet
```

### Service Won't Start

**Diagnosis:**
```bash
# Check service status
sudo systemctl status nimbus-mainnet

# View full logs
sudo journalctl -u nimbus-mainnet -xe

# Check permissions
ls -la /var/lib/nimbus/mainnet
ls -la /var/log/nimbus
```

**Solutions:**

1. **Fix Permissions**
```bash
sudo chown -R nimbus:nimbus /var/lib/nimbus
sudo chown -R nimbus:nimbus /var/log/nimbus
```

2. **Check Binary**
```bash
which nimbus_beacon_node
nimbus_beacon_node --version
```

3. **Validate Configuration**
```bash
# Test run manually
sudo -u nimbus nimbus_beacon_node \
    --network=mainnet \
    --data-dir=/var/lib/nimbus/mainnet \
    --web3-url=none \
    --rest \
    --rest-port=5052
```

## Production Deployment Checklist

### Pre-Deployment

- [ ] Provision Linux server (4+ GB RAM, 200+ GB SSD)
- [ ] Configure firewall (allow port 9000 for P2P)
- [ ] Set up monitoring/alerting
- [ ] Obtain Alchemy/Infura API key for mainnet

### Installation

- [ ] Install Nimbus beacon node
- [ ] Create `nimbus` system user
- [ ] Set up data directories with correct permissions
- [ ] Install Helios light client
- [ ] Create `helios` system user

### Configuration

- [ ] Create systemd service for Nimbus
- [ ] Create systemd service for Helios
- [ ] Configure environment variables
- [ ] Set up log rotation
- [ ] Configure resource limits

### Testing

- [ ] Start Nimbus and wait for full sync (4-8 hours)
- [ ] Verify Nimbus API is accessible
- [ ] Start Helios with local consensus RPC
- [ ] Test Helios RPC endpoints
- [ ] Run health check script

### Production

- [ ] Enable services to start on boot
- [ ] Set up monitoring cron job
- [ ] Configure log aggregation (optional)
- [ ] Document recovery procedures
- [ ] Test failover scenarios

### Maintenance

- [ ] Schedule regular health checks
- [ ] Monitor disk space usage
- [ ] Keep Nimbus updated
- [ ] Keep Helios updated
- [ ] Review logs weekly

## Production Best Practices

### Security

1. **Run as dedicated users** - Never run as root
2. **Firewall configuration** - Only expose necessary ports
3. **Regular updates** - Keep software up to date
4. **Secure API keys** - Use environment files with restricted permissions
5. **Log monitoring** - Watch for suspicious activity

### Reliability

1. **Systemd services** - Auto-restart on failure
2. **Health monitoring** - Automated checks every 5 minutes
3. **Disk space alerts** - Monitor before running out
4. **Backup configuration** - Keep service files in version control
5. **Documentation** - Document your specific setup

### Performance

1. **SSD storage** - NVMe preferred for best performance
2. **Adequate RAM** - 8 GB recommended for mainnet
3. **Network bandwidth** - 25+ Mbps for optimal sync
4. **Peer limits** - Adjust based on available resources
5. **Log rotation** - Prevent logs from filling disk

## Cost Estimation (Monthly)

### VPS Hosting

| Provider | Specs | Cost | Notes |
|----------|-------|------|-------|
| **DigitalOcean** | 8 GB RAM, 200 GB SSD | $48/mo | Recommended |
| **Hetzner** | 8 GB RAM, 160 GB SSD | €20/mo (~$22) | Best value |
| **AWS EC2** | t3.large, 200 GB EBS | ~$80/mo | Enterprise |
| **Linode** | 8 GB RAM, 200 GB SSD | $48/mo | Good support |

### Additional Costs

- **Alchemy/Infura**: Free tier sufficient for most use cases
- **Monitoring**: Free (self-hosted) or $10-20/mo (DataDog, etc.)
- **Backups**: $5-10/mo (optional)

**Total**: $22-100/mo depending on provider

**vs Full Node**: $200-500/mo (requires ~2 TB storage + more CPU/RAM)

## Migration from Public Beacon API

If you're currently using public beacon APIs and want to migrate:

### Step 1: Set Up Your Node (Parallel)

```bash
# Install and sync Nimbus (don't change Helios yet)
# This takes 4-8 hours
```

### Step 2: Verify Sync

```bash
# Wait until fully synced
curl http://127.0.0.1:5052/eth/v1/node/syncing | jq '.data.is_syncing'
# Should return: false
```

### Step 3: Update Helios Configuration

```bash
# Update helios-config.toml
[mainnet]
consensus_rpc = "http://127.0.0.1:5052"  # Changed from public API
execution_rpc = "${MAINNET_RPC_URL}"
```

### Step 4: Restart Helios

```bash
sudo systemctl restart helios-mainnet
sudo journalctl -u helios-mainnet -f
```

### Step 5: Verify

```bash
# Run health check
/usr/local/bin/check-consensus-health.sh
```

## Resources

### Documentation

- [Nimbus Documentation](https://nimbus.guide/)
- [Lighthouse Documentation](https://lighthouse-book.sigmaprime.io/)
- [Ethereum Beacon Chain API](https://ethereum.github.io/beacon-APIs/)
- [Light Client Specification](https://github.com/ethereum/consensus-specs/tree/dev/specs/altair/light-client)

### Monitoring Tools

- [Beaconcha.in](https://beaconcha.in) - Beacon chain explorer
- [Etherscan](https://etherscan.io) - Execution layer explorer
- [Grafana](https://grafana.com/) - Metrics visualization (optional)

### Community

- [Nimbus Discord](https://discord.gg/qnjVyhatUa)
- [Helios Telegram](https://t.me/+IntDY_gZJSRkNTJj)
- [EthStaker Reddit](https://reddit.com/r/ethstaker)

---

## Summary

**For Production Mainnet:**
- ✅ Run your own Nimbus consensus node on Linux
- ✅ Use systemd for automatic restarts
- ✅ Monitor with automated health checks
- ✅ Cost: $22-48/month
- ✅ Security: Maximum (zero trust in third parties)

**For Development (Sepolia/Testnet):**
- ✅ Use public beacon APIs (sufficient)
- ✅ No additional infrastructure needed
- ✅ Cost: $0

**With your own consensus node + Helios in production, you get the security of a full node with a fraction of the cost and complexity!** 🚀

