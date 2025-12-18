@echo off
REM Build script for ContextFreeSQL

echo Building ContextFreeSQL executable...
echo.

REM Activate virtual environment
call venv\Scripts\activate

REM Run PyInstaller
pyinstaller contextfreesql.spec --clean

echo.
if exist dist\contextfreesql.exe (
    echo Build successful!
    echo Executable: dist\contextfreesql.exe
    echo.
    echo To distribute:
    echo   1. Copy dist\contextfreesql.exe
    echo   2. Copy config.sample.json (rename to config.json for users)
    echo.
) else (
    echo Build failed! Check errors above.
)

pause
