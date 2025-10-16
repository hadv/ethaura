# EthAura Docker Production Setup Guide

This guide explains how to deploy EthAura in production using Docker Compose.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

## Overview

The Docker Compose setup provides a complete production environment with:

- **Nimbus Consensus Node**: Ethereum beacon chain node for trustless consensus
- **Helios Light Client**: Trustless RPC endpoint with cryptographic verification
- **Frontend**: React application served via Nginx
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Visualization and dashboards

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host (Production)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────────┐             │
│  │   Frontend   │────────▶│     Helios       │             │
│  │   (Nginx)    │         │  (Light Client)  │             │
│  │   Port 80    │         │   Port 8545      │             │
│  └──────────────┘         └────────┬─────────┘             │
│                                    │                         │
│                           ┌────────┴────────┐               │
│                           │                 │               │
│                           ▼                 ▼               │
│                  ┌─────────────┐   ┌─────────────┐         │
│                  │   Nimbus    │   │  Alchemy    │         │
│                  │ Consensus   │   │ Execution   │         │
│                  │    Node     │   │     RPC     │         │
│                  │  Port 5052  │   │ (External)  │         │
│                  └─────────────┘   └─────────────┘         │
│                                                              │
│  ┌──────────────┐         ┌──────────────────┐             │
│  │  Prometheus  │────────▶│    Grafana       │             │
│  │  Port 9090   │         │   Port 3001      │             │
│  └──────────────┘         └──────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 22.04 LTS recommended)
- **CPU**: 4+ cores
- **RAM**: 8 GB minimum, 16 GB recommended
- **Storage**: 200 GB SSD minimum
- **Network**: 25+ Mbps, stable connection
- **Ports**: 80, 443, 9000 (P2P)

### Software Requirements

1. **Docker** (version 20.10+)
2. **Docker Compose** (version 2.0+)
3. **Git**

### Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/hadv/ethaura.git
cd ethaura
```

### 2. Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit configuration
nano .env.production
```

**Required Configuration:**

```bash
# Network
NETWORK=mainnet
SERVER_IP=YOUR_SERVER_PUBLIC_IP

# RPC URLs
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Helios checkpoint (update from https://beaconcha.in)
HELIOS_CHECKPOINT=0x85e6151a246e8fdba36db27a0c7678a575346272fe978c9281e13a8b26cdfa68

# Web3Auth
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id

# Contract addresses (after deployment)
VITE_FACTORY_ADDRESS=0x...
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Monitoring
GRAFANA_PASSWORD=your_secure_password
```

### 3. Create Required Directories

```bash
# Create directories for logs and SSL
mkdir -p logs/{nimbus,helios,nginx}
mkdir -p docker/nginx/ssl
mkdir -p docker/grafana/{provisioning,dashboards}
```

### 4. Start Services

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

## Configuration

### Environment Variables

See `.env.production.example` for all available options.

### SSL/TLS Configuration (Production)

For HTTPS support:

