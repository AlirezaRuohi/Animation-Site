#!/usr/bin/env sh
# Creates a private .env for a self-hosted instance. Does not print secrets.
set -eu
if [ "$#" -ne 1 ]; then echo 'Usage: sh scripts/bootstrap-env.sh video.your-domain.com' >&2; exit 2; fi
DOMAIN="$1"
case "$DOMAIN" in
  *[!a-zA-Z0-9.-]*|.*|*..*|*.) echo 'Invalid domain name.' >&2; exit 2 ;;
esac
case "$DOMAIN" in *.*) ;; *) echo 'Provide a public domain name.' >&2; exit 2 ;; esac
if [ -e .env ]; then echo '.env already exists; refusing to overwrite existing secrets.' >&2; exit 1; fi
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate secrets.' >&2; exit 1; }
umask 077
STUDIO_TOKEN="$(openssl rand -hex 32)"
MCP_ACCESS_PATH="$(openssl rand -hex 32)"
cat > .env <<EOT
DOMAIN=$DOMAIN
PUBLIC_BASE_URL=https://$DOMAIN
STUDIO_TOKEN=$STUDIO_TOKEN
MCP_ACCESS_PATH=$MCP_ACCESS_PATH
MAX_PROJECTS=200
MAX_OUTPUT_MB=2048
RATE_LIMIT_PER_MIN=120
MCP_ALLOWED_ORIGINS=
EOT
chmod 600 .env
printf '%s\n' 'Created .env (permissions 600). Secrets were not printed.' 'Update DNS A/AAAA for your domain before starting Docker Compose.'
