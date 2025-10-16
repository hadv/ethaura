#!/bin/bash
set -e

# Default values
NETWORK=${NETWORK:-mainnet}
CONSENSUS_RPC=${CONSENSUS_RPC:-http://nimbus:5052}
EXECUTION_RPC=${EXECUTION_RPC}
CHECKPOINT=${CHECKPOINT}
RPC_PORT=${RPC_PORT:-8545}
RPC_BIND_IP=${RPC_BIND_IP:-0.0.0.0}

echo "Starting Helios Light Client..."
echo "Network: $NETWORK"
echo "Consensus RPC: $CONSENSUS_RPC"
echo "Execution RPC: ${EXECUTION_RPC:0:50}..."
echo "RPC Port: $RPC_PORT"

# Wait for consensus node to be ready
echo "Waiting for consensus node to be ready..."
until curl -s -f "$CONSENSUS_RPC/eth/v1/node/health" > /dev/null 2>&1; do
    echo "Consensus node not ready, waiting..."
    sleep 5
done
echo "Consensus node is ready!"

# Build Helios command
CMD="helios ethereum \
    --network $NETWORK \
    --consensus-rpc $CONSENSUS_RPC \
    --execution-rpc $EXECUTION_RPC \
    --rpc-port $RPC_PORT \
    --rpc-bind-ip $RPC_BIND_IP"

# Add checkpoint if provided
if [ -n "$CHECKPOINT" ]; then
    CMD="$CMD --checkpoint $CHECKPOINT"
fi

# Add data directory (use helios user home directory)
CMD="$CMD --data-dir /home/helios/.helios/$NETWORK"

echo "Executing: $CMD"
exec $CMD

