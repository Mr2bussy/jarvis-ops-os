@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  JARVIS Operations OS — launcher
REM
REM  Desktop shortcut runs this via JARVIS-Launch.vbs (hidden console).
REM  Uses the built renderer (dist/) + compiled main (dist-electron/) so the
REM  window opens reliably without waiting on a dev-server transform pipeline.
REM  For hot reload during development, run:  pnpm run dev
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [JARVIS] pnpm not found on PATH.
    echo [JARVIS] Install it with:  npm install -g pnpm
    pause
    exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo [JARVIS] Dependencies missing. Running pnpm install...
    call pnpm install
    if errorlevel 1 (
        echo [JARVIS] pnpm install failed.
        pause
        exit /b 1
    )
)

if not exist "node_modules\electron\dist\electron.exe" (
    echo [JARVIS] Electron binary missing — running postinstall...
    call node node_modules\electron\install.js
    if errorlevel 1 (
        echo [JARVIS] Electron install failed.
        pause
        exit /b 1
    )
)

if not exist "dist\index.html" (
    echo [JARVIS] Renderer build missing — running vite build...
    call pnpm run build
    if errorlevel 1 (
        echo [JARVIS] Build failed.
        pause
        exit /b 1
    )
)

if not exist "dist-electron\main.js" (
    echo [JARVIS] Main process missing — compiling electron...
    call pnpm exec tsc -p electron/tsconfig.json
    if errorlevel 1 (
        echo [JARVIS] TypeScript compile failed.
        pause
        exit /b 1
    )
)

echo [JARVIS] Starting Operations OS...
set NODE_ENV=production
call pnpm exec electron .
