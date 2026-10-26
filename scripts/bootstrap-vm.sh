#!/usr/bin/env bash
#
# One command, run from your workstation, that turns a fresh Ubuntu 24.04 host into a
# live HTTPS portal. Uploads infra/ and scripts/ to the host, then runs the phases there
# through a single SSH session with a TTY — which is what makes interactive sudo work.
#
#   bash scripts/bootstrap-vm.sh --host 203.0.113.10 --domain cloud.example.com \
#                                --email you@example.com [--user ubuntu] [--key ~/.ssh/id_ed25519]
#
# Options:
#   --host HOST        required, IP or hostname
#   --domain DOMAIN    required, DNS name already pointing at HOST
#   --email EMAIL      Let's Encrypt contact (interactive prompt if omitted)
#   --user USER        SSH user (default ubuntu; must be able to sudo)
#   --key PATH         private key (default: your ssh-agent / ~/.ssh/config)
#   --app-dir PATH     checkout on the host (default /srv/gameforge/gameforge-portal)
#   --repo-url URL     repository to clone on the host (default the canonical one)
#   --branch NAME      branch to deploy (default main)
#
# On Windows run this from Git Bash (it needs tar + ssh, not PowerShell). OpenSSH ships
# with Windows 10+; Git for Windows provides both.
#
# This replaces the per-phase copy-paste sequence. The per-phase scripts still exist and
# still work individually — this is a driver, not a second implementation.
set -Eeuo pipefail

HOST=""; DOMAIN=""; EMAIL=""
SSH_USER="ubuntu"; KEY=""
APP_DIR="/srv/gameforge/gameforge-portal"
REPO_URL="https://github.com/onegayunicorn/gameforge-portal.git"
BRANCH="main"

log() { printf '[bootstrap] %s\n' "$*"; }
die() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --user) SSH_USER="${2:-}"; shift 2 ;;
    --key) KEY="${2:-}"; shift 2 ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --repo-url) REPO_URL="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

[ -n "$HOST" ] || usage 1
[ -n "$DOMAIN" ] || usage 1
for value in "$HOST" "$DOMAIN" "$SSH_USER" "$APP_DIR" "$BRANCH"; do
  case "$value" in *[[:space:]]*) die "unsupported whitespace in '$value'" ;; esac
done
printf '%s' "$DOMAIN" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$' \
  || die "--domain '$DOMAIN' is not a plain DNS name"
case "$EMAIL" in *"'"*) die "single quotes are not supported in --email" ;; esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$REPO_ROOT/infra/bootstrap-remote.sh" ] || die "run this from inside the repository checkout"

command -v ssh >/dev/null || die "ssh is not on PATH"
command -v tar >/dev/null || die "tar is not on PATH"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
[ -n "$KEY" ] && SSH_OPTS+=(-i "$KEY" -o IdentitiesOnly=yes)
TARGET="$SSH_USER@$HOST"

log "preflight: $TARGET"
ssh "${SSH_OPTS[@]}" "$TARGET" 'set -e
  command -v sudo >/dev/null || { echo "sudo is not installed" >&2; exit 1; }
  printf "  host: %s\n  kernel: %s\n  user: %s\n" "$(hostname)" "$(uname -sr)" "$(id -un)"' \
  || die "cannot reach $TARGET over SSH (check the host, the key and the security group)"

STAGE="/tmp/gameforge-bootstrap-$$"
log "uploading infra/ and scripts/ to $STAGE"
ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$STAGE'"
tar -czf - -C "$REPO_ROOT" infra scripts \
  | ssh "${SSH_OPTS[@]}" "$TARGET" "tar -xzf - -C '$STAGE'" \
  || die "upload failed"

cleanup() {
  ssh "${SSH_OPTS[@]}" "$TARGET" "rm -rf '$STAGE'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "running the phases on the host (sudo may prompt for a password)"
# -t gives sudo a TTY. Without it, an interactive sudo prompt cannot be answered and the
# phase fails with "no tty present"; this is the detail a naive scripted deploy misses.
ssh -tt "${SSH_OPTS[@]}" "$TARGET" \
  "DOMAIN='$DOMAIN' EMAIL='$EMAIL' APP_DIR='$APP_DIR' SERVICE_USER='$SSH_USER' \
   REPO_URL='$REPO_URL' BRANCH='$BRANCH' bash '$STAGE/infra/bootstrap-remote.sh'"

log "done. If the host reported a pending reboot, run it once: ssh $TARGET 'sudo reboot'"
