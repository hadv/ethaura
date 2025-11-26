# Dockerfile for Helios Light Client

FROM rust:1.75-slim AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Clone and build Helios (pinned to stable release)
WORKDIR /build
RUN git clone --depth 1 --branch v0.8.1 https://github.com/a16z/helios.git && \
    cd helios && \
    cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Helios binary from builder
COPY --from=builder /build/helios/target/release/helios /usr/local/bin/helios

# Create helios user with proper home directory
RUN useradd -m -s /bin/bash helios && \
    mkdir -p /home/helios/.helios && \
    chown -R helios:helios /home/helios/.helios

WORKDIR /app

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER helios

# Expose RPC port
EXPOSE 8545

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8545 -X POST -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]

