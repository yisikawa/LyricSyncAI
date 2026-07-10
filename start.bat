@echo off
chcp 65001 > nul
setlocal

set LAN_IP=192.168.111.10

echo [LyricSyncAI] Starting...

echo [1/2] Starting backend (port 8001, HTTPS)...
start /b cmd /c "cd /d %~dp0backend && call .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --ssl-keyfile %~dp0certs\key.pem --ssl-certfile %~dp0certs\cert.pem"

timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting frontend (HTTPS)...
echo Ctrl+C stops the frontend only. Run stop.bat to stop all services.
echo.
echo iOS access: https://%LAN_IP%:5150
echo.

cd /d %~dp0frontend
npm run dev
