@echo off
chcp 65001 > nul
setlocal

echo [LyricSyncAI] Starting...

echo [1/2] Starting backend (port 8001, HTTPS)...
start /b cmd /c "cd /d %~dp0backend && call .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --ssl-keyfile %~dp0certs\key.pem --ssl-certfile %~dp0certs\cert.pem"

timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting frontend (HTTPS)...
echo Press Ctrl+C to stop all services.
echo.
echo iOS access: https://192.168.111.10:5150
echo.

cd /d %~dp0frontend
npm run dev
