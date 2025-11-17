# EthAura Docker File Structure

Complete overview of all Docker-related files and their purposes.

## 📁 Directory Structure

```
ethaura/
│
├── 🐳 Docker Compose Files
│   ├── docker-compose.yml              # Production configuration
│   ├── docker-compose.dev.yml          # Development configuration
│   └── .dockerignore                   # Build optimization
│
├── ⚙️ Environment Configuration
│   ├── .env.production.example         # Production environment template
│   └── .env (create from example)      # Your actual configuration
│
├── 📂 docker/                          # Docker service configurations
│   │
│   ├── frontend/
│   │   └── Dockerfile                  # Frontend production build
│   │
│   ├── helios/
│   │   ├── Dockerfile                  # Helios light client image
│   │   └── entrypoint.sh              # Helios startup script
│   │
│   ├── nginx/
│   │   ├── nginx.conf                 # Nginx web server config
│   │   └── ssl/                       # SSL certificates (add your own)
│   │       ├── fullchain.pem          # (not included, add yours)
│   │       └── privkey.pem            # (not included, add yours)
│   │
│   ├── prometheus/
│   │   └── prometheus.yml             # Prometheus monitoring config
│   │
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── prometheus.yml     # Grafana datasource config
│   │   │   └── dashboards/
│   │   │       └── default.yml        # Dashboard provisioning
│   │   └── dashboards/                # Custom dashboards (add your own)
│   │
│   └── README.md                      # Docker configuration reference
│
├── 🔧 frontend/
│   └── Dockerfile.dev                 # Frontend development build
│
├── 📜 scripts/                        # Helper scripts
│   ├── docker-deploy.sh              # Automated deployment
│   ├── docker-backup.sh              # Backup automation
│   └── docker-health-check.sh        # Health monitoring
│
├── 📚 Documentation
│   ├── DOCKER_README.md              # Main Docker documentation
│   ├── DOCKER_QUICKSTART.md          # 10-minute quick start
│   ├── DOCKER_SETUP.md               # Comprehensive deployment guide
│   ├── DOCKER_DEPLOYMENT_SUMMARY.md  # Complete overview
│   ├── DOCKER_DEPLOYMENT_CHECKLIST.md # Production checklist
│   ├── DOCKER_SETUP_COMPLETE.md      # Setup completion summary
│   └── DOCKER_FILE_STRUCTURE.md      # This file
│
├── 🛠️ Makefile                        # Updated with Docker commands
└── 🚫 .gitignore                      # Updated with Docker ignores
```

## 📄 File Descriptions

### Core Configuration Files

#### `docker-compose.yml`
**Purpose**: Main production Docker Compose configuration
**Contains**:
- Nimbus consensus node service
- Helios light client service
- Frontend (React + Nginx) service
- Prometheus monitoring service
- Grafana dashboards service
- Network configuration
- Volume definitions
- Health checks
- Resource limits

#### `docker-compose.dev.yml`
**Purpose**: Development Docker Compose configuration
**Contains**:
- Simplified Helios setup (uses public beacon API)
- Frontend development server with hot-reload
- Optional Anvil local node
- Development-optimized settings

#### `.env.production.example`
**Purpose**: Template for production environment variables
**Contains**:
- Network configuration (mainnet/sepolia)
- RPC URLs (Alchemy/Infura)
- Helios checkpoint
- Web3Auth credentials
- Contract addresses
- Monitoring credentials
- Port configurations

#### `.dockerignore`
**Purpose**: Optimize Docker builds by excluding unnecessary files
**Excludes**:
- Git files
- Documentation
- Node modules
- Build artifacts
- Logs
- IDE files

### Docker Service Configurations

#### `docker/frontend/Dockerfile`
**Purpose**: Multi-stage production build for React frontend
**Features**:
- Stage 1: Build with Node.js
- Stage 2: Serve with Nginx
- Environment variable injection
- Optimized for production

#### `frontend/Dockerfile.dev`
**Purpose**: Development build for frontend
**Features**:
- Hot-reload support
- Development server
- Volume mounting for live updates

#### `docker/helios/Dockerfile`
**Purpose**: Build Helios light client from source
**Features**:
- Rust builder stage
- Minimal runtime image
- Health checks
- Non-root user

#### `docker/helios/entrypoint.sh`
**Purpose**: Helios startup and configuration script
**Features**:
- Wait for Nimbus to be ready
- Configure network settings
- Set up RPC endpoint
- Handle checkpoints

#### `docker/nginx/nginx.conf`
**Purpose**: Production Nginx web server configuration
**Features**:
- HTTP/2 support
- Gzip compression
- Security headers
- Static asset caching
- SPA routing support
- SSL/TLS configuration (commented)
- Health check endpoint

#### `docker/prometheus/prometheus.yml`
**Purpose**: Prometheus metrics collection configuration
**Features**:
- Nimbus metrics scraping
- Self-monitoring
- 15-second scrape interval
- Configurable retention

#### `docker/grafana/provisioning/datasources/prometheus.yml`
**Purpose**: Auto-configure Prometheus as Grafana datasource
**Features**:
- Automatic connection to Prometheus
- Default datasource
- Pre-configured settings

#### `docker/grafana/provisioning/dashboards/default.yml`
**Purpose**: Auto-provision Grafana dashboards
**Features**:
- Automatic dashboard loading
- File-based provisioning
- Update support

### Helper Scripts

