@echo off
chcp 65001 > nul
echo ========================================================
echo  [AlphaShorts] 24/7 완전 무인 자율 팩토리 백그라운드 시작
echo  - 비용: 100%% 완전 무료 (Gemini Free Tier + Edge-TTS)
echo  - 사용자 확인 클릭: 0회 (완전 자동)
echo ========================================================

cd /d "c:\ethan\git\ethan_agent"
start "" /b npx ts-node autonomous_daemon.ts > daemon.log 2>&1

echo.
echo ✅ 백그라운드에서 무인 데몬이 정상 실행되었습니다!
echo 💡 로그 확인: c:\ethan\git\ethan_agent\daemon.log
echo 💡 종료 방법: STOP_AUTONOMOUS_FACTORY.bat 실행
echo.
pause
