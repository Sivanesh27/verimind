#!/usr/bin/env bash
# Pull the latest code and restart the API. Run on the VM (GitHub Actions calls this over SSH).
set -euo pipefail
APP_DIR="$HOME/verimind"

git -C "$APP_DIR" fetch --quiet origin main
git -C "$APP_DIR" reset --hard origin/main   # the VM never has local code edits; .env and LLM.gguf are untracked
cd "$APP_DIR/backend"
npm ci --omit=dev
pm2 startOrReload "$APP_DIR/deploy/oracle/ecosystem.config.cjs"
pm2 save
echo "Deployed $(git -C "$APP_DIR" rev-parse --short HEAD)"
