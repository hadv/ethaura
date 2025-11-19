#!/bin/bash

# CORS Testing Script for EthAura
# Tests CORS configuration with different origins

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${1:-http://localhost:3001}"
FRONTEND_URL="${2:-https://ethersafe.ngrok.app}"

echo -e "${BLUE}🧪 EthAura CORS Testing${NC}"
echo "================================"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Function to test CORS
test_cors() {
  local origin=$1
  local description=$2
  
  echo -e "${YELLOW}Testing: $description${NC}"
  echo "Origin: $origin"
  
  # Make preflight request (OPTIONS)
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -X OPTIONS \
    "$BACKEND_URL/api/health" 2>&1)
  
  if [ "$response" = "204" ] || [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ CORS allowed (HTTP $response)${NC}"
  else
    echo -e "${RED}❌ CORS blocked (HTTP $response)${NC}"
  fi
  
  # Make actual request (GET)
  response=$(curl -s -w "\n%{http_code}" \
    -H "Origin: $origin" \
    "$BACKEND_URL/health" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Request successful (HTTP $http_code)${NC}"
    echo "Response: $body"
  else
    echo -e "${RED}❌ Request failed (HTTP $http_code)${NC}"
  fi
  
  echo ""
}

# Test 1: Configured frontend URL (should pass)
echo -e "${BLUE}Test 1: Configured Frontend URL${NC}"
test_cors "$FRONTEND_URL" "Configured FRONTEND_URL"

# Test 2: localhost (should pass)
echo -e "${BLUE}Test 2: Localhost${NC}"
test_cors "http://localhost:3000" "Localhost origin"

# Test 3: Random ngrok URL (should fail in production, pass in development)
echo -e "${BLUE}Test 3: Random ngrok URL${NC}"
test_cors "https://random123.ngrok.app" "Random ngrok URL (should fail in production)"

# Test 4: Invalid origin (should fail)
echo -e "${BLUE}Test 4: Invalid Origin${NC}"
test_cors "https://evil.com" "Invalid origin (should fail)"

# Test 5: No origin (should pass - for mobile apps)
echo -e "${BLUE}Test 5: No Origin${NC}"
echo -e "${YELLOW}Testing: No origin (mobile app/curl)${NC}"
response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✅ Request successful (HTTP $http_code)${NC}"
  echo "Response: $body"
else
  echo -e "${RED}❌ Request failed (HTTP $http_code)${NC}"
fi
echo ""

# Summary
echo "================================"
echo -e "${BLUE}📊 CORS Test Summary${NC}"
echo "================================"
echo ""
echo "Expected Results:"
echo "  ✅ Test 1: Configured Frontend URL - PASS"
echo "  ✅ Test 2: Localhost - PASS"
echo "  ❌ Test 3: Random ngrok URL - FAIL (production) / PASS (development)"
echo "  ❌ Test 4: Invalid Origin - FAIL"
echo "  ✅ Test 5: No Origin - PASS"
echo ""
echo "Check backend logs for detailed CORS messages:"
echo "  - '✅ CORS allowed: ...' indicates successful CORS"
echo "  - '⚠️ CORS blocked origin: ...' indicates blocked request"
echo ""
echo -e "${YELLOW}💡 Tip: Run backend with 'npm start' and check logs${NC}"

