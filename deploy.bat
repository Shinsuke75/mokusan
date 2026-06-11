@echo off
cd /d "%~dp0"
git add .
git commit -m "update"
git push
echo.
echo === Deploy complete! Vercel will update automatically ===
pause