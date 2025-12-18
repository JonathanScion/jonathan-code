# Building ContextFreeSQL as a Distributable Product

This document covers how to package ContextFreeSQL as a standalone executable for distribution.

## Overview

We use **PyInstaller** to bundle Python code, dependencies, and data files into a single executable. Users don't need Python installed.

## Build Output

| Build on | Produces | Works on |
|----------|----------|----------|
| Windows | `contextfreesql.exe` | Windows only |
| macOS | `contextfreesql` (no extension) | macOS only |
| Linux | `contextfreesql` (no extension) | Linux only |

**Important:** PyInstaller cannot cross-compile. You must build on each target OS.

## Files Created for Building

| File | Purpose |
|------|---------|
| `dist/contextfreesql.exe` | The executable (~37.5 MB) |
| `contextfreesql.spec` | PyInstaller configuration |
| `config.sample.json` | Sample config for users |
| `build.bat` | Convenience build script (Windows) |
| `src/utils/resources.py` | Helper for finding bundled files at runtime |

## Bundled Template Files

These HTML/JS files are embedded inside the executable:
- `db_compare_template.html`
- `code_diff_template.html`
- `csv_compare_standalone.html`
- `data_compare.html`
- `database_report.html`
- `data_compare_script.js`

## Building on Windows

### Prerequisites
```cmd
# Activate virtual environment
venv\Scripts\activate

# Install PyInstaller (if not already installed)
pip install pyinstaller
```

### Build Command
```cmd
# Option 1: Use the build script
build.bat

# Option 2: Manual command
pyinstaller contextfreesql.spec --clean
```

### Output
The executable is created at: `dist/contextfreesql.exe`

## Building for All Platforms

### Option 1: GitHub Actions (Recommended)

Set up automated builds for Windows, macOS, and Linux using GitHub Actions. GitHub provides free runners for all three platforms.

A workflow would:
1. Trigger on release tags (e.g., `v1.0.0`)
2. Build on all three OS runners in parallel
3. Upload artifacts to GitHub Releases

Produces:
- `contextfreesql-windows.exe`
- `contextfreesql-macos`
- `contextfreesql-linux`

### Option 2: Manual Builds

Build on each target OS separately:
- Windows machine/VM for Windows build
- macOS machine for macOS build
- Linux machine/VM/Docker for Linux build

### Option 3: Docker for Linux

You can build the Linux version from Windows using Docker with a Linux image.

## Distribution Package

### Option 1: Single File Download
```
contextfreesql.exe    (the executable)
config.json           (user creates from config.sample.json)
```

### Option 2: ZIP Package
```
ContextFreeSQL/
  contextfreesql.exe
  config.sample.json  (user renames to config.json)
  README.txt          (usage instructions)
```

## How Users Run It

```cmd
# With config.json in same directory as executable
contextfreesql.exe

# With custom config path
contextfreesql.exe path\to\myconfig.json
```

## Source Code Protection

PyInstaller bundles Python bytecode which can be extracted and decompiled. Options for better protection:

1. **PyArmor + PyInstaller** - Obfuscates bytecode (~$50-100 license)
2. **Nuitka** - Compiles to native C code (harder to reverse-engineer)
3. **Cython** - Convert critical modules to C extensions

For most commercial tools, the competitive advantage is expertise, support, and updates rather than the code itself.

## Technical Details

### Resource Path Handling

When running as a PyInstaller bundle, data files are extracted to a temp directory. The `src/utils/resources.py` module handles finding these files:

```python
from src.utils.resources import get_template_path, is_bundled

# Works both from source and bundled executable
template = get_template_path('db_compare_template.html')
```

### Spec File Configuration

The `contextfreesql.spec` file defines:
- Entry point: `src/main.py`
- Data files to bundle (templates, config)
- Hidden imports (packages PyInstaller might miss)
- Exclusions (dev-only packages like mypy, pytest)

## Troubleshooting

### Missing modules at runtime
Add to `hiddenimports` in the spec file:
```python
hiddenimports = [
    'missing_module_name',
]
```

### Template files not found
Ensure paths in spec file `datas` list are correct and files exist.

### Large executable size
The ~37 MB size is normal due to pandas and numpy. To reduce:
- Use `upx=True` in spec (requires UPX installed)
- Exclude unused packages in `excludes` list
