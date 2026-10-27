#!/usr/bin/env bash
# CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
# يجهّز Node.js (من النظام أو نسخة محمولة في ‎~/.caf-ai‎) ثم ينفّذ الأمر.
set -e
SELF="$(readlink "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
ROOT="$(cd "$(dirname "$SELF")/.." && pwd)"
CAF_HOME="${CAF_HOME:-$HOME/.caf-ai}"; export CAF_HOME
RUNTIME="$CAF_HOME/runtime"
AMBER=$'\033[38;2;232;163;61m'; RED=$'\033[38;2;219;133;86m'; GRAY=$'\033[38;2;138;147;153m'; OFF=$'\033[0m'

node_ok() { command -v "$1" >/dev/null 2>&1 && [ "$("$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ]; }

if [ -x "$RUNTIME/node/bin/node" ]; then NODE_BIN="$RUNTIME/node/bin/node"
elif node_ok node; then NODE_BIN="$(command -v node)"
else
  echo "  ${AMBER}>${OFF} CAF AI ${GRAY}— preparing Node.js runtime (one time) · تجهيز بيئة التشغيل${OFF}"
  case "$(uname -s)" in Darwin) OS=darwin; EXT=tar.gz;; Linux) OS=linux; EXT=tar.xz;; *) echo "${RED}Unsupported OS${OFF}"; exit 1;; esac
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64;; *) ARCH=x64;; esac
  BASE="https://nodejs.org/dist/latest-v22.x"
  SUMS="$(curl -fsSL "$BASE/SHASUMS256.txt")" || { echo "${RED}No internet connection · لا يوجد اتصال بالإنترنت${OFF}"; exit 1; }
  FILE="$(printf '%s\n' "$SUMS" | awk -v p="node-v.*-$OS-$ARCH.$EXT\$" '$2 ~ p {print $2; exit}')"
  EXPECT="$(printf '%s\n' "$SUMS" | awk -v f="$FILE" '$2==f {print $1}')"
  mkdir -p "$RUNTIME"
  curl -fL --progress-bar "$BASE/$FILE" -o "$RUNTIME/$FILE"
  if command -v sha256sum >/dev/null; then GOT="$(sha256sum "$RUNTIME/$FILE" | awk '{print $1}')"; else GOT="$(shasum -a 256 "$RUNTIME/$FILE" | awk '{print $1}')"; fi
  [ "$EXPECT" = "$GOT" ] || { echo "${RED}Checksum failed · فشل التحقق من سلامة الملف${OFF}"; rm -f "$RUNTIME/$FILE"; exit 1; }
  rm -rf "$RUNTIME/node"; mkdir -p "$RUNTIME/node"
  tar -xf "$RUNTIME/$FILE" -C "$RUNTIME/node" --strip-components=1
  rm -f "$RUNTIME/$FILE"
  NODE_BIN="$RUNTIME/node/bin/node"
fi

cd "$ROOT"
CMD="${1:-start}"
case "$CMD" in
  start|--no-open|--lang|--lang=*)
    [ "$CMD" = "start" ] && shift || true
    "$NODE_BIN" app/cli.js ensure "$@"
    exec "$NODE_BIN" app/server.js "$@";;
  *) exec "$NODE_BIN" app/cli.js "$@";;
esac
