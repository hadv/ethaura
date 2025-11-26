#!/bin/bash

# EthAura Docker Backup Script
# Backs up Docker volumes and configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          EthAura Docker Backup Script                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

cd "$PROJECT_DIR"

# Function to backup volume
backup_volume() {
    local volume_name=$1
    local backup_file="$BACKUP_DIR/${volume_name}_${DATE}.tar.gz"
    
    echo -e "${YELLOW}Backing up volume: $volume_name${NC}"
    
    docker run --rm \
        -v "$volume_name:/data" \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf "/backup/$(basename $backup_file)" -C /data .
    
    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        echo -e "${GREEN}✓ Backed up $volume_name ($size)${NC}"
    else
        echo -e "${RED}✗ Failed to backup $volume_name${NC}"
        return 1
    fi
}

# Function to backup configuration
backup_config() {
    local backup_file="$BACKUP_DIR/config_${DATE}.tar.gz"
    
    echo -e "${YELLOW}Backing up configuration files...${NC}"
    
    tar czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='lib' \
        --exclude='out' \
        --exclude='cache' \
        --exclude='logs' \
        .env.production \
        docker-compose.yml \
        docker/ \
        helios-config.toml \
        2>/dev/null || true
    
    if [ -f "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        echo -e "${GREEN}✓ Backed up configuration ($size)${NC}"
    else
        echo -e "${RED}✗ Failed to backup configuration${NC}"
        return 1
    fi
}

# Function to clean old backups
clean_old_backups() {
    echo -e "${YELLOW}Cleaning backups older than $RETENTION_DAYS days...${NC}"
    
    local deleted=0
    while IFS= read -r file; do
        rm -f "$file"
        ((deleted++))
    done < <(find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS)
    
    if [ $deleted -gt 0 ]; then
        echo -e "${GREEN}✓ Deleted $deleted old backup(s)${NC}"
    else
        echo -e "${GREEN}✓ No old backups to delete${NC}"
    fi
}

# Main backup process
main() {
    echo -e "${YELLOW}Starting backup process...${NC}"
    echo ""
    
    # Backup volumes
    backup_volume "ethaura_nimbus-data"
    backup_volume "ethaura_helios-data"
    backup_volume "ethaura_prometheus-data"
    backup_volume "ethaura_grafana-data"
    
    echo ""
    
    # Backup configuration
    backup_config
    
    echo ""
    
    # Clean old backups
    clean_old_backups
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║            Backup Complete!                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Backup location: $BACKUP_DIR${NC}"
    echo -e "${YELLOW}Backup date: $DATE${NC}"
    echo ""
    
    # List backups
    echo -e "${YELLOW}Recent backups:${NC}"
    ls -lh "$BACKUP_DIR" | tail -n 10
}

# Run main function
main

