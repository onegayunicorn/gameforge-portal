#!/usr/bin/env bash
#
# Pull the pushed commit onto the host, rebuild the installable site, restart the
# runtime service and prove it answers. Rolls back to the previous commit when the
# new one does not come up.
#
#   bash scripts/deploy-vm.sh              # normal deploy
#   bash scripts/deploy-vm.sh --skip-fetch # use whatever origin refs are already local
#
# Environment:
#   APP_DIR     checkout to deploy      (default /srv/gameforge/gameforge-portal)
#   BRANCH      branch to deploy        (default main)
#   SERVICE     systemd unit            (default gameforge.service)
#   HEALTH_URL  readiness endpoint      (default http://127.0.0.1:4173/api/runtime)
#   ROLLBACK    1 to roll back on failure, 0 to leave the checkout as-is (default 1)
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/gameforge/gameforge-portal}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-gameforge.service}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4173/api/runtime}"
ROLLBACK="${ROLLBACK:-1}"
LOG_FILE="${LOG_FILE:-/srv/gameforge/deploy.log}"

SKIP_FETCH=0
for arg in "$@"; do
  case "$arg" in
    --skip-fetch) SKIP_FETCH=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

log() {
  printf '[deploy] %s\n' "$*"
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG_FILE" 2>/dev/null || true
}
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"

# The Windows-built installers and the Electron binary are useless on a headless host;
# skipping the download keeps `npm ci` fast and avoids 120 MB of dead weight.
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false
export NODE_ENV=production

cd "$APP_DIR"

if [ "$SKIP_FETCH" -eq 0 ]; then
  log "fetching origin/$BRANCH"
  git fetch --prune origin "$BRANCH"
fi
TARGET="origin/$BRANCH"
git rev-parse --verify --quiet "$TARGET" >/dev/null || die "$TARGET is not available locally"
NEW_SHA="$(git rev-parse "$TARGET")"
OLD_SHA="$(git rev-parse HEAD)"
log "deploying $NEW_SHA (was $OLD_SHA)"

git checkout --quiet --force -B deploy "$TARGET"
git reset --quiet --hard "$TARGET"

build() {
  log "installing locked dependencies"
  # Dev dependencies are required: studio:build needs esbuild plus the @mlc-ai/web-llm
  # and loglevel packages, and pwa:build regenerates the site from portal/.
  npm ci --no-audit --no-fund || return 1
  log "rebuilding the installable site (pwa/)"
  npm run pwa:build || return 1
}

wait_healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

verify_artifacts() {
  [ -f pwa/index.html ] || die "pwa/index.html missing after build"
  [ -f pwa/manifest.webmanifest ] || die "pwa/manifest.webmanifest missing — the site would not be installable"
  [ -f pwa/sw.js ] || die "pwa/sw.js missing — offline support and install flow would break"
}

restart() {
  log "restarting $SERVICE"
  sudo -n systemctl restart "$SERVICE" || return 1
  wait_healthy || return 1
  log "health check passed: $HEALTH_URL"
}

rollback() {
  log "deploy failed, rolling back to $OLD_SHA"
  git reset --quiet --hard "$OLD_SHA"
  build || die "rollback build failed — service may be down, inspect: journalctl -u $SERVICE -n 120 --no-pager"
  verify_artifacts
  restart || die "rollback target $OLD_SHA is also unhealthy — inspect: journalctl -u $SERVICE -n 120 --no-pager"
  log "rolled back to $OLD_SHA"
}

if ! { build && verify_artifacts && restart; }; then
  if [ "$ROLLBACK" = "1" ] && [ "$NEW_SHA" != "$OLD_SHA" ]; then
    rollback
    die "deploy of $NEW_SHA failed and was rolled back to $OLD_SHA"
  fi
  die "deploy of $NEW_SHA failed; rollback disabled (ROLLBACK=$ROLLBACK)"
fi

log "deployed $NEW_SHA"
sudo -n systemctl is-active "$SERVICE" || true
