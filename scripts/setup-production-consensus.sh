#!/bin/bash

# Production Consensus Node Setup Script for EthAura
# This script sets up Nimbus consensus node for mainnet production on Linux

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EthAura Production Consensus Node Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}Error: This script is for Linux production environments only${NC}"
    echo -e "${YELLOW}For development on macOS, use public beacon APIs${NC}"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Install Nimbus beacon node"
echo "  2. Create system users (nimbus, helios)"
echo "  3. Set up systemd services"
echo "  4. Configure for mainnet production"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Get Alchemy API key
echo ""
echo -e "${YELLOW}Enter your Alchemy Mainnet API key:${NC}"
read -r ALCHEMY_API_KEY

if [ -z "$ALCHEMY_API_KEY" ]; then
    echo -e "${RED}Error: API key is required${NC}"
    exit 1
fi

# Get server IP
echo ""
echo -e "${YELLOW}Enter your server's public IP address:${NC}"
read -r SERVER_IP

if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}Error: Server IP is required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 1: Installing Nimbus...${NC}"

# Download Nimbus
cd /opt
wget -q https://github.com/status-im/nimbus-eth2/releases/download/v24.2.2/nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6.tar.gz
tar -xzf nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6.tar.gz
mv nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6 nimbus
ln -sf /opt/nimbus/build/nimbus_beacon_node /usr/local/bin/nimbus_beacon_node
rm nimbus-eth2_Linux_amd64_24.2.2_3cbbe1c6.tar.gz

echo -e "${GREEN}✓ Nimbus installed${NC}"

echo ""
echo -e "${BLUE}Step 2: Creating system users...${NC}"

# Create nimbus user
if ! id -u nimbus > /dev/null 2>&1; then
    useradd -m -s /bin/bash nimbus
    echo -e "${GREEN}✓ Created nimbus user${NC}"
else
    echo -e "${YELLOW}⚠ nimbus user already exists${NC}"
fi

# Create helios user
if ! id -u helios > /dev/null 2>&1; then
    useradd -m -s /bin/bash helios
    echo -e "${GREEN}✓ Created helios user${NC}"
else
    echo -e "${YELLOW}⚠ helios user already exists${NC}"
fi

echo ""
echo -e "${BLUE}Step 3: Creating directories...${NC}"

# Nimbus directories
mkdir -p /var/lib/nimbus/mainnet
mkdir -p /var/log/nimbus
chown -R nimbus:nimbus /var/lib/nimbus
chown -R nimbus:nimbus /var/log/nimbus

# Helios directories
mkdir -p /etc/helios
mkdir -p /home/helios/.helios

echo -e "${GREEN}✓ Directories created${NC}"

echo ""
echo -e "${BLUE}Step 4: Creating systemd services...${NC}"

# Create Nimbus service
cat > /etc/systemd/system/nimbus-mainnet.service << EOF
[Unit]
Description=Nimbus Beacon Node (Mainnet Production)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=nimbus
Group=nimbus

ExecStart=/usr/local/bin/nimbus_beacon_node \\
    --network=mainnet \\
    --data-dir=/var/lib/nimbus/mainnet \\
    --web3-url=none \\
    --rest \\
    --rest-port=5052 \\
    --rest-address=127.0.0.1 \\
    --log-level=INFO \\
    --log-file=/var/log/nimbus/mainnet.log \\
    --max-peers=100 \\
    --nat=extip:${SERVER_IP}

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

Restart=always
RestartSec=10
TimeoutStopSec=300

LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Created Nimbus service${NC}"

# Create Helios environment file
cat > /etc/helios/mainnet.env << EOF
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}
EOF

chown helios:helios /etc/helios/mainnet.env
chmod 600 /etc/helios/mainnet.env

echo -e "${GREEN}✓ Created Helios environment${NC}"

# Create Helios service
cat > /etc/systemd/system/helios-mainnet.service << EOF
[Unit]
Description=Helios Light Client (Mainnet Production)
After=network.target nimbus-mainnet.service
Requires=nimbus-mainnet.service

