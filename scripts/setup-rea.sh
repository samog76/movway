#!/usr/bin/env bash
# Prepares a container to reverse engineer with REA (rea-agents): Node 24,
# the rea CLI/MCP server, JADX headless MCP and Apktool, and a Claude Code
# MCP registration. Idempotent; safe to run on every session start.
#
# Intended for the cloud environment's setup script:
#   bash /home/user/movway/scripts/setup-rea.sh
set -euo pipefail

REA_VERSION="6.8.0"
NODE_MAJOR="24"
TOOLS_DIR="${REA_TOOLS_DIR:-$HOME/.local/share/rea/android}"
JADX_JAR="$TOOLS_DIR/jadx-headless-mcp-0.7.1-all.jar"
JADX_URL="https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar"
JADX_SHA256="6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75"
# Apktool before 3.0.2 is affected by CVE-2026-39973.
APKTOOL_JAR="$TOOLS_DIR/apktool_3.0.3.jar"
APKTOOL_URL="https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar"
APKTOOL_SHA256="dbf930b076c6b9be08d57c449cacefc3bdd6b71ebd59b3066fc0e1f5b14f9423"

log() { printf '[setup-rea] %s\n' "$*"; }

# REA requires Node 22.23.4+, 24.22.1+ or 26.12.1+; the image's default is older.
export NVM_DIR="${NVM_DIR:-/opt/nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
if ! nvm ls "$NODE_MAJOR" >/dev/null 2>&1; then
  log "installing Node $NODE_MAJOR"
  nvm install "$NODE_MAJOR" >/dev/null
fi
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
export PATH="$NODE_BIN:$PATH"

if [ "$("$NODE_BIN/rea" --version 2>/dev/null || true)" != "$REA_VERSION" ]; then
  log "installing rea-agents@$REA_VERSION"
  npm install -g --no-fund --no-audit "rea-agents@$REA_VERSION" >/dev/null
fi

fetch_verified() { # url dest sha256
  if [ -f "$2" ] && echo "$3  $2" | sha256sum -c --status -; then return; fi
  log "downloading $(basename "$2")"
  curl -fsSL -o "$2.part" "$1"
  echo "$3  $2.part" | sha256sum -c --status - || { rm -f "$2.part"; log "checksum mismatch: $2"; exit 1; }
  mv "$2.part" "$2"
}
mkdir -p "$TOOLS_DIR"
fetch_verified "$JADX_URL" "$JADX_JAR" "$JADX_SHA256"
fetch_verified "$APKTOOL_URL" "$APKTOOL_JAR" "$APKTOOL_SHA256"
cat > "$TOOLS_DIR/apktool" <<WRAP
#!/bin/sh
exec java -jar "$APKTOOL_JAR" "\$@"
WRAP
chmod +x "$TOOLS_DIR/apktool"

# Register the MCP server. Pin the Node 24 binary: the default `node` on PATH
# is too old and REA refuses to start on it.
if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user rea >/dev/null 2>&1 || true
  claude mcp add --scope user rea \
    --env "REA_JADX_MCP_JAR=$JADX_JAR" \
    --env "REA_APKTOOL_COMMAND=$TOOLS_DIR/apktool" \
    -- "$NODE_BIN/node" "$NODE_BIN/rea" mcp >/dev/null
  log "registered REA MCP server (user scope)"
else
  log "claude CLI not found; skipped MCP registration"
fi
log "ready: rea $("$NODE_BIN/rea" --version)"
