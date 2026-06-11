@echo off
cd /d "%~dp0"
git add .
git commit -m "update"
git push
echo.
echo === デプロイ完了！Vercelが自動更新します ===
pause