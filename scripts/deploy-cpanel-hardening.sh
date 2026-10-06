#!/bin/bash
# Run only the reviewed Apache hardening transaction from cPanel's deploy button.
set -euo pipefail
export LC_ALL=C
umask 077
fail() { printf 'HORIZONS hardening refused: %s\n' "$*" >&2; exit 1; }
repo=/home2/horizonstr/repositories/horizons-tr-website-live
web=/home2/horizonstr/public_html
[[ "$(pwd -P)" == "$repo" ]] || fail 'Unexpected live checkout'
[[ -d .git && ! -L .git && -f .git/HEAD && ! -L .git/HEAD ]] || fail 'Unsafe Git checkout'
[[ -d "$web" && ! -L "$web" && "$(cd "$web" && pwd -P)" == "$web" ]] || fail 'Unsafe document root'
gitbin=/usr/local/cpanel/3rdparty/bin/git
if [[ ! -x "$gitbin" ]]; then gitbin=$(command -v git) || fail 'Git preflight unavailable'; fi
[[ "$($gitbin rev-parse --show-toplevel)" == "$repo" ]] || fail 'Unexpected Git root'
[[ "$($gitbin symbolic-ref --short HEAD)" == main ]] || fail 'Only main may publish'
[[ -z "$($gitbin status --porcelain)" ]] || fail 'Working tree contains local changes; preserve and review them'
$gitbin merge-base --is-ancestor 4a9e26d0c3edec60787e6d42be1f7d2b1157763f HEAD || fail 'Reviewed hardening release is missing'
[[ -f scripts/execute-hardening.php && ! -L scripts/execute-hardening.php ]] || fail 'Unsafe verification script'
[[ -f scripts/deploy-hardening.php && ! -L scripts/deploy-hardening.php ]] || fail 'Unsafe publisher'
[[ -f src/security/public.htaccess && ! -L src/security/public.htaccess ]] || fail 'Unsafe security policy'
phpcli=/usr/local/bin/ea-php82
if [[ ! -x "$phpcli" ]]; then phpcli=/opt/cpanel/ea-php82/root/usr/bin/php; fi
[[ -x "$phpcli" ]] || fail 'PHP 8.2 CLI unavailable'
lock=/home2/horizonstr/.horizons-production-chain.lock
mkdir -- "$lock" 2>/dev/null || fail 'Another deployment is running, or the private lock needs review'
trap 'rmdir -- "$lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf 'HORIZONS_PREFLIGHT branch=main head=%s working_tree=clean scope=Apache-hardening\n' "$($gitbin rev-parse HEAD)"
"$phpcli" scripts/execute-hardening.php "$web"
