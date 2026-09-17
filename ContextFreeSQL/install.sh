#!/bin/sh
# ContextFreeSQL installer for Linux and macOS.
#
#   curl -LsSf https://github.com/JonathanScion/jonathan-code/releases/latest/download/install.sh | sh
#
# Downloads the binary from the GitHub release, checks it against SHA256SUMS, and installs it.
# Everything is fetched from github.com, so no extra domain has to be allowed through a corporate proxy.
#
# Environment variables:
#   CFS_VERSION       version to install, e.g. v0.4.0 (default: the latest release)
#   CFS_INSTALL_DIR   where to put the binary (default: ~/.local/bin, or /usr/local/bin when running as root)
#   CFS_BASE_URL      download from somewhere else, e.g. an internal mirror holding the release files
#   CFS_NO_VERIFY     set to 1 to skip the checksum check (not recommended)
#   CFS_DRY_RUN       set to 1 to print what would happen and exit
#
# No Python needed: the binary bundles it.

set -eu

REPO="JonathanScion/jonathan-code"
BIN_NAME="contextfreesql"

say() { printf '%s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ---- what are we running on -------------------------------------------------
os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
    Linux)
        case "$arch" in
            x86_64 | amd64) asset="contextfreesql-linux" ;;
            *) err "no prebuilt binary for Linux $arch. Run from source instead: https://github.com/$REPO/tree/main/ContextFreeSQL#install-and-run" ;;
        esac
        ;;
    Darwin)
        case "$arch" in
            arm64 | x86_64) asset="contextfreesql-macos" ;;
            *) err "no prebuilt binary for macOS $arch" ;;
        esac
        ;;
    *)
        err "unsupported system: $os. On Windows use contextfreesql.exe from https://github.com/$REPO/releases/latest"
        ;;
esac

# ---- how to download --------------------------------------------------------
if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fLsS "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -qO "$2" "$1"; }
else
    err "need curl or wget"
fi

# ---- where it goes ----------------------------------------------------------
if [ -n "${CFS_INSTALL_DIR:-}" ]; then
    install_dir="$CFS_INSTALL_DIR"
elif [ "$(id -u)" = "0" ]; then
    install_dir="/usr/local/bin"
else
    install_dir="$HOME/.local/bin"
fi

version="${CFS_VERSION:-latest}"
if [ -n "${CFS_BASE_URL:-}" ]; then
    base_url="${CFS_BASE_URL%/}"
elif [ "$version" = "latest" ]; then
    base_url="https://github.com/$REPO/releases/latest/download"
else
    base_url="https://github.com/$REPO/releases/download/$version"
fi

say "ContextFreeSQL installer"
say "  system:  $os $arch ($asset)"
say "  release: $version"
say "  target:  $install_dir/$BIN_NAME"

if [ "${CFS_DRY_RUN:-0}" = "1" ]; then
    say ""
    say "dry run, nothing downloaded. URL would be: $base_url/$asset"
    exit 0
fi

# ---- download, verify, install ---------------------------------------------
tmp="$(mktemp -d)"
# shellcheck disable=SC2064
trap "rm -rf '$tmp'" EXIT INT TERM

say ""
say "Downloading $base_url/$asset ..."
fetch "$base_url/$asset" "$tmp/$asset" || err "download failed. If your network blocks this, download the binary manually from https://github.com/$REPO/releases"

if [ "${CFS_NO_VERIFY:-0}" = "1" ]; then
    say "Skipping checksum check (CFS_NO_VERIFY=1)"
elif fetch "$base_url/SHA256SUMS" "$tmp/SHA256SUMS" 2>/dev/null; then
    expected="$(awk -v a="$asset" '$2 == a || $2 == "*" a {print $1}' "$tmp/SHA256SUMS" | head -n 1)"
    if [ -z "$expected" ]; then
        say "warning: $asset is not listed in SHA256SUMS, skipping the check"
    else
        if command -v sha256sum >/dev/null 2>&1; then
            actual="$(sha256sum "$tmp/$asset" | awk '{print $1}')"
        elif command -v shasum >/dev/null 2>&1; then
            actual="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
        else
            actual=""
            say "warning: no sha256sum or shasum available, skipping the check"
        fi
        if [ -n "$actual" ]; then
            [ "$actual" = "$expected" ] || err "checksum mismatch for $asset (expected $expected, got $actual). Not installing."
            say "Checksum OK"
        fi
    fi
else
    say "warning: no SHA256SUMS in this release, skipping the check"
fi

mkdir -p "$install_dir" || err "cannot create $install_dir"
chmod +x "$tmp/$asset"
mv -f "$tmp/$asset" "$install_dir/$BIN_NAME" 2>/dev/null ||
    err "cannot write to $install_dir. Re-run with CFS_INSTALL_DIR=<a writable folder>, or with sudo."

say "Installed $("$install_dir/$BIN_NAME" --version 2>/dev/null || echo "$BIN_NAME") to $install_dir"

# ---- is it on PATH? ---------------------------------------------------------
case ":$PATH:" in
    *":$install_dir:"*)
        say ""
        say "Run it with:  $BIN_NAME --help"
        ;;
    *)
        say ""
        say "$install_dir is not on your PATH. Add it:"
        say "  echo 'export PATH=\"$install_dir:\$PATH\"' >> ~/.profile && . ~/.profile"
        say "Or run it directly:  $install_dir/$BIN_NAME --help"
        ;;
esac
