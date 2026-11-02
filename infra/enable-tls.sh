#!/usr/bin/env bash
#
# Obtain a Let's Encrypt certificate with the HTTP-01 challenge and switch the vhost
# to HTTPS. HTTPS is not cosmetic here: service-worker registration and the
# `beforeinstallprompt` install flow only exist in a secure context.
#
#   sudo DOMAIN=cloud.example.com EMAIL=you@example.com bash infra/enable-tls.sh
#
# Prerequisite: DNS A/AAAA record for DOMAIN already points at this machine, ports
# 80 and 443 are reachable from the internet, and infra/install-service.sh has run.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

log() { printf '[tls] %s\n' "$*"; }
die() { printf '[tls] ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this with sudo"
[ -n "$DOMAIN" ] || die "set DOMAIN, e.g. sudo DOMAIN=cloud.example.com bash infra/enable-tls.sh"
[ -f /etc/nginx/sites-enabled/gameforge.conf ] || die "install the vhost first: sudo DOMAIN=$DOMAIN bash $APP_DIR/infra/install-service.sh"

# The HTTP-01 challenge is answered from this directory by the port-80 vhost.
install -d -o www-data -g www-data -m 755 /var/www/certbot

resolves_here() {
  local ips
  ips="$(getent hosts "$DOMAIN" | awk '{print $1}' || true)"
  [ -n "$ips" ]
}
if ! resolves_here; then
  log "warning: $DOMAIN does not resolve from this host yet; certbot will fail if that is not just local DNS"
fi

# Issuance lives in exactly one place; this script only orchestrates and swaps vhosts.
# The helper is a no-op when the certificate is already on disk, so running the two
# phases separately (request-cert.sh, then this) and running this alone are equivalent.
DOMAIN="$DOMAIN" EMAIL="$EMAIL" WEBROOT="${WEBROOT:-/var/www/certbot}" \
  bash "$APP_DIR/infra/request-cert.sh"
[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] || die "no certificate for $DOMAIN after the request step"

log "installing the TLS vhost"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__APP_DIR__|$APP_DIR|g" \
  "$APP_DIR/infra/nginx/gameforge-tls.conf" > /etc/nginx/sites-available/gameforge.conf
ln -sfn /etc/nginx/sites-available/gameforge.conf /etc/nginx/sites-enabled/gameforge.conf

log "validating and reloading nginx"
nginx -t
systemctl reload nginx

log "renewal timer status"
systemctl list-timers 'certbot.timer' --no-pager || true

log "checking the public endpoint"
if curl -fsS --max-time 10 -o /dev/null -w '%{http_code}\n' "https://$DOMAIN/api/runtime"; then
  log "https://$DOMAIN/ is serving the portal over TLS"
else
  log "warning: https://$DOMAIN/api/runtime did not answer 2xx from this host"
  log "check: dig $DOMAIN, ufw status, and the provider firewall"
fi
