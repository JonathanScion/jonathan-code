# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for ContextFreeSQL

Build commands:
    Single executable (slower startup, simpler distribution):
        pyinstaller contextfreesql.spec

    Directory mode (faster startup, more files):
        pyinstaller contextfreesql.spec --onedir

The executable will be created in the 'dist' folder.
"""

import os

block_cipher = None

# Get the project root directory
PROJECT_ROOT = os.path.dirname(os.path.abspath(SPEC))

# Data files to include: (source, destination_folder)
# destination_folder is relative to the bundle root
datas = [
    # HTML templates
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'db_compare_template.html'), 'templates'),
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'code_diff_template.html'), 'templates'),
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'csv_compare_standalone.html'), 'templates'),
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'data_compare.html'), 'templates'),
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'database_report.html'), 'templates'),
    # JavaScript for templates
    (os.path.join(PROJECT_ROOT, 'src', 'templates', 'data_compare_script.js'), 'templates'),
    # Default config file (users can override with their own)
    (os.path.join(PROJECT_ROOT, 'src', 'config.json'), '.'),
]

# Hidden imports that PyInstaller might miss
hiddenimports = [
    'psycopg2',
    'psycopg2._psycopg',
    'pandas',
    'numpy',
    'sqlparse',
    'sqlglot',
    'pydantic',
    'dacite',
    'networkx',
]

a = Analysis(
    [os.path.join(PROJECT_ROOT, 'src', 'main.py')],
    pathex=[PROJECT_ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude development-only packages to reduce size
        'mypy',
        'pandas-stubs',
        'pytest',
        'pip',
        'setuptools',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='contextfreesql',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,  # Compress executable (requires UPX installed)
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Show console window (needed for output)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='icon.ico',  # Uncomment and provide icon if desired
)
