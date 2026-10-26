#!/usr/bin/env bash
#
# Install (or re-install) the systemd unit, the sudoers rule the deploy script needs,
# and the nginx vhost for this checkout.
#
#   sudo DOMAIN=cloud.example.com bash infra/install-service.sh
#
# The vhost installed here is the HTTP-only bootstrap vhost. Run
# infra/enable-tls.sh afterwards to obtain a certificate and switch to HTTPS.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-ubuntu}}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

log() { printf '[install] %s\n' "$*"; }
die() { printf '[install] ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this with sudo"
[ -n "$DOMAIN" ] || die "set DOMAIN, e.g. sudo DOMAIN=cloud.example.com bash infra/install-service.sh"
printf '%s' "$DOMAIN" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$' \
  || die "DOMAIN '$DOMAIN' is not a plain DNS name (no scheme, no path)"
id -u "$SERVICE_USER" >/dev/null 2>&1 || die "user '$SERVICE_USER' does not exist"
command -v node >/dev/null || die "node is not installed; run infra/provision.sh first"
[ -f "$APP_DIR/pwa/index.html" ] || die "$APP_DIR/pwa/index.html is missing — clone the repo and run 'npm run pwa:build' first"
[ -f "$APP_DIR/scripts/serve-public.js" ] || die "$APP_DIR is not a gameforge-portal checkout"

NODE_BIN="$(command -v node)"
render() {
  sed -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__APP_DIR__|$APP_DIR|g" \
      -e "s|__SERVICE_USER__|$SERVICE_USER|g" \
      -e "s|/usr/bin/node|$NODE_BIN|g" \
      "$1"
}

log "installing systemd unit"
render "$APP_DIR/infra/systemd/gameforge.service" > /etc/systemd/system/gameforge.service
systemctl daemon-reload

log "installing nginx snippet and vhost"
install -d -m 755 /etc/nginx/snippets /etc/nginx/sites-available /etc/nginx/sites-enabled
mkdir -p /var/www/certbot
render "$APP_DIR/infra/nginx/gameforge-locations.conf" > /etc/nginx/snippets/gameforge-locations.conf
render "$APP_DIR/infra/nginx/gameforge-headers.conf" > /etc/nginx/snippets/gameforge-headers.conf

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  log "certificate for $DOMAIN found, installing the TLS vhost"
  render "$APP_DIR/infra/nginx/gameforge-tls.conf" > /etc/nginx/sites-available/gameforge.conf
else
  log "no certificate yet, installing the HTTP-only bootstrap vhost"
  render "$APP_DIR/infra/nginx/gameforge-http.conf" > /etc/nginx/sites-available/gameforge.conf
fi
ln -sfn /etc/nginx/sites-available/gameforge.conf /etc/nginx/sites-enabled/gameforge.conf
rm -f /etc/nginx/sites-enabled/default

log "validating nginx configuration"
nginx -t

log "installing the deploy sudoers rule"
render "$APP_DIR/infra/sudoers/gameforge-deploy" > /etc/sudoers.d/gameforge-deploy
chmod 440 /etc/sudoers.d/gameforge-deploy
visudo -c -f /etc/sudoers.d/gameforge-deploy >/dev/null || die "generated sudoers file is invalid"

log "starting the portal service"
systemctl enable --now gameforge.service
systemctl reload nginx

log "waiting for the runtime endpoint on 127.0.0.1:4173"
for _ in $(seq 1 25); do
  if curl -fsS --max-time 2 http://127.0.0.1:4173/api/runtime >/dev/null 2>&1; then
    log "service healthy"
    break
  fi
  sleep 1
done
curl -fsS --max-time 2 http://127.0.0.1:4173/api/runtime >/dev/null 2>&1 \
  || die "service did not become healthy — check: journalctl -u gameforge -n 80 --no-pager"

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  log "done: https://$DOMAIN/"
else
  log "done over HTTP only. Installability needs TLS, so next run:"
  log "  sudo DOMAIN=$DOMAIN EMAIL=you@example.com bash $APP_DIR/infra/enable-tls.sh"
fi
