.PHONY: install build test deploy clean frontend help

# Default target
help:
	@echo "ΞTHΛURΛ - P256 Account Abstraction"
	@echo ""
	@echo "Available commands:"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build smart contracts"
	@echo "  make test           - Run contract tests"
	@echo "  make test-gas       - Run tests with gas report"
	@echo "  make coverage       - Run tests with coverage report"
	@echo "  make deploy-sepolia - Deploy to Sepolia testnet"
	@echo "  make verify-sepolia - Verify contracts on Sepolia"
	@echo "  make verify-mainnet - Verify contracts on Mainnet"
	@echo "  make frontend       - Run frontend dev server"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Helios Light Client (Development):"
	@echo "  make helios-install   - Install Helios light client"
	@echo "  make helios-sepolia   - Start Helios for Sepolia (dev)"
	@echo "  make helios-mainnet   - Start Helios for Mainnet (prod)"
	@echo "  make helios-test      - Test Helios RPC connection"
	@echo "  make helios-checkpoint - Update checkpoint"
	@echo ""
	@echo "Production Consensus Node (Linux only):"
	@echo "  make consensus-setup  - Set up production consensus node"
	@echo ""
	@echo "Docker Production Deployment:"
	@echo "  make docker-deploy    - Deploy with Docker Compose"
	@echo "  make docker-start     - Start Docker services"
	@echo "  make docker-stop      - Stop Docker services"
	@echo "  make docker-restart   - Restart Docker services"
	@echo "  make docker-logs      - View Docker logs"
	@echo "  make docker-health    - Check Docker services health"
	@echo "  make docker-backup    - Backup Docker volumes"
	@echo "  make docker-clean     - Clean Docker resources"
	@echo ""

# Install dependencies
install:
	@echo "Installing Foundry dependencies..."
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install eth-infinitism/account-abstraction --no-commit
	forge install foundry-rs/forge-std --no-commit
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Installation complete!"

# Build contracts
build:
	@echo "Building contracts..."
	forge build
	@echo "✅ Build complete!"

# Run tests
test:
	@echo "Running tests..."
	forge test
	@echo "✅ Tests complete!"

# Run tests with gas report
test-gas:
	@echo "Running tests with gas report..."
	forge test --gas-report
	@echo "✅ Tests complete!"

# Run tests with coverage
coverage:
	@echo "Running coverage..."
	forge coverage --ir-minimum
	@echo "✅ Coverage complete!"

# Deploy to Sepolia
deploy-sepolia:
	@echo "Deploying to Sepolia..."
	forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast --verify
	@echo "✅ Deployment complete!"

# Verify contracts on Sepolia
verify-sepolia:
	@echo "Verifying contracts on Sepolia..."
	@if [ -z "$$FACTORY_ADDRESS" ]; then \
		echo "Error: FACTORY_ADDRESS not set"; \
		echo "Usage: FACTORY_ADDRESS=0x... make verify-sepolia"; \
		exit 1; \
	fi
	@chmod +x scripts/verify-contracts.sh
	@./scripts/verify-contracts.sh sepolia
	@echo "✅ Verification complete!"

# Verify contracts on Mainnet
verify-mainnet:
	@echo "Verifying contracts on Mainnet..."
	@if [ -z "$$FACTORY_ADDRESS" ]; then \
		echo "Error: FACTORY_ADDRESS not set"; \
		echo "Usage: FACTORY_ADDRESS=0x... make verify-mainnet"; \
		exit 1; \
	fi
	@chmod +x scripts/verify-contracts.sh
	@./scripts/verify-contracts.sh mainnet
	@echo "✅ Verification complete!"

# Run frontend
frontend:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

# Build frontend
frontend-build:
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "✅ Frontend build complete!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	forge clean
	rm -rf frontend/dist
	@echo "✅ Clean complete!"

# Format code
format:
	@echo "Formatting code..."
	forge fmt
	@echo "✅ Format complete!"

# Run local node
anvil:
	@echo "Starting local Anvil node..."
	anvil

# Snapshot gas
snapshot:
	@echo "Creating gas snapshot..."
	forge snapshot
	@echo "✅ Snapshot complete!"

# Helios Light Client commands
helios-install:
	@echo "Installing Helios..."
	@curl https://raw.githubusercontent.com/a16z/helios/master/heliosup/install | bash
	@echo "Run: source ~/.bashrc && heliosup"

helios-sepolia:
	@echo "Starting Helios for Sepolia (development)..."
	@chmod +x scripts/start-helios.sh
	@./scripts/start-helios.sh sepolia

helios-mainnet:
	@echo "Starting Helios for Mainnet (production)..."
	@chmod +x scripts/start-helios.sh
	@./scripts/start-helios.sh mainnet

helios-test:
	@echo "Testing Helios RPC connection..."
	@chmod +x scripts/test-helios.sh
	@./scripts/test-helios.sh

helios-checkpoint:
	@echo "Updating Helios checkpoint..."
	@chmod +x scripts/update-checkpoint.sh
	@./scripts/update-checkpoint.sh $(NETWORK)

# Production Consensus Node setup (Linux only)
consensus-setup:
	@echo "Setting up production consensus node..."
	@if [ "$$(uname)" != "Linux" ]; then \
		echo "Error: This command is for Linux production environments only"; \
		echo "For development, use: make helios-sepolia"; \
		exit 1; \
	fi
	@chmod +x scripts/setup-production-consensus.sh
	@sudo ./scripts/setup-production-consensus.sh

# Docker Production Deployment commands
docker-deploy:
	@echo "Deploying with Docker Compose..."
	@chmod +x scripts/docker-deploy.sh
	@./scripts/docker-deploy.sh

docker-start:
	@echo "Starting Docker services..."
	@docker compose up -d
	@echo "✅ Services started!"

docker-stop:
	@echo "Stopping Docker services..."
	@docker compose down
	@echo "✅ Services stopped!"

docker-restart:
	@echo "Restarting Docker services..."
	@docker compose restart
	@echo "✅ Services restarted!"

docker-logs:
	@echo "Viewing Docker logs (Ctrl+C to exit)..."
	@docker compose logs -f

docker-health:
	@echo "Checking Docker services health..."
	@chmod +x scripts/docker-health-check.sh
	@./scripts/docker-health-check.sh

docker-backup:
	@echo "Backing up Docker volumes..."
	@chmod +x scripts/docker-backup.sh
	@./scripts/docker-backup.sh

docker-clean:
	@echo "Cleaning Docker resources..."
	@docker compose down -v
	@docker system prune -f
	@echo "✅ Docker resources cleaned!"

docker-build:
	@echo "Building Docker images..."
	@docker compose build --no-cache
	@echo "✅ Docker images built!"

docker-dev:
	@echo "Starting development environment..."
	@docker compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Helios RPC: http://localhost:8545"
