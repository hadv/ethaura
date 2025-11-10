#!/bin/bash

# Script to verify all contracts on Etherscan after deployment
# Usage: ./scripts/verify-contracts.sh <network>
# Example: ./scripts/verify-contracts.sh sepolia

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${1:-sepolia}
COMPILER_VERSION="v0.8.23"
OPTIMIZER_RUNS=200

# Network-specific settings
case $NETWORK in
  sepolia)
    CHAIN_ID=11155111
    ENTRYPOINT="0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    ;;
  mainnet)
    CHAIN_ID=1
    ENTRYPOINT="0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    ;;
  *)
    echo -e "${RED}Error: Unsupported network '$NETWORK'${NC}"
    echo "Supported networks: sepolia, mainnet"
    exit 1
    ;;
esac

echo -e "${GREEN}=== EthAura Contract Verification ===${NC}"
echo "Network: $NETWORK (Chain ID: $CHAIN_ID)"
echo ""

# Check required environment variables
if [ -z "$FACTORY_ADDRESS" ]; then
  echo -e "${RED}Error: FACTORY_ADDRESS environment variable not set${NC}"
  echo "Please set it with: export FACTORY_ADDRESS=0x..."
  exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
  echo -e "${RED}Error: ETHERSCAN_API_KEY environment variable not set${NC}"
  echo "Please set it with: export ETHERSCAN_API_KEY=your_api_key"
  exit 1
fi

echo -e "${YELLOW}Factory Address: $FACTORY_ADDRESS${NC}"
echo ""

# Get implementation address from factory
echo "Fetching implementation address from factory..."
IMPLEMENTATION_ADDRESS=$(cast call $FACTORY_ADDRESS "IMPLEMENTATION()(address)" --rpc-url $NETWORK)
echo -e "${YELLOW}Implementation Address: $IMPLEMENTATION_ADDRESS${NC}"
echo ""

# Prepare constructor args
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address)" $ENTRYPOINT)

# Function to verify contract
verify_contract() {
  local name=$1
  local address=$2
  local contract_path=$3
  local constructor_args=$4
  
  echo -e "${GREEN}=== Verifying $name ===${NC}"
  echo "Address: $address"
  echo "Contract: $contract_path"
  echo ""
  
  forge verify-contract \
    --chain-id $CHAIN_ID \
    --num-of-optimizations $OPTIMIZER_RUNS \
    --watch \
    --constructor-args $constructor_args \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --compiler-version $COMPILER_VERSION \
    $address \
    $contract_path
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $name verified successfully!${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}✗ $name verification failed${NC}"
    echo ""
    return 1
  fi
}

# Verify Factory
echo -e "${YELLOW}Step 1/2: Verifying Factory Contract${NC}"
echo ""
verify_contract \
  "P256AccountFactory" \
  $FACTORY_ADDRESS \
  "src/P256AccountFactory.sol:P256AccountFactory" \
  $CONSTRUCTOR_ARGS

FACTORY_STATUS=$?

# Wait a bit to avoid rate limiting
sleep 3

# Verify Implementation
echo -e "${YELLOW}Step 2/2: Verifying Implementation Contract${NC}"
echo ""
verify_contract \
  "P256Account Implementation" \
  $IMPLEMENTATION_ADDRESS \
  "src/P256Account.sol:P256Account" \
  $CONSTRUCTOR_ARGS

IMPLEMENTATION_STATUS=$?

# Summary
echo ""
echo -e "${GREEN}=== Verification Summary ===${NC}"
echo ""

if [ $FACTORY_STATUS -eq 0 ]; then
  echo -e "${GREEN}✓ Factory verified${NC}"
else
  echo -e "${RED}✗ Factory verification failed${NC}"
fi

if [ $IMPLEMENTATION_STATUS -eq 0 ]; then
  echo -e "${GREEN}✓ Implementation verified${NC}"
else
  echo -e "${RED}✗ Implementation verification failed${NC}"
fi

echo ""
echo -e "${GREEN}=== Etherscan Links ===${NC}"
echo ""

case $NETWORK in
  sepolia)
    EXPLORER="https://sepolia.etherscan.io"
    ;;
  mainnet)
    EXPLORER="https://etherscan.io"
    ;;
esac

echo "Factory: $EXPLORER/address/$FACTORY_ADDRESS#code"
echo "Implementation: $EXPLORER/address/$IMPLEMENTATION_ADDRESS#code"
echo ""

# Proxy verification note
echo -e "${YELLOW}=== Note on Proxy Verification ===${NC}"
echo ""
echo "ERC-1967 proxies are automatically recognized by Etherscan."
echo "Once the implementation is verified, proxy accounts will show:"
echo "  - 'Read as Proxy' tab"
echo "  - 'Write as Proxy' tab"
echo "  - Link to implementation contract"
echo ""
echo "No manual proxy verification needed! 🎉"
echo ""

# Exit with error if any verification failed
if [ $FACTORY_STATUS -ne 0 ] || [ $IMPLEMENTATION_STATUS -ne 0 ]; then
  echo -e "${RED}Some verifications failed. Please check the errors above.${NC}"
  exit 1
fi

echo -e "${GREEN}All contracts verified successfully! ✓${NC}"

