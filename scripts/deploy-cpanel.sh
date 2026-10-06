#!/bin/bash
# Run by cPanel Deploy HEAD. Check all payloads in private staging first.
set -euo pipefail
export LC_ALL=C
umask 077
fail() { printf 'HORIZONS deployment stopped: %s\n' "$*" >&2; exit 1; }
for command in cat sha256sum unzip awk find sort wc stat cp mv mkdir mktemp chmod rmdir rm date head cmp; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command is missing: $command"
done
REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE_DIR="$REPO_DIR/dist"
VERSION="${2:-1.4.0}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Invalid release version'
WEB_VERSION="${3:-1.4.4}"
[[ "$WEB_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Invalid web release version'
ASSETS_DIR="$REPO_DIR/release-assets/$VERSION"
MANIFEST="$ASSETS_DIR/manifest.tsv"
OVERLAY_DIR="$REPO_DIR/release-assets/$WEB_VERSION"
OVERLAY_MANIFEST="$OVERLAY_DIR/manifest.tsv"
DEMO_VERSION="${4:-1.4.3}"
[[ "$DEMO_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Invalid demo release version'
DEMO_OVERLAY_DIR="$REPO_DIR/release-assets/demo-$DEMO_VERSION"
DEMO_OVERLAY_MANIFEST="$DEMO_OVERLAY_DIR/manifest.tsv"
TARGET_INPUT="${1:?Provide the cPanel document root}"
while [[ "$TARGET_INPUT" != / && "$TARGET_INPUT" == */ ]]; do TARGET_INPUT="${TARGET_INPUT%/}"; done
[[ "$TARGET_INPUT" == /* && "$TARGET_INPUT" != / && ! -L "$TARGET_INPUT" ]] || fail 'Invalid or symbolic-link document root'
TARGET_PARENT="$(cd -- "$(dirname -- "$TARGET_INPUT")" && pwd -P)"
TARGET_NAME="${TARGET_INPUT##*/}"
[[ "$TARGET_NAME" != . && "$TARGET_NAME" != .. ]] || fail 'Invalid document-root name'
TARGET_DIR="$TARGET_PARENT/$TARGET_NAME"
[[ ! -e "$TARGET_DIR" || -d "$TARGET_DIR" ]] || fail 'Document root is not a directory'
case "$TARGET_DIR/" in "$REPO_DIR/"*) fail 'Document root must be outside the repository';; esac
case "$REPO_DIR/" in "$TARGET_DIR/"*) fail 'Repository must be outside the document root';; esac
[[ -d "$SOURCE_DIR" && ! -L "$SOURCE_DIR" && -f "$SOURCE_DIR/index.html" && -f "$SOURCE_DIR/release.json" && -f "$SOURCE_DIR/.htaccess" ]] || fail 'Incomplete website release'
[[ -f "$MANIFEST" && ! -L "$MANIFEST" && ! -L "$ASSETS_DIR" && ! -L "$REPO_DIR/release-assets" ]] || fail 'Missing or unsafe release manifest'
[[ -f "$OVERLAY_MANIFEST" && ! -L "$OVERLAY_MANIFEST" && ! -L "$OVERLAY_DIR" ]] || fail 'Missing or unsafe web overlay manifest'
[[ -f "$DEMO_OVERLAY_MANIFEST" && ! -L "$DEMO_OVERLAY_MANIFEST" && ! -L "$DEMO_OVERLAY_DIR" ]] || fail 'Missing or unsafe demo overlay manifest'
[[ -z "$(find "$SOURCE_DIR" \( -type l -o \( ! -type d ! -type f \) \) -print -quit)" ]] || fail 'Website source contains a link or special file'

# Private staging and retained backups are siblings of public_html, never public.
STATE_DIR="$TARGET_PARENT/.horizons-deploy-$TARGET_NAME"
[[ ! -L "$STATE_DIR" ]] || fail 'Private deployment directory must not be a symbolic link'
mkdir -p -- "$STATE_DIR"
chmod 700 "$STATE_DIR"
LOCK_DIR="$STATE_DIR/deploy.lock"
mkdir -- "$LOCK_DIR" 2>/dev/null || fail "Another deployment is running, or a stale lock needs review: $LOCK_DIR"
STAGE=''; BACKUP=''; COMMITTED=0
declare -a CHANGED_PATHS=() OLD_PATHS=() CHANGED_TYPES=()
cleanup() {
  local status=$? i relative destination
  set +e
  if [[ "$COMMITTED" == 0 && ${#CHANGED_PATHS[@]} -gt 0 ]]; then
    printf 'Restoring backed-up publication paths after an error.\n' >&2
    for ((i=${#CHANGED_PATHS[@]}-1; i>=0; i--)); do
      relative="${CHANGED_PATHS[$i]}"; destination="$TARGET_DIR/$relative"
      # The journal precedes the first move. If that move failed, the original
      # is still public and must not be removed merely because a row exists.
      if [[ "${OLD_PATHS[$i]}" == 1 && ! -e "$BACKUP/$relative" && ! -L "$BACKUP/$relative" ]]; then continue; fi
      if [[ "${CHANGED_TYPES[$i]}" == directory ]]; then
        case "$relative" in learn|try|learning-api) rm -rf -- "$destination";; *) continue;; esac
      else rm -f -- "$destination"; fi
      if [[ "${OLD_PATHS[$i]}" == 1 ]]; then
        mv -- "$BACKUP/$relative" "$destination" || printf 'Restore this backup manually: %s\n' "$BACKUP/$relative" >&2
      fi
    done
  fi
  if [[ -n "$STAGE" && "$STAGE" == "$STATE_DIR"/stage.* && -d "$STAGE" && ! -L "$STAGE" ]]; then rm -rf -- "$STAGE"; fi
  rmdir -- "$LOCK_DIR" 2>/dev/null
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
STAGE="$(mktemp -d "$STATE_DIR/stage.XXXXXXXX")"
mkdir -- "$STAGE/assembled" "$STAGE/site" "$STAGE/learn-extracted" "$STAGE/demo-extracted" "$STAGE/update-extracted" "$STAGE/api-extracted"
shopt -s nullglob dotglob

declare -A FILENAMES=() SIZES=() HASHES=() PARTS=()
line_number=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line_number=$((line_number+1))
  if [[ "$line_number" == 1 ]]; then
    [[ "$line" == $'HORIZONS_RELEASE_V1\t'"$VERSION" ]] || fail 'Manifest header/version mismatch'
    continue
  fi
  [[ "$(awk -F '\t' '{print NF}' <<< "$line")" == 5 ]] || fail "Manifest row $line_number must contain exactly five tab-separated fields"
  IFS=$'\t' read -r kind filename bytes sha parts <<< "$line"
  case "$kind" in learn|demo|setup|update) ;; *) fail "Unknown artifact kind: $kind";; esac
  [[ -z "${FILENAMES[$kind]+present}" ]] || fail "Repeated artifact kind: $kind"
  [[ "$filename" =~ ^[A-Za-z0-9][A-Za-z0-9._-]+$ ]] || fail 'Unsafe artifact filename'
  case "$kind:$filename" in setup:*.exe|learn:*.zip|demo:*.zip|update:*.zip) ;; *) fail 'Artifact extension does not match its kind';; esac
  [[ "$bytes" =~ ^[1-9][0-9]{0,9}$ && "$bytes" -le 2147483648 ]] || fail 'Invalid artifact size'
  [[ "$sha" =~ ^[0-9a-f]{64}$ ]] || fail 'Invalid SHA-256 digest'
  [[ "$parts" =~ ^[1-9][0-9]{0,3}$ ]] || fail 'Invalid chunk count'
  FILENAMES[$kind]="$filename"; SIZES[$kind]="$bytes"; HASHES[$kind]="$sha"; PARTS[$kind]="$parts"
done < "$MANIFEST"
[[ "$line_number" == 5 && ${#FILENAMES[@]} == 4 ]] || fail 'Manifest must declare exactly learn, demo, setup and update'
for kind in learn demo setup update; do
  [[ -n "${FILENAMES[$kind]+present}" ]] || fail "Missing artifact: $kind"
  directory="$ASSETS_DIR/$kind"
  [[ -d "$directory" && ! -L "$directory" ]] || fail "Missing/unsafe chunk directory: $kind"
  entries=("$directory"/*)
  [[ ${#entries[@]} -eq ${PARTS[$kind]} ]] || fail "Unexpected or missing chunk files: $kind"
  output="$STAGE/assembled/$kind"; : > "$output"
  for ((i=0; i<${PARTS[$kind]}; i++)); do
    printf -v name 'part-%04d' "$i"
    chunk="$directory/$name"
    [[ -f "$chunk" && ! -L "$chunk" ]] || fail "Missing/unsafe chunk: $kind/$name"
    size="$(stat -c '%s' -- "$chunk")"
    [[ "$size" -ge 1 && "$size" -le 16777216 ]] || fail "Chunk exceeds the 16 MiB limit: $kind/$name"
    cat -- "$chunk" >> "$output"
  done
  [[ "$(stat -c '%s' -- "$output")" == "${SIZES[$kind]}" ]] || fail "Assembled size mismatch: $kind"
  digest="$(sha256sum -- "$output")"; digest="${digest%% *}"
  [[ "$digest" == "${HASHES[$kind]}" ]] || fail "Assembled SHA-256 mismatch: $kind"
  printf 'Verified %s: %s bytes.\n' "$kind" "${SIZES[$kind]}"
done
[[ "$(head -c 2 -- "$STAGE/assembled/setup")" == MZ ]] || fail 'Windows setup is not an EXE'

validate_archive() {
  local kind="$1" archive="$2" names="$STAGE/$1.entries" metadata="$STAGE/$1.metadata" name normalized entry_type size count=0 total=0 parent
  local -A seen=() types=()
  unzip -Z -1 "$archive" > "$names" || fail "Cannot list $kind ZIP"
  unzip -Z -l "$archive" > "$metadata" || fail "Cannot inspect $kind ZIP"
  while IFS= read -r name || [[ -n "$name" ]]; do
    [[ -n "$name" && "$name" =~ ^[A-Za-z0-9_./-]+$ && "$name" != /* && "$name" != *//* ]] || fail "Unsafe ZIP path in $kind"
    [[ "/$name/" != */../* && "/$name/" != */./* ]] || fail "ZIP path traversal in $kind"
    case "$kind:$name" in
      learn:learn/|learn:learn/*|demo:try/|demo:try/*) ;;
      update:downloads/|update:updates/|update:downloads/Horizons-Arabic-Level-1-"$VERSION"-update.zip|update:updates/arabic-level-1.json) ;;
      *) fail "Unexpected ZIP root/path in $kind: $name";;
    esac
    normalized="${name%/}"
    [[ -z "${seen[$normalized]+present}" ]] || fail "Duplicate ZIP path in $kind: $name"
    seen[$normalized]=1
    if [[ "$name" == */ ]]; then types[$normalized]=directory; else types[$normalized]=file; fi
    count=$((count+1)); [[ "$count" -le 10000 ]] || fail "Too many ZIP entries in $kind"
  done < "$names"
  [[ "$count" -gt 0 ]] || fail "Empty ZIP: $kind"
  # Release ZIPs use Unix file/directory attributes. Reject symlinks, devices,
  # ambiguous metadata and file/directory conflicts before extraction.
  awk 'length($1)==10 && $2 ~ /^[0-9]+\.[0-9]+$/ {print $1 "\t" $4 "\t" $NF}' "$metadata" > "$STAGE/$kind.attributes"
  [[ "$(wc -l < "$STAGE/$kind.attributes")" -eq "$count" ]] || fail "Unsupported ZIP entry metadata: $kind"
  while IFS=$'\t' read -r entry_type size name; do
    [[ "$entry_type" =~ ^[-d][rwxstST-]{9}$ && "$size" =~ ^[0-9]+$ ]] || fail "ZIP links/special files are forbidden: $kind"
    [[ ${#size} -le 10 && "$size" -le 2147483648 ]] || fail "ZIP entry is too large: $kind"
    total=$((total+size)); [[ "$total" -le 2147483648 ]] || fail "Expanded ZIP exceeds 2 GiB: $kind"
    normalized="${name%/}"
    [[ -n "${seen[$normalized]+present}" ]] || fail "ZIP metadata/path mismatch: $kind"
    if [[ "$entry_type" == d* ]]; then [[ "${types[$normalized]}" == directory ]] || fail 'ZIP directory metadata mismatch'; fi
    if [[ "$entry_type" == -* ]]; then [[ "${types[$normalized]}" == file ]] || fail 'ZIP file metadata mismatch'; fi
    parent="$normalized"
    while [[ "$parent" == */* ]]; do
      parent="${parent%/*}"
      [[ "${types[$parent]:-directory}" != file ]] || fail 'ZIP file is used as a parent directory'
    done
  done < "$STAGE/$kind.attributes"
  unzip -tqq "$archive" </dev/null || fail "ZIP CRC/integrity check failed: $kind"
}
for kind in learn demo update; do validate_archive "$kind" "$STAGE/assembled/$kind"; done
for kind in learn demo update; do
  unzip -q "$STAGE/assembled/$kind" -d "$STAGE/$kind-extracted" </dev/null || fail "Cannot unpack $kind"
  [[ -z "$(find "$STAGE/$kind-extracted" \( -type l -o \( ! -type d ! -type f \) \) -print -quit)" ]] || fail "Unsafe extracted file: $kind"
  rm -f -- "$STAGE/assembled/$kind"
done
[[ -s "$STAGE/learn-extracted/learn/index.html" && -s "$STAGE/demo-extracted/try/index.html" ]] || fail 'An application index is missing'
UPDATE_NAME="Horizons-Arabic-Level-1-$VERSION-update.zip"
[[ -s "$STAGE/update-extracted/downloads/$UPDATE_NAME" && -s "$STAGE/update-extracted/updates/arabic-level-1.json" ]] || fail 'Incomplete native update package'

# Apply the small, independently verified web update to the reconstructed base
# before publication. The Windows payload and signed native feed stay unchanged.
# The API directory contains code only; its database is outside public_html.
declare -A OVERLAY_PATHS=()
overlay_lines=0
while IFS= read -r line || [[ -n "$line" ]]; do
  overlay_lines=$((overlay_lines+1))
  if [[ "$overlay_lines" == 1 ]]; then
    [[ "$line" == $'HORIZONS_WEB_OVERLAY_V1\t'"$WEB_VERSION"$'\t'"$VERSION" ]] || fail 'Web overlay header/version mismatch'
    continue
  fi
  [[ "$(awk -F '\t' '{print NF}' <<< "$line")" == 4 ]] || fail 'Web overlay row must contain four tab-separated fields'
  IFS=$'\t' read -r sha bytes source relative <<< "$line"
  [[ "$sha" =~ ^[0-9a-f]{64}$ && "$bytes" =~ ^[1-9][0-9]{0,7}$ && "$bytes" -le 16777216 ]] || fail 'Invalid web overlay digest/size'
  for path in "$source" "$relative"; do
    [[ "$path" =~ ^[A-Za-z0-9_./-]+$ && "$path" != /* && "$path" != */ && "$path" != *//* && "/$path/" != */../* && "/$path/" != */./* ]] || fail 'Unsafe web overlay path'
  done
  case "$source" in
    src/workbook-web/*) [[ "$relative" == "learn/${source#src/workbook-web/}" ]] || fail 'Workbook overlay mapping mismatch';;
    src/learning-api/*) [[ "$relative" == "learning-api/${source#src/learning-api/}" ]] || fail 'API overlay mapping mismatch';;
    "release-assets/$WEB_VERSION/files/learn/"*) [[ "$relative" == "${source#release-assets/$WEB_VERSION/files/}" ]] || fail 'Content overlay mapping mismatch';;
    *) fail 'Unapproved web overlay source';;
  esac
  case "/$relative/" in */.env*|*/.git/*|*/data/*|*/private/*|*/owner-vault.json/*|*/config.php/*) fail 'Runtime/private file cannot be deployed through the web overlay';; esac
  [[ -z "${OVERLAY_PATHS[$relative]+present}" ]] || fail 'Duplicate web overlay destination'
  OVERLAY_PATHS[$relative]=1
  current="$REPO_DIR"
  IFS=/ read -r -a segments <<< "$source"
  for segment in "${segments[@]}"; do
    current="$current/$segment"
    [[ ! -L "$current" ]] || fail 'Web overlay source contains a symbolic link'
  done
  [[ -f "$current" && "$(stat -c '%s' -- "$current")" == "$bytes" ]] || fail "Web overlay file missing/size mismatch: $source"
  digest="$(sha256sum -- "$current")"; digest="${digest%% *}"
  [[ "$digest" == "$sha" ]] || fail "Web overlay SHA-256 mismatch: $source"
  case "$relative" in
    learn/*) destination="$STAGE/learn-extracted/$relative";;
    learning-api/*) destination="$STAGE/api-extracted/$relative";;
    *) fail 'Unapproved web overlay destination';;
  esac
  mkdir -p -- "$(dirname -- "$destination")"
  cp -- "$current" "$destination"
  [[ "$overlay_lines" -le 10001 ]] || fail 'Too many web overlay files'
done < "$OVERLAY_MANIFEST"
[[ -n "${OVERLAY_PATHS[learn/index.html]+present}" && -n "${OVERLAY_PATHS[learning-api/index.php]+present}" ]] || fail 'Web overlay lacks the workbook/API entry points'
printf 'Verified web overlay %s: %s files.\n' "$WEB_VERSION" "$((overlay_lines-1))"

# Apply the independently versioned public demo fix before any public writes.
# Its allowlist excludes curriculum, paid content, activation and learner data.
declare -A DEMO_OVERLAY_PATHS=()
demo_overlay_lines=0
while IFS= read -r line || [[ -n "$line" ]]; do
  demo_overlay_lines=$((demo_overlay_lines+1))
  if [[ "$demo_overlay_lines" == 1 ]]; then
    [[ "$line" == $'HORIZONS_DEMO_OVERLAY_V1\t'"$DEMO_VERSION"$'\t'"$VERSION" ]] || fail 'Demo overlay header/version mismatch'
    continue
  fi
  [[ "$(awk -F '\t' '{print NF}' <<< "$line")" == 4 ]] || fail 'Demo overlay row must contain four tab-separated fields'
  IFS=$'\t' read -r sha bytes source relative <<< "$line"
  [[ "$sha" =~ ^[0-9a-f]{64}$ && "$bytes" =~ ^[1-9][0-9]{0,7}$ && "$bytes" -le 16777216 ]] || fail 'Invalid demo overlay digest/size'
  case "$source" in
    src/demo-pwa/workbook.js|src/demo-pwa/release-config.js|src/demo-pwa/sw.js)
      [[ "$relative" == "try/${source#src/demo-pwa/}" ]] || fail 'Demo overlay mapping mismatch';;
    "release-assets/demo-$DEMO_VERSION/files/try/demo-asset-manifest.json")
      [[ "$relative" == try/demo-asset-manifest.json ]] || fail 'Demo manifest mapping mismatch';;
    *) fail 'Unapproved demo overlay source';;
  esac
  [[ -z "${DEMO_OVERLAY_PATHS[$relative]+present}" ]] || fail 'Duplicate demo overlay destination'
  DEMO_OVERLAY_PATHS[$relative]=1
  current="$REPO_DIR"
  IFS=/ read -r -a segments <<< "$source"
  for segment in "${segments[@]}"; do
    current="$current/$segment"
    [[ ! -L "$current" ]] || fail 'Demo overlay source contains a symbolic link'
  done
  [[ -f "$current" && "$(stat -c '%s' -- "$current")" == "$bytes" ]] || fail "Demo overlay file missing/size mismatch: $source"
  digest="$(sha256sum -- "$current")"; digest="${digest%% *}"
  [[ "$digest" == "$sha" ]] || fail "Demo overlay SHA-256 mismatch: $source"
  cp -- "$current" "$STAGE/demo-extracted/$relative"
  [[ "$demo_overlay_lines" -le 5 ]] || fail 'Too many demo overlay files'
done < "$DEMO_OVERLAY_MANIFEST"
[[ "$demo_overlay_lines" == 5 && -n "${DEMO_OVERLAY_PATHS[try/workbook.js]+present}" && -n "${DEMO_OVERLAY_PATHS[try/release-config.js]+present}" && -n "${DEMO_OVERLAY_PATHS[try/sw.js]+present}" && -n "${DEMO_OVERLAY_PATHS[try/demo-asset-manifest.json]+present}" ]] || fail 'Incomplete demo overlay'
printf 'Verified demo overlay %s: %s files.\n' "$DEMO_VERSION" "$((demo_overlay_lines-1))"

# Ignore the website's old app copies and all host/runtime configuration.
for entry in "$SOURCE_DIR"/*; do
  name="${entry##*/}"
  case "$name" in .htaccess|.well-known|cgi-bin|.user.ini|php.ini|activation|learn|learning-api|try|downloads|updates) continue;; esac
  case "$name" in .git|.env*|private|backend|owner-bin|release-assets|node_modules) fail "Private source directory found in dist: $name";; esac
  cp -R -- "$entry" "$STAGE/site/$name"
done
safe_destination() {
  local relative="$1" expected="$2" current="$TARGET_DIR" segment index=0
  local -a segments
  IFS=/ read -r -a segments <<< "$relative"
  for segment in "${segments[@]}"; do
    current="$current/$segment"; index=$((index+1))
    [[ ! -L "$current" ]] || fail "Publication destination is a symbolic link: $relative"
    if [[ "$index" -lt ${#segments[@]} || "$expected" == directory ]]; then
      [[ ! -e "$current" || -d "$current" ]] || fail "Publication directory conflicts with a file: $relative"
    else [[ ! -e "$current" || -f "$current" ]] || fail "Publication file conflicts with a directory: $relative"; fi
  done
}
preflight_tree() {
  local source="$1" relative="$2" child path
  for child in "$source"/*; do
    path="${relative:+$relative/}${child##*/}"
    if [[ -d "$child" ]]; then safe_destination "$path" directory; preflight_tree "$child" "$path"; else safe_destination "$path" file; fi
  done
}
preflight_tree "$STAGE/site" ''
for name in learn try learning-api; do
  safe_destination "$name" directory
  if [[ -d "$TARGET_DIR/$name" ]]; then
    [[ -z "$(find "$TARGET_DIR/$name" \( -type l -o \( ! -type d ! -type f \) \) -print -quit)" ]] || fail "Existing $name contains links/special files; review before replacing"
  fi
done
safe_destination "downloads/${FILENAMES[setup]}" file
safe_destination "downloads/$UPDATE_NAME" file
safe_destination updates/arabic-level-1.json file
safe_destination .htaccess file

# Preserve prior immutable content versions for existing browser/offline clients.
if [[ -d "$TARGET_DIR/learn/content" ]]; then
  mkdir -p -- "$STAGE/learn-extracted/learn/content"
  for old_version in "$TARGET_DIR/learn/content"/*; do
    name="${old_version##*/}"
    if [[ -d "$old_version" && "$name" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && ! -e "$STAGE/learn-extracted/learn/content/$name" ]]; then
      cp -R -- "$old_version" "$STAGE/learn-extracted/learn/content/$name"
    fi
  done
fi
HTACCESS="$STAGE/root.htaccess"
: > "$HTACCESS"
if [[ -f "$TARGET_DIR/.htaccess" ]]; then
  awk '/^# BEGIN HORIZONS MANAGED$/{if(inside || begins++)exit 1;inside=1;next} /^# END HORIZONS MANAGED$/{if(!inside)exit 1;inside=0;next} END{if(inside)exit 1}' "$TARGET_DIR/.htaccess" || fail 'Malformed existing HORIZONS Apache block; no files were published'
  awk '/^# BEGIN HORIZONS MANAGED$/{inside=1;next} /^# END HORIZONS MANAGED$/{inside=0;next} !inside{print}' "$TARGET_DIR/.htaccess" > "$HTACCESS"
fi
# A prior scoped hardening publication may live outside the managed block.
# Migrate it into the current source policy once, preserving all host directives.
if [[ "$(awk '/^# BEGIN HORIZONS HARDENING$/{n++} END{print n+0}' "$SOURCE_DIR/.htaccess")" != 0 ]]; then
  for access_file in "$SOURCE_DIR/.htaccess" "$HTACCESS"; do
    awk '/^# BEGIN HORIZONS HARDENING$/{if(inside || begins++)exit 1;inside=1;next} /^# END HORIZONS HARDENING$/{if(!inside)exit 1;inside=0;next} END{if(inside)exit 1}' "$access_file" || fail 'Malformed HORIZONS hardening block; no files were published'
  done
  awk '/^# BEGIN HORIZONS HARDENING$/{inside=1;next} /^# END HORIZONS HARDENING$/{inside=0;next} !inside{print}' "$HTACCESS" > "$STAGE/root-host.htaccess"
  mv -- "$STAGE/root-host.htaccess" "$HTACCESS"
fi
{
  printf '# BEGIN HORIZONS MANAGED\n'
  cat -- "$SOURCE_DIR/.htaccess"
  printf '\n# END HORIZONS MANAGED\n'
} >> "$HTACCESS"
find "$STAGE/site" "$STAGE/learn-extracted" "$STAGE/demo-extracted" "$STAGE/update-extracted" "$STAGE/api-extracted" -type d -exec chmod 755 {} +
find "$STAGE/site" "$STAGE/learn-extracted" "$STAGE/demo-extracted" "$STAGE/update-extracted" "$STAGE/api-extracted" -type f -exec chmod 644 {} +
chmod 644 "$STAGE/assembled/setup" "$HTACCESS"

# Public writes start only after all validation and staging succeeds.
printf 'Base artifacts, web overlay and publication paths verified; publishing web %s (Windows %s).\n' "$WEB_VERSION" "$VERSION"
BACKUP="$STATE_DIR/backup-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -- "$BACKUP"
if [[ ! -d "$TARGET_DIR" ]]; then mkdir -- "$TARGET_DIR"; chmod 755 "$TARGET_DIR"; fi
publish_file() {
  local source="$1" relative="$2" destination="$TARGET_DIR/$2" old=0
  if [[ -f "$destination" ]] && cmp -s -- "$source" "$destination"; then return; fi
  mkdir -p -- "$(dirname -- "$destination")" "$(dirname -- "$BACKUP/$relative")"
  if [[ -f "$destination" ]]; then old=1; fi
  CHANGED_PATHS+=("$relative") OLD_PATHS+=("$old") CHANGED_TYPES+=(file)
  if [[ "$old" == 1 ]]; then mv -- "$destination" "$BACKUP/$relative"; fi
  mv -- "$source" "$destination"
}
publish_directory() {
  local source="$1" relative="$2" old=0
  if [[ -d "$TARGET_DIR/$relative" ]]; then old=1; fi
  CHANGED_PATHS+=("$relative") OLD_PATHS+=("$old") CHANGED_TYPES+=(directory)
  if [[ "$old" == 1 ]]; then mv -- "$TARGET_DIR/$relative" "$BACKUP/$relative"; fi
  mv -- "$source" "$TARGET_DIR/$relative"
}
publish_tree() {
  local source="$1" relative="$2" child path
  for child in "$source"/*; do
    path="${relative:+$relative/}${child##*/}"
    if [[ -d "$child" ]]; then
      if [[ ! -d "$TARGET_DIR/$path" ]]; then mkdir -- "$TARGET_DIR/$path"; chmod 755 "$TARGET_DIR/$path"; fi
      publish_tree "$child" "$path"
    else publish_file "$child" "$path"; fi
  done
}
# Download targets precede the signed feed; unrelated downloads remain intact.
publish_file "$STAGE/assembled/setup" "downloads/${FILENAMES[setup]}"
publish_file "$STAGE/update-extracted/downloads/$UPDATE_NAME" "downloads/$UPDATE_NAME"
chmod 755 "$TARGET_DIR/downloads"
publish_directory "$STAGE/api-extracted/learning-api" learning-api
publish_directory "$STAGE/learn-extracted/learn" learn
publish_directory "$STAGE/demo-extracted/try" try
publish_tree "$STAGE/site" ''
publish_file "$HTACCESS" .htaccess
publish_file "$STAGE/update-extracted/updates/arabic-level-1.json" updates/arabic-level-1.json
chmod 755 "$TARGET_DIR/updates"
COMMITTED=1
printf 'HORIZONS web %s (Windows %s) deployed to %s\nBackups: %s\n' "$WEB_VERSION" "$VERSION" "$TARGET_DIR" "$BACKUP"
printf 'Public five-letter demo version: %s\n' "$DEMO_VERSION"
