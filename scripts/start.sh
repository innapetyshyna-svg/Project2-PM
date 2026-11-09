#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -t pm-app .
docker rm -f pm-app >/dev/null 2>&1 || true
mkdir -p data
docker run -d --name pm-app -p 8000:8000 --env-file .env -v "$PWD/data:/app/data" pm-app
echo "Running at http://127.0.0.1:8000"
