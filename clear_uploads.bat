@echo off
chcp 65001 > nul
echo backend\uploads フォルダをクリアしています...

set "UPLOADS_DIR=%~dp0backend\uploads"

if exist "%UPLOADS_DIR%" (
    rem ファイルをすべて削除
    del /q /s "%UPLOADS_DIR%\*" > nul 2>&1
    
    rem サブフォルダをすべて削除
    for /d %%x in ("%UPLOADS_DIR%\*") do rd /s /q "%%x" > nul 2>&1
    
    echo クリアが完了しました。
) else (
    echo %UPLOADS_DIR% が見つかりません。
)

pause
