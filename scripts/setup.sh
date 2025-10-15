#!/bin/bash

# EthAura Setup Script
# This script helps you set up the development environment

set -e

echo "🔐 EthAura - P256 Account Abstraction Setup"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Print colored message
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "ℹ $1"
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check Foundry
if command_exists forge; then
    FORGE_VERSION=$(forge --version | head -n 1)
    print_success "Foundry installed: $FORGE_VERSION"
else
    print_error "Foundry not found"
    print_info "Install from: https://getfoundry.sh/"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found"
    print_info "Install from: https://nodejs.org/"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: v$NPM_VERSION"
else
    print_error "npm not found"
    exit 1
fi

# Check git
if command_exists git; then
    GIT_VERSION=$(git --version)
    print_success "Git installed: $GIT_VERSION"
else
    print_error "Git not found"
    exit 1
fi

echo ""
echo "Installing dependencies..."
echo ""

# Install Foundry dependencies
print_info "Installing Foundry dependencies..."
forge install OpenZeppelin/openzeppelin-contracts --no-commit 2>/dev/null || true
forge install eth-infinitism/account-abstraction --no-commit 2>/dev/null || true
forge install foundry-rs/forge-std --no-commit 2>/dev/null || true
print_success "Foundry dependencies installed"

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..
print_success "Frontend dependencies installed"

echo ""
echo "Building contracts..."
echo ""

# Build contracts
forge build
print_success "Contracts built successfully"

echo ""
echo "Running tests..."
echo ""

# Run tests
forge test
print_success "Tests passed"

echo ""
echo "Setting up environment..."
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env file"
    print_warning "Please edit .env with your configuration"
else
    print_info ".env file already exists"
fi

echo ""
echo "==========================================="
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Get Sepolia ETH from faucet"
echo "3. Deploy contracts: make deploy-sepolia"
echo "4. Run frontend: make frontend"
echo ""
echo "For more information, see README.md"
echo ""

