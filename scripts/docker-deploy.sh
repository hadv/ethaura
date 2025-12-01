#!/bin/bash

# EthAura Docker Production Deployment Script
# This script helps deploy EthAura using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     EthAura Docker Production Deployment Script       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    local missing_deps=0
    
    if ! command_exists docker; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        missing_deps=1
    else
        echo -e "${GREEN}✓ Docker is installed${NC}"
    fi
    
    if ! command_exists docker compose; then
        echo -e "${RED}✗ Docker Compose is not installed${NC}"
        missing_deps=1
    else
        echo -e "${GREEN}✓ Docker Compose is installed${NC}"
    fi
    
    if ! command_exists git; then
        echo -e "${RED}✗ Git is not installed${NC}"
        missing_deps=1
    else
        echo -e "${GREEN}✓ Git is installed${NC}"
    fi
    
    if [ $missing_deps -eq 1 ]; then
        echo -e "${RED}Please install missing dependencies and try again${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to setup environment
setup_environment() {
    echo -e "${YELLOW}Setting up environment...${NC}"
    
    cd "$PROJECT_DIR"
    
    if [ ! -f .env.production ]; then
        if [ -f .env.production.example ]; then
            echo -e "${YELLOW}Creating .env.production from template...${NC}"
            cp .env.production.example .env.production
            echo -e "${GREEN}✓ Created .env.production${NC}"
            echo -e "${YELLOW}⚠ Please edit .env.production with your configuration${NC}"
            echo -e "${YELLOW}  Required: MAINNET_RPC_URL, VITE_WEB3AUTH_CLIENT_ID, etc.${NC}"
            read -p "Press Enter after editing .env.production..."
        else
            echo -e "${RED}✗ .env.production.example not found${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓ .env.production exists${NC}"
    fi
    
    # Create required directories
    echo -e "${YELLOW}Creating required directories...${NC}"
    mkdir -p logs/{nimbus,helios,nginx}
    mkdir -p docker/nginx/ssl
    mkdir -p docker/grafana/{provisioning,dashboards}
    mkdir -p backups
    echo -e "${GREEN}✓ Directories created${NC}"
    
    echo ""
}

# Function to validate configuration
validate_configuration() {
    echo -e "${YELLOW}Validating configuration...${NC}"
    
    source .env.production
    
    local validation_failed=0
    
    if [ -z "$MAINNET_RPC_URL" ] || [ "$MAINNET_RPC_URL" = "https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY" ]; then
        echo -e "${RED}✗ MAINNET_RPC_URL not configured${NC}"
        validation_failed=1
    else
        echo -e "${GREEN}✓ MAINNET_RPC_URL configured${NC}"
    fi
    
    if [ -z "$VITE_WEB3AUTH_CLIENT_ID" ] || [ "$VITE_WEB3AUTH_CLIENT_ID" = "your_web3auth_client_id_here" ]; then
        echo -e "${RED}✗ VITE_WEB3AUTH_CLIENT_ID not configured${NC}"
        validation_failed=1
    else
        echo -e "${GREEN}✓ VITE_WEB3AUTH_CLIENT_ID configured${NC}"
    fi
    
    if [ -z "$HELIOS_CHECKPOINT" ]; then
        echo -e "${YELLOW}⚠ HELIOS_CHECKPOINT not set, using default${NC}"
    else
        echo -e "${GREEN}✓ HELIOS_CHECKPOINT configured${NC}"
    fi
    
    if [ $validation_failed -eq 1 ]; then
        echo -e "${RED}Configuration validation failed. Please update .env.production${NC}"
        exit 1
    fi
    
    echo ""
}

# Function to build images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Load environment
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Build images
    docker compose build --no-cache
    
    echo -e "${GREEN}✓ Images built successfully${NC}"
    echo ""
}

# Function to start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Load environment
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Start services
    docker compose up -d
    
    echo -e "${GREEN}✓ Services started${NC}"
    echo ""
}

# Function to check service health
check_health() {
    echo -e "${YELLOW}Checking service health...${NC}"
    
    cd "$PROJECT_DIR"
    
    sleep 5
    
    # Check service status
    docker compose ps
    
    echo ""
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    
    # Wait for Nimbus
    echo -e "${YELLOW}Checking Nimbus (this may take a while)...${NC}"
    for i in {1..10}; do
        if docker compose exec -T nimbus wget -qO- http://localhost:5052/eth/v1/node/health 2>/dev/null; then
            echo -e "${GREEN}✓ Nimbus is healthy${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${YELLOW}⚠ Nimbus is still syncing (this is normal, may take 4-8 hours)${NC}"
        fi
        sleep 3
    done
    
    # Wait for Helios
    echo -e "${YELLOW}Checking Helios...${NC}"
    for i in {1..10}; do
        if docker compose exec -T helios curl -sf http://localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Helios is healthy${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${YELLOW}⚠ Helios is not ready yet (waiting for Nimbus sync)${NC}"
        fi
        sleep 3
    done
    
    # Check Frontend
    echo -e "${YELLOW}Checking Frontend...${NC}"
    for i in {1..5}; do
        if curl -sf http://localhost/health >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend is healthy${NC}"
            break
        fi
        if [ $i -eq 5 ]; then
            echo -e "${RED}✗ Frontend is not responding${NC}"
        fi
        sleep 2
    done
    
    echo ""
}

# Function to display access information
display_info() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              Deployment Complete!                      ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Services are running!${NC}"
    echo ""
    echo -e "${YELLOW}Access URLs:${NC}"
    echo -e "  Frontend:    http://localhost"
    echo -e "  Grafana:     http://localhost:3001"
    echo -e "  Prometheus:  http://localhost:9090"
    echo ""
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo -e "  View logs:           docker compose logs -f"
    echo -e "  Check status:        docker compose ps"
    echo -e "  Stop services:       docker compose down"
    echo -e "  Restart services:    docker compose restart"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Monitor Nimbus sync: docker compose logs -f nimbus"
    echo -e "  2. Configure SSL/TLS for production"
    echo -e "  3. Set up backups"
    echo -e "  4. Configure monitoring alerts"
    echo ""
    echo -e "${YELLOW}Documentation:${NC}"
    echo -e "  See DOCKER_SETUP.md for detailed information"
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    setup_environment
    validate_configuration
    
    echo -e "${YELLOW}Ready to deploy. This will:${NC}"
    echo -e "  1. Build Docker images"
    echo -e "  2. Start all services"
    echo -e "  3. Check service health"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 0
    fi
    
    build_images
    start_services
    check_health
    display_info
}

# Run main function
main

