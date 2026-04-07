#!/bin/bash
# Start Tailscale Funnel for local development

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if ! command -v tailscale &> /dev/null; then
  echo -e "${RED}Error: Tailscale is not installed.${NC}"
  echo -e "Install with: ${BLUE}brew install tailscale${NC}"
  exit 1
fi

if ! tailscale status &> /dev/null; then
  echo -e "${YELLOW}Error: Tailscale not running. Run 'tailscale up' first.${NC}"
  exit 1
fi

MACHINE_NAME=$(tailscale status --json | jq -r '.Self.DNSName' | sed 's/\.$//')

if [ -z "$MACHINE_NAME" ] || [ "$MACHINE_NAME" = "null" ]; then
  echo -e "${RED}Error: Could not get Tailscale DNS name.${NC}"
  echo -e "Make sure Tailscale is running: ${BLUE}tailscale up${NC}"
  exit 1
fi

echo -e "${BLUE}Starting Tailscale Funnel...${NC}"
echo -e "Machine: ${MACHINE_NAME}\n"

echo -e "Starting tunnel (localhost:3001 -> 3001)..."
tailscale funnel --bg --https=3001 http://localhost:3001

TUNNEL_URL="https://${MACHINE_NAME}:3001"

echo -e "\n${GREEN}Tunnel Ready!${NC}"
echo -e "URL: ${TUNNEL_URL}"
echo -e "\n${YELLOW}This URL is persistent - it won't change on restart!${NC}"
echo -e "\nTo stop: ${BLUE}pnpm tunnel:stop${NC}"
