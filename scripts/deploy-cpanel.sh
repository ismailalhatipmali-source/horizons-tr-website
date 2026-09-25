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
# Only website files are copied. Hosting-specific files are retained.
printf 'Copying HORIZONS website files to %s\n' "$TARGET_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -rlt --chmod=D755,F644 \
    --exclude='/.htaccess' --exclude='/.well-known/' --exclude='/cgi-bin/' \
    --exclude='/.user.ini' --exclude='/php.ini' \
    "$SOURCE_DIR/" "$TARGET_DIR/"
else
  # Shared hosting may not provide rsync. Copy only source-listed paths,
  # including dotfiles, without deleting or chmod-ing unrelated hosting files.
  printf 'rsync unavailable; using the standard file-copy fallback.\n'
  shopt -s dotglob nullglob
  copy_entry() {
    local source="$1" destination="$2" child
    if [[ -L "$source" || -L "$destination" ]]; then
      printf 'Cannot copy a symbolic-link path: %s\n' "$destination" >&2
      return 1
    fi
    if [[ -d "$source" ]]; then
      mkdir -p -- "$destination"
      chmod 755 "$destination"
      for child in "$source"/*; do
        copy_entry "$child" "$destination/${child##*/}"
      done
    elif [[ -f "$source" ]]; then
      [[ ! -d "$destination" ]] || { printf 'Expected a file at %s\n' "$destination" >&2; return 1; }
      cp -- "$source" "$destination"
      chmod 644 "$destination"
    else
      printf 'Unsupported release path: %s\n' "$source" >&2
      return 1
    fi
  }
  for entry in "$SOURCE_DIR"/*; do
    name="${entry##*/}"
    case "$name" in .htaccess|.well-known|cgi-bin|.user.ini|php.ini) continue;; esac
    copy_entry "$entry" "$TARGET_DIR/$name"
  done
fi
printf 'Website files copied; updating Apache settings.\n'
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
