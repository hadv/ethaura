#!/bin/bash

# EthAura Docker Health Check Script
# Monitors the health of all Docker services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        EthAura Docker Health Check                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check service status
check_service_status() {
    local service=$1
    
    if docker compose ps | grep -q "$service.*running"; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local service=$1
    
    local health=$(docker compose ps | grep "$service" | awk '{print $6}')
    
    if [[ "$health" == *"healthy"* ]]; then
        echo -e "${GREEN}healthy${NC}"
        return 0
    elif [[ "$health" == *"starting"* ]]; then
        echo -e "${YELLOW}starting${NC}"
        return 1
    else
        echo -e "${RED}unhealthy${NC}"
        return 1
    fi
}

# Function to get container uptime
get_uptime() {
    local service=$1
    docker compose ps | grep "$service" | awk '{print $5}'
}

# Function to check Nimbus
check_nimbus() {
    echo -e "${YELLOW}Nimbus Consensus Node:${NC}"
    
    # Status
    echo -n "  Status: "
    check_service_status "nimbus"
    
    # Health
    echo -n "  Health: "
    check_service_health "nimbus"
    
    # Uptime
    echo -e "  Uptime: $(get_uptime nimbus)"
    
    # Sync status
    if docker compose exec -T nimbus wget -qO- http://localhost:5052/eth/v1/node/syncing 2>/dev/null | grep -q '"is_syncing":false'; then
        echo -e "  Sync: ${GREEN}synced${NC}"
    else
        echo -e "  Sync: ${YELLOW}syncing${NC}"
    fi
    
    # Peer count
    local peers=$(docker compose exec -T nimbus wget -qO- http://localhost:5052/eth/v1/node/peer_count 2>/dev/null | grep -o '"connected":"[0-9]*"' | grep -o '[0-9]*' || echo "0")
    echo -e "  Peers: $peers"
    
    echo ""
}

# Function to check Helios
check_helios() {
    echo -e "${YELLOW}Helios Light Client:${NC}"
    
    # Status
    echo -n "  Status: "
    check_service_status "helios"
    
    # Health
    echo -n "  Health: "
    check_service_health "helios"
    
    # Uptime
    echo -e "  Uptime: $(get_uptime helios)"
    
    # RPC test
    if docker compose exec -T helios curl -sf http://localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
        echo -e "  RPC: ${GREEN}responding${NC}"
        
        # Get block number
        local block=$(docker compose exec -T helios curl -s http://localhost:8545 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | grep -o '"result":"0x[0-9a-f]*"' | cut -d'"' -f4)
        if [ -n "$block" ]; then
            local block_dec=$((16#${block#0x}))
            echo -e "  Block: $block_dec"
        fi
    else
        echo -e "  RPC: ${RED}not responding${NC}"
    fi
    
    echo ""
}

# Function to check Frontend
check_frontend() {
    echo -e "${YELLOW}Frontend:${NC}"
    
    # Status
    echo -n "  Status: "
    check_service_status "frontend"
    
    # Health
    echo -n "  Health: "
    check_service_health "frontend"
    
    # Uptime
    echo -e "  Uptime: $(get_uptime frontend)"
    
    # HTTP test
    if curl -sf http://localhost/health >/dev/null 2>&1; then
        echo -e "  HTTP: ${GREEN}responding${NC}"
    else
        echo -e "  HTTP: ${RED}not responding${NC}"
    fi
    
    echo ""
}

# Function to check Prometheus
check_prometheus() {
    echo -e "${YELLOW}Prometheus:${NC}"
    
    # Status
    echo -n "  Status: "
    check_service_status "prometheus"
    
    # Health
    echo -n "  Health: "
    check_service_health "prometheus"
    
    # Uptime
    echo -e "  Uptime: $(get_uptime prometheus)"
    
    # HTTP test
    if docker compose exec -T prometheus wget -qO- http://localhost:9090/-/healthy >/dev/null 2>&1; then
        echo -e "  API: ${GREEN}responding${NC}"
    else
        echo -e "  API: ${RED}not responding${NC}"
    fi
    
    echo ""
}

# Function to check Grafana
check_grafana() {
    echo -e "${YELLOW}Grafana:${NC}"
    
    # Status
    echo -n "  Status: "
    check_service_status "grafana"
    
    # Health
    echo -n "  Health: "
    check_service_health "grafana"
    
    # Uptime
    echo -e "  Uptime: $(get_uptime grafana)"
    
    # HTTP test
    if docker compose exec -T grafana wget -qO- http://localhost:3000/api/health >/dev/null 2>&1; then
        echo -e "  API: ${GREEN}responding${NC}"
    else
        echo -e "  API: ${RED}not responding${NC}"
    fi
    
    echo ""
}

# Function to check resources
check_resources() {
    echo -e "${YELLOW}Resource Usage:${NC}"
    echo ""
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo ""
}

# Function to check disk usage
check_disk() {
    echo -e "${YELLOW}Disk Usage:${NC}"
    echo ""
    docker system df
    echo ""
    
    echo -e "${YELLOW}Volume Sizes:${NC}"
    docker volume ls --format "{{.Name}}" | grep "ethaura" | while read vol; do
        local size=$(docker run --rm -v "$vol:/data" alpine du -sh /data 2>/dev/null | cut -f1)
        echo "  $vol: $size"
    done
    echo ""
}

# Main health check
main() {
    check_nimbus
    check_helios
    check_frontend
    check_prometheus
    check_grafana
    check_resources
    check_disk
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Health Check Complete                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}For detailed logs, run:${NC}"
    echo -e "  docker compose logs -f [service-name]"
    echo ""
}

# Run main function
main

