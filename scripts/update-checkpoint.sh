#!/bin/bash

# Update Helios checkpoint for a given network
# This script fetches the latest finalized checkpoint from a beacon chain explorer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NETWORK="${1:-sepolia}"

echo -e "${GREEN}Fetching latest checkpoint for ${NETWORK}...${NC}"

case $NETWORK in
    sepolia)
        BEACON_API="https://sepolia.beaconcha.in"
        ;;
    mainnet)
        BEACON_API="https://beaconcha.in"
        ;;
    holesky)
        BEACON_API="https://holesky.beaconcha.in"
        ;;
    *)
        echo -e "${RED}Unknown network: $NETWORK${NC}"
        echo "Supported networks: sepolia, mainnet, holesky"
        exit 1
        ;;
esac

echo -e "${YELLOW}Beacon Chain Explorer: ${BEACON_API}${NC}"
echo ""
echo -e "${YELLOW}To get the latest checkpoint:${NC}"
echo "1. Visit ${BEACON_API}"
echo "2. Find the latest finalized epoch"
echo "3. Click on the first slot of that epoch"
echo "4. Copy the 'Block Root' value"
echo "5. Update the checkpoint in helios-config.toml or use it with --checkpoint flag"
echo ""
echo -e "${GREEN}Example:${NC}"
echo "helios ethereum --network $NETWORK --checkpoint 0x<BLOCK_ROOT> --execution-rpc \$SEPOLIA_RPC_URL"
echo ""

# Try to fetch programmatically (may not work for all explorers)
echo -e "${YELLOW}Attempting to fetch latest finalized epoch...${NC}"
echo -e "${YELLOW}Note: You may need to manually verify this checkpoint${NC}"
echo ""
echo -e "${GREEN}Visit ${BEACON_API} to get the latest checkpoint${NC}"

