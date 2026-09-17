@echo off
REM Build script for ContextFreeSQL
REM The version is set in src\version.py - bump it before building a release

REM Activate virtual environment
call venv\Scripts\activate

for /f %%v in ('python -c "from src.version import __version__; print(__version__)"') do set CFS_VERSION=%%v
echo Building ContextFreeSQL %CFS_VERSION% executable...
echo   (version comes from src\version.py - bump it there for a new release)
echo.

REM Run PyInstaller
pyinstaller contextfreesql.spec --clean

echo.
if exist dist\contextfreesql.exe (
    echo Build successful!
    echo Executable: dist\contextfreesql.exe
    dist\contextfreesql.exe --version
    echo.
    echo To distribute:
    echo   1. Copy dist\contextfreesql.exe
    echo   2. Copy config.sample.json (rename to config.json for users)
    echo.
) else (
    echo Build failed! Check errors above.
)

pause
