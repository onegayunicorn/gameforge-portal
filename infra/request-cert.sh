#!/usr/bin/env bash
#
# Phase 2 of the TLS install: obtain the certificate with the HTTP-01 webroot
# challenge. nginx is already answering /.well-known/acme-challenge/ from this
# directory (installed by infra/install-service.sh), so no vhost changes and no
# reload are needed here.
#
#   sudo DOMAIN=cloud.example.com EMAIL=you@example.com bash infra/request-cert.sh
#
# Called automatically by infra/enable-tls.sh when no certificate exists, so running
# it on its own is only useful when you want the certificate before the swap (for
# example to check DNS and port 80 reachability first).
#
# Environment:
#   DOMAIN    required hostname
#   EMAIL     Let's Encrypt contact address (interactive prompt when empty)
#   WEBROOT   challenge directory (default /var/www/certbot)
#   STAGING   1 to use the Let's Encrypt staging CA (default 0)
#   RENEW     1 to issue again even when a certificate is already on disk (default 0)
set -Eeuo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
WEBROOT="${WEBROOT:-/var/www/certbot}"
STAGING="${STAGING:-0}"
RENEW="${RENEW:-0}"

log() { printf '[cert] %s\n' "$*"; }
die() { printf '[cert] ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this with sudo"
[ -n "$DOMAIN" ] || die "set DOMAIN, e.g. sudo DOMAIN=cloud.example.com bash infra/request-cert.sh"
printf '%s' "$DOMAIN" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$' \
  || die "DOMAIN '$DOMAIN' is not a plain DNS name"
command -v certbot >/dev/null || die "certbot is not installed; run infra/provision.sh first"

install -d -o www-data -g www-data -m 755 "$WEBROOT"

CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT" ] && [ "$RENEW" != "1" ]; then
  log "certificate already present for $DOMAIN, nothing to do (RENEW=1 to reissue)"
  exit 0
fi

# The challenge is served by the port-80 vhost, so a stale or missing DNS record is the
# usual cause of failure. Report it before certbot spends a validation attempt.
if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  log "warning: $DOMAIN does not resolve from this host; validation will fail unless that is only local DNS"
fi

certbot_args=(certonly --webroot --webroot-path "$WEBROOT" -d "$DOMAIN"
             --deploy-hook "systemctl reload nginx")
if [ -n "$EMAIL" ]; then
  certbot_args+=(--non-interactive --agree-tos --no-eff-email --email "$EMAIL")
else
  log "EMAIL not set: certbot will prompt interactively"
fi
[ "$STAGING" = "1" ] && certbot_args+=(--staging)

log "requesting certificate for $DOMAIN (webroot $WEBROOT)"
# No --force-renewal: Let's Encrypt limits duplicate certificates for an identical name
# set to 5 per week, and an unnecessary reissue is the fastest way to hit it.
certbot "${certbot_args[@]}"

[ -f "$CERT" ] || die "certbot returned without writing $CERT — check: /var/log/letsencrypt/letsencrypt.log"
log "certificate written to $(dirname "$CERT")"
log "next: sudo DOMAIN=$DOMAIN bash infra/enable-tls.sh"
