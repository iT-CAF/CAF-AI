#!/usr/bin/env bash
# CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
# macOS / Linux:  curl -fsSL https://raw.githubusercontent.com/iT-CAF/CAF-AI/main/install-caf-ai.sh | bash
set -e
REPO="iT-CAF/CAF-AI"
CAF_HOME="${CAF_HOME:-$HOME/.caf-ai}"
BIN_DIR="${CAF_BIN:-$HOME/.local/bin}"
AMBER=$'\033[38;2;232;163;61m'; GREEN=$'\033[38;2;95;179;161m'; GRAY=$'\033[38;2;138;147;153m'; RED=$'\033[38;2;219;133;86m'; B=$'\033[1m'; OFF=$'\033[0m'

echo
echo "  ${AMBER}${B}>${OFF} ${B}CAF AI${OFF}  ${GRAY}·${OFF}  ${B}كآف AI${OFF}"
echo "  ${GRAY}by CAF · iT CAF · store.it-caf.com${OFF}"
echo "  ${GRAY}────────────────────────────────────────────────────${OFF}"

HERE=""; [ -n "${BASH_SOURCE[0]:-}" ] && HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || true
if [ -n "$HERE" ] && [ -f "$HERE/app/server.js" ]; then
  APP_DIR="$HERE"
else
  command -v curl >/dev/null || { echo "  ${RED}curl is required · يلزم curl${OFF}"; exit 1; }
  APP_DIR="$CAF_HOME/app"
  echo "  ${AMBER}›${OFF} Downloading CAF AI · تنزيل كآف AI"
  TMP="$(mktemp -d)"
  curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$TMP" --strip-components=1
  rm -rf "$APP_DIR"; mkdir -p "$CAF_HOME"; mv "$TMP" "$APP_DIR"
fi
chmod +x "$APP_DIR/bin/startcaf" "$APP_DIR/app/bootstrap.sh"

mkdir -p "$BIN_DIR"
ln -sf "$APP_DIR/bin/startcaf" "$BIN_DIR/startcaf"
echo "  ${GREEN}✓${OFF} Command installed · تم تثبيت الأمر: ${B}startcaf${OFF}  ${GRAY}($BIN_DIR/startcaf)${OFF}"

case ":$PATH:" in *":$BIN_DIR:"*) NEED_PATH=0;; *) NEED_PATH=1;; esac
if [ "$NEED_PATH" = 1 ]; then
  LINE="export PATH=\"$BIN_DIR:\$PATH\""
  for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    case "$rc" in
      "$HOME/.zshrc") [ -f "$rc" ] || [ "$(basename "${SHELL:-}")" = zsh ] || continue;;
      "$HOME/.bashrc"|"$HOME/.bash_profile") [ -f "$rc" ] || [ "$(basename "${SHELL:-}")" = bash ] || continue;;
    esac
    grep -qs "caf-ai PATH" "$rc" 2>/dev/null || printf '\n# caf-ai PATH\n%s\n' "$LINE" >> "$rc"
  done
  if command -v fish >/dev/null 2>&1; then
    mkdir -p "$HOME/.config/fish/conf.d"
    echo "fish_add_path $BIN_DIR" > "$HOME/.config/fish/conf.d/caf-ai.fish"
  fi
  echo "  ${GREEN}✓${OFF} PATH updated · تم تحديث PATH — open a new terminal · افتح طرفية جديدة"
fi

echo
echo "  ${B}Next · الخطوة التالية${OFF}"
if [ "$NEED_PATH" = 1 ]; then echo "    ${AMBER}$BIN_DIR/startcaf${OFF}   ${GRAY}(or open a new terminal and run: startcaf)${OFF}"
else echo "    ${AMBER}startcaf${OFF}"; fi
echo
