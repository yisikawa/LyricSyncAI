@echo off
chcp 65001 > nul
setlocal

echo [LyricSyncAI] 起動中...

:: バックエンドをバックグラウンド（同じウィンドウ）で起動
echo [1/2] バックエンドを起動しています (ポート 8001)...
start /b cmd /c "cd /d %~dp0backend && .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001"

:: バックエンドの起動待ち
timeout /t 5 /nobreak > nul

:: フロントエンドを同じウィンドウで起動
echo.
echo [2/2] フロントエンドを起動しています...
echo アプリケーションを終了するには Ctrl+C を押してください（バックエンドも終了します）...
echo.

cd /d %~dp0frontend
npm run dev
