@echo off
chcp 65001 > nul
echo [LyricSyncAI] Stopping services...

echo Stopping backend (port 8001)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo Stopping frontend (port 5150)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5150 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo Done.
pause
