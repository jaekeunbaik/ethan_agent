@echo off
chcp 65001 > nul
echo ========================================================
echo  [AlphaShorts] 무인 자율 팩토리 백그라운드 종료
echo ========================================================

taskkill /f /im node.exe > nul 2>&1

echo.
echo 🛑 백그라운드 무인 데몬이 안전하게 종료되었습니다.
echo.
pause