#### `scripts/docker-deploy.sh`
**Purpose**: Automated production deployment
**Features**:
- Prerequisites check
- Environment setup
- Configuration validation
- Image building
- Service startup
- Health verification
- Access information display

#### `scripts/docker-backup.sh`
**Purpose**: Automated backup of Docker volumes and configuration
**Features**:
- Volume backups (Nimbus, Helios, Prometheus, Grafana)
- Configuration backups
- Automatic cleanup of old backups
- Configurable retention period

#### `scripts/docker-health-check.sh`
**Purpose**: Comprehensive health monitoring
**Features**:
- Service status checks
- Health endpoint verification
- Resource usage monitoring
- Disk usage reporting
- Detailed diagnostics

### Documentation Files

#### `DOCKER_README.md`
**Purpose**: Main entry point for Docker documentation
**Contains**:
- Quick start guide
- Documentation index
- Essential commands
- Configuration overview
- Troubleshooting basics

#### `DOCKER_QUICKSTART.md`
**Purpose**: Get running in 10 minutes
**Contains**:
- Prerequisites
- Minimal configuration
- Quick deployment steps
- Common commands
- Basic troubleshooting

#### `DOCKER_SETUP.md`
**Purpose**: Comprehensive deployment guide
**Contains**:
- Detailed architecture
- Step-by-step instructions
- Security configuration
- SSL/TLS setup
- Monitoring setup
- Maintenance procedures
- Troubleshooting guide

#### `DOCKER_DEPLOYMENT_SUMMARY.md`
**Purpose**: Complete overview of the setup
**Contains**:
- All files created
- Architecture diagram
- Quick reference
- Command summary

#### `DOCKER_DEPLOYMENT_CHECKLIST.md`
**Purpose**: Production deployment checklist
**Contains**:
- Pre-deployment tasks
- Configuration checklist
- Security hardening
- Post-deployment verification
- Sign-off section

#### `DOCKER_SETUP_COMPLETE.md`
**Purpose**: Setup completion summary
**Contains**:
- What was created
- Quick start guide
- Next steps
- Documentation guide

#### `docker/README.md`
**Purpose**: Docker configuration reference
**Contains**:
- Directory structure
- Configuration details
- Customization guide
- Security best practices
- Troubleshooting

### Updated Files

#### `Makefile`
**Added Commands**:
- `make docker-deploy` - Full deployment
- `make docker-start` - Start services
- `make docker-stop` - Stop services
- `make docker-restart` - Restart services
- `make docker-logs` - View logs
- `make docker-health` - Health check
- `make docker-backup` - Backup volumes
- `make docker-clean` - Clean resources
- `make docker-build` - Build images
- `make docker-dev` - Development mode

#### `.gitignore`
**Added Entries**:
- `.env.production` - Production environment
- `.env.local` - Local environment
- `logs/` - Log files
- `backups/` - Backup files
- `docker/nginx/ssl/*.pem` - SSL certificates
- `.helios/` - Helios data

## 🗂️ Runtime Directories (Created Automatically)

```
ethaura/
├── logs/                              # Log files (gitignored)
│   ├── nimbus/
│   ├── helios/
│   └── nginx/
│
├── backups/                           # Backup files (gitignored)
│   ├── nimbus-data_YYYYMMDD.tar.gz
│   ├── helios-data_YYYYMMDD.tar.gz
│   └── config_YYYYMMDD.tar.gz
│
└── docker/nginx/ssl/                  # SSL certificates (gitignored)
    ├── fullchain.pem
    └── privkey.pem
```

## 📊 Docker Volumes (Created by Docker Compose)

```
ethaura_nimbus-data        # Nimbus consensus data (~100GB)
ethaura_helios-data        # Helios cache (~10GB)
ethaura_prometheus-data    # Prometheus metrics
ethaura_grafana-data       # Grafana dashboards
```

## 🔍 File Sizes

| File | Size | Purpose |
|------|------|---------|
| docker-compose.yml | ~6 KB | Production config |
| docker-compose.dev.yml | ~2 KB | Dev config |
| .env.production.example | ~3 KB | Environment template |
| docker/frontend/Dockerfile | ~1 KB | Frontend build |
| docker/helios/Dockerfile | ~1 KB | Helios build |
| docker/nginx/nginx.conf | ~4 KB | Nginx config |
| scripts/docker-deploy.sh | ~8 KB | Deployment script |
| scripts/docker-backup.sh | ~3 KB | Backup script |
| scripts/docker-health-check.sh | ~6 KB | Health check script |
| DOCKER_SETUP.md | ~15 KB | Comprehensive guide |

## 📝 Usage Examples

### View a Configuration File
```bash
cat docker-compose.yml
cat .env.production.example
cat docker/nginx/nginx.conf
```

### Edit Configuration
```bash
nano .env.production
nano docker/nginx/nginx.conf
nano docker/prometheus/prometheus.yml
```

### Run Scripts
```bash
./scripts/docker-deploy.sh
./scripts/docker-backup.sh
./scripts/docker-health-check.sh
```

### Use Makefile Commands
```bash
make docker-deploy
make docker-health
make docker-logs
```

## 🎯 Quick Navigation

**Need to deploy?** → Start with `DOCKER_QUICKSTART.md`

**Need detailed guide?** → Read `DOCKER_SETUP.md`

**Need to customize?** → Check `docker/README.md`

**Need checklist?** → Use `DOCKER_DEPLOYMENT_CHECKLIST.md`

**Need reference?** → See `DOCKER_DEPLOYMENT_SUMMARY.md`

---

**All files are ready for production deployment! 🚀**

