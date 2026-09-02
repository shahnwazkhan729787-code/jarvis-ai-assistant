@echo off
title JARVIS AI Assistant (HTTPS Mode)
echo ===================================================
echo   STARTING JARVIS WITH SECURE HTTPS CLOUDFLARE LINK
echo ===================================================
echo.
cd /d "%~dp0"

echo [1/2] Starting Local Server...
start "" python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000

echo [2/2] Starting Secure HTTPS Tunnel...
timeout /t 3 >nul
.\cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
