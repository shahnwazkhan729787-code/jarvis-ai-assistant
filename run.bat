@echo off
title JARVIS AI Assistant
echo ===================================================
echo        STARTING JARVIS PERSONAL AI ASSISTANT
echo ===================================================
echo.
cd /d "%~dp0"

echo [1/3] Checking requirements...
python -m pip install -r requirements.txt --quiet

echo [2/3] Starting Backend Server...
start "" http://127.0.0.1:8000

echo [3/3] Running Server on http://127.0.0.1:8000
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
pause