1. **Obtain SSL certificates** (Let's Encrypt recommended):

```bash
# Install certbot
sudo apt-get install certbot

# Get certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

2. **Update nginx.conf**:

Uncomment the HTTPS server block in `docker/nginx/nginx.conf` and update the domain name.

3. **Restart frontend**:

```bash
docker compose restart frontend
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Nimbus P2P
sudo ufw allow 9000/tcp
sudo ufw allow 9000/udp

# Enable firewall
sudo ufw enable
```

## Deployment

### Production Deployment Steps

1. **Deploy Smart Contracts** (if not already deployed):

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MAINNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Update VITE_FACTORY_ADDRESS in .env.production
```

2. **Start Infrastructure**:

```bash
# Start Nimbus first (will take 4-8 hours to sync)
docker compose up -d nimbus

# Monitor sync progress
docker compose logs -f nimbus

# Once synced, start remaining services
docker compose up -d
```

3. **Verify Deployment**:

```bash
# Check all services are running
docker compose ps

# Test Helios RPC
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Access frontend
curl http://localhost

# Access Grafana
curl http://localhost:3001
```

## Monitoring

### Accessing Monitoring Tools

- **Grafana**: http://your-server:3001
  - Username: admin
  - Password: (from GRAFANA_PASSWORD in .env.production)

- **Prometheus**: http://your-server:9090

### Key Metrics to Monitor

1. **Nimbus Consensus Node**:
   - Sync status
   - Peer count
   - Memory usage
   - Disk usage

2. **Helios Light Client**:
   - RPC response time
   - Verification success rate
   - Connection status

3. **Frontend**:
   - HTTP response codes
   - Request rate
   - Response time

### Health Checks

```bash
# Check all services
docker compose ps

# Check individual service health
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/health
docker compose exec helios curl -f http://localhost:8545
docker compose exec frontend curl -f http://localhost/health

# View resource usage
docker stats
```

## Maintenance

### Regular Maintenance Tasks

#### Daily

```bash
# Check service status
docker compose ps

# Check logs for errors
docker compose logs --tail=100 | grep -i error
```

#### Weekly

```bash
# Update Helios checkpoint
# Get latest from https://beaconcha.in
# Update HELIOS_CHECKPOINT in .env.production
docker compose restart helios

# Review disk usage
df -h
docker system df

# Check for updates
docker compose pull
```

#### Monthly

```bash
# Backup volumes
./scripts/backup-docker-volumes.sh

# Clean up old logs
find logs/ -name "*.log" -mtime +30 -delete

# Update Docker images
docker compose pull
docker compose up -d
```

### Backup and Restore

#### Backup

```bash
# Backup all volumes
docker run --rm \
  -v ethaura_nimbus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/nimbus-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup configuration
tar czf backups/config-$(date +%Y%m%d).tar.gz \
  .env.production \
  docker-compose.yml \
  docker/
```

#### Restore

```bash
# Restore volume
docker run --rm \
  -v ethaura_nimbus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/nimbus-data-YYYYMMDD.tar.gz -C /data
```

### Updates

```bash
# Pull latest images
docker compose pull

# Restart services with new images
docker compose up -d

# Remove old images
docker image prune -a
```

## Troubleshooting

### Common Issues

#### Nimbus Not Syncing

```bash
# Check logs
docker compose logs nimbus

# Check peers
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/peer_count

# Restart service
docker compose restart nimbus
```

#### Helios Connection Issues

```bash
# Check if Nimbus is ready
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/health

# Check Helios logs
docker compose logs helios

# Verify checkpoint is recent
# Update HELIOS_CHECKPOINT if needed
```

#### Frontend Not Loading

```bash
# Check nginx logs
docker compose logs frontend

# Verify build completed
docker compose exec frontend ls -la /usr/share/nginx/html

# Rebuild frontend
docker compose build frontend
docker compose up -d frontend
```

### Performance Optimization

```bash
# Increase Nimbus memory limit
# Edit docker-compose.yml, increase memory limits

# Enable swap (if needed)
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Optimize Docker
docker system prune -a
```

### Logs

```bash
# View all logs
docker compose logs

# Follow specific service
docker compose logs -f nimbus

# Last 100 lines
docker compose logs --tail=100

# Save logs to file
docker compose logs > logs/docker-compose-$(date +%Y%m%d).log
```

## Development Setup

For local development, use the development compose file:

```bash
# Copy development environment
cp .env.example .env

# Start development services
docker compose -f docker-compose.dev.yml up -d

# Access frontend dev server
open http://localhost:3000
```

## Support

For issues or questions:

1. Check logs: `docker compose logs`
2. Review this documentation
3. Check GitHub issues: https://github.com/hadv/ethaura/issues
4. Open a new issue with logs and configuration

## Security Considerations

1. **Never commit** `.env.production` to version control
2. **Use strong passwords** for Grafana and other services
3. **Enable HTTPS** in production
4. **Keep Docker updated** regularly
5. **Monitor logs** for suspicious activity
6. **Backup regularly** and test restores
7. **Use firewall** to restrict access

## Cost Estimate

- **VPS**: $22-48/month (Hetzner, DigitalOcean, etc.)
- **Alchemy RPC**: $0-50/month (depending on usage)
- **Total**: $22-98/month

## Next Steps

1. ✅ Complete environment configuration
2. ✅ Deploy smart contracts
3. ✅ Start Docker services
4. ✅ Configure SSL/TLS
5. ✅ Set up monitoring
6. ✅ Configure backups
7. ✅ Test application
8. ✅ Monitor and maintain

---

**Happy Deploying! 🚀**

