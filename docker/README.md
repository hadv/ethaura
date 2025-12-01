# EthAura Docker Configuration

This directory contains all Docker-related configuration files for EthAura production deployment.

## Directory Structure

```
docker/
├── frontend/
│   └── Dockerfile              # Production frontend build
├── helios/
│   ├── Dockerfile              # Helios light client image
│   └── entrypoint.sh           # Helios startup script
├── nginx/
│   ├── nginx.conf              # Nginx web server configuration
│   └── ssl/                    # SSL certificates (add your own)
├── prometheus/
│   └── prometheus.yml          # Prometheus monitoring config
└── grafana/
    ├── provisioning/
    │   ├── datasources/        # Grafana data sources
    │   └── dashboards/         # Grafana dashboard configs
    └── dashboards/             # Dashboard JSON files
```

## Configuration Files

### Frontend (frontend/Dockerfile)

Multi-stage Docker build for the React frontend:
- Stage 1: Build the application with Node.js
- Stage 2: Serve with Nginx

**Build arguments:**
- `VITE_WEB3AUTH_CLIENT_ID`
- `VITE_CHAIN_ID`
- `VITE_RPC_URL`
- `VITE_FACTORY_ADDRESS`
- `VITE_ENTRYPOINT_ADDRESS`

### Helios (helios/Dockerfile)

Builds Helios light client from source:
- Uses Rust builder image
- Compiles Helios from GitHub
- Creates minimal runtime image

**Environment variables:**
- `NETWORK` - Network to connect to (mainnet, sepolia)
- `CONSENSUS_RPC` - Consensus node endpoint
- `EXECUTION_RPC` - Execution RPC endpoint
- `CHECKPOINT` - Weak subjectivity checkpoint

### Nginx (nginx/nginx.conf)

Production-ready Nginx configuration:
- HTTP/2 support
- Gzip compression
- Security headers
- Static asset caching
- Health check endpoint
- HTTPS support (commented out, enable for production)

**Features:**
- SPA routing support
- 1-year cache for static assets
- Security headers (X-Frame-Options, CSP, etc.)
- Let's Encrypt support

### Prometheus (prometheus/prometheus.yml)

Monitoring configuration:
- Scrapes Nimbus metrics
- Self-monitoring
- 15-second scrape interval

**Metrics collected:**
- Nimbus consensus node metrics
- System metrics (if node-exporter added)
- Custom application metrics

### Grafana (grafana/provisioning/)

Pre-configured Grafana setup:
- Prometheus datasource
- Dashboard provisioning
- Automatic configuration

## Usage

### Build Images

```bash
# Build all images
docker compose build

# Build specific service
docker compose build frontend
docker compose build helios
```

### Start Services

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d nimbus
docker compose up -d helios
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f nimbus
docker compose logs -f helios
docker compose logs -f frontend
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Customization

### Frontend

To customize the frontend build:

1. Edit `frontend/Dockerfile`
2. Modify build arguments in `docker-compose.yml`
3. Rebuild: `docker compose build frontend`

### Nginx

To customize Nginx configuration:

1. Edit `nginx/nginx.conf`
2. Restart: `docker compose restart frontend`

For HTTPS:

1. Obtain SSL certificates
2. Copy to `nginx/ssl/`
3. Uncomment HTTPS server block in `nginx.conf`
4. Restart: `docker compose restart frontend`

### Prometheus

To add more scrape targets:

1. Edit `prometheus/prometheus.yml`
2. Add new job under `scrape_configs`
3. Restart: `docker compose restart prometheus`

### Grafana

To add custom dashboards:

1. Create dashboard JSON
2. Save to `grafana/dashboards/`
3. Restart: `docker compose restart grafana`

## Security

### Best Practices

1. **SSL/TLS**: Always use HTTPS in production
2. **Secrets**: Never commit `.env.production`
3. **Firewall**: Restrict access to monitoring ports
4. **Updates**: Keep images updated regularly
5. **Backups**: Regular backups of volumes

### Firewall Rules

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Nimbus P2P
sudo ufw allow 9000/tcp
sudo ufw allow 9000/udp

# Deny direct access to monitoring (use SSH tunnel)
sudo ufw deny 9090/tcp
sudo ufw deny 3001/tcp
```

### SSH Tunneling for Monitoring

```bash
# Access Grafana securely
ssh -L 3001:localhost:3001 user@your-server

# Access Prometheus securely
ssh -L 9090:localhost:9090 user@your-server
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs [service-name]

# Check container status
docker compose ps

# Inspect container
docker inspect ethaura-[service-name]
```

### Out of memory

```bash
# Check memory usage
docker stats

# Increase limits in docker-compose.yml
# Edit memory limits under deploy.resources
```

### Network issues

```bash
# Check network
docker network ls
docker network inspect ethaura-network

# Recreate network
docker compose down
docker compose up -d
```

### Volume issues

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect ethaura_nimbus-data

# Backup volume
docker run --rm -v ethaura_nimbus-data:/data -v $(pwd):/backup alpine tar czf /backup/nimbus-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v ethaura_nimbus-data:/data -v $(pwd):/backup alpine tar xzf /backup/nimbus-backup.tar.gz -C /data
```

## Maintenance

### Regular Tasks

**Daily:**
- Check service status: `docker compose ps`
- Review logs: `docker compose logs --tail=100`

**Weekly:**
- Update checkpoint: Edit `.env.production`, restart Helios
- Check disk usage: `docker system df`
- Review metrics in Grafana

**Monthly:**
- Update images: `docker compose pull && docker compose up -d`
- Backup volumes: `make docker-backup`
- Clean old images: `docker image prune -a`

### Updates

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Remove old images
docker image prune -a
```

## Performance Tuning

### Nimbus

Adjust memory limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 8G  # Increase if needed
```

### Helios

Adjust cache settings:

```yaml
environment:
  - RUST_LOG=info  # Change to 'debug' for more logs
```

### Nginx

Enable additional caching:

```nginx
# Add to nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
```

## Monitoring

### Metrics

Access metrics:
- Nimbus: http://localhost:8008/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Alerts

Configure alerts in Prometheus:

1. Create alert rules in `prometheus/alerts/`
2. Configure Alertmanager
3. Restart Prometheus

## Support

For issues:
1. Check logs: `docker compose logs`
2. Review documentation: `../DOCKER_SETUP.md`
3. Open issue: https://github.com/hadv/ethaura/issues

## License

Same as parent project (MIT)

