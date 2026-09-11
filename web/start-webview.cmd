@echo off
setlocal
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install the current Node.js LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

cd /d "%~dp0"
if not exist node_modules (
  echo Installing the web prototype dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting ParallaxView at http://127.0.0.1:5173
call npm run dev
