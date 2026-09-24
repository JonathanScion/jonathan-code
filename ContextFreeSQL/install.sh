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
#   CFS_FORCE         set to 1 to download and reinstall even if the version already installed is current
#
# No Python needed: the binary bundles it.

set -eu

REPO="JonathanScion/jonathan-code"
BIN_NAME="contextfreesql"

say() { printf '%s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; exit 1; }

# Compare two versions field by field: 0 they match, 1 the first is newer, 2 the second is newer.
# Leading 'v' and anything that is not a digit are ignored, so v0.5.0 and 0.5.0-rc1 both read as 0 5 0.
# Call it as: version_cmp a b && r=0 || r=$?   - it returns non-zero by design, which set -e would
# otherwise treat as a failure.
version_cmp() {
    _a="${1#v}"
    _b="${2#v}"
    _i=1
    while [ "$_i" -le 3 ]; do
        _fa="$(printf '%s' "$_a" | cut -d. -f"$_i" | tr -dc '0-9')"
        _fb="$(printf '%s' "$_b" | cut -d. -f"$_i" | tr -dc '0-9')"
        [ -n "$_fa" ] || _fa=0
        [ -n "$_fb" ] || _fb=0
        [ "$_fa" -gt "$_fb" ] && return 1
        [ "$_fa" -lt "$_fb" ] && return 2
        _i=$((_i + 1))
    done
    return 0
}

# The tag of the newest release, without asking the API: /releases/latest redirects to /releases/tag/vX.Y.Z,
# so the redirect itself carries the answer. Still only github.com, and no API rate limit to run into.
# Prints nothing if it cannot tell, and the caller then just installs.
resolve_latest_tag() {
    _url="https://github.com/$REPO/releases/latest"
    if command -v curl >/dev/null 2>&1; then
        _final="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$_url" 2>/dev/null || true)"
    else
        _final="$(wget -q --max-redirect=0 -S -O /dev/null "$_url" 2>&1 |
                  sed -n 's/^[[:space:]]*Location:[[:space:]]*//p' | tr -d '\r' | head -n 1)"
    fi
    case "$_final" in
        */releases/tag/*) printf '%s\n' "${_final##*/tag/}" ;;
        *) : ;;
    esac
}

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

# ---- what is already here ---------------------------------------------------
# The one about to be replaced, or failing that whatever `contextfreesql` currently runs
if [ -x "$install_dir/$BIN_NAME" ]; then
    installed_bin="$install_dir/$BIN_NAME"
elif command -v "$BIN_NAME" >/dev/null 2>&1; then
    installed_bin="$(command -v "$BIN_NAME")"
else
    installed_bin=""
fi

installed_version=""
if [ -n "$installed_bin" ]; then
    # `contextfreesql --version` prints 'contextfreesql 0.5.0'
    installed_version="$("$installed_bin" --version 2>/dev/null | awk 'NR == 1 {print $NF}')"
fi

say "ContextFreeSQL installer"
say "  system:  $os $arch ($asset)"
say "  release: $version"
if [ -n "$installed_version" ]; then
    say "  have:    $installed_version at $installed_bin"
fi
say "  target:  $install_dir/$BIN_NAME"

# ---- is there anything to do? -----------------------------------------------
# Only worth asking when something is installed already. A mirror is not asked which release is newest,
# since only github.com answers that; name the version with CFS_VERSION to compare against a mirror.
target_version=""
if [ -n "$installed_version" ] && [ "${CFS_FORCE:-0}" != "1" ]; then
    if [ "$version" != "latest" ]; then
        target_version="$version"
    elif [ -z "${CFS_BASE_URL:-}" ]; then
        target_version="$(resolve_latest_tag)"
    fi
fi

if [ -n "$target_version" ]; then
    version_cmp "$installed_version" "$target_version" && cmp_result=0 || cmp_result=$?
    if [ "$cmp_result" -eq 0 ] || { [ "$cmp_result" -eq 1 ] && [ "$version" = "latest" ]; }; then
        say ""
        if [ "$cmp_result" -eq 1 ]; then
            say "$installed_version is newer than the latest release (${target_version#v}). Nothing to do."
        else
            say "${installed_version} is already the current release. Nothing to do."
        fi
        say "Reinstall it anyway with:  CFS_FORCE=1"
        exit 0
    fi
    say ""
    say "Updating ${installed_version} -> ${target_version#v}"
    # A named version is fetched from its own tag, so the comparison and the download agree
    if [ "$version" = "latest" ] && [ -z "${CFS_BASE_URL:-}" ]; then
        base_url="https://github.com/$REPO/releases/download/$target_version"
    fi
fi

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
