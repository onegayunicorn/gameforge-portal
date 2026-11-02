#!/usr/bin/env bash
#
# Back up the state that is *not* reproducible from git: the local .env, the catalogue
# overrides, and the nginx/systemd configuration this host was installed with.
#
#   bash scripts/backup.sh
#   sudo bash scripts/backup.sh      # also captures /etc/nginx and /etc/systemd copies
#
# Environment:
#   APP_DIR      checkout          (default /srv/gameforge/gameforge-portal)
#   BACKUP_DIR   output directory  (default /srv/gameforge/backups)
#   RETAIN_DAYS  retention window  (default 14)
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/gameforge/gameforge-portal}"
BACKUP_DIR="${BACKUP_DIR:-/srv/gameforge/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

[ -d "$APP_DIR" ] || die "$APP_DIR does not exist"
mkdir -p "$BACKUP_DIR"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/gameforge-backup.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

copied=0
take() {  # take <source> <name inside archive>
  if [ -e "$1" ]; then
    mkdir -p "$STAGE/$(dirname "$2")"
    cp -a "$1" "$STAGE/$2"
    copied=$((copied + 1))
    log "captured $1"
  fi
}

take "$APP_DIR/.env" env
take "$APP_DIR/portal/data" portal/data
take "$APP_DIR/portal/cloud/data" portal/cloud/data
take "$APP_DIR/portal/manus-routes.json" portal/manus-routes.json
take /etc/systemd/system/gameforge.service systemd/gameforge.service
take /etc/nginx/sites-available/gameforge.conf nginx/gameforge.conf
take /etc/nginx/snippets/gameforge-locations.conf nginx/gameforge-locations.conf
take /etc/nginx/snippets/gameforge-headers.conf nginx/gameforge-headers.conf
take /etc/sudoers.d/gameforge-deploy sudoers/gameforge-deploy

# Trivial, but it makes "which commit was this host running" answerable later.
if git -C "$APP_DIR" rev-parse --verify --quiet HEAD >/dev/null; then
  git -C "$APP_DIR" rev-parse HEAD > "$STAGE/git-head.txt"
  git -C "$APP_DIR" log -1 --pretty='%H %ad %s' --date=iso >> "$STAGE/git-head.txt"
fi

[ "$copied" -gt 0 ] || die "nothing to back up — refusing to write an empty archive"

NAME="gameforge-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
ARCHIVE="$BACKUP_DIR/$NAME"
tar -czf "$ARCHIVE" -C "$STAGE" .

tar -tzf "$ARCHIVE" >/dev/null || die "archive $ARCHIVE is unreadable"
log "wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1), $copied entries)"

find "$BACKUP_DIR" -maxdepth 1 -name 'gameforge-backup-*.tar.gz' -type f -mtime "+$RETAIN_DAYS" -delete
log "retained backups: $(find "$BACKUP_DIR" -maxdepth 1 -name 'gameforge-backup-*.tar.gz' -type f | wc -l | tr -d ' ')"
log "restore: sudo tar -xzf $ARCHIVE -C /   # after extracting, place each file back at its original path"
