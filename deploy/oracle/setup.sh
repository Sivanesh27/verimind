#!/usr/bin/env bash
# One-time setup of the VeriMind backend on an Oracle Cloud "Always Free" Ubuntu VM (Arm or x86).
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/verimind/main/deploy/oracle/setup.sh -o setup.sh
#   bash setup.sh https://github.com/<you>/verimind.git
#
# Installs Node.js 22, pm2 and Caddy, clones the repo, opens ports 80/443, gives you
# free HTTPS at https://<public-ip-with-dashes>.sslip.io and starts the API with pm2.
set -euo pipefail

REPO_URL="${1:?Usage: bash setup.sh <git-repo-url>}"
APP_DIR="$HOME/verimind"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "Installing system packages"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates gnupg build-essential iptables-persistent \
  debian-keyring debian-archive-keyring apt-transport-https

log "Installing Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2

log "Getting the code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR/backend"
npm ci --omit=dev
[ -f .env ] || cp .env.example .env

log "Opening ports 80 and 443 in the VM firewall"
# Oracle's Ubuntu images ship iptables rules that block everything except SSH.
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null ||
    sudo iptables -I INPUT 6 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
sudo netfilter-persistent save

log "Installing Caddy (automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi
PUBLIC_IP="$(curl -fsS https://api.ipify.org)"
DOMAIN="${PUBLIC_IP//./-}.sslip.io"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy localhost:8080
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

log "Starting the API with pm2"
pm2 startOrReload "$APP_DIR/deploy/oracle/ecosystem.config.cjs"
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null

cat <<EOF

✅ Setup complete.

Your API URL:  https://$DOMAIN

Next steps:
  1. Put the model at   $APP_DIR/LLM.gguf     (see deployment.md, step 6.4)
  2. Edit settings:     nano $APP_DIR/backend/.env
  3. Restart:           pm2 restart verimind-api
  4. Watch logs:        pm2 logs verimind-api
  5. Check:             curl https://$DOMAIN/health
EOF
