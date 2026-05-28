@echo off
chcp 65001 > nul
setlocal

echo [LyricSyncAI] 起動中...

:: バックエンドをバックグラウンド（同じウィンドウ）で起動 (HTTPS)
echo [1/2] バックエンドを起動しています (ポート 8001, HTTPS)...
start /b cmd /c "cd /d %~dp0backend && .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --ssl-keyfile ..\certs\key.pem --ssl-certfile ..\certs\cert.pem"

:: バックエンドの起動待ち
timeout /t 5 /nobreak > nul

:: フロントエンドを同じウィンドウで起動 (HTTPS)
echo.
echo [2/2] フロントエンドを起動しています (HTTPS)...
echo アプリケーションを終了するには Ctrl+C を押してください（バックエンドも終了します）...
echo.
echo iOS端末からアクセス: https://192.168.111.10:5150
echo.

cd /d %~dp0frontend
npm run dev
