#!/bin/bash
set -euo pipefail
REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE_DIR="$REPO_DIR/dist"
TARGET_INPUT="${1:?Provide the cPanel document root}"
[[ "$TARGET_INPUT" = /* && "$TARGET_INPUT" != / ]] || { echo 'Invalid document root' >&2; exit 1; }
[[ -f "$SOURCE_DIR/index.html" && -f "$SOURCE_DIR/release.json" ]] || { echo 'Incomplete release' >&2; exit 1; }
mkdir -p -- "$TARGET_INPUT"
TARGET_DIR="$(cd -- "$TARGET_INPUT" && pwd -P)"
case "$TARGET_DIR/" in "$REPO_DIR/"*) echo 'Document root must be outside the repository' >&2; exit 1;; esac
case "$REPO_DIR/" in "$TARGET_DIR/"*) echo 'Repository must be outside the document root' >&2; exit 1;; esac
command -v rsync >/dev/null || { echo 'rsync is required on the cPanel server' >&2; exit 1; }
# Only website files are copied. Hosting-specific files are retained.
rsync -rlt --chmod=D755,F644 \
  --exclude='/.htaccess' --exclude='/.well-known/' --exclude='/cgi-bin/' \
  --exclude='/.user.ini' --exclude='/php.ini' \
  "$SOURCE_DIR/" "$TARGET_DIR/"
# Update only our marked Apache block, retaining the host's existing rules.
TEMP_HTACCESS="$(mktemp "$TARGET_DIR/.horizons-apache.XXXXXX")"
trap 'rm -f -- "$TEMP_HTACCESS"' EXIT
if [[ -f "$TARGET_DIR/.htaccess" ]]; then
  awk '/^# BEGIN HORIZONS MANAGED$/{managed=1;next} /^# END HORIZONS MANAGED$/{managed=0;next} !managed{print}' "$TARGET_DIR/.htaccess" > "$TEMP_HTACCESS"
fi
{
  printf '\n# BEGIN HORIZONS MANAGED\n'
  cat "$SOURCE_DIR/.htaccess"
  printf '# END HORIZONS MANAGED\n'
} >> "$TEMP_HTACCESS"
chmod 644 "$TEMP_HTACCESS"
mv -- "$TEMP_HTACCESS" "$TARGET_DIR/.htaccess"
trap - EXIT
printf 'HORIZONS release deployed to %s\n' "$TARGET_DIR"
