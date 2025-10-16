.PHONY: install build test deploy clean frontend help

# Default target
help:
	@echo "EthAura - P256 Account Abstraction"
	@echo ""
	@echo "Available commands:"
	@echo "  make install        - Install all dependencies"
	@echo "  make build          - Build smart contracts"
	@echo "  make test           - Run contract tests"
	@echo "  make test-gas       - Run tests with gas report"
	@echo "  make deploy-sepolia - Deploy to Sepolia testnet"
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
	forge coverage
	@echo "✅ Coverage complete!"

# Deploy to Sepolia
deploy-sepolia:
	@echo "Deploying to Sepolia..."
	forge script script/Deploy.s.sol:DeployScript --rpc-url sepolia --broadcast --verify
	@echo "✅ Deployment complete!"

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
