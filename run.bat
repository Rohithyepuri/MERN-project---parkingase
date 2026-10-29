@echo off
title ParkEase Launcher
echo ========================================================
echo   Starting ParkEase (Backend + Frontend)
echo ========================================================

:: Check if server .env exists
if not exist "%~dp0server\.env" (
    echo [INFO] Creating server\.env from .env.example...
    copy "%~dp0server\.env.example" "%~dp0server\.env" >nul
)

:: Check if node_modules exist
if not exist "%~dp0server\node_modules" (
    echo [SETUP] Installing server dependencies...
    start /wait cmd /c "cd /d "%~dp0server" && npm install"
)

if not exist "%~dp0client\node_modules" (
    echo [SETUP] Installing client dependencies...
    start /wait cmd /c "cd /d "%~dp0client" && npm install"
)

echo.
echo [1/2] Launching Backend Server on port 5000...
start "ParkEase API (Port 5000)" cmd /k "cd /d "%~dp0server" && npm run dev"

echo [2/2] Launching Frontend Web Client on port 5173...
start "ParkEase Web (Port 5173)" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo ========================================================
echo   ParkEase is running!
echo   Web App : http://localhost:5173
echo   API     : http://localhost:5000/api
echo.
echo   Demo Logins:
echo     Admin:    admin@parkease.dev  / Admin@123
echo     Staff:    staff@parkease.dev  / Staff@123
echo     Customer: user@parkease.dev   / User@123
echo ========================================================
pause
