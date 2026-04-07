#!/bin/bash
# Start dev server with Tailscale Funnel, auto-stop tunnel on exit

set -e

cleanup() {
  echo -e "\n\033[0;34mStopping Tailscale Funnel...\033[0m"
  tailscale funnel --https=3001 off
  echo -e "\033[0;32mTunnel stopped.\033[0m"
}

trap cleanup EXIT INT TERM

bash scripts/tunnel.sh
turbo watch dev --continue
