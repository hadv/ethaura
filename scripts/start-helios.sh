#!/bin/bash

# Start Helios Light Client for EthAura
# This script starts a local Helios RPC endpoint that provides trustless access to Ethereum

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default network
NETWORK="${1:-sepolia}"

echo -e "${GREEN}Starting Helios Light Client for ${NETWORK}...${NC}"

# Check if Helios is installed
if ! command -v helios &> /dev/null; then
    echo -e "${RED}Helios is not installed!${NC}"
    echo -e "${YELLOW}Installing Helios...${NC}"
    curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash
    source ~/.bashrc
    heliosup
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with your RPC URLs"
    exit 1
fi

# Check if RPC URL is set
if [ "$NETWORK" = "sepolia" ] && [ -z "$SEPOLIA_RPC_URL" ]; then
    echo -e "${RED}Error: SEPOLIA_RPC_URL not set in .env${NC}"
    exit 1
fi

# Get latest checkpoint for the network
echo -e "${YELLOW}Fetching latest checkpoint for ${NETWORK}...${NC}"

case $NETWORK in
    sepolia)
        CHECKPOINT_URL="https://sepolia.beaconcha.in/api/v1/epoch/latest"
        CONSENSUS_RPC="https://ethereum-sepolia-beacon-api.publicnode.com"
        EXECUTION_RPC="$SEPOLIA_RPC_URL"
        ;;
    mainnet)
        CHECKPOINT_URL="https://beaconcha.in/api/v1/epoch/latest"
        CONSENSUS_RPC="https://www.lightclientdata.org"
        EXECUTION_RPC="${MAINNET_RPC_URL:-$SEPOLIA_RPC_URL}"
        ;;
    holesky)
        CHECKPOINT_URL="https://holesky.beaconcha.in/api/v1/epoch/latest"
        CONSENSUS_RPC="http://testing.holesky.beacon-api.nimbus.team"
        EXECUTION_RPC="${HOLESKY_RPC_URL:-$SEPOLIA_RPC_URL}"
        ;;
    *)
        echo -e "${RED}Unknown network: $NETWORK${NC}"
        echo "Supported networks: sepolia, mainnet, holesky"
        exit 1
        ;;
esac

# Create Helios config directory if it doesn't exist
mkdir -p ~/.helios

# Copy config file
if [ -f helios-config.toml ]; then
    cp helios-config.toml ~/.helios/helios.toml
    echo -e "${GREEN}Helios configuration copied to ~/.helios/helios.toml${NC}"
fi

# Start Helios
echo -e "${GREEN}Starting Helios on http://127.0.0.1:8545${NC}"
echo -e "${YELLOW}Network: ${NETWORK}${NC}"
echo -e "${YELLOW}Consensus RPC: ${CONSENSUS_RPC}${NC}"
echo -e "${YELLOW}Execution RPC: ${EXECUTION_RPC}${NC}"
echo ""
echo -e "${GREEN}Helios will provide a trustless, verified local RPC endpoint${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Run Helios with the specified network
helios ethereum \
    --network "$NETWORK" \
    --consensus-rpc "$CONSENSUS_RPC" \
    --execution-rpc "$EXECUTION_RPC" \
    --rpc-port 8545 \
    --rpc-bind-ip 127.0.0.1 \
    --load-external-fallback