[Service]
Type=simple
User=helios
Group=helios

ExecStartPre=/bin/sleep 30

ExecStart=/home/helios/.helios/bin/helios ethereum \\
    --network mainnet \\
    --consensus-rpc http://127.0.0.1:5052 \\
    --execution-rpc \${MAINNET_RPC_URL} \\
    --rpc-port 8545 \\
    --rpc-bind-ip 127.0.0.1

EnvironmentFile=/etc/helios/mainnet.env

NoNewPrivileges=true
PrivateTmp=true

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Created Helios service${NC}"

echo ""
echo -e "${BLUE}Step 5: Creating health check script...${NC}"

cat > /usr/local/bin/check-consensus-health.sh << 'EOF'
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Nimbus Consensus Node Health Check ==="
echo ""

if systemctl is-active --quiet nimbus-mainnet; then
    echo -e "${GREEN}✓ Service Status: Running${NC}"
else
    echo -e "${RED}✗ Service Status: Not Running${NC}"
    exit 1
fi

if curl -s http://127.0.0.1:5052/eth/v1/node/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Health: OK${NC}"
else
    echo -e "${RED}✗ API Health: Failed${NC}"
    exit 1
fi

SYNC_STATUS=$(curl -s http://127.0.0.1:5052/eth/v1/node/syncing | jq -r '.data.is_syncing')
if [ "$SYNC_STATUS" = "false" ]; then
    echo -e "${GREEN}✓ Sync Status: Synced${NC}"
else
    echo -e "${YELLOW}⚠ Sync Status: Syncing...${NC}"
fi

PEER_COUNT=$(curl -s http://127.0.0.1:5052/eth/v1/node/peer_count | jq -r '.data.connected')
echo "Peers: ${PEER_COUNT}"

echo ""
echo "=== Helios Light Client Health Check ==="
echo ""

if systemctl is-active --quiet helios-mainnet; then
    echo -e "${GREEN}✓ Helios Service: Running${NC}"
else
    echo -e "${YELLOW}⚠ Helios Service: Not Running (start after Nimbus syncs)${NC}"
fi

echo ""
EOF

chmod +x /usr/local/bin/check-consensus-health.sh

echo -e "${GREEN}✓ Health check script created${NC}"

echo ""
echo -e "${BLUE}Step 6: Configuring firewall...${NC}"

# Configure UFW if available
if command -v ufw &> /dev/null; then
    ufw allow 9000/tcp comment 'Nimbus P2P'
    ufw allow 9000/udp comment 'Nimbus P2P'
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not found, please manually allow port 9000${NC}"
fi

echo ""
echo -e "${BLUE}Step 7: Enabling services...${NC}"

systemctl daemon-reload
systemctl enable nimbus-mainnet
echo -e "${GREEN}✓ Nimbus service enabled${NC}"

systemctl enable helios-mainnet
echo -e "${GREEN}✓ Helios service enabled${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Start Nimbus and wait for sync (4-8 hours):"
echo "   ${BLUE}sudo systemctl start nimbus-mainnet${NC}"
echo "   ${BLUE}sudo journalctl -u nimbus-mainnet -f${NC}"
echo ""
echo "2. Check sync status:"
echo "   ${BLUE}curl http://127.0.0.1:5052/eth/v1/node/syncing | jq${NC}"
echo ""
echo "3. Once synced, install Helios:"
echo "   ${BLUE}sudo -u helios bash${NC}"
echo "   ${BLUE}curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash${NC}"
echo "   ${BLUE}source ~/.bashrc${NC}"
echo "   ${BLUE}heliosup${NC}"
echo "   ${BLUE}exit${NC}"
echo ""
echo "4. Start Helios:"
echo "   ${BLUE}sudo systemctl start helios-mainnet${NC}"
echo ""
echo "5. Run health check:"
echo "   ${BLUE}/usr/local/bin/check-consensus-health.sh${NC}"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  See docs/CONSENSUS_NODE_SETUP.md for detailed information"
echo ""

