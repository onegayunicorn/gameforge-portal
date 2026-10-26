#!/usr/bin/env bash
#
# One-time provisioning for a GameForge Portal host (Ubuntu 24.04 LTS).
# Installs Node.js 22, nginx, certbot and ffmpeg, then locks the firewall down.
#
#   sudo bash infra/provision.sh
#
# Idempotent: safe to re-run. It does not clone the repository and does not
# install the service — see docs/DEPLOY-VM.md for the ordered runbook.
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-22}"          # package.json requires >=22.0.0 <23
APP_ROOT="${APP_ROOT:-/srv/gameforge}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-ubuntu}}"
REBOOT="${REBOOT:-0}"                   # REBOOT=1 reboots when the kernel asks for it

log() { printf '[provision] %s\n' "$*"; }
die() { printf '[provision] ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this with sudo: sudo bash infra/provision.sh"
id -u "$SERVICE_USER" >/dev/null 2>&1 || die "user '$SERVICE_USER' does not exist (override with SERVICE_USER=...)"

log "updating apt index"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

log "installing base packages"
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git ufw nginx certbot python3-certbot-nginx \
  ffmpeg unattended-upgrades rsync

log "installing Node.js ${NODE_MAJOR}.x from NodeSource"
# Download, inspect, then run — rather than piping a remote script straight into a root shell.
nodesource_setup="$(mktemp /tmp/nodesource-setup.XXXXXX.sh)"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$nodesource_setup"
bash "$nodesource_setup"
rm -f "$nodesource_setup"
apt-get install -y nodejs

node_major_installed="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major_installed" -ge 22 ] || die "node $(node -v) is too old for this repository (needs >=22 <23)"
log "node $(node -v), npm $(npm -v)"

log "configuring swap (npm ci plus the PWA build peak well above the idle footprint)"
if [ -z "$(swapon --show --noheadings || true)" ]; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  log "2 GiB swapfile active"
else
  log "swap already present, leaving it alone"
fi

log "creating application directories"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 755 "$APP_ROOT"
install -d -o www-data -g www-data -m 755 /var/www/certbot
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$APP_ROOT/backups"

log "configuring firewall"
# SSH must be allowed before the policy is enabled, or the session is cut off.
if ufw app list 2>/dev/null | grep -qx 'OpenSSH'; then
  ufw allow OpenSSH >/dev/null
else
  ufw allow 22/tcp >/dev/null
fi
ufw allow 80/tcp >/dev/null    # HTTP-01 challenge and the redirect
ufw allow 443/tcp >/dev/null   # HTTPS: required for service workers and install prompts
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable >/dev/null
log "ufw active: $(ufw status | tr '\n' ' ')"

log "removing the stock nginx default vhost so it cannot shadow the portal"
rm -f /etc/nginx/sites-enabled/default

log "provisioning complete"
log "next: clone the repository into $APP_ROOT, then sudo bash infra/install-service.sh"

if [ -f /var/run/reboot-required ]; then
  log "a reboot is required to finish kernel/library updates"
  if [ "$REBOOT" = "1" ]; then
    log "REBOOT=1 set, rebooting now"
    reboot
  else
    log "reboot when convenient: sudo reboot  (or re-run with REBOOT=1)"
  fi
fi
