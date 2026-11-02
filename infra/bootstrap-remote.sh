#!/usr/bin/env bash
#
# Runs ON the target host. Orchestrates the full first-time install in the only order
# that works, and is idempotent, so re-running it is a repair rather than a repeat.
#
#   Called by scripts/bootstrap-vm.sh (which uploads this directory and sets the env).
#   Can also be run by hand from a clone:  sudo -E DOMAIN=… bash infra/bootstrap-remote.sh
#
# Why this order:
#   1 provision       needs root, installs node/nginx/certbot/ffmpeg, no repo required
#   2 checkout        the repo is what the remaining steps operate on
#   3 build           pwa/ must exist before nginx is pointed at it
#   4 install-service writes the HTTP-only vhost + unit, and must precede the challenge
#   5 request-cert    needs the port-80 vhost already answering
#   6 enable-tls      swaps the vhost, which requires a certificate to exist
set -Eeuo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP_DIR="${APP_DIR:-/srv/gameforge/gameforge-portal}"
REPO_URL="${REPO_URL:-https://github.com/onegayunicorn/gameforge-portal.git}"
BRANCH="${BRANCH:-main}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }
step() { printf '[bootstrap] %s\n' "$*"; }

[ -n "$DOMAIN" ] || die "DOMAIN is required"
printf '%s' "$DOMAIN" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$' \
  || die "DOMAIN '$DOMAIN' is not a plain DNS name"
[ -f "$HERE/provision.sh" ] || die "infra/ was not uploaded completely ($HERE/provision.sh missing)"

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
SUDO_KEEP=(env "PATH=$PATH")
# An `if`, not `[ -n ... ] && ...`: under `set -e` the false test would abort the script
# before the first phase instead of falling through.
if [ -n "${SUDO_USER:-}" ]; then SERVICE_USER="${SERVICE_USER:-$SUDO_USER}"; fi

# ---------------------------------------------------------------- 1. provisioning
log "1/6 provisioning the substrate"
$SUDO "${SUDO_KEEP[@]}" SERVICE_USER="$SERVICE_USER" bash "$HERE/provision.sh"

command -v node >/dev/null || die "node is missing after provisioning"
command -v nginx >/dev/null || die "nginx is missing after provisioning"
command -v certbot >/dev/null || die "certbot is missing after provisioning"
step "node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------- 2. checkout
log "2/6 checking out the repository"
if [ -d "$APP_DIR/.git" ]; then
  step "existing checkout, fast-forwarding to origin/$BRANCH"
  git -C "$APP_DIR" fetch --prune origin "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  step "cloning $REPO_URL into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
[ -f "$APP_DIR/scripts/serve-public.js" ] || die "$APP_DIR does not look like the portal repository"
[ -f "$APP_DIR/.env" ] || cp "$APP_DIR/.env.example" "$APP_DIR/.env"
step "HEAD $(git -C "$APP_DIR" rev-parse --short HEAD)"

# ---------------------------------------------------------------- 3. build
log "3/6 installing dependencies and building the installable site"
cd "$APP_DIR"
export ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm_config_audit=false npm_config_fund=false
npm ci --no-audit --no-fund
npm run pwa:build
[ -f pwa/manifest.webmanifest ] || die "pwa/manifest.webmanifest missing after build"
[ -f pwa/sw.js ] || die "pwa/sw.js missing after build"
step "site built: $(find pwa -type f | wc -l | tr -d ' ') files"

# ---------------------------------------------------------------- 4. service + HTTP vhost
log "4/6 installing the systemd unit and the HTTP-only vhost"
$SUDO "${SUDO_KEEP[@]}" DOMAIN="$DOMAIN" SERVICE_USER="$SERVICE_USER" APP_DIR="$APP_DIR" \
  bash "$APP_DIR/infra/install-service.sh"

# ---------------------------------------------------------------- 5. certificate
log "5/6 requesting the certificate"
$SUDO "${SUDO_KEEP[@]}" DOMAIN="$DOMAIN" EMAIL="$EMAIL" APP_DIR="$APP_DIR" \
  bash "$APP_DIR/infra/request-cert.sh"

# ---------------------------------------------------------------- 6. https
log "6/6 enabling HTTPS"
$SUDO "${SUDO_KEEP[@]}" DOMAIN="$DOMAIN" APP_DIR="$APP_DIR" \
  bash "$APP_DIR/infra/enable-tls.sh"

# ---------------------------------------------------------------- verify
log "verifying the lattice"
curl -fsS --max-time 10 "http://127.0.0.1:4173/api/runtime" >/dev/null \
  || die "the runtime endpoint did not answer on 127.0.0.1:4173"
step "runtime endpoint: ok"
# Not `curl -I | head -n 1`: head closing the pipe can SIGPIPE curl, and with pipefail
# that reads as a failed deploy even though TLS answered.
root_code="$(curl -fsS --max-time 10 -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)"
[ "$root_code" = "200" ] || die "https://$DOMAIN/ answered ${root_code:-nothing}"
step "document: $root_code"
curl -fsS --max-time 10 -o /dev/null -w 'manifest: %{http_code} %{content_type}\n' \
  "https://$DOMAIN/manifest.webmanifest"
curl -fsS --max-time 10 -o /dev/null -w 'service worker: %{http_code}\n' "https://$DOMAIN/sw.js"

cat <<EOF

[bootstrap] complete.

  portal        https://$DOMAIN/
  cloud library https://$DOMAIN/cloud/
  runtime       https://$DOMAIN/api/runtime

  logs    journalctl -u gameforge -n 80 --no-pager
  redeploy bash $APP_DIR/scripts/deploy-vm.sh

Open the site over HTTPS once, then use the browser install prompt (Android/Chrome) or
Share -> Add to Home Screen (iOS Safari). A service worker is only registered in a
secure context, so the plain-HTTP bootstrap phase could never have offered installation.
EOF
