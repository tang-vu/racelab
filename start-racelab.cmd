@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24.15 or later LTS, then run this file again.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(!((major===24&&minor>=15)||major>=26))process.exit(1)"
if errorlevel 1 (
  echo RaceLab needs Node.js 24.15 or later LTS, or Node.js 26+.
  pause
  exit /b 1
)
if not exist "node_modules\quickjs-emscripten\package.json" (
  call npm.cmd ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
if "%~1"=="--check" exit /b 0
echo.
echo RaceLab: http://127.0.0.1:4174/
echo Local experiments and recorded replay need no API key.
echo Existing configuration and accounting are preserved.
echo Keep this window open. Ctrl+C stops the local server.
echo.
node server.mjs
if errorlevel 1 pause
