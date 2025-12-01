# Multi-stage build for production frontend

# Stage 1: Build the frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_WEB3AUTH_CLIENT_ID
ARG VITE_CHAIN_ID
ARG VITE_RPC_URL
ARG VITE_FACTORY_ADDRESS
ARG VITE_ENTRYPOINT_ADDRESS

# Set environment variables for build
ENV VITE_WEB3AUTH_CLIENT_ID=${VITE_WEB3AUTH_CLIENT_ID}
ENV VITE_CHAIN_ID=${VITE_CHAIN_ID}
ENV VITE_RPC_URL=${VITE_RPC_URL}
ENV VITE_FACTORY_ADDRESS=${VITE_FACTORY_ADDRESS}
ENV VITE_ENTRYPOINT_ADDRESS=${VITE_ENTRYPOINT_ADDRESS}

# Build the application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files from builder stage
# Note: nginx.conf is mounted via docker-compose.yml volume
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

