#!/bin/bash

# EthAura Local Network Setup Script
# This script helps you start the backend and frontend with local network access

set -e

echo "🚀 EthAura Local Network Setup"
echo "================================"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Windows;;
    MINGW*)     MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "📱 Detected OS: $MACHINE"
echo ""

# Find local IP address
echo "🔍 Finding local IP address..."
if [ "$MACHINE" = "Mac" ]; then
    # Try en0 (WiFi) first, then en1 (Ethernet)
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif [ "$MACHINE" = "Linux" ]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    echo "⚠️  Windows detected. Please find your IP manually:"
    echo "   Run: ipconfig | findstr IPv4"
    echo ""
    read -p "Enter your local IP address (e.g., 192.168.1.4): " LOCAL_IP
fi

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local IP address"
    echo ""
    echo "Please find your IP manually:"
    echo "  macOS:   ipconfig getifaddr en0"
    echo "  Linux:   hostname -I"
    echo "  Windows: ipconfig | findstr IPv4"
    echo ""
    read -p "Enter your local IP address: " LOCAL_IP
fi

echo "✅ Local IP: $LOCAL_IP"
echo ""

# Note: VITE_BACKEND_URL is kept empty to use Vite proxy
echo "ℹ️  VITE_BACKEND_URL is kept empty (uses Vite proxy)"
echo "   Mobile testing requires HTTPS (use ngrok instead)"
echo ""

# Show access URLs
echo "🌐 Access URLs:"
echo "   Desktop: http://$LOCAL_IP:5173"
echo "   Backend: http://$LOCAL_IP:3001"
echo "   Health:  http://$LOCAL_IP:3001/health"
echo ""

# Ask if user wants to start services
read -p "Start backend and frontend now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting services..."
    echo ""
    
    # Check if node_modules exist
    if [ ! -d "backend/node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi
    
    if [ ! -d "frontend/node_modules" ]; then
        echo "📦 Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    echo ""
    echo "✅ Starting backend on port 3001..."
    echo "✅ Starting frontend on http://$LOCAL_IP:5173"
    echo ""
    echo "📱 To test on mobile:"
    echo "   1. Connect mobile to same WiFi network"
    echo "   2. Open browser to: http://$LOCAL_IP:5173"
    echo "   3. Login and go to Passkey Settings"
    echo "   4. Click 'Add Device' → 'Mobile / Tablet'"
    echo "   5. Scan QR code with mobile camera"
    echo ""
    echo "Press Ctrl+C to stop both services"
    echo ""
    
    # Start backend in background
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    
    # Wait a bit for backend to start
    sleep 2
    
    # Start frontend (host is configured in vite.config.js)
    cd frontend
    npm run dev
    
    # When frontend exits, kill backend
    kill $BACKEND_PID 2>/dev/null || true
else
    echo ""
    echo "ℹ️  To start manually:"
    echo ""
    echo "   Terminal 1 (Backend):"
    echo "   $ cd backend && npm start"
    echo ""
    echo "   Terminal 2 (Frontend):"
    echo "   $ cd frontend && npm run dev"
    echo ""
    echo "   Then open: http://$LOCAL_IP:3000"
    echo ""
fi

