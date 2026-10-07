#!/bin/bash
# Scoped cPanel publisher. Six-file transaction with private rollback.
# cPanel records command output in its normal private deployment log.
set -euo pipefail
export LC_ALL=C
umask 077
fail() { printf 'STOP: HZN_UI_PUBLISH_%s\n' "$1" >&2; exit 1; }
repo=/home2/horizonstr/repositories/horizons-tr-website-live
web=/home2/horizonstr/public_html
php=/usr/local/bin/ea-php82
[[ "$(pwd -P)" == "$repo" ]] || fail REPOSITORY
[[ -d .git && ! -L .git && -f .git/HEAD && ! -L .git/HEAD ]] || fail GIT_HEAD
IFS= read -r head < .git/HEAD
[[ "$head" == 'ref: refs/heads/main' ]] || fail MAIN_REQUIRED
[[ -d "$web" && ! -L "$web" && "$(cd "$web" && pwd -P)" == "$web" ]] || fail DOCUMENT_ROOT
[[ ! -e /home2/horizonstr/.horizons-production-chain.lock && ! -L /home2/horizonstr/.horizons-production-chain.lock ]] || fail BUSY
[[ -x "$php" ]] || fail PHP82
[[ -f scripts/deploy-native-ui.php && ! -L scripts/deploy-native-ui.php ]] || fail CHECK_ENTRY
printf 'HORIZONS NATIVE UI - guarded six-file publication.\n'
exec "$php" -d display_errors=0 -d log_errors=0 "$repo/scripts/deploy-native-ui.php" "$web" --publish
