#!/usr/bin/env sh
# Prints private URL only in the terminal. Never put this output in public logs.
set -eu
if [ ! -f .env ]; then echo 'Missing .env' >&2; exit 1; fi
DOMAIN=$(sed -n 's/^DOMAIN=//p' .env | head -n 1)
SECRET=$(sed -n 's/^MCP_ACCESS_PATH=//p' .env | head -n 1)
if [ -z "$DOMAIN" ] || [ -z "$SECRET" ]; then echo 'Invalid .env' >&2; exit 1; fi
printf '%s\n' "https://$DOMAIN/mcp/$SECRET"
