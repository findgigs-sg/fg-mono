#!/usr/bin/env bash
set -euo pipefail

echo "Starting Postgres..."
docker compose up -d

echo "Waiting for Postgres to be ready..."
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "Running migrations..."
pnpm db:migrate

echo "Database ready."
