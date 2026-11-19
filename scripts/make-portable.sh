#!/bin/sh
# Merakit folder distribusi portable dari hasil `npm run tauri build`.
# Hanya menyalin artefak pengguna (.app, .dmg, panduan, info versi) —
# tidak ada source code, node_modules, atau folder target Rust.
#
# Pemakaian: sh scripts/make-portable.sh [label-arsitektur]   (default: intel)
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ARCH_LABEL=${1:-intel}
BUNDLE="$ROOT/src-tauri/target/release/bundle"
APP="$BUNDLE/macos/Laptop Health Check.app"
DMG=$(ls "$BUNDLE"/dmg/*.dmg 2>/dev/null | head -n 1 || true)
VERSION=$(/usr/bin/plutil -extract CFBundleShortVersionString raw "$APP/Contents/Info.plist")
MIN_OS=$(/usr/bin/plutil -extract LSMinimumSystemVersion raw "$APP/Contents/Info.plist" 2>/dev/null || echo "tidak ditetapkan")
OUT="$ROOT/portable/LaptopHealthCheck-PortableBeta-$VERSION-$ARCH_LABEL"

[ -d "$APP" ] || { echo "Build .app tidak ditemukan: $APP" >&2; exit 1; }
if [ -e "$OUT" ]; then
  echo "Folder sudah ada, tidak ditimpa: $OUT" >&2
  exit 1
fi
mkdir -p "$OUT"

# ditto mempertahankan tanda tangan kode dan atribut bundle.
/usr/bin/ditto "$APP" "$OUT/Laptop Health Check.app"
if [ -n "$DMG" ]; then
  /bin/cp "$DMG" "$OUT/LaptopHealthCheck-$VERSION-$ARCH_LABEL.dmg"
fi
/bin/cp "$ROOT/packaging/portable/BACA-SAYA.txt" "$OUT/BACA-SAYA.txt"

ARCHS=$(/usr/bin/lipo -archs "$OUT/Laptop Health Check.app/Contents/MacOS/laptop-health-check")
{
  echo "Laptop Health Check — Portable Beta"
  echo "Versi aplikasi      : $VERSION"
  echo "Arsitektur biner    : $ARCHS"
  echo "macOS minimum       : $MIN_OS menurut Info.plist (yang benar-benar diuji hanya versi di baris Dibuat)"
  echo "Dibuat              : $(date '+%Y-%m-%d %H:%M %Z') di $(/usr/sbin/sysctl -n hw.model), macOS $(/usr/bin/sw_vers -productVersion)"
  echo "Basis kode          : $(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet HEAD -- src src-tauri || echo ' + perubahan lokal belum di-commit')"
  echo "Penandatanganan     : $(/usr/bin/codesign -dv "$OUT/Laptop Health Check.app" 2>&1 | grep -E '^Signature=' || echo 'tidak ada')"
  echo "Notarisasi Apple    : belum"
  echo
  echo "SHA-256:"
  cd "$OUT"
  [ -n "$DMG" ] && /usr/bin/shasum -a 256 "LaptopHealthCheck-$VERSION-$ARCH_LABEL.dmg"
  /usr/bin/shasum -a 256 "Laptop Health Check.app/Contents/MacOS/laptop-health-check"
} > "$OUT/VERSI.txt"

echo "Paket portable: $OUT"
ls -la "$OUT"
