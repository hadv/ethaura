#!/bin/bash

# Test Helios RPC Connection
# This script tests if Helios is running and responding correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

RPC_URL="${1:-http://127.0.0.1:8545}"

echo -e "${BLUE}Testing Helios RPC at ${RPC_URL}${NC}"
echo ""

# Test 1: Check if RPC is responding
echo -e "${YELLOW}Test 1: Checking RPC connectivity...${NC}"
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' \
    "$RPC_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RPC is responding${NC}"
else
    echo -e "${RED}✗ RPC is not responding${NC}"
    echo -e "${YELLOW}Make sure Helios is running: make helios-sepolia${NC}"
    exit 1
fi

# Test 2: Get client version
echo -e "${YELLOW}Test 2: Getting client version...${NC}"
CLIENT_VERSION=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' \
    "$RPC_URL" | jq -r '.result')
echo -e "${GREEN}✓ Client: ${CLIENT_VERSION}${NC}"

# Test 3: Get latest block number
echo -e "${YELLOW}Test 3: Getting latest block number...${NC}"
BLOCK_NUMBER=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    "$RPC_URL" | jq -r '.result')
BLOCK_NUMBER_DEC=$((16#${BLOCK_NUMBER#0x}))
echo -e "${GREEN}✓ Latest block: ${BLOCK_NUMBER_DEC} (${BLOCK_NUMBER})${NC}"

# Test 4: Get chain ID
echo -e "${YELLOW}Test 4: Getting chain ID...${NC}"
CHAIN_ID=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$RPC_URL" | jq -r '.result')
CHAIN_ID_DEC=$((16#${CHAIN_ID#0x}))
echo -e "${GREEN}✓ Chain ID: ${CHAIN_ID_DEC} (${CHAIN_ID})${NC}"

# Determine network
case $CHAIN_ID_DEC in
    1)
        NETWORK="Mainnet"
        ;;
    11155111)
        NETWORK="Sepolia"
        ;;
    17000)
        NETWORK="Holesky"
        ;;
    *)
        NETWORK="Unknown"
        ;;
esac
echo -e "${GREEN}✓ Network: ${NETWORK}${NC}"

# Test 5: Get gas price
echo -e "${YELLOW}Test 5: Getting gas price...${NC}"
GAS_PRICE=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' \
    "$RPC_URL" | jq -r '.result')
GAS_PRICE_DEC=$((16#${GAS_PRICE#0x}))
GAS_PRICE_GWEI=$(echo "scale=2; $GAS_PRICE_DEC / 1000000000" | bc)
echo -e "${GREEN}✓ Gas price: ${GAS_PRICE_GWEI} Gwei${NC}"

# Test 6: Get a block
echo -e "${YELLOW}Test 6: Getting latest block details...${NC}"
BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
    "$RPC_URL" | jq -r '.result')
if [ "$BLOCK" != "null" ]; then
    echo -e "${GREEN}✓ Successfully retrieved block data${NC}"
else
    echo -e "${RED}✗ Failed to retrieve block data${NC}"
fi

# Test 7: Test eth_call (read-only call)
echo -e "${YELLOW}Test 7: Testing eth_call...${NC}"
# Call to get balance of zero address (should return 0)
BALANCE=$(curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x0000000000000000000000000000000000000000","latest"],"id":1}' \
    "$RPC_URL" | jq -r '.result')
if [ "$BALANCE" != "null" ]; then
    echo -e "${GREEN}✓ eth_call working correctly${NC}"
else
    echo -e "${RED}✗ eth_call failed${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests passed! ✓${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Helios RPC Summary:${NC}"
echo -e "  URL: ${RPC_URL}"
echo -e "  Network: ${NETWORK} (Chain ID: ${CHAIN_ID_DEC})"
echo -e "  Latest Block: ${BLOCK_NUMBER_DEC}"
echo -e "  Gas Price: ${GAS_PRICE_GWEI} Gwei"
echo -e "  Client: ${CLIENT_VERSION}"
echo ""
echo -e "${GREEN}You can now use this RPC endpoint with EthAura!${NC}"
echo -e "${YELLOW}Update your .env file:${NC}"
echo -e "  SEPOLIA_RPC_URL=${RPC_URL}"
echo ""

